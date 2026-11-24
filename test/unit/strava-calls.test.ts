import { describe, expect, it } from "vitest";
import {
	actionOf,
	type CallCount,
	type CallDayRow,
	callBreakdown,
	callDayRows,
	type OwnCallDay,
	ownCallDays,
	type PeerCallDay,
} from "../../src/strava/calls";
import type { WorkMessage } from "../../src/work/messages";

// Strava call counts (feature 047): the action a message's calls count under
// (research R2), the usage view's day rows and their mark (data-model.md ›
// Derived), and a day's breakdown (contracts/usage-view.md). Pure.

const TODAY = "2026-11-24";
const ATHLETE = "1001";

describe("actionOf", () => {
	it.each<[WorkMessage, string | undefined]>([
		[
			{
				kind: "activity-event",
				athleteId: ATHLETE,
				activityId: "7",
				aspect: "create",
				changed: [],
			},
			"ride-event",
		],
		[{ kind: "import-page", athleteId: ATHLETE, page: 1, after: 0 }, "import"],
		[{ kind: "reread-page", athleteId: ATHLETE, page: 1, after: 0 }, "reread"],
		[{ kind: "check-membership", athleteId: ATHLETE }, "club-check"],
		[
			{ kind: "recheck-rider", athleteId: ATHLETE, stamp: 1, previous: null },
			"recheck",
		],
		[
			{
				kind: "delete-rider",
				athleteId: ATHLETE,
				reason: "deauthorized",
				revoke: false,
			},
			"disconnect",
		],
		[
			{
				kind: "delete-rider",
				athleteId: ATHLETE,
				reason: "left-club",
				revoke: true,
			},
			"leave",
		],
		[
			{
				kind: "delete-rider",
				athleteId: ATHLETE,
				reason: "reconnect-expired",
				revoke: true,
			},
			"leave",
		],
		[
			{
				kind: "delete-rider",
				athleteId: ATHLETE,
				reason: "guest-removed",
				revoke: true,
			},
			"leave",
		],
		[{ kind: "evaluate-rider", athleteId: ATHLETE }, undefined],
		[
			{ kind: "send-notification", athleteId: ATHLETE, subscriptionId: 1 },
			undefined,
		],
		[{ kind: "report-hold", athleteId: ATHLETE }, undefined],
	])("maps %o to %s", (message, action) => {
		expect(actionOf(message)).toBe(action);
	});
});

const own = (day: string, values: Partial<OwnCallDay> = {}): OwnCallDay => ({
	day,
	calls: 0,
	heldBack: 0,
	unassigned: 0,
	seen: 0,
	...values,
});

const peer = (day: string, calls: number, seen = 0): PeerCallDay => ({
	day,
	calls,
	seen,
});

/** The row of `day`, or a failure. */
function rowOf(rows: CallDayRow[], day: string): CallDayRow {
	const row = rows.find((r) => r.day === day);
	if (!row) throw new Error(`no row for ${day}`);
	return row;
}

