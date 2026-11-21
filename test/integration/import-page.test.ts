import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seasonStartEpoch } from "../../src/config";
import { upsertActivity } from "../../src/db/activities";
import { getRider } from "../../src/db/riders";
import { handleQueue } from "../../src/index";
import { compareIds } from "../../src/strava/id";
import { PER_PAGE } from "../../src/work/activity-page";
import { importPage } from "../../src/work/import-page";
import type { ImportPageMessage } from "../../src/work/messages";
import {
	makeCtx,
	resetDb,
	seedRider,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";
import {
	activityRecord,
	balanceRow,
	expectConsistent,
	resultRows,
} from "../support/rynke";

const SEASON_START = seasonStartEpoch("2026-01-01");
const FIRST: ImportPageMessage = {
	kind: "import-page",
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

afterEach(() => fake.restore());

/** One activity per hour from `start` on. */
function addActivities(
	count: number,
	start: number,
	overrides: (i: number) => Record<string, unknown> = () => ({}),
) {
	for (let i = 0; i < count; i++) {
		const startDate = new Date((start + i * 3600) * 1000).toISOString();
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({
				start_date: startDate,
				start_date_local: startDate,
				...overrides(i),
			}),
		);
	}
}

/** The start of activity `i` that `addActivities` adds from a day into the season. */
const hourly = (i: number) => SEASON_START + 86400 + i * 3600;

/** Delivers one message through the Worker's queue handler. */
async function deliver(body: unknown) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

async function importStatus() {
	return (await getRider(env.DB, ATHLETE_A))?.importStatus;
}

describe("import-page", () => {
	it("imports the season page by page", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { importStatus: "pending" });
		addActivities(450, SEASON_START + 86400, (i) =>
			i % 20 === 7 && i < 400 ? { sport_type: "Run", type: "Run" } : {},
		);
		addActivities(5, SEASON_START - 30 * 86400);

		const queued: unknown[] = [FIRST];
		const statuses: (string | undefined)[] = [];
		while (queued.length > 0) {
			const sentBefore = ctx.queue.sent.length;
			const result = await deliver(queued.shift());
			expect(result.explicitAcks).toEqual(["m1"]);
			statuses.push(await importStatus());
			queued.push(...ctx.queue.sent.slice(sentBefore).map((m) => m.body));
		}

		// Each page after the newest start listed, one second earlier (review
		// L-21).
		const second = hourly(199) - 1;
		const third = hourly(398) - 1;
		const calls = fake.callsTo("activities");
		expect(
			calls.map((c) => [
				c.url.searchParams.get("after"),
				c.url.searchParams.get("page"),
				c.url.searchParams.get("per_page"),
			]),
		).toEqual([
			[String(SEASON_START), "1", "200"],
			[String(second), "1", "200"],
			[String(third), "1", "200"],
		]);
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{ ...FIRST, after: second },
			{ ...FIRST, after: third },
		]);
		expect((await tableCounts()).activities).toBe(430);
		expect(statuses).toEqual(["running", "running", "done"]);
	});

	it("stores the points figures of every cycling item", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		addActivities(3, SEASON_START + 86400, (i) => ({
			elapsed_time: 6000 + i,
			manual: i === 1,
			trainer: i === 2,
			flagged: i === 0,
		}));
		await deliver(FIRST);
		const { results } = await env.DB.prepare(
			`SELECT elapsed_time_s, is_manual, is_trainer, is_flagged FROM activities
			ORDER BY start_date`,
		).all();
		expect(results).toEqual([
			{ elapsed_time_s: 6000, is_manual: 0, is_trainer: 0, is_flagged: 1 },
			{ elapsed_time_s: 6001, is_manual: 1, is_trainer: 0, is_flagged: 0 },
			{ elapsed_time_s: 6002, is_manual: 0, is_trainer: 1, is_flagged: 0 },
		]);
	});

	it("stores ride results and the balance with the page", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		addActivities(3, SEASON_START + 86400, (i) => ({ flagged: i === 1 }));
		await deliver(FIRST);
		const rows = await resultRows();
		expect(rows).toHaveLength(3);
		expect(rows.map((r) => r.reasons)).toContain('["flagged"]');
		expect(await balanceRow()).not.toBeNull();
		await expectConsistent();
	});

	it("gives a rider without rides a zero balance", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		await deliver(FIRST);
		expect(await resultRows()).toEqual([]);
		expect(await balanceRow()).toMatchObject({
			distance_rynke: 0,
			training_rynke: 0,
		});
	});

	it("keeps the season start the import was started with", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		const after = SEASON_START - 365 * 86400;
		await deliver({ ...FIRST, after });
		expect(fake.callsTo("activities")[0]?.url.searchParams.get("after")).toBe(
			String(after),
		);
	});

	describe("pages by start (review L-21)", () => {
		/** Delivers `first` and what it queues, at most `limit` messages. */
		async function drain(first: ImportPageMessage, limit = 5) {
			const queued: unknown[] = [first];
			for (let n = 0; n < limit && queued.length > 0; n++) {
				const sentBefore = ctx.queue.sent.length;
				await deliver(queued.shift());
				queued.push(...ctx.queue.sent.slice(sentBefore).map((m) => m.body));
			}
			return queued;
		}

		async function storedIds() {
			const { results } = await env.DB.prepare(
				"SELECT CAST(strava_activity_id AS TEXT) AS strava_activity_id FROM activities ORDER BY activities.strava_activity_id",
			).all<{ strava_activity_id: string }>();
			return results.map((r) => r.strava_activity_id);
		}

		it("misses nothing when an activity is deleted between two pages", async () => {
			fake.addAthlete({ id: ATHLETE_A });
			await seedRider(ctx);
			addActivities(250, SEASON_START + 86400);
			const all = [...fake.activities.keys()].sort(compareIds);
			await deliver(FIRST);
			// Deleted on Strava after the first page was read.
			const [deleted] = [...fake.activities.values()].sort(
				(a, b) => Date.parse(a.start_date) - Date.parse(b.start_date),
			);
			if (!deleted) throw new Error("nothing added");
			fake.activities.delete(deleted.id);
			expect(await drain(ctx.queue.sent[0]?.body as ImportPageMessage)).toEqual(
				[],
			);
			expect(await storedIds()).toEqual(all);
			expect(await importStatus()).toBe("done");
		});

		it("lists again what starts in the same second as a page's newest", async () => {
			fake.addAthlete({ id: ATHLETE_A });
			await seedRider(ctx);
			const tie = new Date(hourly(PER_PAGE - 1) * 1000).toISOString();
			addActivities(PER_PAGE + 1, SEASON_START + 86400, (i) =>
				i === PER_PAGE ? { start_date: tie, start_date_local: tie } : {},
			);
			expect(await drain(FIRST)).toEqual([]);
			expect(await storedIds()).toHaveLength(PER_PAGE + 1);
		});

		it("ends when a whole page starts in the same second", async () => {
			fake.addAthlete({ id: ATHLETE_A });
			await seedRider(ctx);
			const same = new Date(hourly(0) * 1000).toISOString();
			addActivities(PER_PAGE + 50, SEASON_START + 86400, () => ({
				start_date: same,
				start_date_local: same,
			}));
			expect(await drain(FIRST)).toEqual([]);
			expect(await importStatus()).toBe("done");
		});
	});

	it("goes on by start from a page sent by number before", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		addActivities(PER_PAGE * 2, SEASON_START + 86400);
		await deliver({ ...FIRST, page: 2 });
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{ ...FIRST, after: hourly(2 * PER_PAGE - 1) - 1 },
		]);
	});

	it("is idempotent when a page is processed twice", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		addActivities(250, SEASON_START + 86400);
		await deliver({ ...FIRST, page: 2 });
		await deliver({ ...FIRST, page: 2 });
		expect((await tableCounts()).activities).toBe(50);
	});

	it("stores no private activities without read_all", async () => {
		fake.addAthlete({
			id: ATHLETE_A,
			scopes: ["read", "activity:read"],
		});
		await seedRider(ctx, { scopeReadAll: false });
		addActivities(4, SEASON_START + 86400, (i) => ({ private: i % 2 === 0 }));
		await deliver(FIRST);
		const { results } = await env.DB.prepare(
			"SELECT is_private FROM activities",
		).all<{ is_private: number }>();
		expect(results).toEqual([{ is_private: 0 }, { is_private: 0 }]);
	});

	it("drops private activities Strava still returns without read_all", async () => {
		// The stored grant is what counts, even if Strava answers more.
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { scopeReadAll: false });
		addActivities(4, SEASON_START + 86400, (i) => ({ private: i % 2 === 0 }));
		await deliver(FIRST);
		expect((await tableCounts()).activities).toBe(2);
	});

	describe("after the last page (review L-03)", () => {
		const KEPT = "7300001";
		const GONE = "7300002";
		const SINCE = "7300003";

		/** Stores KEPT (still on Strava), GONE (not) and SINCE (refreshed since the import began). */
		async function storeBefore() {
			fake.addAthlete({ id: ATHLETE_A });
			await seedRider(ctx);
			fake.addActivity(
				ATHLETE_A,
				makeStravaActivity({ id: KEPT, start_date: "2026-05-01T08:00:00Z" }),
			);
			for (const [id, refreshed] of [
				[KEPT, NOW - 3600],
				[GONE, NOW - 3600],
				[SINCE, NOW],
			]) {
				await upsertActivity(
					env.DB,
					activityRecord(id as string, { refreshed_at: refreshed as number }),
				);
			}
		}

		it("refetches each stored activity the import didn't list", async () => {
			await storeBefore();
			await deliver({ ...FIRST, startedAt: NOW - 60 });
			expect(ctx.queue.sent.map((m) => m.body)).toEqual([
				{
					kind: "activity-event",
					athleteId: ATHLETE_A,
					activityId: GONE,
					aspect: "update",
					changed: [],
				},
			]);

			// The decision table removes it: Strava answers 404.
			await deliver(ctx.queue.sent[0]?.body);
			const { results } = await env.DB.prepare(
				"SELECT CAST(strava_activity_id AS TEXT) AS strava_activity_id FROM activities ORDER BY activities.strava_activity_id",
			).all<{ strava_activity_id: string }>();
			expect(results.map((r) => r.strava_activity_id)).toEqual([KEPT, SINCE]);
			await expectConsistent();
		});

		it("refetches nothing for an import without a start time", async () => {
			await storeBefore();
			await deliver(FIRST);
			expect(ctx.queue.sent).toEqual([]);
		});

		it("refetches nothing before the last page", async () => {
			await storeBefore();
			addActivities(PER_PAGE, SEASON_START + 86400);
			await deliver({ ...FIRST, startedAt: NOW - 60 });
			expect(ctx.queue.sent.map((m) => m.body)).toEqual([
				{ ...FIRST, startedAt: NOW - 60, after: hourly(PER_PAGE - 1) - 1 },
			]);
		});
	});

	it("defers without calling Strava when the budget is exhausted", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		await env.DB.prepare(
			"UPDATE strava_rate_limit SET observed_at = ?, read_15m = 100 WHERE id = 1",
		)
			.bind(NOW)
			.run();
		const rider = await getRider(env.DB, ATHLETE_A);
		if (!rider) throw new Error("rider not seeded");
		const result = await importPage(FIRST, rider, ctx, ATTEMPT);
		expect(result).toMatchObject({ kind: "budget" });
		expect(fake.calls).toEqual([]);
	});

	it("reports transient on a Strava 5xx and changes nothing", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { importStatus: "pending" });
		fake.failNext("activities", { status: 503 });
		const rider = await getRider(env.DB, ATHLETE_A);
		if (!rider) throw new Error("rider not seeded");
		const result = await importPage(FIRST, rider, ctx, ATTEMPT);
		expect(result).toMatchObject({ kind: "transient" });
		expect(await importStatus()).toBe("pending");
		expect(ctx.queue.sent).toEqual([]);
	});
});
