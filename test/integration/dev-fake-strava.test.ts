import { createMessageBatch, env } from "cloudflare:test";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	type MockInstance,
	vi,
} from "vitest";
import { SAMPLE_RIDERS } from "../../dev/fake-strava/samples";
import {
	type DevEnv,
	devFetch,
	devQueue,
	removeStravaInterceptor,
} from "../../dev/worker";
import { CONSENT_VERSION } from "../../src/consent";
import {
	cookiePair,
	makeCtx,
	resetDb,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { NOW } from "../support/fixtures";

// Fake mode end to end (specs/006-local-frontend-dev research R10): the first
// request seeds the sample riders through the app's real connect flow, the
// queue imports and evaluates their rides, and /me shows what the app's rules
// make of them. Nothing reaches the network: test/setup.ts's deny-all fetch
// stays underneath the dev entry's interceptor and fails the test otherwise.

const LOCAL = "http://localhost:8789";
const TINA = 990004;
const ALL_SCOPES = [
	"read",
	"activity:read",
	"activity:read_all",
	"activity:write",
];

let ctx: TestCtx;
let logs: string[];
let logSpy: MockInstance<typeof console.log>;

function devCtx(): TestCtx {
	const devEnv: DevEnv = { ...env, RYNKE_FAKE_STRAVA: "local-only" };
	return { ...makeCtx(), env: devEnv };
}

function rider(athleteId: number) {
	const found = SAMPLE_RIDERS.find((r) => r.athleteId === athleteId);
	if (!found) throw new Error(`no sample rider ${athleteId}`);
	return found;
}

function get(path: string, cookies: Record<string, string> = {}) {
	const cookie = Object.entries(cookies)
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");
	return devFetch(
		new Request(path.startsWith("http") ? path : `${LOCAL}${path}`, {
			headers: cookie ? { Cookie: cookie } : {},
		}),
		ctx,
	);
}

function post(path: string, form: [string, string][]) {
	return devFetch(
		new Request(`${LOCAL}${path}`, {
			method: "POST",
			headers: {
				Origin: LOCAL,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: new URLSearchParams(form).toString(),
		}),
		ctx,
	);
}

/**
 * Runs the queued messages through the dev entry until none are ready.
 * Delayed ones (a 429 defers the import) stay queued, unprocessed.
 */
async function drain() {
	for (let round = 0; round < 50; round++) {
		const ready = ctx.queue.sent.filter((m) => m.delaySeconds === undefined);
		if (ready.length === 0) return;
		const delayed = ctx.queue.sent.filter((m) => m.delaySeconds !== undefined);
		ctx.queue.sent.splice(0, ctx.queue.sent.length, ...delayed);
		const batch = createMessageBatch(
			"rynke-points-work",
			ready.map((m, i) => ({
				id: `m${round}-${i}`,
				timestamp: new Date(NOW * 1000),
				attempts: 1,
				body: m.body,
			})),
		);
		await devQueue(batch, ctx);
	}
	throw new Error("the queue didn't drain in 50 rounds");
}

async function rateLimitRow() {
	return env.DB.prepare("SELECT * FROM strava_rate_limit").first();
}

async function count(sql: string, ...params: unknown[]): Promise<number> {
	return (
		(await env.DB.prepare(sql)
			.bind(...params)
			.first<number>("n")) ?? 0
	);
}

async function mePage(athleteId: number): Promise<string> {
	const res = await get("/me", await sessionCookie(ctx, athleteId));
	expect(res.status).toBe(200);
	return res.text();
}

beforeEach(async () => {
	await resetDb();
	// No fake table: the first request seeds.
	await env.DB.prepare("DROP TABLE IF EXISTS fake_strava_activities").run();
	logs = [];
	logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
		logs.push(args.join(" "));
	});
	ctx = devCtx();
});

afterEach(() => {
	logSpy.mockRestore();
	removeStravaInterceptor();
	// No token, code or secret ever reaches a log line.
	for (const line of logs) {
		expect(line).not.toMatch(/fake-(access|refresh|code)\./);
	}
});

