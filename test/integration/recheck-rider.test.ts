import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { storeWork } from "../../src/db/strava-work";
import { evaluateChange } from "../../src/rynke/apply";
import { toActivityRecord, toRunRecord } from "../../src/strava/activity";
import { processBatch } from "../../src/work/consumer";
import type { RecheckRiderMessage } from "../../src/work/messages";
import { recheckRider } from "../../src/work/recheck-rider";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { countRows } from "../support/d1-rows";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	makeStravaActivity,
	NOW,
	type StravaActivityFixture,
} from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";

// One ride edit re-check (feature 036 contracts/queue-message.md, "Guarantees
// to test"): one request, only what differs written, never retried.

const STAMP = NOW - 600;
const PREVIOUS = NOW - 20 * 3600;
const DAY = "2026-10-06";
const MESSAGE: RecheckRiderMessage = {
	kind: "recheck-rider",
	athleteId: ATHLETE_A,
	stamp: STAMP,
	previous: PREVIOUS,
};

let fake: FakeStrava;
let ctx: TestCtx;

/** A ride that doesn't count: the recording kept running for a long stop. */
function pausedRide(id: number): StravaActivityFixture {
	return makeStravaActivity({
		id,
		start_date: "2026-10-05T07:30:00Z",
		moving_time: 5400,
		elapsed_time: 20000,
	});
}

/** On Strava and stored alike, as the import or an event left them. */
async function stored(...activities: StravaActivityFixture[]): Promise<void> {
	for (const activity of activities) fake.addActivity(ATHLETE_A, activity);
	await evaluateChange(ctx, ATHLETE_A, {
		kind: "upsert",
		records: activities.flatMap(
			(a) => toActivityRecord(a, ATHLETE_A, NOW - 3600) ?? [],
		),
		runs: activities.flatMap(
			(a) => toRunRecord(a, ATHLETE_A, NOW - 3600) ?? [],
		),
	});
}

/** Changes an activity on Strava without an event, as a crop does. */
function edit(id: number, change: Partial<StravaActivityFixture>): void {
	const activity = fake.activities.get(id);
	if (!activity) throw new Error(`no activity ${id}`);
	fake.activities.set(id, { ...activity, ...change });
}

async function process(message: unknown = MESSAGE, attempts = 1) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts, body: message },
	]);
	await processBatch(batch, ctx, { "recheck-rider": recheckRider });
	return getQueueResult(batch, createExecutionContext());
}

async function stamp(): Promise<number | null> {
	return (await getRider(env.DB, ATHLETE_A))?.recheckedAt ?? null;
}

async function setStamp(value: number | null): Promise<void> {
	await env.DB.prepare(
		"UPDATE riders SET rechecked_at = ? WHERE athlete_id = ?",
	)
		.bind(value, ATHLETE_A)
		.run();
}

async function day() {
	return env.DB.prepare("SELECT * FROM recheck_daily WHERE day = ?")
		.bind(DAY)
		.first<Record<string, number | string>>();
}

async function count(sql: string): Promise<number> {
	return (await env.DB.prepare(sql).first<number>("n")) ?? 0;
}

async function result(id: number) {
	return env.DB.prepare(
		"SELECT counts, reasons FROM ride_results WHERE strava_activity_id = ?",
	)
		.bind(id)
		.first<{ counts: number; reasons: string }>();
}

async function training(): Promise<number> {
	return (
		(await env.DB.prepare(
			"SELECT training_rynke FROM rynke_balances WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.first<number>("training_rynke")) ?? 0
	);
}

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	fake.addAthlete({ id: ATHLETE_A });
	ctx = makeCtx();
	await seedRider(ctx);
	await setStamp(STAMP);
});

afterEach(() => fake.restore());

