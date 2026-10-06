import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seasonStartEpoch } from "../../src/config";
import { listActivityIdsMissingFigures } from "../../src/db/activities";
import { getRider } from "../../src/db/riders";
import { handleQueue } from "../../src/index";
import type { RereadPageMessage } from "../../src/work/messages";
import { rereadPage } from "../../src/work/reread-page";
import {
	makeCtx,
	resetDb,
	seedRider,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
	type StravaActivityFixture,
} from "../support/fixtures";

// The one-time re-read of stored activities (research R20).

const SEASON_START = seasonStartEpoch("2026-01-01");
const FIRST: RereadPageMessage = {
	kind: "reread-page",
	athleteId: ATHLETE_A,
	page: 1,
	after: SEASON_START,
};
const ATTEMPT = { attempts: 1, isLastAttempt: false };

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => {
	vi.restoreAllMocks();
	fake.restore();
});

/** One activity per hour from `start` on, added to the fake. */
function addActivities(
	count: number,
	start: number,
	overrides: (i: number) => Record<string, unknown> = () => ({}),
): StravaActivityFixture[] {
	const added: StravaActivityFixture[] = [];
	for (let i = 0; i < count; i++) {
		const startDate = new Date((start + i * 3600) * 1000).toISOString();
		const activity = makeStravaActivity({
			start_date: startDate,
			start_date_local: startDate,
			...overrides(i),
		});
		fake.addActivity(ATHLETE_A, activity);
		added.push(activity);
	}
	return added;
}

/** A row as migration 0002 leaves it: every new figure `NULL`. */
async function seedUnknownFigures(
	activityIds: number[],
	athleteId = ATHLETE_A,
): Promise<void> {
	if (activityIds.length === 0) return;
	await env.DB.batch(
		activityIds.map((id) =>
			env.DB.prepare(
				`INSERT INTO activities (strava_activity_id, athlete_id, sport_type,
					start_date, start_date_local, timezone, distance_m, moving_time_s,
					elevation_gain_m, is_private, refreshed_at)
				VALUES (?, ?, 'Ride', '2026-03-01T07:00:00Z', '2026-03-01T08:00:00Z',
					'(GMT+01:00) Europe/Berlin', 1000, 600, 10, 0, ?)`,
			).bind(id, athleteId, NOW - 86400),
		),
	);
}

/** A row as migration 0003 leaves it: the 0002 figures set, the flag `NULL`. */
async function seedUnknownFlag(activityIds: number[]): Promise<void> {
	await env.DB.batch(
		activityIds.map((id) =>
			env.DB.prepare(
				`INSERT INTO activities (strava_activity_id, athlete_id, sport_type,
					start_date, start_date_local, timezone, distance_m, moving_time_s,
					elevation_gain_m, is_private, refreshed_at, elapsed_time_s,
					is_manual, is_trainer)
				VALUES (?, ?, 'Ride', '2026-03-01T07:00:00Z', '2026-03-01T08:00:00Z',
					'(GMT+01:00) Europe/Berlin', 1000, 600, 10, 0, ?, 700, 0, 0)`,
			).bind(id, ATHLETE_A, NOW - 86400),
		),
	);
}

/** Delivers one message through the Worker's queue handler. */
async function deliver(body: unknown) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

/** Delivers `first` and every message it leads to, in order. */
async function drain(first: unknown, inspect: () => Promise<void>) {
	const queued: unknown[] = [first];
	while (queued.length > 0) {
		const sentBefore = ctx.queue.sent.length;
		const result = await deliver(queued.shift());
		expect(result.explicitAcks).toEqual(["m1"]);
		await inspect();
		queued.push(...ctx.queue.sent.slice(sentBefore).map((m) => m.body));
	}
}

async function importStatus() {
	return (await getRider(env.DB, ATHLETE_A))?.importStatus;
}

async function rider() {
	const r = await getRider(env.DB, ATHLETE_A);
	if (!r) throw new Error("rider not seeded");
	return r;
}

function refetch(activityId: number, athleteId = ATHLETE_A) {
	return {
		kind: "activity-event",
		athleteId,
		activityId,
		aspect: "update",
		changed: [],
	};
}

