import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seasonStartEpoch } from "../../src/config";
import { getRider } from "../../src/db/riders";
import { handleQueue } from "../../src/index";
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
		}));
		await deliver(FIRST);
		const { results } = await env.DB.prepare(
			"SELECT elapsed_time_s, is_manual, is_trainer FROM activities ORDER BY start_date",
		).all();
		expect(results).toEqual([
			{ elapsed_time_s: 6000, is_manual: 0, is_trainer: 0 },
			{ elapsed_time_s: 6001, is_manual: 1, is_trainer: 0 },
			{ elapsed_time_s: 6002, is_manual: 0, is_trainer: 1 },
		]);
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
