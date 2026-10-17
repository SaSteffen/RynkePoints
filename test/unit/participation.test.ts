import { describe, expect, it } from "vitest";
import { hasTakenPlace, reportState } from "../../src/rynke/participation";

// What a rider's report at an event counts as (feature 019 data-model.md
// "Derived state", research R1, R2). Dates only, no clock.

const TODAY = "2026-10-06";

describe("hasTakenPlace", () => {
	it("is true from the event's date on (research R2)", () => {
		expect(hasTakenPlace("2026-10-05", TODAY)).toBe(true);
		expect(hasTakenPlace(TODAY, TODAY)).toBe(true);
		expect(hasTakenPlace("2026-10-07", TODAY)).toBe(false);
	});
});

describe("reportState", () => {
	const state = (date: string, reported: boolean, attended = false) =>
		reportState({ date, today: TODAY, reported, attended });

	it("offers 'Bin dabei' before the event and keeps an intent", () => {
		expect(state("2026-10-10", false)).toBe("join");
		expect(state("2026-10-10", true)).toBe("intent");
	});

	it("offers 'Ich war dabei' from the event's date and turns a report into a request", () => {
		expect(state(TODAY, false)).toBe("report");
		expect(state("2026-09-01", false)).toBe("report");
		expect(state(TODAY, true)).toBe("request");
	});

	it("says the rider attended once attendance is recorded", () => {
		expect(state("2026-09-01", false, true)).toBe("attended");
		expect(state("2026-09-01", true, true)).toBe("attended");
	});

	it("turns a request back into an intent when its event moves ahead (spec edge cases)", () => {
		expect(state("2026-09-01", true)).toBe("request");
		expect(state("2026-11-01", true)).toBe("intent");
	});
});
