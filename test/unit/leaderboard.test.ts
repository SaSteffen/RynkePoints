import { describe, expect, it } from "vitest";
import {
	type LeaderboardRider,
	type LeaderboardRow,
	leaderboardRows,
	neighbourhood,
	teamTotals,
} from "../../src/rynke/leaderboard";
import type { WeekPoint } from "../../src/rynke/weeks";

// Places, ties and the neighbourhood of the Team page (016 research R6,
// data-model.md `LeaderboardRow`, `Viewer`, `Neighbourhood`). Synthetic riders
// only.

const VIEWER = 900_100;

/** A listed rider with these totals, a first name and two week points. */
function rider(
	athleteId: number,
	training: number | null,
	team = 0,
): LeaderboardRider & { firstName: string } {
	return {
		athleteId,
		firstName: `Synth${athleteId}`,
		balance:
			training === null ? null : { trainingRynke: training, teamRynke: team },
		weeks: [
			{
				weekEnd: "2026-10-04",
				training: Math.floor((training ?? 0) / 2),
				team,
			},
			{ weekEnd: "2026-10-06", training: training ?? 0, team },
		],
	};
}

/** `count` riders with Training count, count − 1, …, 1; the viewer at `place`. */
function team(count: number, place: number) {
	return Array.from({ length: count }, (_, i) =>
		rider(i + 1 === place ? VIEWER : 900_000 + i, count - i),
	);
}

const places = (rows: readonly LeaderboardRow[]) => rows.map((r) => r.place);

describe("leaderboardRows", () => {
	it("orders by the picked kind, then the other kind, then athlete ID", () => {
		const riders = [
			rider(900_003, 10, 1),
			rider(900_001, 10, 1),
			rider(900_002, 10, 5),
			rider(VIEWER, 20, 0),
		];
		const { rows } = leaderboardRows(riders, VIEWER, "training");
		expect(rows.map((r) => [r.you, r.total, r.other])).toEqual([
			[true, 20, 0],
			[false, 10, 5],
			[false, 10, 1],
			[false, 10, 1],
		]);
	});

	it("breaks a full tie by athlete ID", () => {
		const riders = [rider(VIEWER, 10, 1), rider(900_001, 10, 1)];
		const { rows } = leaderboardRows(riders, VIEWER, "training");
		expect(rows.map((r) => r.you)).toEqual([false, true]);
		expect(rows.map((r) => [r.place, r.joint])).toEqual([
			[1, true],
			[1, true],
		]);
	});

	it("reorders by Team for the Team kind", () => {
		const riders = [rider(900_001, 30, 2), rider(VIEWER, 10, 7)];
		const { rows, viewer } = leaderboardRows(riders, VIEWER, "team");
		expect(rows.map((r) => [r.you, r.total, r.other])).toEqual([
			[true, 7, 10],
			[false, 2, 30],
		]);
		expect(rows.map((r) => r.weeks)).toEqual([
			[7, 7],
			[2, 2],
		]);
		expect(viewer).toMatchObject({ place: 1, lead: true });
	});

	it("gives the Training weeks for the Training kind", () => {
		const { rows } = leaderboardRows([rider(VIEWER, 9)], VIEWER, "training");
		expect(rows[0]?.weeks).toEqual([4, 9]);
	});

	it("ranks equal totals on a shared place and skips the next (1, 2, 2, 4)", () => {
		const riders = [
			rider(900_001, 40),
			rider(VIEWER, 30),
			rider(900_002, 30),
			rider(900_003, 10),
		];
		const { rows, viewer } = leaderboardRows(riders, VIEWER, "training");
		expect(places(rows)).toEqual([1, 2, 2, 4]);
		expect(rows.map((r) => r.joint)).toEqual([false, true, true, false]);
		expect(viewer).toEqual({
			place: 2,
			joint: true,
			count: 4,
			toNext: 11,
			lead: false,
		});
	});

	it("needs the smallest total above the viewer's, plus 1, to pass", () => {
		const riders = [
			rider(900_001, 50),
			rider(900_002, 42),
			rider(900_003, 42),
			rider(VIEWER, 30),
		];
		const { viewer } = leaderboardRows(riders, VIEWER, "training");
		expect(viewer).toMatchObject({ place: 4, joint: false, toNext: 13 });
	});

	it("gives 1st place the lead instead of a gap, shared or not", () => {
		const alone = leaderboardRows(
			[rider(VIEWER, 50), rider(900_001, 40)],
			VIEWER,
			"training",
		);
		expect(alone.viewer).toEqual({
			place: 1,
			joint: false,
			count: 2,
			toNext: null,
			lead: true,
		});
		const shared = leaderboardRows(
			[rider(VIEWER, 50), rider(900_001, 50)],
			VIEWER,
			"training",
		);
		expect(shared.viewer).toMatchObject({ place: 1, joint: true, lead: true });
	});

	it("counts a listed rider without a balance with 0 in both kinds", () => {
		const riders = [rider(900_001, null), rider(VIEWER, 3, 1)];
		const { rows, viewer } = leaderboardRows(riders, VIEWER, "training");
		expect(rows.map((r) => [r.you, r.place, r.total, r.other])).toEqual([
			[true, 1, 3, 1],
			[false, 2, 0, 0],
		]);
		expect(viewer?.count).toBe(2);
	});

	it("gives a viewer who isn't listed every row, no own row and no Viewer", () => {
		const { rows, viewer } = leaderboardRows(team(9, 0), VIEWER, "training");
		expect(rows).toHaveLength(9);
		expect(rows.some((r) => r.you)).toBe(false);
		expect(viewer).toBeNull();
		expect(neighbourhood(rows, false)).toEqual({
			rows,
			hiddenAhead: 0,
			hiddenBehind: 0,
			toggle: false,
		});
	});

	it("names nobody: no athlete ID, first name or profile link leaves it", () => {
		const result = leaderboardRows(team(14, 6), VIEWER, "training");
		const text = JSON.stringify([result, neighbourhood(result.rows, false)]);
		for (const key of ["athleteId", "firstName", "profileLink"]) {
			expect(text).not.toContain(key);
		}
		expect(text).not.toContain("Synth");
		expect(text).not.toContain(String(VIEWER));
		for (const row of result.rows) {
			expect(Object.keys(row).sort()).toEqual([
				"joint",
				"other",
				"place",
				"total",
				"weeks",
				"you",
			]);
		}
	});
});

