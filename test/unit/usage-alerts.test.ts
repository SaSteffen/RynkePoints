import { describe, expect, it } from "vitest";
import { alertPeriod, levelsReached } from "../../src/usage/alerts";
import { historyStart, RECORDED_ALLOWANCES } from "../../src/usage/allowances";

// Levels and periods of the alerts (feature 025 contracts/alerts.md, research R5).

describe("levelsReached", () => {
	it.each([
		[79, []],
		[80, [80]],
		[94, [80]],
		[95, [80, 95]],
		[130, [80, 95]],
	])("%i of 100", (used, levels) => {
		expect(levelsReached(used, 100)).toEqual(levels);
	});
});

describe("alertPeriod", () => {
	it("is the day, or open where nothing resets", () => {
		expect(alertPeriod("strava_read_daily", "2026-11-04")).toBe("2026-11-04");
		expect(alertPeriod("cf_d1_rows_read", "2026-11-04")).toBe("2026-11-04");
		expect(alertPeriod("cf_d1_storage_bytes", "2026-11-04")).toBe("open");
		expect(alertPeriod("riders_connected", "2026-11-04")).toBe("open");
	});
});

describe("what can alert", () => {
	it("leaves out Strava's 15-minute figures (US5 scenario 4)", () => {
		expect(RECORDED_ALLOWANCES).toHaveLength(8);
		expect(RECORDED_ALLOWANCES.join()).not.toContain("15m");
	});
});

describe("historyStart", () => {
	it("is 13 months back", () => {
		expect(historyStart("2026-11-04")).toBe("2025-10-04");
	});

	it("stays in a shorter month", () => {
		expect(historyStart("2027-03-31")).toBe("2026-02-28");
	});
});
