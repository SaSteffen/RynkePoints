import { describe, expect, it } from "vitest";
import {
	CURRENT_RULES,
	type CountingWindow,
	eventInWindow,
	seasonEnd,
} from "../../src/rynke/rules";
import {
	type Attendance,
	EVENT_KINDS,
	evaluateAttendance,
	isEventKind,
	isTeamEventKind,
	TEAM_EVENT_KINDS,
} from "../../src/rynke/team-events";

// Feature 021: the Tour de Paris is a fourth event kind that earns no Rynke
// (FR-001, FR-002, research R9) and is counted from the season start to the
// season's end rather than to the qualification deadline (FR-003, R10).
// Synthetic dates only.

const WINDOW: CountingWindow = {
	seasonStart: "2026-09-01",
	deadline: "2027-06-30",
};

describe("event kinds", () => {
	it("are the Rynke-earning kinds plus the Tour de Paris", () => {
		expect(EVENT_KINDS).toEqual([...TEAM_EVENT_KINDS, "tour_de_paris"]);
	});

	it("knows the Tour de Paris as an event kind, not a Rynke-earning one", () => {
		expect(isEventKind("tour_de_paris")).toBe(true);
		expect(isTeamEventKind("tour_de_paris")).toBe(false);
		for (const kind of TEAM_EVENT_KINDS) expect(isEventKind(kind)).toBe(true);
		expect(isEventKind("tour")).toBe(false);
		expect(isEventKind("ride")).toBe(false);
	});

	it("has no amounts for the Tour de Paris in the rules (FR-002)", () => {
		expect(Object.keys(CURRENT_RULES.teamEvents)).toEqual([
			...TEAM_EVENT_KINDS,
		]);
		expect("tour_de_paris" in CURRENT_RULES.teamEvents).toBe(false);
	});
});

describe("seasonEnd", () => {
	it("is the day before the season start's anniversary", () => {
		expect(seasonEnd(WINDOW)).toBe("2027-08-31");
		expect(seasonEnd({ seasonStart: "2026-01-01" })).toBe("2026-12-31");
	});

	it("handles a season starting on 29 February", () => {
		expect(seasonEnd({ seasonStart: "2028-02-29" })).toBe("2029-02-28");
	});
});

describe("eventInWindow", () => {
	it("counts a tour day from the season start to the season end", () => {
		expect(eventInWindow("tour_de_paris", "2026-08-31", WINDOW)).toBe(false);
		expect(eventInWindow("tour_de_paris", "2026-09-01", WINDOW)).toBe(true);
		expect(eventInWindow("tour_de_paris", "2027-07-01", WINDOW)).toBe(true);
		expect(eventInWindow("tour_de_paris", "2027-08-31", WINDOW)).toBe(true);
		expect(eventInWindow("tour_de_paris", "2027-09-01", WINDOW)).toBe(false);
	});

	it("counts every other kind from the season start to the deadline", () => {
		for (const kind of TEAM_EVENT_KINDS) {
			expect(eventInWindow(kind, "2026-08-31", WINDOW)).toBe(false);
			expect(eventInWindow(kind, "2026-09-01", WINDOW)).toBe(true);
			expect(eventInWindow(kind, "2027-06-30", WINDOW)).toBe(true);
			expect(eventInWindow(kind, "2027-07-01", WINDOW)).toBe(false);
		}
	});

	it("ends a tour day's window today when the window says so (badges)", () => {
		const today = { ...WINDOW, today: "2027-07-02" };
		expect(eventInWindow("tour_de_paris", "2027-07-02", today)).toBe(true);
		expect(eventInWindow("tour_de_paris", "2027-07-03", today)).toBe(false);
	});
});

describe("evaluateAttendance", () => {
	it("gives a tour attendance nothing (FR-002)", () => {
		const tour: Attendance[] = [
			{ eventId: 1, kind: "tour_de_paris", date: "2027-06-20" },
			{ eventId: 2, kind: "tour_de_paris", date: "2027-06-21" },
		];
		const result = evaluateAttendance(tour, CURRENT_RULES, WINDOW);
		expect(result.team).toBe(0);
		expect(result.training).toBe(0);
		expect(result.byKind.map((s) => s.kind)).toEqual([...TEAM_EVENT_KINDS]);
		expect(result.byKind.every((s) => s.attended === 0)).toBe(true);
	});
});
