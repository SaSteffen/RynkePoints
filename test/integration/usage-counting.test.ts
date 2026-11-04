import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStravaUsage } from "../../src/db/rate-limit";
import { stravaFetch } from "../../src/strava/result";
import { makeCtx, resetDb } from "../support/ctx";
import { countTrips } from "../support/d1-trips";

// This team's own Strava requests (feature 025 FR-010, research R1): counted in
// the one UPDATE each response already causes.

const DAY = 86_400;
const NOW = 20_000 * DAY + 3_000; // 00:50 UTC, in the window from 00:45.

function answer(headers: Record<string, string>) {
	vi.mocked(globalThis.fetch).mockImplementation(
		async () => new Response("{}", { headers }),
	);
}

const WITH_USAGE = {
	"X-ReadRateLimit-Usage": "12,300",
	"X-ReadRateLimit-Limit": "300,3000",
	"X-RateLimit-Usage": "15,400",
	"X-RateLimit-Limit": "600,6000",
};

const call = (now: number, method?: string) =>
	stravaFetch(makeCtx({ now }), "test", "https://www.strava.com/api/v3/x", {
		method,
	});

beforeEach(resetDb);

describe("recordRateLimitHeaders counting", () => {
	it("adds a GET to both own counts, and anything else only to all", async () => {
		answer(WITH_USAGE);
		await call(NOW);
		await call(NOW, "POST");
		expect(await readStravaUsage(env.DB)).toMatchObject({
			ownRead15m: 1,
			ownAll15m: 2,
			ownReadDaily: 1,
			ownAllDaily: 2,
		});
	});

	it("adds nothing for a response without usage headers", async () => {
		answer({});
		await call(NOW);
		expect(await readStravaUsage(env.DB)).toMatchObject({
			ownAll15m: 0,
			ownAllDaily: 0,
			observedAt: 0,
		});
	});

	it("restarts the 15-minute counts in a new window, not the daily ones", async () => {
		answer(WITH_USAGE);
		await call(NOW);
		await call(NOW + 900);
		expect(await readStravaUsage(env.DB)).toMatchObject({
			ownAll15m: 1,
			ownAllDaily: 2,
		});
	});

	it("restarts everything on a new day", async () => {
		answer(WITH_USAGE);
		await call(NOW);
		answer({ ...WITH_USAGE, "X-ReadRateLimit-Usage": "2,2" });
		await call(NOW + DAY);
		expect(await readStravaUsage(env.DB)).toMatchObject({
			ownAll15m: 1,
			ownAllDaily: 1,
			ownReadDaily: 1,
			peakRead15m: 2,
		});
	});

	it("keeps the day's highest 15-minute usage", async () => {
		answer(WITH_USAGE);
		await call(NOW);
		answer({ ...WITH_USAGE, "X-ReadRateLimit-Usage": "3,301" });
		await call(NOW + 900);
		expect(await readStravaUsage(env.DB)).toMatchObject({
			read15m: 3,
			peakRead15m: 12,
			peakAll15m: 15,
		});
	});

	it("causes one UPDATE per response, as before", async () => {
		answer(WITH_USAGE);
		const { ctx, counter } = countTrips(makeCtx({ now: NOW }));
		await stravaFetch(ctx, "test", "https://www.strava.com/api/v3/x", {});
		// One read of the row and one UPDATE.
		expect(counter.calls()).toBe(2);
	});

	it("doesn't lose the response when the write fails", async () => {
		answer(WITH_USAGE);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const ctx = makeCtx({ now: NOW });
		const broken = {
			...ctx,
			env: {
				...ctx.env,
				DB: {
					prepare() {
						throw new Error("D1 down");
					},
				} as unknown as D1Database,
			},
		};
		const res = await stravaFetch(
			broken,
			"test",
			"https://www.strava.com/api/v3/x",
			{},
		);
		expect(res).toBeInstanceOf(Response);
		expect(warn).toHaveBeenCalled();
	});
});
