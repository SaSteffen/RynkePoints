import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readRynke } from "../../src/db/rynke";
import { handleQueue } from "../../src/index";
import { applyAndEvaluate } from "../../src/rynke/apply";
import { CURRENT_RULES, countingWindow } from "../../src/rynke/rules";
import type { ActivityEventMessage } from "../../src/work/messages";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";
import {
	balanceRow,
	expectConsistent,
	resultRows,
	snapshot,
} from "../support/rynke";

// Story 4 through the webhook path: an activity event stores the activity, its
// ride result and the balance in one batch (research R11).

const A = 7_500_001;
const B = 7_500_002;
const C = 7_500_003;

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	fake.addAthlete({ id: ATHLETE_A });
	await seedRider(ctx);
});

afterEach(() => fake.restore());

/** A ride in human units on 2026-10-05 (UTC), unless `start` says otherwise. */
function ride(
	id: number,
	spec: {
		km: number;
		movingH: number;
		pausedH?: number;
		elevationM?: number;
		start?: string;
		manual?: boolean;
	},
	extra: Record<string, unknown> = {},
) {
	const start = spec.start ?? "2026-10-05T07:00:00Z";
	const moving = Math.round(spec.movingH * 3600);
	fake.addActivity(
		ATHLETE_A,
		makeStravaActivity({
			id,
			start_date: start,
			start_date_local: start,
			distance: spec.km * 1000,
			moving_time: moving,
			elapsed_time: moving + Math.round((spec.pausedH ?? 0) * 3600),
			total_elevation_gain: spec.elevationM ?? 0,
			manual: spec.manual ?? false,
			...extra,
		}),
	);
}

function event(
	activityId: number,
	aspect: ActivityEventMessage["aspect"],
	changed: string[] = [],
): ActivityEventMessage {
	return {
		kind: "activity-event",
		athleteId: ATHLETE_A,
		activityId,
		aspect,
		changed,
	};
}

async function deliver(body: ActivityEventMessage) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, ctx);
	const result = await getQueueResult(batch, createExecutionContext());
	expect(result.explicitAcks).toEqual(["m1"]);
	await expectConsistent();
}

async function result(activityId: number) {
	return (await resultRows()).find((r) => r.strava_activity_id === activityId);
}

