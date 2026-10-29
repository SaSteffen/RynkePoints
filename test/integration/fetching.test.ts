import { createMessageBatch, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seasonStartEpoch } from "../../src/config";
import { setImportStatus } from "../../src/db/riders";
import { handleFetch, handleQueue } from "../../src/index";
import {
	type HandlerResult,
	type Handlers,
	processBatch,
} from "../../src/work/consumer";
import {
	type ActivityEventMessage,
	STRAVA_TURN,
} from "../../src/work/messages";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";
import { riderPage, seedBalance } from "../support/rider-view";

// Feature 024 US4: the line saying how far the rider's activities are
// (FR-018 to FR-022, contracts/http-routes.md).

let ctx: TestCtx;
let seq = 0;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
	seq = 0;
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

afterEach(() => vi.restoreAllMocks());

function events(n: number): ActivityEventMessage[] {
	return Array.from({ length: n }, (_, i) => ({
		kind: "activity-event",
		athleteId: ATHLETE_A,
		activityId: i + 1,
		aspect: "create",
		changed: [],
	}));
}

/**
 * Delivers `n` events (none: a `strava-turn`) with a stand-in that does `done`
 * of the waiting ones, then meets the budget.
 */
async function deliver(n: number, done = 0) {
	let calls = 0;
	const handlers: Handlers = {
		"activity-event": async (): Promise<HandlerResult> =>
			++calls <= done ? { kind: "ok" } : { kind: "budget", delaySeconds: 900 },
	};
	const batch = createMessageBatch(
		"rynke-points-work",
		(n > 0 ? events(n) : [STRAVA_TURN]).map((body) => ({
			id: `m${++seq}`,
			timestamp: new Date(NOW * 1000),
			attempts: 1,
			body,
		})),
	);
	await processBatch(batch, ctx, handlers);
}

async function fetching(
	options: { athleteId?: number; acceptLanguage?: string } = {},
) {
	const res = await handleFetch(
		request("/me/fetching", {
			acceptLanguage: options.acceptLanguage,
			cookies: await sessionCookie(ctx, options.athleteId ?? ATHLETE_A),
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	expect(res.headers.get("Cache-Control")).toBe("no-store");
	return ((await res.json()) as { text: string | null }).text;
}

describe("GET /me/fetching", () => {
	it("refuses a request without a session", async () => {
		const res = await handleFetch(request("/me/fetching"), ctx);
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("");
	});

	it("says nothing without waiting work", async () => {
		expect(await fetching()).toBeNull();
	});

	it("says nothing for a few waiting activities (FR-018, US4 scenario 7)", async () => {
		await deliver(9);
		expect(await fetching()).toBeNull();
	});

	it("counts done and total once 10 are waiting (US4 scenario 1)", async () => {
		await deliver(12);
		expect(await fetching()).toBe("0 von 12 Aktivitäten geholt");
		expect(await fetching({ acceptLanguage: "en" })).toBe(
			"0 of 12 activities fetched",
		);
	});

	it("rises as activities are done and includes later ones (US4 scenarios 2, 3)", async () => {
		await deliver(12, 5);
		expect(await fetching()).toBe("5 von 12 Aktivitäten geholt");
		await deliver(3);
		expect(await fetching()).toBe("5 von 15 Aktivitäten geholt");
	});

	it("stays once shown, even when fewer than 10 are left", async () => {
		await deliver(12, 8);
		expect(await fetching()).toBe("8 von 12 Aktivitäten geholt");
	});

	it("goes when the queue is empty (US4 scenario 4)", async () => {
		await deliver(12);
		await deliver(0, 100);
		expect(await fetching()).toBeNull();
	});

	it("is the rider's own (FR-021)", async () => {
		await deliver(12);
		expect(await fetching({ athleteId: ATHLETE_B })).toBeNull();
	});

	it("counts an import that continues after its first part (FR-019)", async () => {
		await setImportStatus(env.DB, ATHLETE_A, "running");
		await env.DB.prepare(
			"UPDATE riders SET import_fetched = 200 WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.run();
		expect(await fetching()).toBe(
			"Bisher 200 Aktivitäten geholt, weitere folgen",
		);
		expect(await fetching({ acceptLanguage: "en" })).toBe(
			"200 activities fetched so far, more to come",
		);
		await setImportStatus(env.DB, ATHLETE_A, "done");
		expect(await fetching()).toBeNull();
	});

	it("starts an import's count again when it is set pending", async () => {
		await env.DB.prepare(
			"UPDATE riders SET import_fetched = 200 WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.run();
		await setImportStatus(env.DB, ATHLETE_A, "pending");
		const row = await env.DB.prepare(
			"SELECT import_fetched FROM riders WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.first();
		expect(row).toEqual({ import_fetched: 0 });
	});
});

describe("import count", () => {
	let fake: FakeStrava;

	beforeEach(() => {
		fake = installFakeStrava();
		fake.addAthlete({ id: ATHLETE_A });
	});

	afterEach(() => fake.restore());

	it("adds each page's listed activities", async () => {
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: 801 }));
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({ id: 802, start_date: "2026-10-04T07:30:00Z" }),
		);
		await setImportStatus(env.DB, ATHLETE_A, "pending");
		const batch = createMessageBatch("rynke-points-work", [
			{
				id: "m1",
				timestamp: new Date(NOW * 1000),
				attempts: 1,
				body: {
					kind: "import-page",
					athleteId: ATHLETE_A,
					page: 1,
					after: seasonStartEpoch("2026-01-01"),
				},
			},
		]);
		await handleQueue(batch, ctx);
		const row = await env.DB.prepare(
			"SELECT import_fetched, import_status FROM riders WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.first();
		expect(row).toEqual({ import_fetched: 2, import_status: "done" });
	});
});

describe("the line on the pages", () => {
	beforeEach(() => seedBalance(ATHLETE_A));

	it("shows on Overview and Rides with the poll interval (contracts/http-routes.md)", async () => {
		await deliver(12, 2);
		for (const path of ["/me", "/me/rides"]) {
			const { status, html } = await riderPage(ctx, ATHLETE_A, path);
			expect(status).toBe(200);
			expect(html).toContain(
				'<section class="notice fetching" role="status" data-fetching data-poll-seconds="10">',
			);
			expect(html).toContain("<p>2 von 12 Aktivitäten geholt</p>");
		}
	});

	it("never shows on the Team page or to another rider (FR-021)", async () => {
		await deliver(12);
		expect((await riderPage(ctx, ATHLETE_A, "/team")).html).not.toContain(
			"data-fetching",
		);
		await seedBalance(ATHLETE_B);
		expect((await riderPage(ctx, ATHLETE_B, "/me")).html).not.toContain(
			"data-fetching",
		);
	});

	it("isn't there without waiting work", async () => {
		const { html } = await riderPage(ctx, ATHLETE_A, "/me");
		expect(html).not.toContain("data-fetching");
	});
});
