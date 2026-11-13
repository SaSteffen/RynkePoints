import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleScheduled } from "../../src/index";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import {
	cloudflareBody,
	installCloudflare,
	seedUsageDay,
	setStravaUsage,
	WITH_ANALYTICS,
} from "../support/usage";

// The hourly recording (feature 025 FR-013, FR-016, SC-006, research R2 to R4).
// No test reaches Strava or Cloudflare (FR-028).

const NOW = Date.UTC(2026, 10, 4, 12, 58, 0) / 1000;
const TODAY = "2026-11-04";
const YESTERDAY = "2026-11-03";

const hourly = () =>
	createScheduledController({
		scheduledTime: new Date(NOW * 1000),
		cron: "58 * * * *",
	});

function withAnalytics(ctx: TestCtx): TestCtx {
	return { ...ctx, env: { ...ctx.env, ...WITH_ANALYTICS } };
}

async function rows(day = TODAY) {
	const { results } = await env.DB.prepare(
		"SELECT * FROM usage_daily WHERE day = ? ORDER BY allowance",
	)
		.bind(day)
		.all<{
			allowance: string;
			team: string;
			used: number;
			limit_value: number;
			team_used: number | null;
			peak_15m: number | null;
			recorded_at: number;
		}>();
	return new Map(results.map((row) => [row.allowance, row]));
}

const FIGURES = {
	requests: 1000,
	operations: 200,
	rowsRead: 30000,
	rowsWritten: 400,
	storage: 5000,
};

let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx({ now: NOW });
	vi.spyOn(console, "warn").mockImplementation(() => {});
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, {
		athleteId: ATHLETE_B,
		status: "needs_reconnect",
	});
	await setStravaUsage({
		observedAt: NOW - 60,
		readDaily: 1200,
		allDaily: 1500,
		ownReadDaily: 900,
		ownAllDaily: 1000,
		peakRead15m: 200,
		peakAll15m: 250,
	});
});