describe("seeding (FR-005, FR-012)", () => {
	it("connects the sample riders and shows Tina TrainingDone's rides", async () => {
		const before = await rateLimitRow();
		const index = await get("/_dev/");
		expect(index.status).toBe(200);
		expect(await index.text()).toContain("Tina TrainingDone");

		expect(
			await count(
				"SELECT COUNT(*) AS n FROM riders WHERE athlete_id = ?",
				TINA,
			),
		).toBe(1);
		expect(
			await count(
				"SELECT COUNT(*) AS n FROM consent_records WHERE athlete_id = ?",
				TINA,
			),
		).toBe(1);
		expect(
			await count(
				"SELECT COUNT(*) AS n FROM fake_strava_activities WHERE athlete_id = ?",
				TINA,
			),
		).toBe(rider(TINA).rides.length);

		await drain();
		const page = await mePage(TINA);
		expect(page).toContain("erreicht ✓");
		expect(page).toContain("Noch nicht dabei");
		expect(page.match(/<tr class="ride /g)).toHaveLength(20);

		// FR-006, SC-002: fake answers never touch the request budget.
		expect(await rateLimitRow()).toEqual(before);
	});
});

describe("connect flow (FR-008)", () => {
	async function startConnect() {
		const res = await post("/connect", [["consent", String(CONSENT_VERSION)]]);
		expect(res.status).toBe(302);
		const location = res.headers.get("Location") ?? "";
		expect(location).toMatch(/^\/_dev\/strava\/oauth\/authorize\?/);
		const query = new URL(location, LOCAL).searchParams;
		expect(query.get("client_id")).toBe(env.STRAVA_CLIENT_ID);
		expect(query.get("redirect_uri")).toBe(`${LOCAL}/auth/callback`);
		const stateCookie = cookiePair(res.headers.get("Set-Cookie") ?? "");
		return { location, query, stateCookie };
	}

	function decide(query: URLSearchParams, extra: [string, string][]) {
		return post("/_dev/strava/oauth/authorize", [
			["redirect_uri", query.get("redirect_uri") ?? ""],
			["state", query.get("state") ?? ""],
			...extra,
		]);
	}

	it("signs in through the stand-in screen", async () => {
		const { location, query, stateCookie } = await startConnect();

		const screen = await get(location);
		expect(screen.status).toBe(200);
		expect(await screen.text()).toContain("Tina TrainingDone");

		const wrongClient = new URL(location, LOCAL);
		wrongClient.searchParams.set("client_id", "424242");
		expect((await get(wrongClient.href)).status).toBe(400);

		const authorized = await decide(query, [
			["athlete", String(TINA)],
			...ALL_SCOPES.map((s): [string, string] => ["scope", s]),
			["action", "authorize"],
		]);
		expect(authorized.status).toBe(302);
		const callback = new URL(authorized.headers.get("Location") ?? "");
		expect(`${callback.origin}${callback.pathname}`).toBe(
			`${LOCAL}/auth/callback`,
		);
		expect(callback.searchParams.get("state")).toBe(query.get("state"));
		expect(callback.searchParams.get("code")).toMatch(/^fake-code\.990004\./);
		expect(callback.searchParams.get("scope")).toBe(ALL_SCOPES.join(","));

		const landed = await get(callback.href, stateCookie);
		expect(landed.status).toBe(302);
		expect(landed.headers.get("Location")).toBe("/me");
		expect(landed.headers.getSetCookie().join("\n")).toMatch(/rp_session=\w/);
	});

	it("cancels like Strava does", async () => {
		const { query } = await startConnect();
		const cancelled = await decide(query, [
			["athlete", String(TINA)],
			["action", "cancel"],
		]);
		expect(cancelled.status).toBe(302);
		const callback = new URL(cancelled.headers.get("Location") ?? "");
		expect(callback.searchParams.get("error")).toBe("access_denied");
		expect(callback.searchParams.get("state")).toBe(query.get("state"));
		expect(callback.searchParams.has("code")).toBe(false);
	});
});

describe("requests the fake has no answer for (FR-010)", () => {
	it("answers 404 and logs them", async () => {
		await get("/health");
		const res = await fetch("https://www.strava.com/api/v3/segments/1");
		expect(res.status).toBe(404);
		expect(logs).toContain("[fake-strava] UNANSWERED GET /api/v3/segments/1");
	});
});