describe("a check that is made", () => {
	// The request's usage headers update the app's one rate-limit row, as for
	// every Strava read; nothing of the rider is written (FR-007).
	it("makes exactly one request and writes nothing when nothing changed", async () => {
		await stored(makeStravaActivity({ id: 1 }), pausedRide(2));
		const { ctx: counted, counter } = countRows(ctx);
		const rider = await getRider(env.DB, ATHLETE_A);
		if (!rider) throw new Error("no rider");
		await recheckRider(MESSAGE, rider, counted, {
			attempts: 1,
			isLastAttempt: false,
		});
		expect(fake.callsTo("activities")).toHaveLength(1);
		expect(counter.written()).toBe(1);
		expect(
			counter
				.statements()
				.filter((sql) => /^\s*(INSERT|UPDATE|DELETE)/i.test(sql)),
		).toEqual([expect.stringMatching(/^UPDATE strava_rate_limit/)]);
		expect(await stamp()).toBe(STAMP);
		expect(await day()).toBeNull();
	});

	it("takes over a crop: the ride counts, with Rynke and a notification (US1 scenarios 1, 5)", async () => {
		await stored(pausedRide(2));
		expect(await result(2)).toMatchObject({ counts: 0 });
		const before = await training();
		const subscription = await seedSubscription(ATHLETE_A, pushEndpoint(1));
		edit(2, { elapsed_time: 6000, distance: 40000 });

		const queue = await process();

		expect(queue.explicitAcks).toEqual(["m1"]);
		expect(fake.callsTo("activities")).toHaveLength(1);
		expect(await result(2)).toMatchObject({ counts: 1 });
		expect(
			await env.DB.prepare(
				"SELECT distance_m, elapsed_time_s FROM activities WHERE strava_activity_id = 2",
			).first(),
		).toEqual({ distance_m: 40000, elapsed_time_s: 6000 });
		expect(await training()).toBeGreaterThan(before);
		expect(ctx.queue.sent.map((m) => m.body)).toContainEqual({
			kind: "send-notification",
			athleteId: ATHLETE_A,
			subscriptionId: subscription,
		});
		expect(await stamp()).toBe(STAMP);
	});

	it("evaluates a ride again when it no longer counts (US1 scenario 2)", async () => {
		await stored(makeStravaActivity({ id: 3 }));
		expect(await result(3)).toMatchObject({ counts: 1 });
		edit(3, { elapsed_time: 20000 });
		await process();
		expect(await result(3)).toMatchObject({ counts: 0 });
		expect(JSON.parse((await result(3))?.reasons ?? "[]")).toContain("pause");
	});

	it("stores and evaluates a lost activity of this season (US1 scenario 4)", async () => {
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: 4 }));
		await process();
		expect(await result(4)).toMatchObject({ counts: 1 });
	});

	it("ignores what the import ignores: before the season, unkept sport types, private without the grant", async () => {
		await env.DB.prepare(
			"UPDATE riders SET scope_read_all = 0 WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.run();
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({
				id: 5,
				start_date: "2025-12-20T07:30:00Z",
				start_date_local: "2025-12-20T09:30:00Z",
			}),
		);
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({ id: 6, sport_type: "Walk", type: "Walk" }),
		);
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: 7, private: true }));
		await process();
		expect(await count("SELECT COUNT(*) AS n FROM activities")).toBe(0);
		expect(await count("SELECT COUNT(*) AS n FROM runs")).toBe(0);
	});

	it("leaves a stored activity missing from the list alone", async () => {
		await stored(makeStravaActivity({ id: 8 }));
		fake.activities.delete(8);
		await process();
		expect(
			await count(
				"SELECT COUNT(*) AS n FROM activities WHERE strava_activity_id = 8",
			),
		).toBe(1);
	});

	it("converges when the same message comes twice: no Rynke twice", async () => {
		await stored(pausedRide(2));
		edit(2, { elapsed_time: 6000 });
		await process();
		const once = await training();
		const rises = await count("SELECT COUNT(*) AS n FROM rynke_rises");
		await process();
		expect(await training()).toBe(once);
		expect(await count("SELECT COUNT(*) AS n FROM rynke_rises")).toBe(rises);
		expect(fake.callsTo("activities")).toHaveLength(2);
	});
});