describe("stored ride results and balance", () => {
	it("S4-1: a first ride gives its result and the balance", async () => {
		ride(A, { km: 79, movingH: 3, elevationM: 1240 });
		await deliver(event(A, "create"));

		expect(await resultRows()).toEqual([
			{
				strava_activity_id: A,
				athlete_id: ATHLETE_A,
				counts: 1,
				reasons: "[]",
				overlaps_activity_id: null,
				distance_rynke: 7,
				elevation_dm: 12400,
				is_virtual: 0,
				unknown_figures: "[]",
				rules_version: CURRENT_RULES.version,
				activity_refreshed_at: NOW,
			},
		]);
		expect(await balanceRow()).toEqual({
			athlete_id: ATHLETE_A,
			distance_rynke: 7,
			elevation_dm: 12400,
			elevation_rynke: 5,
			elevation_to_next_step_dm: 7600,
			training_rynke: 12,
			team_rynke: 0,
			training_missing: 238,
			team_missing: 25,
			training_without_virtual: 12,
			virtual_share_missing: 155,
			qualified: 0,
			rules_version: CURRENT_RULES.version,
			rules_effective_date: CURRENT_RULES.effectiveDate,
			computed_at: NOW,
		});
	});

	it("S4-2: elevation Rynke come from the total, never per ride", async () => {
		ride(A, { km: 30, movingH: 2, elevationM: 600 });
		ride(B, {
			km: 30,
			movingH: 2,
			elevationM: 600,
			start: "2026-10-06T07:00:00Z",
		});
		await deliver(event(A, "create"));
		await deliver(event(B, "create"));

		const rows = await resultRows();
		expect(rows.map((r) => r.elevation_dm)).toEqual([6000, 6000]);
		for (const row of rows) expect(row).not.toHaveProperty("elevation_rynke");
		expect(await balanceRow()).toMatchObject({
			elevation_dm: 12000,
			elevation_rynke: 5,
		});
	});

	it("S4-3: a ride paused too long gets a result but no Rynke", async () => {
		ride(A, { km: 79, movingH: 3, elevationM: 1240 });
		await deliver(event(A, "create"));
		const before = await balanceRow();

		ride(B, {
			km: 100,
			movingH: 4,
			pausedH: 3,
			start: "2026-10-06T07:00:00Z",
		});
		await deliver(event(B, "create"));

		expect(await result(B)).toMatchObject({
			counts: 0,
			reasons: '["pause"]',
			distance_rynke: 0,
			elevation_dm: 0,
		});
		expect(await balanceRow()).toEqual(before);
	});

	it("S4-4: a manual entry lists every reason", async () => {
		ride(A, { km: 15, movingH: 2, manual: true });
		await deliver(event(A, "create"));
		expect(await result(A)).toMatchObject({
			counts: 0,
			reasons: '["manual","too_slow"]',
		});
	});

	it("S4-5: a larger overlapping recording takes over", async () => {
		ride(A, { km: 78, movingH: 3, elevationM: 650 });
		await deliver(event(A, "create"));
		expect(await result(A)).toMatchObject({ counts: 1, distance_rynke: 7 });

		ride(B, { km: 80, movingH: 3, elevationM: 600 });
		await deliver(event(B, "create"));

		expect(await result(A)).toMatchObject({
			counts: 0,
			reasons: '["overlap"]',
			overlaps_activity_id: B,
			distance_rynke: 0,
			elevation_dm: 0,
		});
		expect(await result(B)).toMatchObject({ counts: 1, distance_rynke: 8 });
		expect(await balanceRow()).toMatchObject({
			distance_rynke: 8,
			elevation_dm: 6000,
		});
	});

	it("S4-6 / US2-5: edits and deletions on Strava follow", async () => {
		ride(A, { km: 79, movingH: 3 });
		ride(B, { km: 50, movingH: 2, start: "2026-10-06T07:00:00Z" });
		await deliver(event(A, "create"));
		await deliver(event(B, "create"));
		expect(await balanceRow()).toMatchObject({ distance_rynke: 12 });

		const stored = fake.activities.get(A);
		if (!stored) throw new Error("fake has no activity A");
		stored.distance = 101000;
		await deliver(event(A, "update", ["type"]));
		expect(await result(A)).toMatchObject({ distance_rynke: 10 });
		expect(await balanceRow()).toMatchObject({ distance_rynke: 15 });

		fake.activities.delete(B);
		await deliver(event(B, "delete"));
		expect(await result(B)).toBeUndefined();
		expect(await balanceRow()).toMatchObject({ distance_rynke: 10 });
	});

	it("S4-7: a ride after the qualification deadline adds nothing", async () => {
		ride(A, { km: 79, movingH: 3 });
		await deliver(event(A, "create"));
		expect(await balanceRow()).toMatchObject({ distance_rynke: 7 });

		const rules = { ...CURRENT_RULES, qualificationDeadline: "2026-08-31" };
		await applyAndEvaluate(
			env.DB,
			ATHLETE_A,
			{ kind: "none" },
			rules,
			countingWindow(env, rules),
			NOW,
		);

		expect(await result(A)).toMatchObject({
			counts: 0,
			reasons: '["outside_window"]',
		});
		expect(await balanceRow()).toMatchObject({ distance_rynke: 0 });
	});

	it("a title-only update writes nothing", async () => {
		ride(A, { km: 79, movingH: 3 });
		await deliver(event(A, "create"));
		const before = await snapshot();
		ctx = makeCtx({ now: NOW + 3600 });

		await deliver(event(A, "update", ["title"]));

		expect(await snapshot()).toEqual(before);
		expect(fake.callsTo("activity")).toHaveLength(1);
	});

	it("a flag Strava sends later stops the ride counting", async () => {
		ride(A, { km: 79, movingH: 3, elevationM: 1240 }, { flagged: undefined });
		await deliver(event(A, "create"));
		expect(await result(A)).toMatchObject({
			counts: 1,
			unknown_figures: '["flagged"]',
		});

		const stored = fake.activities.get(A);
		if (!stored) throw new Error("fake has no activity A");
		stored.flagged = true;
		await deliver(event(A, "update", ["type"]));

		expect(await result(A)).toMatchObject({
			counts: 0,
			reasons: '["flagged"]',
			unknown_figures: "[]",
		});
		expect(await balanceRow()).toMatchObject({
			distance_rynke: 0,
			elevation_dm: 0,
			training_rynke: 0,
		});
	});

	it("SC-002 / SC-003: replays and full evaluations change nothing", async () => {
		ride(A, { km: 78, movingH: 3, elevationM: 650 });
		ride(B, { km: 80, movingH: 3, elevationM: 600 });
		ride(C, { km: 100, movingH: 4, pausedH: 3, start: "2026-10-06T07:00:00Z" });
		const events = [
			event(A, "create"),
			event(B, "create"),
			event(C, "create"),
			event(A, "update", ["type"]),
		];
		for (const e of events) await deliver(e);
		const settled = await snapshot();

		await applyAndEvaluate(
			env.DB,
			ATHLETE_A,
			{ kind: "none" },
			CURRENT_RULES,
			countingWindow(env, CURRENT_RULES),
			NOW + 3600,
		);
		expect(await snapshot()).toEqual(settled);

		for (const e of [...events].reverse()) await deliver(e);
		for (const e of events) await deliver(e);
		expect(await snapshot()).toEqual(settled);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("reads back what was stored", async () => {
		ride(A, { km: 79, movingH: 3, elevationM: 1240 });
		await deliver(event(A, "create"));
		const { balance, results } = await readRynke(env.DB, ATHLETE_A);
		expect(results).toEqual([
			{
				activityId: A,
				counts: true,
				reasons: [],
				overlapsActivityId: null,
				distanceRynke: 7,
				elevationDm: 12400,
				isVirtual: false,
				unknownFigures: [],
				activityRefreshedAt: NOW,
				rulesVersion: CURRENT_RULES.version,
			},
		]);
		expect(balance).toMatchObject({
			trainingRynke: 12,
			qualified: false,
			rulesEffectiveDate: CURRENT_RULES.effectiveDate,
			computedAt: NOW,
		});
	});
});
