import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertBadgeRiseStatement } from "../../src/db/badges";
import { handleQueue } from "../../src/index";
import { type Handlers, processBatch } from "../../src/work/consumer";
import type { ActivityEventMessage } from "../../src/work/messages";
import { notifyRiders } from "../../src/work/send-notification";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import { balanceRow } from "../support/rynke";

// Feature 024 US3: no new push while a rider's Strava work waits; one per rider
// owed one when their queue is empty (FR-015 to FR-017, research R6).

let fake: FakeStrava;
let ctx: TestCtx;
let seq = 0;
let a: number[];
let b: number[];

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	seq = 0;
	fake.addAthlete({ id: ATHLETE_A });
	fake.addAthlete({ id: ATHLETE_B });
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
	a = [
		await seedSubscription(ATHLETE_A, pushEndpoint(1)),
		await seedSubscription(ATHLETE_A, pushEndpoint(2)),
	];
	b = [await seedSubscription(ATHLETE_B, pushEndpoint(3))];
});

afterEach(() => {
	vi.restoreAllMocks();
	fake.restore();
});

const event = (
	athleteId: number,
	activityId: number,
): ActivityEventMessage => ({
	kind: "activity-event",
	athleteId,
	activityId,
	aspect: "create",
	changed: [],
});

function batchOf(bodies: unknown[]) {
	return createMessageBatch(
		"rynke-points-work",
		bodies.map((body) => ({
			id: `m${++seq}`,
			timestamp: new Date(NOW * 1000),
			attempts: 1,
			body,
		})),
	);
}