describe("reread-page", () => {
	it("re-reads the season page by page and fills every row", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { importStatus: "done", figuresVersion: 0 });
		const added = addActivities(450, SEASON_START + 86400, (i) => ({
			elapsed_time: 6000 + i,
			trainer: i % 3 === 0,
		}));
		await seedUnknownFigures(added.map((a) => a.id));

		const statuses: (string | undefined)[] = [];
		await drain(FIRST, async () => {
			statuses.push(await importStatus());
		});

		const calls = fake.callsTo("activities");
		expect(calls.map((c) => c.url.searchParams.get("page"))).toEqual([
			"1",
			"2",
			"3",
		]);
		for (const call of calls) {
			expect(call.url.searchParams.get("after")).toBe(String(SEASON_START));
			expect(call.url.searchParams.get("per_page")).toBe("200");
		}
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{ ...FIRST, page: 2 },
			{ ...FIRST, page: 3 },
		]);
		expect(statuses).toEqual(["done", "done", "done"]);
		expect(await listActivityIdsMissingFigures(env.DB, ATHLETE_A)).toEqual([]);
		expect((await tableCounts()).activities).toBe(450);
		const { results } = await env.DB.prepare(
			`SELECT elapsed_time_s, is_manual, is_trainer FROM activities
			WHERE strava_activity_id = ?`,
		)
			.bind(added[3]?.id)
			.all();
		expect(results).toEqual([
			{ elapsed_time_s: 6003, is_manual: 0, is_trainer: 1 },
		]);
	});

	it("fills Strava's flag on rows stored before 0003", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { importStatus: "done", figuresVersion: 1 });
		const added = addActivities(3, SEASON_START + 86400, (i) => ({
			flagged: i === 1,
		}));
		await seedUnknownFlag(added.map((a) => a.id));

		await drain(FIRST, async () => {});

		expect(await listActivityIdsMissingFigures(env.DB, ATHLETE_A)).toEqual([]);
		const { results } = await env.DB.prepare(
			"SELECT is_flagged FROM activities ORDER BY start_date",
		).all();
		expect(results).toEqual([
			{ is_flagged: 0 },
			{ is_flagged: 1 },
			{ is_flagged: 0 },
		]);
	});

	it("refetches a row whose summary omits Strava's flag", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { figuresVersion: 1 });
		const [filled, omitsFlag] = addActivities(2, SEASON_START + 86400);
		if (!filled || !omitsFlag) throw new Error("activities not added");
		delete omitsFlag.flagged;
		fake.addActivity(ATHLETE_A, omitsFlag);
		await seedUnknownFlag([filled.id, omitsFlag.id]);

		await deliver(FIRST);

		expect(ctx.queue.sent.map((m) => m.body)).toEqual([refetch(omitsFlag.id)]);
	});

	it("never touches the import status", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { importStatus: "running", figuresVersion: 0 });
		addActivities(3, SEASON_START + 86400);
		await deliver(FIRST);
		expect(await importStatus()).toBe("running");
	});

	it("stores no private activities without read_all", async () => {
		// The stored grant decides, even if Strava returns more (FR-007).
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { scopeReadAll: false, figuresVersion: 0 });
		addActivities(4, SEASON_START + 86400, (i) => ({ private: i % 2 === 0 }));
		await deliver(FIRST);
		const { results } = await env.DB.prepare(
			"SELECT is_private FROM activities",
		).all<{ is_private: number }>();
		expect(results).toEqual([{ is_private: 0 }, { is_private: 0 }]);
	});

	it("refetches rows still missing a figure after the last page", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		fake.addAthlete({ id: ATHLETE_B });
		await seedRider(ctx, { figuresVersion: 0 });
		await seedRider(ctx, { athleteId: ATHLETE_B, figuresVersion: 0 });
		const [filled, omitsManual] = addActivities(2, SEASON_START + 86400);
		if (!filled || !omitsManual) throw new Error("activities not added");
		delete omitsManual.manual;
		fake.addActivity(ATHLETE_A, omitsManual);
		const gone = 7_400_001;
		const otherRider = 7_400_002;
		await seedUnknownFigures([filled.id, omitsManual.id, gone]);
		await seedUnknownFigures([otherRider], ATHLETE_B);

		await deliver(FIRST);

		expect(ctx.queue.sent.map((m) => m.body)).toEqual(
			[omitsManual.id, gone].sort((a, b) => a - b).map((id) => refetch(id)),
		);
		expect(
			await listActivityIdsMissingFigures(env.DB, ATHLETE_A),
		).not.toContain(filled.id);
	});

	it("deletes a leftover row Strava no longer has", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { figuresVersion: 0 });
		const gone = 7_400_001;
		await seedUnknownFigures([gone]);

		await drain(FIRST, async () => {});

		expect(fake.callsTo("activity")).toHaveLength(1);
		expect((await tableCounts()).activities).toBe(0);
	});

	it("sends the refetches in batches of 100", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { figuresVersion: 0 });
		const ids = Array.from({ length: 150 }, (_, i) => 7_500_001 + i);
		await seedUnknownFigures(ids);
		const sendBatch = vi.spyOn(ctx.queue, "sendBatch");

		await rereadPage(FIRST, await rider(), ctx, ATTEMPT);

		expect(sendBatch.mock.calls.map(([batch]) => [...batch].length)).toEqual([
			100, 50,
		]);
		expect(ctx.queue.sent.map((m) => m.body)).toEqual(
			ids.map((id) => refetch(id)),
		);
	});

	it("defers without calling Strava when the budget is exhausted", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { figuresVersion: 0 });
		await seedUnknownFigures([7_400_001]);
		await env.DB.prepare(
			"UPDATE strava_rate_limit SET observed_at = ?, read_15m = 100 WHERE id = 1",
		)
			.bind(NOW)
			.run();
		const result = await rereadPage(FIRST, await rider(), ctx, ATTEMPT);
		expect(result).toMatchObject({ kind: "budget" });
		expect(fake.calls).toEqual([]);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("reports transient on a Strava 5xx and changes nothing", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { figuresVersion: 0 });
		addActivities(2, SEASON_START + 86400);
		await seedUnknownFigures([7_400_001]);
		fake.failNext("activities", { status: 503 });
		const result = await rereadPage(FIRST, await rider(), ctx, ATTEMPT);
		expect(result).toMatchObject({ kind: "transient" });
		expect(ctx.queue.sent).toEqual([]);
		expect((await tableCounts()).activities).toBe(1);
	});
});
