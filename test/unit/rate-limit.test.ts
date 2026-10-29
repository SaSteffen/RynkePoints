import { describe, expect, it } from "vitest";
import {
	backoffSeconds,
	budgetDecision,
	dayStart,
	deferUntilNextWindow,
	effectiveUsage,
	MAX_DELAY_SECONDS,
	parseUsageHeader,
	type RateLimitState,
	windowStart,
} from "../../src/strava/rate-limit";

const at = (iso: string) => Date.parse(iso) / 1000;

function state(overrides: Partial<RateLimitState> = {}): RateLimitState {
	return {
		observedAt: at("2026-10-06T10:20:00Z"),
		read15m: 0,
		readDaily: 0,
		all15m: 0,
		allDaily: 0,
		limitRead15m: 100,
		limitReadDaily: 1000,
		limitAll15m: 200,
		limitAllDaily: 2000,
		...overrides,
	};
}

describe("parseUsageHeader", () => {
	it("parses '<15min>,<daily>'", () => {
		expect(parseUsageHeader("45,310")).toEqual({ short: 45, daily: 310 });
		expect(parseUsageHeader(" 45 , 310 ")).toEqual({ short: 45, daily: 310 });
	});

	it("returns null for malformed input", () => {
		for (const bad of [
			null,
			"",
			"45",
			"45,",
			"a,b",
			"1,2,3",
			"-1,5",
			"1.5,2",
		]) {
			expect(parseUsageHeader(bad)).toBeNull();
		}
	});
});

describe("windowStart / dayStart", () => {
	it("aligns to :00/:15/:30/:45 UTC", () => {
		expect(windowStart(at("2026-10-06T10:00:00Z"))).toBe(
			at("2026-10-06T10:00:00Z"),
		);
		expect(windowStart(at("2026-10-06T10:14:59Z"))).toBe(
			at("2026-10-06T10:00:00Z"),
		);
		expect(windowStart(at("2026-10-06T10:15:00Z"))).toBe(
			at("2026-10-06T10:15:00Z"),
		);
		expect(windowStart(at("2026-10-06T10:59:30Z"))).toBe(
			at("2026-10-06T10:45:00Z"),
		);
	});

	it("gives UTC midnight", () => {
		expect(dayStart(at("2026-10-06T23:59:59Z"))).toBe(
			at("2026-10-06T00:00:00Z"),
		);
	});
});

describe("effectiveUsage", () => {
	const s = state({ read15m: 50, readDaily: 500, all15m: 60, allDaily: 600 });

	it("keeps counts inside the current window and day", () => {
		expect(effectiveUsage(s, at("2026-10-06T10:29:00Z"))).toEqual(s);
	});

	it("zeroes 15-minute counts after the window ends", () => {
		const e = effectiveUsage(s, at("2026-10-06T10:31:00Z"));
		expect([e.read15m, e.all15m]).toEqual([0, 0]);
		expect([e.readDaily, e.allDaily]).toEqual([500, 600]);
	});

	it("zeroes all counts on the next UTC day", () => {
		const e = effectiveUsage(s, at("2026-10-07T00:00:01Z"));
		expect([e.read15m, e.readDaily, e.all15m, e.allDaily]).toEqual([
			0, 0, 0, 0,
		]);
		expect(e.limitReadDaily).toBe(1000);
	});
});