describe("the hourly cron", () => {
	it("writes all 8 allowances with the limit in effect, team label and own counts", async () => {
		installCloudflare(() =>
			Response.json(cloudflareBody({ [TODAY]: FIGURES })),
		);
		await handleScheduled(hourly(), withAnalytics(ctx));
		const today = await rows();
		expect([...today.keys()].sort()).toEqual([
			"cf_d1_rows_read",
			"cf_d1_rows_written",
			"cf_d1_storage_bytes",
			"cf_queue_operations",
			"cf_worker_requests",
			"riders_connected",
			"strava_all_daily",
			"strava_read_daily",
		]);
		expect(today.get("strava_read_daily")).toMatchObject({
			team: env.TEAM_ID,
			used: 1200,
			limit_value: 3000,
			team_used: 900,
			peak_15m: 200,
			recorded_at: NOW,
		});
		expect(today.get("strava_all_daily")).toMatchObject({
			used: 1500,
			limit_value: 6000,
			team_used: 1000,
			peak_15m: 250,
		});
		expect(today.get("riders_connected")).toMatchObject({
			used: 1,
			limit_value: 999,
			team_used: 1,
			peak_15m: null,
		});
		// The synthetic Workers aren't this team's, so its share is none (026 FR-040).
		expect(today.get("cf_worker_requests")).toMatchObject({
			used: 1000,
			limit_value: 100_000,
			team_used: 0,
		});
		// No queue IDs in team data yet: not split.
		expect(today.get("cf_queue_operations")).toMatchObject({ team_used: null });
		expect(today.get("cf_d1_storage_bytes")).toMatchObject({
			used: 5000,
			limit_value: 5_000_000_000,
		});
	});

	it("doesn't double-count on a repeat", async () => {
		installCloudflare(() =>
			Response.json(cloudflareBody({ [TODAY]: FIGURES })),
		);
		const target = withAnalytics(ctx);
		await handleScheduled(hourly(), target);
		await handleScheduled(hourly(), target);
		expect((await rows()).get("cf_worker_requests")?.used).toBe(1000);
		expect((await rows()).get("strava_read_daily")?.used).toBe(1200);
	});

	it("corrects yesterday, keeping the limit it was recorded with", async () => {
		await seedUsageDay(YESTERDAY, "cf_worker_requests", 900, 50_000);
		await seedUsageDay(YESTERDAY, "strava_read_daily", 77, 1000, { team: 7 });
		installCloudflare(() =>
			Response.json(
				cloudflareBody({
					[YESTERDAY]: { ...FIGURES, requests: 950 },
					[TODAY]: FIGURES,
				}),
			),
		);
		await handleScheduled(hourly(), withAnalytics(ctx));
		const yesterday = await rows(YESTERDAY);
		expect(yesterday.get("cf_worker_requests")).toMatchObject({
			used: 950,
			limit_value: 50_000,
		});
		expect(yesterday.get("strava_read_daily")?.used).toBe(77);
	});

	it("leaves a day Cloudflare says nothing about alone", async () => {
		await seedUsageDay(YESTERDAY, "cf_worker_requests", 900, 100_000);
		installCloudflare(() =>
			Response.json(cloudflareBody({ [TODAY]: FIGURES })),
		);
		await handleScheduled(hourly(), withAnalytics(ctx));
		const yesterday = await rows(YESTERDAY);
		expect(yesterday.get("cf_worker_requests")?.used).toBe(900);
		expect(yesterday.size).toBe(1);
	});

	it("takes the latest storage when today has none, and zero for other figures", async () => {
		installCloudflare(() =>
			Response.json(cloudflareBody({ [YESTERDAY]: FIGURES })),
		);
		await handleScheduled(hourly(), withAnalytics(ctx));
		const today = await rows();
		expect(today.get("cf_d1_storage_bytes")?.used).toBe(5000);
		expect(today.get("cf_worker_requests")?.used).toBe(0);
	});

	it("on a Cloudflare failure keeps stored rows, notes it and still records Strava", async () => {
		await seedUsageDay(TODAY, "cf_worker_requests", 123, 100_000);
		installCloudflare(() => new Response("no", { status: 500 }));
		await handleScheduled(hourly(), withAnalytics(ctx));
		const today = await rows();
		expect(today.get("cf_worker_requests")?.used).toBe(123);
		expect(today.get("strava_read_daily")?.used).toBe(1200);
		expect(
			await env.DB.prepare(
				"SELECT last_success_at, last_failure_at FROM usage_source_state",
			).first(),
		).toEqual({ last_success_at: null, last_failure_at: NOW });
	});

	it("notes a success, and a later failure counts from then", async () => {
		const calls = installCloudflare(() =>
			Response.json(cloudflareBody({ [TODAY]: FIGURES })),
		);
		await handleScheduled(hourly(), withAnalytics(ctx));
		expect(calls).toHaveLength(1);
		expect(
			await env.DB.prepare(
				"SELECT last_success_at, last_failure_at FROM usage_source_state",
			).first(),
		).toEqual({ last_success_at: NOW, last_failure_at: null });
	});

	it("without a token is unavailable, with no fetch at all", async () => {
		await handleScheduled(hourly(), ctx);
		expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
		expect(
			await env.DB.prepare(
				"SELECT last_failure_at FROM usage_source_state",
			).first("last_failure_at"),
		).toBe(NOW);
		expect((await rows()).get("strava_read_daily")?.used).toBe(1200);
	});

	it("counts an old day's Strava figures as zero, with the day's new record", async () => {
		await setStravaUsage({
			observedAt: NOW - 2 * 86_400,
			readDaily: 1200,
			ownReadDaily: 900,
			peakRead15m: 200,
		});
		await handleScheduled(hourly(), ctx);
		expect((await rows()).get("strava_read_daily")).toMatchObject({
			used: 0,
			team_used: 0,
			peak_15m: 0,
		});
	});

	it("does none of the daily work", async () => {
		await handleScheduled(hourly(), ctx);
		expect(ctx.queue.sent).toEqual([]);
	});

	it("stays within 1 % of the allowances over a day (SC-006)", async () => {
		installCloudflare(() =>
			Response.json(cloudflareBody({ [YESTERDAY]: FIGURES, [TODAY]: FIGURES })),
		);
		let written = 0;
		const target = withAnalytics(ctx);
		const db = new Proxy(target.env.DB, {
			get(real, prop) {
				if (prop === "batch") {
					return async (statements: D1PreparedStatement[]) => {
						const results = await real.batch(statements);
						for (const result of results) {
							written += result.meta.rows_written ?? 0;
						}
						return results;
					};
				}
				const value = Reflect.get(real, prop, real);
				return typeof value === "function" ? value.bind(real) : value;
			},
		});
		const counted: TestCtx = { ...target, env: { ...target.env, DB: db } };
		await handleScheduled(hourly(), counted);
		// At most 1,000 rows written a day is 1 % of the 100,000 allowed.
		expect(written * 24).toBeLessThan(1000);
	});
});

describe("the daily cron", () => {
	const daily = () =>
		createScheduledController({
			scheduledTime: new Date(NOW * 1000),
			cron: "17 3 * * *",
		});

	it("doesn't record", async () => {
		await handleScheduled(daily(), ctx);
		expect((await rows()).size).toBe(0);
		expect(ctx.queue.sent.length).toBeGreaterThan(0);
	});

	it("removes days older than 13 months and no newer ones (T019)", async () => {
		await seedUsageDay("2025-10-03", "strava_read_daily", 1, 10);
		await seedUsageDay("2025-10-04", "strava_read_daily", 2, 10);
		await seedUsageDay(TODAY, "strava_read_daily", 3, 10);
		await handleScheduled(daily(), ctx);
		const { results } = await env.DB.prepare(
			"SELECT day FROM usage_daily ORDER BY day",
		).all<{ day: string }>();
		expect(results.map((r) => r.day)).toEqual(["2025-10-04", TODAY]);
	});

	it("removes the ride re-check's days with them (feature 036)", async () => {
		for (const day of ["2025-10-03", "2025-10-04", TODAY]) {
			await env.DB.prepare(
				"INSERT INTO recheck_daily (day, sent) VALUES (?, 1)",
			)
				.bind(day)
				.run();
		}
		await handleScheduled(daily(), ctx);
		const { results } = await env.DB.prepare(
			"SELECT day FROM recheck_daily ORDER BY day",
		).all<{ day: string }>();
		expect(results.map((r) => r.day)).toEqual(["2025-10-04", TODAY]);
	});
});
