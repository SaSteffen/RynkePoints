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
import { clearSessionCookie } from "../../src/http/session";
import {
	cookiePair,
	makeCtx,
	resetDb,
	sessionCookie,
	type TestCtx,
	tableCounts,
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
	// No fake tables: the first request seeds.
	await env.DB.batch([
		env.DB.prepare("DROP TABLE IF EXISTS fake_strava_activities"),
		env.DB.prepare("DROP TABLE IF EXISTS fake_strava_seed"),
	]);
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

describe("seeding again", () => {
	const fakeRides = () =>
		count("SELECT COUNT(*) AS n FROM fake_strava_activities");
	const allRides = SAMPLE_RIDERS.reduce((n, r) => n + r.rides.length, 0);

	it("leaves a database seeded from the current sample data alone", async () => {
		await get("/_dev/");
		await env.DB.prepare("DELETE FROM fake_strava_activities").run();
		await get("/_dev/");
		expect(await fakeRides()).toBe(0);
	});

	it("seeds again when the database holds older sample data", async () => {
		await get("/_dev/");
		// As seeded by older samples: only Tina TrainingDone had rides.
		await env.DB.batch([
			env.DB.prepare(
				"DELETE FROM fake_strava_activities WHERE athlete_id <> ?",
			).bind(TINA),
			env.DB.prepare("UPDATE fake_strava_seed SET fingerprint = 'older'"),
		]);
		await get("/_dev/");
		expect(await fakeRides()).toBe(allRides);
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

describe("sample riders in every state (US2)", () => {
	const IDA = 990001;
	const NORA = 990002;
	const FIONA = 990003;
	const VERA = 990005;
	const REX = 990006;
	const PAULA = 990007;
	const OLLI = 990008;
	const REMY = 990009;
	const NOAH = 990010;

	async function seeded() {
		expect((await get("/_dev/")).status).toBe(200);
		await drain();
	}

	async function riderRow(athleteId: number) {
		return env.DB.prepare(
			"SELECT status, import_status, scope_read_all FROM riders WHERE athlete_id = ?",
		)
			.bind(athleteId)
			.first<{
				status: string;
				import_status: string;
				scope_read_all: number;
			}>();
	}

	async function balance(athleteId: number) {
		return env.DB.prepare(
			"SELECT training_rynke, training_without_virtual FROM rynke_balances WHERE athlete_id = ?",
		)
			.bind(athleteId)
			.first<{ training_rynke: number; training_without_virtual: number }>();
	}

	/** Connect as `athleteId` through /_dev/ and the stand-in screen. */
	async function connectAs(athleteId: number, scopes: string[]) {
		const started = await post("/_dev/connect", [
			["athleteId", String(athleteId)],
		]);
		expect(started.status).toBe(303);
		const location = new URL(started.headers.get("Location") ?? "", LOCAL);
		expect(location.pathname).toBe("/_dev/strava/oauth/authorize");
		expect(location.searchParams.get("athlete")).toBe(String(athleteId));
		const stateCookie = cookiePair(started.headers.get("Set-Cookie") ?? "");
		const decided = await post("/_dev/strava/oauth/authorize", [
			["redirect_uri", location.searchParams.get("redirect_uri") ?? ""],
			["state", location.searchParams.get("state") ?? ""],
			["athlete", String(athleteId)],
			...scopes.map((s): [string, string] => ["scope", s]),
			["action", "authorize"],
		]);
		return get(decided.headers.get("Location") ?? "", stateCookie);
	}

	it("stores every club member and nobody else", async () => {
		await seeded();
		const { results } = await env.DB.prepare(
			"SELECT athlete_id FROM riders ORDER BY athlete_id",
		).all<{ athlete_id: number }>();
		expect(results.map((r) => r.athlete_id)).toEqual(
			SAMPLE_RIDERS.filter((r) => r.athleteId !== NOAH).map((r) => r.athleteId),
		);
	});

	it("flags Tina TrainingDone as the only organiser (004 research R10)", async () => {
		await seeded();
		const { results } = await env.DB.prepare(
			"SELECT athlete_id, organiser FROM riders ORDER BY athlete_id",
		).all<{ athlete_id: number; organiser: number }>();
		for (const row of results) {
			expect(row.organiser, String(row.athlete_id)).toBe(
				row.athlete_id === 990004 ? 1 : 0,
			);
		}
		expect(results.some((r) => r.athlete_id === 990004)).toBe(true);
	});

	it("keeps Ida Importing's import waiting", async () => {
		await seeded();
		expect((await riderRow(IDA))?.import_status).toBe("pending");
		expect(ctx.queue.sent).toContainEqual({
			body: expect.objectContaining({ kind: "import-page", athleteId: IDA }),
			delaySeconds: expect.any(Number),
		});
	});

	it("makes Remy Reconnect reconnect", async () => {
		await seeded();
		expect((await riderRow(REMY))?.status).toBe("needs_reconnect");
	});

	it("shows Nora NoRides without rides", async () => {
		await seeded();
		expect(await mePage(NORA)).toContain("Noch keine Fahrten importiert");
	});

	it("leaves Fiona FarAway far from both targets", async () => {
		await seeded();
		expect((await balance(FIONA))?.training_rynke).toBeLessThan(50);
	});

	it("gets Vera Virtual to the target only with virtual rides", async () => {
		await seeded();
		const row = await balance(VERA);
		expect(row?.training_rynke).toBeGreaterThanOrEqual(250);
		expect(row?.training_without_virtual).toBeLessThan(167);
		const page = await mePage(VERA);
		expect(page).toContain("erreicht ✓");
		expect(page).toContain(
			"Trainingsrynke aus Fahrten draußen (nicht virtuell)",
		);
	});

	it("gives Rex Rejected a ride for every reason not to count", async () => {
		await seeded();
		const { results } = await env.DB.prepare(
			"SELECT reasons FROM ride_results WHERE athlete_id = ? AND counts = 0",
		)
			.bind(REX)
			.all<{ reasons: string }>();
		const reasons = new Set(results.flatMap((r) => JSON.parse(r.reasons)));
		for (const reason of [
			"too_slow",
			"too_fast",
			"pause",
			"climbing_rate",
			"manual",
			"flagged",
			"excluded_sport_type",
			"overlap",
		]) {
			expect(reasons).toContain(reason);
		}
		// Each ride breaks only its own rule.
		for (const r of results) expect(JSON.parse(r.reasons)).toHaveLength(1);
		// The app imports only cycling (src/strava/activity.ts).
		expect(
			await count(
				"SELECT COUNT(*) AS n FROM activities WHERE athlete_id = ? AND sport_type = 'Run'",
				REX,
			),
		).toBe(0);
		expect(rider(REX).rides.some((r) => r.sportType === "Run")).toBe(true);
	});

	it("gives Paula Paging more rides than one page", async () => {
		await seeded();
		expect(
			await count(
				"SELECT COUNT(*) AS n FROM activities WHERE athlete_id = ?",
				PAULA,
			),
		).toBe(45);
		// The table shows the newest 20; feature 005's pager links the rest.
		expect((await mePage(PAULA)).match(/<tr class="ride /g)).toHaveLength(20);
	});

	it("enters Paula Paging's team events, one that doesn't count", async () => {
		await seeded();
		const list = (await mePage(PAULA)).split('class="rynke-events">')[1] ?? "";
		const items = list.slice(0, list.indexOf("</ul>"));
		expect(items.match(/<li/g)).toHaveLength(4);
		expect(items.match(/event-not-counting/g)).toHaveLength(1);
		expect(items).toContain("Sample cornering");
	});

	it("hides Olli OptionalDenied's private rides", async () => {
		await seeded();
		expect((await riderRow(OLLI))?.scope_read_all).toBe(0);
		expect(rider(OLLI).rides.some((r) => r.private)).toBe(true);
		expect(
			await count(
				"SELECT COUNT(*) AS n FROM activities WHERE athlete_id = ? AND is_private = 1",
				OLLI,
			),
		).toBe(0);
		expect(
			await count(
				"SELECT COUNT(*) AS n FROM activities WHERE athlete_id = ?",
				OLLI,
			),
		).toBe(rider(OLLI).rides.filter((r) => !r.private).length);
	});

	it("turns Noah NotMember away", async () => {
		await seeded();
		const landed = await connectAs(NOAH, ALL_SCOPES);
		expect(landed.headers.get("Location")).toBe("/notice/not-member");
		expect(await riderRow(NOAH)).toBeNull();
	});

	it("refuses a grant without a required scope, like Strava's real one", async () => {
		await seeded();
		const landed = await connectAs(NOAH, ["read"]);
		expect(landed.headers.get("Location")).toBe("/notice/denied");
	});

	it("resets to the sample data (FR-013)", async () => {
		await seeded();
		const first = await tableCounts();
		const fakeRides = await count(
			"SELECT COUNT(*) AS n FROM fake_strava_activities",
		);

		await env.DB.prepare(
			`DELETE FROM fake_strava_activities WHERE id =
				(SELECT MIN(id) FROM fake_strava_activities WHERE athlete_id = ?)`,
		)
			.bind(TINA)
			.run();
		await env.DB.prepare("DELETE FROM riders WHERE athlete_id = ?")
			.bind(FIONA)
			.run();

		const reset = await post("/_dev/reset", []);
		expect(reset.status).toBe(303);
		expect(reset.headers.get("Location")).toBe("/_dev/");
		expect(reset.headers.get("Set-Cookie")).toBe(clearSessionCookie());
		await drain();
		expect(await tableCounts()).toEqual(first);
		expect(
			await count("SELECT COUNT(*) AS n FROM fake_strava_activities"),
		).toBe(fakeRides);
	});
});

describe("simulated Strava events (US3)", () => {
	const FIONA = 990003;
	const OLLI = 990008;

	async function event(fields: [string, string][]) {
		const res = await post("/_dev/events", fields);
		expect(res.status).toBe(303);
		const location = new URL(res.headers.get("Location") ?? "", LOCAL);
		expect(location.pathname).toBe("/_dev/");
		// The flash names the webhook's answer: the body passed its checks.
		expect(location.searchParams.get("flash")).toMatch(/answered 200/);
		await drain();
	}

	async function training(athleteId: number): Promise<number> {
		return count(
			"SELECT training_rynke AS n FROM rynke_balances WHERE athlete_id = ?",
			athleteId,
		);
	}

	async function newestFake(athleteId: number): Promise<number> {
		return count(
			"SELECT MAX(id) AS n FROM fake_strava_activities WHERE athlete_id = ?",
			athleteId,
		);
	}

	async function stored(activityId: number): Promise<number> {
		return count(
			"SELECT COUNT(*) AS n FROM activities WHERE strava_activity_id = ?",
			activityId,
		);
	}

	beforeEach(async () => {
		expect((await get("/_dev/")).status).toBe(200);
		await drain();
	});

	it("creates, repeats, updates and deletes a ride", async () => {
		const before = await training(FIONA);
		await event([
			["athleteId", String(FIONA)],
			["action", "create"],
			["date", "2026-10-05"],
			["time", "09:00"],
			["sportType", "Ride"],
			["distanceKm", "120"],
			["elevationM", "600"],
			["movingMin", "240"],
			["elapsedMin", "250"],
		]);
		const id = await newestFake(FIONA);
		expect(await stored(id)).toBe(1);
		const created = await training(FIONA);
		expect(created).toBeGreaterThan(before);

		// US3 scenario 3, Principle II: the same event twice changes nothing.
		const counts = await tableCounts();
		await event([
			["athleteId", String(FIONA)],
			["action", "repeat"],
		]);
		expect(await tableCounts()).toEqual(counts);
		expect(await training(FIONA)).toBe(created);

		await event([
			["athleteId", String(FIONA)],
			["action", "update"],
			["activityId", String(id)],
			["distanceKm", "60"],
		]);
		expect(await training(FIONA)).toBeLessThan(created);

		await event([
			["athleteId", String(FIONA)],
			["action", "delete"],
			["activityId", String(id)],
		]);
		expect(await stored(id)).toBe(0);
		expect(
			await count(
				"SELECT COUNT(*) AS n FROM fake_strava_activities WHERE id = ?",
				id,
			),
		).toBe(0);
	});

	it("reports a rename as a title change (008 research R9)", async () => {
		const id = await newestFake(FIONA);
		const res = await post("/_dev/events", [
			["athleteId", String(FIONA)],
			["action", "update"],
			["activityId", String(id)],
			["name", "Synthetic renamed"],
		]);
		expect(res.status).toBe(303);
		// The webhook turns `updates` into its keys: only the title changed.
		const events = ctx.queue.sent
			.map((m) => m.body)
			.filter((body) => body.kind === "activity-event");
		expect(events).toEqual([
			{
				kind: "activity-event",
				athleteId: FIONA,
				activityId: id,
				aspect: "update",
				changed: ["title"],
			},
		]);
		await drain();
		expect(await mePage(FIONA)).toContain(
			'<span class="ride-name">Synthetic renamed</span>',
		);
	});

	it("drops a ride turned private for a rider without activity:read_all", async () => {
		const id = await count(
			`SELECT MIN(a.strava_activity_id) AS n FROM activities a
			WHERE a.athlete_id = ? AND a.is_private = 0`,
			OLLI,
		);
		expect(await stored(id)).toBe(1);
		await event([
			["athleteId", String(OLLI)],
			["action", "update"],
			["activityId", String(id)],
			["private", "true"],
		]);
		expect(await stored(id)).toBe(0);
	});

	it("deletes everything of a rider who revokes access", async () => {
		await event([
			["athleteId", String(FIONA)],
			["action", "deauthorize"],
		]);
		for (const table of [
			"riders",
			"strava_credentials",
			"activities",
			"consent_records",
			"ride_results",
			"rynke_balances",
		]) {
			expect(
				await count(
					`SELECT COUNT(*) AS n FROM ${table} WHERE athlete_id = ?`,
					FIONA,
				),
			).toBe(0);
		}
	});
});

describe("links to Strava (008 research R9)", () => {
	beforeEach(async () => {
		expect((await get("/_dev/")).status).toBe(200);
		await drain();
	});

	async function fakeRides(athleteId: number) {
		const { results } = await env.DB.prepare(
			"SELECT id, json_extract(body, '$.name') AS name FROM fake_strava_activities WHERE athlete_id = ?",
		)
			.bind(athleteId)
			.all<{ id: number; name: string }>();
		return new Map(results.map((r) => [r.id, r.name]));
	}

	it("sends the rider page's links to the stand-in, never to Strava", async () => {
		const page = await mePage(TINA);
		expect(page).not.toContain("https://www.strava.com/activities/");
		const hrefs = [
			...page.matchAll(/<a class="tap strava-activity" href="([^"]*)">/g),
		].map(([, href]) => href ?? "");
		expect(hrefs.length).toBeGreaterThan(0);
		const ids = await fakeRides(TINA);
		for (const href of hrefs) {
			const id = Number(href.match(/^\/_dev\/strava\/activities\/(\d+)$/)?.[1]);
			expect(ids.has(id)).toBe(true);
		}
	});

	it("shows the fake ride on the stand-in page", async () => {
		const [first] = await fakeRides(TINA);
		if (!first) throw new Error("Tina has no fake rides");
		const [id, name] = first;
		const res = await get(`/_dev/strava/activities/${id}`);
		expect(res.status).toBe(200);
		expect(await res.text()).toContain(name);
		expect((await get("/_dev/strava/activities/1")).status).toBe(404);
	});
});