describe("budgetDecision", () => {
	const now = at("2026-10-06T10:20:00Z");

	it("allows calls under the margins", () => {
		expect(budgetDecision(state({ read15m: 89, readDaily: 949 }), now)).toEqual(
			{ ok: true },
		);
	});

	it("refuses within 10 of the 15-minute read limit until the next window", () => {
		expect(budgetDecision(state({ read15m: 90 }), now)).toEqual({
			ok: false,
			delaySeconds: 600,
		});
	});

	it("refuses within 10 of the 15-minute overall limit", () => {
		expect(budgetDecision(state({ all15m: 190 }), now)).toEqual({
			ok: false,
			delaySeconds: 600,
		});
	});

	it("refuses within 50 of the daily limit until UTC midnight, capped", () => {
		const late = at("2026-10-06T20:00:00Z");
		expect(
			budgetDecision(state({ observedAt: late, readDaily: 950 }), late),
		).toEqual({ ok: false, delaySeconds: 4 * 3600 });
		expect(
			budgetDecision(state({ observedAt: late, allDaily: 1950 }), late),
		).toEqual({ ok: false, delaySeconds: 4 * 3600 });
	});

	it("caps a daily refusal at MAX_DELAY_SECONDS", () => {
		const early = at("2026-10-06T01:00:00Z");
		expect(MAX_DELAY_SECONDS).toBe(43200);
		expect(
			budgetDecision(state({ observedAt: early, readDaily: 999 }), early),
		).toEqual({ ok: false, delaySeconds: 43200 });
	});

	it("keeps today's margins for interactive calls, the default", () => {
		expect(budgetDecision(state({ read15m: 85 }), now)).toEqual({ ok: true });
		expect(budgetDecision(state({ read15m: 89 }), now, "interactive")).toEqual({
			ok: true,
		});
		expect(budgetDecision(state({ read15m: 90 }), now, "interactive")).toEqual({
			ok: false,
			delaySeconds: 600,
		});
	});

	// Feature 024 research R5: background work leaves 10 a window and 50 a day
	// for sign-ins, reconnects and revocations.
	it("stops background work 10 earlier per window", () => {
		expect(budgetDecision(state({ read15m: 79 }), now, "background")).toEqual({
			ok: true,
		});
		expect(budgetDecision(state({ read15m: 80 }), now, "background")).toEqual({
			ok: false,
			delaySeconds: 600,
		});
		expect(budgetDecision(state({ all15m: 180 }), now, "background")).toEqual({
			ok: false,
			delaySeconds: 600,
		});
	});

	it("stops background work 50 earlier per day", () => {
		const late = at("2026-10-06T20:00:00Z");
		expect(
			budgetDecision(
				state({ observedAt: late, readDaily: 899 }),
				late,
				"background",
			),
		).toEqual({ ok: true });
		expect(
			budgetDecision(
				state({ observedAt: late, readDaily: 900 }),
				late,
				"background",
			),
		).toEqual({ ok: false, delaySeconds: 4 * 3600 });
		expect(
			budgetDecision(
				state({ observedAt: late, allDaily: 1900 }),
				late,
				"background",
			),
		).toEqual({ ok: false, delaySeconds: 4 * 3600 });
	});

	it("scales the background share with the limits Strava reports", () => {
		const raised = { limitRead15m: 300, limitReadDaily: 3000 };
		expect(
			budgetDecision(state({ ...raised, read15m: 279 }), now, "background"),
		).toEqual({ ok: true });
		expect(
			budgetDecision(state({ ...raised, read15m: 280 }), now, "background"),
		).toEqual({ ok: false, delaySeconds: 600 });
	});

	it("ignores usage observed in an earlier window", () => {
		expect(
			budgetDecision(
				state({ observedAt: at("2026-10-06T09:59:00Z"), read15m: 100 }),
				now,
			),
		).toEqual({ ok: true });
	});
});

describe("deferUntilNextWindow", () => {
	it("delays until the next 15-minute window", () => {
		expect(deferUntilNextWindow(at("2026-10-06T10:20:00Z"))).toBe(600);
		expect(deferUntilNextWindow(at("2026-10-06T10:15:00Z"))).toBe(900);
	});

	it("never exceeds MAX_DELAY_SECONDS", () => {
		expect(
			deferUntilNextWindow(at("2026-10-06T10:20:00Z")),
		).toBeLessThanOrEqual(MAX_DELAY_SECONDS);
	});
});

describe("backoffSeconds", () => {
	it("is min(30 * 2^attempts, 3600)", () => {
		expect(backoffSeconds(1)).toBe(60);
		expect(backoffSeconds(3)).toBe(240);
		expect(backoffSeconds(6)).toBe(1920);
		expect(backoffSeconds(7)).toBe(3600);
		expect(backoffSeconds(10)).toBe(3600);
	});
});
