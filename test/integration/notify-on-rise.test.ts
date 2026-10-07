import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seasonStartEpoch } from "../../src/config";
import { upsertActivity } from "../../src/db/activities";
import { handleQueue } from "../../src/index";
import {
	type ActivityChange,
	applyAndEvaluate,
	applyTeamEventChange,
	type TeamEventChange,
	teamEventChange,
} from "../../src/rynke/apply";
import { CURRENT_RULES, countingWindow } from "../../src/rynke/rules";
import type { ActivityRecord } from "../../src/strava/activity";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import { activityRecord, balanceRow, insertEvent } from "../support/rynke";

// Which changes notify (feature 010 contracts/push-delivery.md, research R5,
// FR-015, FR-016, FR-018).

const window = countingWindow(env, CURRENT_RULES);

async function rose(change: ActivityChange, now = NOW) {
	return (
		await applyAndEvaluate(
			env.DB,
			ATHLETE_A,
			change,
			CURRENT_RULES,
			window,
			now,
		)
	).rose;
}

const upsert = (...records: ActivityRecord[]) =>
	({ kind: "upsert", records }) as const;

beforeEach(async () => {
	await resetDb();
	const ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

describe("rose (contracts/push-delivery.md case table)", () => {
	it("is true for a new ride earning Training Rynke", async () => {
		expect(await rose(upsert(activityRecord(1, { distance_m: 79000 })))).toBe(
			true,
		);
		expect(await balanceRow()).toMatchObject({ distance_rynke: 7 });
	});

	it.each<[string, Partial<ActivityRecord>]>([
		["an e-bike ride", { sport_type: "EBikeRide" }],
		["a ride too slow", { moving_time_s: 5 * 3600, elapsed_time_s: 5 * 3600 }],
		["a flagged ride", { is_flagged: 1 }],
		["a ride before the season", { start_date: "2025-12-01T08:00:00Z" }],
	])("is false for %s, which earns 0", async (_, overrides) => {
		expect(await rose(upsert(activityRecord(1, overrides)))).toBe(false);
	});

	it("is true, then false, for the same ride delivered twice", async () => {
		const ride = activityRecord(1);
		expect(await rose(upsert(ride))).toBe(true);
		expect(await rose(upsert(ride), NOW + 60)).toBe(false);
	});

	it("is true when an overlapping 80 km recording replaces a 78 km one", async () => {
		await rose(upsert(activityRecord(1, { distance_m: 78000 })));
		expect(await rose(upsert(activityRecord(2, { distance_m: 80000 })))).toBe(
			true,
		);
	});

	it("is false when the overlap is a shorter recording", async () => {
		await rose(upsert(activityRecord(1, { distance_m: 80000 })));
		expect(await rose(upsert(activityRecord(2, { distance_m: 78000 })))).toBe(
			false,
		);
	});

	it("is true for a 9 km ride taking the elevation past the next 1000 m", async () => {
		await rose(upsert(activityRecord(1, { elevation_gain_m: 950 })));
		expect(
			await rose(
				upsert(
					activityRecord(2, {
						start_date: "2026-05-02T08:00:00Z",
						distance_m: 9000,
						moving_time_s: 1800,
						elapsed_time_s: 1800,
						elevation_gain_m: 100,
					}),
				),
			),
		).toBe(true);
	});

	it("is false for a deleted ride", async () => {
		await rose(upsert(activityRecord(1)));
		expect(await rose({ kind: "delete", activityIds: [1] })).toBe(false);
	});

	it("compares with the stored rides evaluated now, not a stale balance", async () => {
		// Stored but never evaluated: no balance row yet.
		await upsertActivity(env.DB, activityRecord(1));
		expect(
			await rose(upsert(activityRecord(2, { sport_type: "EBikeRide" }))),
		).toBe(false);
	});

	describe("team events", () => {
		const apply = (change: TeamEventChange) =>
			applyTeamEventChange(env.DB, change, CURRENT_RULES, window, NOW);

		it("lists the riders whose Team Rynke rose", async () => {
			const eventId = await insertEvent("team_training", "2026-05-02");
			expect(
				(
					await apply({
						kind: "add-attendance",
						eventId,
						athleteIds: [ATHLETE_B, ATHLETE_A],
					})
				).rose,
			).toEqual([ATHLETE_A, ATHLETE_B]);
			expect(
				(
					await apply({
						kind: "remove-attendance",
						eventId,
						athleteIds: [ATHLETE_A],
					})
				).rose,
			).toEqual([]);
		});

		it("is empty for a new event", async () => {
			const result = await apply({
				kind: "create-event",
				event: { kind: "team_training", date: "2026-05-02", name: null },
			});
			expect(result.rose).toEqual([]);
		});
	});
});

describe("send-notification messages", () => {
	let fake: FakeStrava;
	let ctx: TestCtx;

	beforeEach(() => {
		fake = installFakeStrava();
		ctx = makeCtx();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		fake.restore();
	});

	async function deliver(body: unknown) {
		const batch = createMessageBatch("rynke-points-work", [
			{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
		]);
		await handleQueue(batch, ctx);
		return getQueueResult(batch, createExecutionContext());
	}

	const notifications = () =>
		ctx.queue.sent
			.map((m) => m.body)
			.filter((b) => b.kind === "send-notification");

	const event = (activityId: number, aspect = "create") => ({
		kind: "activity-event",
		athleteId: ATHLETE_A,
		activityId,
		aspect,
		changed: [],
	});

	async function devices() {
		fake.addAthlete({ id: ATHLETE_A });
		const a1 = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		const a2 = await seedSubscription(ATHLETE_A, pushEndpoint(2));
		await seedSubscription(ATHLETE_B, pushEndpoint(3));
		return [a1, a2];
	}

	it("queues one per device of the rider for a ride that earns Rynke", async () => {
		const [a1, a2] = await devices();
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: 501 }));

		expect((await deliver(event(501))).explicitAcks).toEqual(["m1"]);
		expect(notifications()).toEqual([
			{ kind: "send-notification", athleteId: ATHLETE_A, subscriptionId: a1 },
			{ kind: "send-notification", athleteId: ATHLETE_A, subscriptionId: a2 },
		]);

		ctx.queue.sent.length = 0;
		await deliver(event(501, "update"));
		expect(notifications()).toEqual([]);
	});

	it("queues none for a ride earning 0 or a delete", async () => {
		await devices();
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({
				id: 502,
				sport_type: "EBikeRide",
				type: "EBikeRide",
			}),
		);
		await deliver(event(502));
		await deliver(event(502, "delete"));
		expect(notifications()).toEqual([]);
	});

	it("queues none for import, re-read or evaluate-rider (FR-016)", async () => {
		await devices();
		const after = seasonStartEpoch("2026-01-01");
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: 503 }));
		await deliver({
			kind: "import-page",
			athleteId: ATHLETE_A,
			page: 1,
			after,
		});
		expect(await balanceRow()).toMatchObject({ distance_rynke: 4 });

		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({ id: 504, start_date: "2026-10-04T07:30:00Z" }),
		);
		await deliver({
			kind: "reread-page",
			athleteId: ATHLETE_A,
			page: 1,
			after,
		});

		await upsertActivity(
			env.DB,
			activityRecord(505, { start_date: "2026-05-01T08:00:00Z" }),
		);
		await deliver({ kind: "evaluate-rider", athleteId: ATHLETE_A });
		expect(await balanceRow()).toMatchObject({ distance_rynke: 12 });

		expect(notifications()).toEqual([]);
	});

	it("queues one per device for attendance, besides evaluate-rider", async () => {
		const a = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		const b = await seedSubscription(ATHLETE_B, pushEndpoint(2));
		const eventId = await insertEvent("team_training", "2026-05-02");

		await teamEventChange(ctx, {
			kind: "add-attendance",
			eventId,
			athleteIds: [ATHLETE_A, ATHLETE_B],
		});

		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{ kind: "evaluate-rider", athleteId: ATHLETE_A },
			{ kind: "evaluate-rider", athleteId: ATHLETE_B },
			{ kind: "send-notification", athleteId: ATHLETE_A, subscriptionId: a },
			{ kind: "send-notification", athleteId: ATHLETE_B, subscriptionId: b },
		]);
	});

	it("still stores the ride when queueing fails (FR-018)", async () => {
		await devices();
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: 506 }));
		ctx.queue.sendBatch = async () => {
			throw new Error("queue down");
		};
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		expect((await deliver(event(506))).explicitAcks).toEqual(["m1"]);
		expect(await balanceRow()).toMatchObject({ distance_rynke: 4 });
		expect(error).toHaveBeenCalledWith(
			"Queueing notifications for 1 riders failed: Error",
		);
	});
});