describe("neighbourhood", () => {
	const shown = (count: number, place: number, all = false) =>
		neighbourhood(
			leaderboardRows(team(count, place), VIEWER, "training").rows,
			all,
		);

	it("shows three rows either side of the viewer (6th of 14)", () => {
		const view = shown(14, 6);
		expect(places(view.rows)).toEqual([3, 4, 5, 6, 7, 8, 9]);
		expect(view).toMatchObject({
			hiddenAhead: 2,
			hiddenBehind: 5,
			toggle: true,
		});
	});

	it("cuts at the top without filling up from below (2nd)", () => {
		const view = shown(14, 2);
		expect(places(view.rows)).toEqual([1, 2, 3, 4, 5]);
		expect(view).toMatchObject({ hiddenAhead: 0, hiddenBehind: 9 });
	});

	it("cuts at the bottom (last)", () => {
		const view = shown(14, 14);
		expect(places(view.rows)).toEqual([11, 12, 13, 14]);
		expect(view).toMatchObject({ hiddenAhead: 10, hiddenBehind: 0 });
	});

	it("shows every row and no toggle with seven rows", () => {
		const view = shown(7, 1);
		expect(places(view.rows)).toEqual([1, 2, 3, 4, 5, 6, 7]);
		expect(view).toMatchObject({
			hiddenAhead: 0,
			hiddenBehind: 0,
			toggle: false,
		});
	});

	it("offers the toggle from eight rows", () => {
		const view = shown(8, 1);
		expect(places(view.rows)).toEqual([1, 2, 3, 4]);
		expect(view).toMatchObject({ hiddenBehind: 4, toggle: true });
	});

	it("shows every row for Everyone", () => {
		const view = shown(14, 6, true);
		expect(view.rows).toHaveLength(14);
		expect(view).toMatchObject({
			hiddenAhead: 0,
			hiddenBehind: 0,
			toggle: true,
		});
	});
});

describe("teamTotals", () => {
	const ENDS = ["2026-09-20", "2026-09-27", "2026-10-04", "2026-10-06"];

	/** One rider's points: Training as given, Team twice as much. */
	const weeks = (...training: number[]): WeekPoint[] =>
		training.map((value, i) => ({
			weekEnd: ENDS[i] ?? "",
			training: value,
			team: value * 2,
		}));

	it("sums each week end over the riders", () => {
		const totals = teamTotals(
			[weeks(0, 10, 15, 20), weeks(5, 5, 30, 32)],
			"training",
		);
		expect(totals.total).toBe(52);
		expect(totals.weeks).toEqual([
			{ weekEnd: "2026-09-20", total: 5, gain: null },
			{ weekEnd: "2026-09-27", total: 15, gain: 10 },
			{ weekEnd: "2026-10-04", total: 45, gain: 30 },
			{ weekEnd: "2026-10-06", total: 52, gain: 7 },
		]);
	});

	it("takes the picked kind", () => {
		const totals = teamTotals([weeks(1, 4), weeks(2, 3)], "team");
		expect(totals.weeks.map((w) => w.total)).toEqual([6, 14]);
		expect(totals).toMatchObject({ total: 14, thisWeek: 8 });
	});

	it("gives this week as the last week end minus the one before", () => {
		const totals = teamTotals([weeks(0, 10, 15, 20)], "training");
		expect(totals.thisWeek).toBe(5);
	});

	it("gives 0 this week and no best week with one week", () => {
		const totals = teamTotals([weeks(12)], "training");
		expect(totals).toEqual({
			total: 12,
			thisWeek: 0,
			weeks: [{ weekEnd: "2026-09-20", total: 12, gain: null }],
			bestWeek: null,
		});
	});

	it("names the week with the largest gain, the earliest on ties", () => {
		const totals = teamTotals([weeks(100, 110, 130, 150)], "training");
		expect(totals.bestWeek).toEqual({ weekEnd: "2026-10-04", gain: 20 });
	});

	it("doesn't count the first week's total as a gain", () => {
		const totals = teamTotals([weeks(100, 101, 102)], "training");
		expect(totals.bestWeek).toEqual({ weekEnd: "2026-09-27", gain: 1 });
	});

	it("names no best week without any gain", () => {
		const totals = teamTotals([weeks(5, 5, 4)], "training");
		expect(totals.bestWeek).toBeNull();
		expect(totals.thisWeek).toBe(-1);
	});

	it("gives 0 and no weeks for nobody", () => {
		expect(teamTotals([], "training")).toEqual({
			total: 0,
			thisWeek: 0,
			weeks: [],
			bestWeek: null,
		});
	});
});