describe("callDayRows", () => {
	it("is empty without any counted day", () => {
		expect(callDayRows(TODAY, [], [])).toEqual([]);
	});

	it("runs from the first counted day to today, newest first, zero in between", () => {
		const rows = callDayRows(
			TODAY,
			[own("2026-11-21", { calls: 5, heldBack: 2 })],
			[],
		);
		expect(rows.map((r) => r.day)).toEqual([
			"2026-11-24",
			"2026-11-23",
			"2026-11-22",
			"2026-11-21",
		]);
		expect(rowOf(rows, "2026-11-21")).toMatchObject({ calls: 5, heldBack: 2 });
		expect(rowOf(rows, "2026-11-23")).toMatchObject({ calls: 0, heldBack: 0 });
	});

	it("shows at most 30 days, today included", () => {
		const rows = callDayRows(TODAY, [own("2026-09-01", { calls: 1 })], []);
		expect(rows).toHaveLength(30);
		expect(rows[0]?.day).toBe(TODAY);
		expect(rows[29]?.day).toBe("2026-10-26");
	});

	it("without other teams: no other team, all teams is this team's", () => {
		const row = rowOf(
			callDayRows(TODAY, [own("2026-11-23", { calls: 300, seen: 301 })], []),
			"2026-11-23",
		);
		expect(row).toMatchObject({ others: null, all: 300, strava: 301 });
	});

	it("adds the other teams up, Strava's count the highest any team saw", () => {
		const row = rowOf(
			callDayRows(
				TODAY,
				[own("2026-11-23", { calls: 300, seen: 410 })],
				[[peer("2026-11-23", 70, 421)], [peer("2026-11-23", 50, 0)]],
			),
			"2026-11-23",
		);
		expect(row).toMatchObject({
			calls: 300,
			others: 120,
			all: 420,
			strava: 421,
			marked: false,
		});
	});

	it("marks a finished day whose gap is over 10 calls and over 1%", () => {
		const marked = (calls: number, seen: number) =>
			rowOf(
				callDayRows(TODAY, [own("2026-11-23", { calls, seen })], []),
				"2026-11-23",
			).marked;
		expect(marked(420, 600)).toBe(true);
		expect(marked(420, 421)).toBe(false);
		// Over 1% but not over 10 calls.
		expect(marked(100, 110)).toBe(false);
		expect(marked(100, 111)).toBe(true);
		// Over 10 calls but not over 1% (1% of 5,000 is 50).
		expect(marked(4950, 5000)).toBe(false);
		expect(marked(4949, 5000)).toBe(true);
		// Counted above Strava's count: seen before the day's last calls.
		expect(marked(600, 420)).toBe(false);
	});

	it("never marks today", () => {
		const rows = callDayRows(
			TODAY,
			[own(TODAY, { calls: 10, seen: 900, unassigned: 3 })],
			[],
		);
		expect(rowOf(rows, TODAY).marked).toBe(false);
	});

	it("marks a finished day with any unassigned call", () => {
		const row = rowOf(
			callDayRows(TODAY, [own("2026-11-23", { calls: 10, unassigned: 1 })], []),
			"2026-11-23",
		);
		expect(row).toMatchObject({ strava: null, marked: true });
	});

	it("leaves Strava's count empty and the day unmarked when nobody saw it", () => {
		const row = rowOf(
			callDayRows(TODAY, [own("2026-11-23", { calls: 10 })], []),
			"2026-11-23",
		);
		expect(row).toMatchObject({ strava: null, marked: false });
	});

	it("says a team's day is missing after its first day, and doesn't mark it", () => {
		const rows = callDayRows(
			TODAY,
			[
				own("2026-11-21", { calls: 100, seen: 130 }),
				own("2026-11-22", { calls: 10, seen: 900 }),
			],
			[[peer("2026-11-21", 20, 120), peer("2026-11-23", 5)]],
		);
		expect(rowOf(rows, "2026-11-22")).toMatchObject({
			others: "missing",
			all: null,
			strava: 900,
			marked: false,
		});
		expect(rowOf(rows, "2026-11-21")).toMatchObject({ others: 20, all: 120 });
		expect(rowOf(rows, TODAY)).toMatchObject({ others: "missing" });
	});

	it("shows nothing for a team before its first day", () => {
		const rows = callDayRows(
			TODAY,
			[own("2026-11-21", { calls: 100 })],
			[[peer("2026-11-23", 5)], [peer("2026-11-22", 7), peer("2026-11-23", 7)]],
		);
		expect(rowOf(rows, "2026-11-21")).toMatchObject({
			others: null,
			all: 100,
		});
		expect(rowOf(rows, "2026-11-22")).toMatchObject({ others: 7 });
		expect(rowOf(rows, "2026-11-23")).toMatchObject({ others: 12 });
	});
});

const count = (
	day: string,
	action: CallCount["action"],
	endpoint: CallCount["endpoint"],
	calls: number,
	heldBack = 0,
): CallCount => ({ day, action, endpoint, calls, heldBack });

describe("ownCallDays", () => {
	it("adds each day's counts up, with its Strava count and its unassigned calls", () => {
		expect(
			ownCallDays(
				[
					count("2026-11-23", "import", "GET /athlete/activities", 30),
					count("2026-11-23", "recheck", "GET /athlete/activities", 0, 4),
					count("2026-11-23", "unassigned", "GET /athlete/clubs", 2),
					count("2026-11-24", "connect", "POST /oauth/token", 1, 1),
				],
				new Map([["2026-11-23", 500]]),
			),
		).toEqual([
			{ day: "2026-11-23", calls: 32, heldBack: 4, unassigned: 2, seen: 500 },
			{ day: "2026-11-24", calls: 1, heldBack: 1, unassigned: 0, seen: 0 },
		]);
	});
});

describe("callBreakdown", () => {
	it("has one row per action with a count and a column per endpoint with calls", () => {
		const breakdown = callBreakdown(
			[
				count(TODAY, "ride-event", "GET /activities/{id}", 40),
				count(TODAY, "connect", "POST /oauth/token", 3, 1),
				count(TODAY, "ride-event", "POST /oauth/token", 2),
				count(TODAY, "recheck", "GET /athlete/activities", 0, 40),
				count("2026-11-23", "import", "GET /athlete/activities", 9),
			],
			TODAY,
		);
		expect(breakdown.endpoints).toEqual([
			"GET /activities/{id}",
			"POST /oauth/token",
		]);
		expect(breakdown.rows).toEqual([
			{ action: "connect", calls: [0, 3], heldBack: 1, total: 3 },
			{ action: "ride-event", calls: [40, 2], heldBack: 0, total: 42 },
			{ action: "recheck", calls: [0, 0], heldBack: 40, total: 0 },
		]);
	});

	it("is empty for a day without counts", () => {
		expect(
			callBreakdown(
				[count("2026-11-23", "import", "GET /athlete/activities", 9)],
				TODAY,
			),
		).toEqual({ endpoints: [], rows: [] });
	});
});