async function deliver(bodies: unknown[]) {
	const batch = batchOf(bodies);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

/** The devices notified, in order, as `[athleteId, subscriptionId]`. */
const pushes = () =>
	ctx.queue.sent.flatMap((m) =>
		m.body.kind === "send-notification"
			? [[m.body.athleteId, m.body.subscriptionId]]
			: [],
	);

/** A ride that earns Rynke, on its own day so none overlaps another. */
function addRide(id: number, day: number) {
	const date = `2026-05-${String(day).padStart(2, "0")}`;
	fake.addActivity(
		ATHLETE_A,
		makeStravaActivity({
			id,
			start_date: `${date}T08:00:00Z`,
			start_date_local: `${date}T10:00:00Z`,
		}),
	);
}

describe("held notifications", () => {
	it("sends one per device after a backlog, telling all of its rise (FR-015, SC-006)", async () => {
		addRide(601, 1);
		addRide(602, 2);
		addRide(603, 3);
		await deliver([
			event(ATHLETE_A, 601),
			event(ATHLETE_A, 602),
			event(ATHLETE_A, 603),
		]);

		expect(pushes()).toEqual([
			[ATHLETE_A, a[0]],
			[ATHLETE_A, a[1]],
		]);
		const balance = await balanceRow(ATHLETE_A);
		const rise = await env.DB.prepare(
			"SELECT training_rynke FROM rynke_rises WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.first();
		// The whole backlog's rise, not the last ride's.
		expect(rise).toEqual({ training_rynke: balance?.training_rynke });
		expect(Number(balance?.training_rynke)).toBeGreaterThan(0);
	});

	it("notifies a lone event as today (FR-017)", async () => {
		addRide(611, 1);
		await deliver([event(ATHLETE_A, 611)]);
		expect(pushes()).toEqual([
			[ATHLETE_A, a[0]],
			[ATHLETE_A, a[1]],
		]);
	});

	it("sends nothing while the rider's work still waits", async () => {
		addRide(621, 1);
		addRide(622, 2);
		// The second event meets the budget after the first is done.
		await deliver([event(ATHLETE_A, 621)]);
		ctx.queue.sent.length = 0;
		await env.DB.prepare(
			"UPDATE strava_rate_limit SET observed_at = ?, read_15m = 80, all_15m = 80 WHERE id = 1",
		)
			.bind(NOW)
			.run();
		await deliver([event(ATHLETE_A, 622), event(ATHLETE_A, 622)]);
		expect(pushes()).toEqual([]);
	});

	it("sends none after a backlog that earned nothing", async () => {
		for (const id of [631, 632]) {
			fake.addActivity(
				ATHLETE_A,
				makeStravaActivity({ id, sport_type: "EBikeRide", type: "EBikeRide" }),
			);
		}
		await deliver([event(ATHLETE_A, 631), event(ATHLETE_A, 632)]);
		expect(pushes()).toEqual([]);
	});
});

describe("held notifications with stand-in handlers", () => {
	/**
	 * Each event earns the badge `b<activityId>` and notifies the rider, and the
	 * team (rider B) when `team` holds the id, as `teamBadgeNews` would.
	 */
	function handlers(team: number[] = []): Handlers {
		return {
			"activity-event": async (m, _rider, c) => {
				await upsertBadgeRiseStatement(
					env.DB,
					m.athleteId,
					[`b${m.activityId}`],
					c.now(),
				).run();
				const others = team.includes(m.activityId) ? [ATHLETE_B] : [];
				await notifyRiders(c, [m.athleteId, ...others]);
				return { kind: "ok" };
			},
		};
	}

	async function run(bodies: unknown[], h: Handlers) {
		await processBatch(batchOf(bodies), ctx, h);
	}

	it("stores every badge of the backlog in the one badge rise (FR-015)", async () => {
		await run(
			[event(ATHLETE_A, 1), event(ATHLETE_A, 2), event(ATHLETE_A, 3)],
			handlers(),
		);
		expect(pushes()).toEqual([
			[ATHLETE_A, a[0]],
			[ATHLETE_A, a[1]],
		]);
		const rise = await env.DB.prepare(
			"SELECT badge_ids FROM badge_rises WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.first<{ badge_ids: string }>();
		expect(JSON.parse(rise?.badge_ids ?? "[]")).toEqual(["b1", "b2", "b3"]);
	});

	it("holds team badge news for others until the backlog is done (FR-016)", async () => {
		await run(
			[event(ATHLETE_A, 1), event(ATHLETE_A, 2), event(ATHLETE_A, 3)],
			handlers([1, 2]),
		);
		// One for each of A's devices and one for B's, once each.
		expect(pushes()).toEqual([
			[ATHLETE_A, a[0]],
			[ATHLETE_A, a[1]],
			[ATHLETE_B, b[0]],
		]);
	});

	it("notifies a rider without a backlog at once, whatever another's does (US3 scenario 4)", async () => {
		await run(
			[event(ATHLETE_A, 1), event(ATHLETE_B, 7), event(ATHLETE_A, 2)],
			handlers([1]),
		);
		// B's own ride went first after A's first (B's queue was empty); A's
		// team news for B waited for A's last.
		expect(pushes()).toEqual([
			[ATHLETE_B, b[0]],
			[ATHLETE_A, a[0]],
			[ATHLETE_A, a[1]],
			[ATHLETE_B, b[0]],
		]);
	});

	it("drops what a deleted rider's backlog held", async () => {
		await env.DB.prepare(
			"INSERT INTO strava_held (owner_id, recipient_id) VALUES (?, ?)",
		)
			.bind(ATHLETE_A, ATHLETE_B)
			.run();
		await env.DB.prepare("DELETE FROM riders WHERE athlete_id = ?")
			.bind(ATHLETE_A)
			.run();
		expect(
			await env.DB.prepare(
				"SELECT COUNT(*) AS n FROM strava_held",
			).first<number>("n"),
		).toBe(0);
		// B's own ride notifies B once, nothing for A's gone backlog.
		await run([event(ATHLETE_B, 7)], handlers());
		expect(pushes()).toEqual([[ATHLETE_B, b[0]]]);
	});
});
