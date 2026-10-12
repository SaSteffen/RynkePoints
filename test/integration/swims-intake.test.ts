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
import { toSwimRecord } from "../../src/strava/activity";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";
import { riderPage } from "../support/rider-view";
import { snapshot } from "../support/rynke";

// Swims are kept on their own for the swim badges (feature 013 part C,
// FR-024, FR-025, SC-004, research R26). Synthetic activities only.

let fake: FakeStrava;
let ctx: TestCtx;

const RIDE = 7_400_001;
const POOL = 7_400_002;
const OPEN = 7_400_003;

const swim = (id: number, overrides = {}) =>
	makeStravaActivity({
		id,
		sport_type: "Swim",
		type: "Swim",
		distance: 1200,
		moving_time: 1800,
		elapsed_time: 2000,
		total_elevation_gain: 0,
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

async function swims() {
	const { results } = await env.DB.prepare(
		"SELECT strava_activity_id, distance_m, is_private FROM swims ORDER BY strava_activity_id",
	).all();
	return results;
}

async function count(table: "activities" | "runs") {
	return env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<number>(
		"n",
	);
}

/** A page without the Team page's random quote. */
async function page(path: string) {
	const { html } = await riderPage(ctx, ATHLETE_A, path);
	return html.replace(/<blockquote class="quote[\s\S]*?<\/blockquote>/, "");
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

describe("swims from activity events", () => {
	it("stores a swim in swims, never in activities or runs", async () => {
		fake.addActivity(ATHLETE_A, swim(POOL, { trainer: true }));
		await deliver(event(POOL));
		expect(await swims()).toEqual([
			{ strava_activity_id: POOL, distance_m: 1200, is_private: 0 },
		]);
		expect(await count("activities")).toBe(0);
		expect(await count("runs")).toBe(0);
	});

	it("removes a swim updated to manual", async () => {
		fake.addActivity(ATHLETE_A, swim(POOL));
		await deliver(event(POOL));
		await setActivity(swim(POOL, { manual: true }));
		await deliver(event(POOL, "update"));
		expect(await swims()).toEqual([]);
	});

	it("removes a swim on a delete event and on a 404", async () => {
		fake.addActivity(ATHLETE_A, swim(POOL));
		fake.addActivity(ATHLETE_A, swim(OPEN));
		await deliver(event(POOL));
		await deliver(event(OPEN));
		expect(await swims()).toHaveLength(2);

		await deliver(event(POOL, "delete"));
		fake.activities.delete(OPEN);
		await deliver(event(OPEN, "update"));
		expect(await swims()).toEqual([]);
	});

	it("keeps a private swim only with read-all", async () => {
		fake.addActivity(ATHLETE_A, swim(POOL, { private: true }));
		await deliver(event(POOL));
		expect(await swims()).toHaveLength(1);

		await env.DB.prepare("UPDATE riders SET scope_read_all = 0").run();
		await deliver(event(POOL, "update"));
		expect(await swims()).toEqual([]);
	});

	it("moves an activity between rides and swims when its sport changes", async () => {
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: RIDE }));
		await deliver(event(RIDE));
		expect(await count("activities")).toBe(1);

		await setActivity(swim(RIDE));
		await deliver(event(RIDE, "update"));
		expect(await count("activities")).toBe(0);
		expect(await swims()).toHaveLength(1);

		await setActivity(makeStravaActivity({ id: RIDE }));
		await deliver(event(RIDE, "update"));
		expect(await count("activities")).toBe(1);
		expect(await swims()).toEqual([]);
	});
});

describe("swims from list pages and scope changes", () => {
	it("stores swims from an import page, without manual ones", async () => {
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: RIDE }));
		fake.addActivity(ATHLETE_A, swim(POOL));
		fake.addActivity(ATHLETE_A, swim(OPEN, { manual: true }));
		await deliver({
			kind: "import-page",
			athleteId: ATHLETE_A,
			page: 1,
			after: seasonStartEpoch("2026-01-01"),
		});
		expect(await count("activities")).toBe(1);
		expect((await swims()).map((r) => r.strava_activity_id)).toEqual([POOL]);
	});

	it("drops private swims when private access is withdrawn", async () => {
		fake.addActivity(ATHLETE_A, swim(POOL));
		fake.addActivity(ATHLETE_A, swim(OPEN, { private: true }));
		await deliver(event(POOL));
		await deliver(event(OPEN));

		await applyAndEvaluate(
			env.DB,
			ATHLETE_A,
			{ kind: "delete-private" },
			CURRENT_RULES,
			countingWindow(env),
			NOW,
		);
		expect((await swims()).map((r) => r.strava_activity_id)).toEqual([POOL]);
	});
});

describe("swims change nothing but the swim badges (SC-004, FR-025)", () => {
	it("leaves results, balance, ride list and the whole Team page as they were", async () => {
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: RIDE }));
		await deliver(event(RIDE));
		const before = {
			rynke: await snapshot(),
			rides: await page("/me/rides"),
			team: await page("/team"),
		};

		fake.addActivity(ATHLETE_A, swim(POOL, { distance: 2000 }));
		await deliver(event(POOL));

		expect(await swims()).toHaveLength(1);
		expect(await snapshot()).toEqual(before.rynke);
		expect(await page("/me/rides")).toBe(before.rides);
		expect(await page("/team")).toBe(before.team);
	});

	it("never marks the team's figures as changed", async () => {
		const record = toSwimRecord(swim(POOL), ATHLETE_A, NOW);
		if (!record) throw new Error("not a swim");
		const result = await applyAndEvaluate(
			env.DB,
			ATHLETE_A,
			{ kind: "upsert", records: [], swims: [record] },
			CURRENT_RULES,
			countingWindow(env),
			NOW,
		);
		expect(result.figuresChanged).toBe(false);
		expect(result.badges).toEqual(["swim-length-500", "swim-length-1000"]);
	});

	it("earns the swim badges by the swims' dates (US5 scenario 4)", async () => {
		fake.addActivity(ATHLETE_A, swim(POOL));
		fake.addActivity(
			ATHLETE_A,
			swim(OPEN, {
				distance: 800,
				start_date: "2026-05-05T06:00:00Z",
				start_date_local: "2026-05-05T08:00:00Z",
			}),
		);
		await deliver(event(POOL));
		await deliver(event(OPEN));
		const { results } = await env.DB.prepare(
			"SELECT badge_id, earned_on FROM rider_badges ORDER BY badge_id",
		).all();
		expect(results).toEqual([
			{ badge_id: "swim-length-1000", earned_on: "2026-05-02" },
			{ badge_id: "swim-length-500", earned_on: "2026-05-02" },
		]);
	});
});