describe("a check that fails", () => {
	it("trusts no list that isn't newest first (FR-026)", async () => {
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({ id: 9, start_date: "2026-10-01T07:00:00Z" }),
		);
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({ id: 10, start_date: "2026-10-03T07:00:00Z" }),
		);
		fake.newestFirst = false;
		const queue = await process();
		expect(queue.explicitAcks).toEqual(["m1"]);
		expect(await count("SELECT COUNT(*) AS n FROM activities")).toBe(0);
		expect(await day()).toMatchObject({ failed: 1, unordered: 1, skipped: 0 });
		expect(await stamp()).toBe(PREVIOUS);
	});

	it("leaves a stamp a later run has set", async () => {
		fake.newestFirst = false;
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({ id: 9, start_date: "2026-10-01T07:00:00Z" }),
		);
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({ id: 10, start_date: "2026-10-03T07:00:00Z" }),
		);
		await setStamp(NOW);
		await process();
		expect(await stamp()).toBe(NOW);
	});

	it.each([429, 503, 403, 404])(
		"counts a %i as failed, puts the stamp back and never retries",
		async (status) => {
			fake.failNext("activities", { status });
			const queue = await process();
			expect(queue.explicitAcks).toEqual(["m1"]);
			expect(queue.retryMessages).toEqual([]);
			expect(fake.callsTo("activities")).toHaveLength(1);
			expect(await day()).toMatchObject({ failed: 1, unordered: 0 });
			expect(await stamp()).toBe(PREVIOUS);
			expect(await count("SELECT COUNT(*) AS n FROM failed_work")).toBe(0);
			expect(await count("SELECT COUNT(*) AS n FROM strava_work")).toBe(0);
			expect(ctx.queue.sent).toEqual([]);
		},
	);

	it("marks a rider whose token is refused, leaving the stamp", async () => {
		await env.DB.prepare(
			"UPDATE strava_credentials SET expires_at = ? WHERE athlete_id = ?",
		)
			.bind(NOW - 1, ATHLETE_A)
			.run();
		fake.failNext("token", { status: 400 });
		const queue = await process();
		expect(queue.explicitAcks).toEqual(["m1"]);
		expect((await getRider(env.DB, ATHLETE_A))?.status).toBe("needs_reconnect");
		expect(await stamp()).toBe(STAMP);
		expect(await day()).toBeNull();
	});

	it.each([
		["gone", async () => env.DB.prepare("DELETE FROM riders").run()],
		[
			"needs to reconnect",
			async () =>
				env.DB.prepare(
					"UPDATE riders SET status = 'needs_reconnect', reconnect_requested_at = ?",
				)
					.bind(NOW)
					.run(),
		],
	])(
		"acks the message for a rider who is %s, asking nothing",
		async (_l, change) => {
			await change();
			const queue = await process();
			expect(queue.explicitAcks).toEqual(["m1"]);
			expect(fake.calls).toEqual([]);
		},
	);

	it("drops a message whose D1 work keeps failing, never into failed_work", async () => {
		const broken = makeCtx();
		ctx = {
			...broken,
			env: {
				...broken.env,
				DB: new Proxy(broken.env.DB, {
					get(target, prop) {
						if (prop === "batch") {
							return () => Promise.reject(new Error("D1 down"));
						}
						const value = Reflect.get(target, prop, target);
						return typeof value === "function" ? value.bind(target) : value;
					},
				}),
			},
		};
		fake.failNext("activities", { status: 503 });
		const queue = await process(MESSAGE, 11);
		expect(queue.explicitAcks).toEqual(["m1"]);
		expect(await count("SELECT COUNT(*) AS n FROM failed_work")).toBe(0);
	});
});

// Each gate of step 2 (research R8, US5 scenarios 1, 2, 4): no request,
// counted as skipped, the stamp back, the message acked, nothing queued.
describe("a check that stands back", () => {
	it.each<[string, () => Promise<unknown>]>([
		[
			"the import isn't done",
			() => env.DB.prepare("UPDATE riders SET import_status = 'running'").run(),
		],
		[
			"more than half of the day's reads are used",
			() =>
				env.DB.prepare(
					"UPDATE strava_rate_limit SET observed_at = ?, read_daily = 501 WHERE id = 1",
				)
					.bind(NOW)
					.run(),
		],
		[
			"the 15-minute budget leaves only the reserve",
			() =>
				env.DB.prepare(
					"UPDATE strava_rate_limit SET observed_at = ?, read_15m = 80, all_15m = 80 WHERE id = 1",
				)
					.bind(NOW)
					.run(),
		],
		[
			"Strava work is waiting",
			async () => {
				await seedRider(ctx, { athleteId: ATHLETE_A + 10 });
				await storeWork(
					env.DB,
					{ kind: "check-membership", athleteId: ATHLETE_A + 10 },
					1,
					NOW,
				);
			},
		],
	])("when %s", async (_label, gate) => {
		await gate();
		const queue = await process();
		expect(queue.explicitAcks).toEqual(["m1"]);
		expect(fake.callsTo("activities")).toEqual([]);
		expect(await day()).toMatchObject({ skipped: 1, failed: 0 });
		expect(await stamp()).toBe(PREVIOUS);
		expect(
			ctx.queue.sent.filter((m) => m.body.kind === "recheck-rider"),
		).toEqual([]);
	});

	it("checks at exactly half of the day's reads", async () => {
		await env.DB.prepare(
			"UPDATE strava_rate_limit SET observed_at = ?, read_daily = 500 WHERE id = 1",
		)
			.bind(NOW)
			.run();
		await process();
		expect(fake.callsTo("activities")).toHaveLength(1);
	});
});
