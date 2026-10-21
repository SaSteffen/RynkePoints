import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seasonStartEpoch } from "../../src/config";
import { handleQueue } from "../../src/index";
import { applyAndEvaluate } from "../../src/rynke/apply";
import { CURRENT_RULES, countingWindow } from "../../src/rynke/rules";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";
import { riderPage } from "../support/rider-view";
import { snapshot } from "../support/rynke";

// Outdoor runs are kept on their own for the running badges (feature 013
// US3, FR-020 to FR-022, SC-004). Synthetic activities only.

let fake: FakeStrava;
let ctx: TestCtx;

const RIDE = 7_300_001;
const RUN = 7_300_002;
const TRAIL = 7_300_003;

const run = (id: number, overrides = {}) =>
	makeStravaActivity({
		id,
		sport_type: "Run",
		type: "Run",
		distance: 7800,
		moving_time: 2400,
		elapsed_time: 2500,
		start_date: "2026-05-02T06:00:00Z",
		start_date_local: "2026-05-02T08:00:00Z",
		...overrides,
	});

async function deliver(body: unknown) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

const event = (activityId: number, aspect = "create") => ({
	kind: "activity-event",
	athleteId: ATHLETE_A,
	activityId,
	aspect,
	changed: [],
});

async function runs() {
	const { results } = await env.DB.prepare(
		"SELECT strava_activity_id, distance_m, is_private FROM runs ORDER BY strava_activity_id",
	).all();
	return results;
}

async function rideIds() {
	const { results } = await env.DB.prepare(
		"SELECT strava_activity_id FROM activities ORDER BY strava_activity_id",
	).all<{ strava_activity_id: number }>();
	return results.map((r) => r.strava_activity_id);
}

/** A page without the Team page's random quote and the monkey who says it. */
/** Without the random quote and its monkey, and without the team's badges, which runs feed. */
async function page(path: string) {
	const { html } = await riderPage(ctx, ATHLETE_A, path);
	return html
		.replace(/<div class="quote-monkey">[\s\S]*?<\/blockquote>\n<\/div>/, "")
		.replace(/<section class="badges"[\s\S]*?(?=<\/main>)/, "");
}

async function setActivity(activity: ReturnType<typeof makeStravaActivity>) {
	fake.activities.set(activity.id, { ...activity, ownerId: ATHLETE_A });
}

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	fake.addAthlete({ id: ATHLETE_A });
	await seedRider(ctx);
});

afterEach(() => fake.restore());

describe("runs from activity events", () => {
	it("stores an outdoor run in runs, never in activities", async () => {
		fake.addActivity(ATHLETE_A, run(RUN));
		await deliver(event(RUN));
		expect(await runs()).toEqual([
			{ strava_activity_id: RUN, distance_m: 7800, is_private: 0 },
		]);
		expect(await rideIds()).toEqual([]);
	});

	it.each([
		["a treadmill", { trainer: true }],
		["a virtual run", { sport_type: "VirtualRun" }],
	])("removes a run updated to %s (FR-020a)", async (_, overrides) => {
		fake.addActivity(ATHLETE_A, run(RUN));
		await deliver(event(RUN));
		await setActivity(run(RUN, overrides));
		await deliver(event(RUN, "update"));
		expect(await runs()).toEqual([]);
	});

	it("removes a run on a delete event and on a 404", async () => {
		fake.addActivity(ATHLETE_A, run(RUN));
		fake.addActivity(ATHLETE_A, run(TRAIL, { sport_type: "TrailRun" }));
		await deliver(event(RUN));
		await deliver(event(TRAIL));
		expect(await runs()).toHaveLength(2);

		await deliver(event(RUN, "delete"));
		fake.activities.delete(TRAIL);
		await deliver(event(TRAIL, "update"));
		expect(await runs()).toEqual([]);
	});

	it("keeps a private run only with read-all", async () => {
		fake.addActivity(ATHLETE_A, run(RUN, { private: true }));
		await deliver(event(RUN));
		expect(await runs()).toHaveLength(1);

		await env.DB.prepare("UPDATE riders SET scope_read_all = 0").run();
		await deliver(event(RUN, "update"));
		expect(await runs()).toEqual([]);
	});

	it("moves an activity between rides and runs when its sport changes", async () => {
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: RIDE }));
		await deliver(event(RIDE));
		expect(await rideIds()).toEqual([RIDE]);

		await setActivity(run(RIDE));
		await deliver(event(RIDE, "update"));
		expect(await rideIds()).toEqual([]);
		expect(await runs()).toHaveLength(1);

		await setActivity(makeStravaActivity({ id: RIDE }));
		await deliver(event(RIDE, "update"));
		expect(await rideIds()).toEqual([RIDE]);
		expect(await runs()).toEqual([]);
	});
});

describe("runs from list pages and scope changes", () => {
	it("stores runs from an import page", async () => {
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: RIDE }));
		fake.addActivity(ATHLETE_A, run(RUN));
		fake.addActivity(ATHLETE_A, run(TRAIL, { manual: true }));
		await deliver({
			kind: "import-page",
			athleteId: ATHLETE_A,
			page: 1,
			after: seasonStartEpoch("2026-01-01"),
		});
		expect(await rideIds()).toEqual([RIDE]);
		expect((await runs()).map((r) => r.strava_activity_id)).toEqual([RUN]);
	});

	it("drops private runs when private access is withdrawn", async () => {
		fake.addActivity(ATHLETE_A, run(RUN));
		fake.addActivity(ATHLETE_A, run(TRAIL, { private: true }));
		await deliver(event(RUN));
		await deliver(event(TRAIL));

		await applyAndEvaluate(
			env.DB,
			ATHLETE_A,
			{ kind: "delete-private" },
			CURRENT_RULES,
			countingWindow(env),
			NOW,
		);
		expect((await runs()).map((r) => r.strava_activity_id)).toEqual([RUN]);
	});
});

describe("runs change nothing of the Rynke (SC-004, US3 scenario 2)", () => {
	it("leaves results, balance, ride list and Team page as they were", async () => {
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: RIDE }));
		await deliver(event(RIDE));
		const before = {
			rynke: await snapshot(),
			rides: await page("/me/rides"),
			team: await page("/team"),
		};

		fake.addActivity(ATHLETE_A, run(RUN, { distance: 12400 }));
		await deliver(event(RUN));

		expect(await runs()).toHaveLength(1);
		expect(await snapshot()).toEqual(before.rynke);
		expect(await page("/me/rides")).toBe(before.rides);
		expect(await page("/team")).toBe(before.team);
	});

	it("earns the running badges by the runs' dates", async () => {
		fake.addActivity(ATHLETE_A, run(RUN));
		fake.addActivity(
			ATHLETE_A,
			run(TRAIL, {
				sport_type: "TrailRun",
				distance: 4600,
				start_date: "2026-05-05T06:00:00Z",
				start_date_local: "2026-05-05T08:00:00Z",
			}),
		);
		await deliver(event(RUN));
		await deliver(event(TRAIL));
		const { results } = await env.DB.prepare(
			"SELECT badge_id, earned_on FROM rider_badges ORDER BY badge_id",
		).all();
		expect(results).toEqual([
			{ badge_id: "run-length-5", earned_on: "2026-05-02" },
			{ badge_id: "running-10", earned_on: "2026-05-05" },
		]);
	});
});
