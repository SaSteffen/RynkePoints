import { describe, expect, it } from "vitest";
import { evaluateRides } from "../../src/rynke/rides";
import { type CountingWindow, CURRENT_RULES } from "../../src/rynke/rules";
import { tally } from "../../src/rynke/tally";
import { makeRide, type RideSpec } from "../support/rides";

// SC-001: synthetic riders whose expected totals were worked out by hand from
// the rules of version 1 (10 km = 1, 1000 m of the summed elevation = 5,
// paused at most half the moving time, 10–45 km/h, at most 1500 m/h, no
// e-bikes, flagged or manual rides, larger recording wins an overlap; 250
// training and 25 team Rynke, at least 167 of the 250 not virtual). Never
// derive an expected value by running the code.
//
// Team Rynke come from events (Story 3), which don't exist yet; the last
// riders get them as an `extras` stand-in so qualification is covered too.

/** The counting window, with a deadline so both of its ends are covered. */
const WINDOW: CountingWindow = {
	seasonStart: "2026-01-01",
	deadline: "2026-08-31",
};

/** `count` rides like `spec`, one a day from 2026-05-01 + `firstDay`. */
function daily(
	count: number,
	firstId: number,
	spec: Omit<RideSpec, "id" | "start">,
	firstDay = 0,
): RideSpec[] {
	return Array.from({ length: count }, (_, i) => ({
		...spec,
		id: firstId + i,
		start: new Date(Date.UTC(2026, 4, 1 + firstDay + i, 8)).toISOString(),
	}));
}

const DAY2 = "2026-05-02T08:00:00Z";
const DAY3 = "2026-05-03T08:00:00Z";

interface Rider {
	name: string;
	rides: RideSpec[];
	team?: number;
	training: number;
	qualified: boolean;
}

const RIDERS: Rider[] = [
	// No rides: nothing.
	{ name: "no rides", rides: [], training: 0, qualified: false },
	// 79 km → floor(7.9) = 7.
	{
		name: "one ride",
		rides: [{ id: 1, km: 79, movingH: 3 }],
		training: 7,
		qualified: false,
	},
	// 10 km at exactly 10 km/h → allowed, floor(1.0) = 1.
	{
		name: "minimum speed, one step",
		rides: [{ id: 1, km: 10, movingH: 1 }],
		training: 1,
		qualified: false,
	},
	// 9.99 km counts but floor(0.999) = 0.
	{
		name: "just under a distance step",
		rides: [{ id: 1, km: 9.99, movingH: 0.5 }],
		training: 0,
		qualified: false,
	},
	// 3 + 3 km Rynke; 600 + 600 m = 1200 m → 5, though each ride alone gives 0.
	{
		name: "elevation summed before rounding",
		rides: [
			{ id: 1, km: 30, movingH: 2, elevationM: 600 },
			{ id: 2, km: 30, movingH: 2, elevationM: 600, start: DAY2 },
		],
		training: 11,
		qualified: false,
	},
	// 999.96 m rounds to 10000 dm = one step → 4 + 5.
	{
		name: "elevation rounded up to a step",
		rides: [{ id: 1, km: 40, movingH: 2, elevationM: 999.96 }],
		training: 9,
		qualified: false,
	},
	// 999.94 m rounds to 9999 dm, under a step → 4 + 0.
	{
		name: "elevation rounded down under a step",
		rides: [{ id: 1, km: 40, movingH: 2, elevationM: 999.94 }],
		training: 4,
		qualified: false,
	},
	// Paused exactly half of 2 h → counts (4); 2 h + 1 s of 4 h → pause (0).
	{
		name: "pause limit",
		rides: [
			{ id: 1, km: 40, movingH: 2, pausedH: 1 },
			{ id: 2, km: 100, movingH: 4, pausedH: 2 + 1 / 3600, start: DAY2 },
		],
		training: 4,
		qualified: false,
	},
	// 45 km/h exactly counts (4); 45.005 km/h is too fast (0).
	{
		name: "maximum speed",
		rides: [
			{ id: 1, km: 45, movingH: 1 },
			{ id: 2, km: 90.01, movingH: 2, start: DAY2 },
		],
		training: 4,
		qualified: false,
	},
	// 10 km/h exactly counts (2); 9.995 km/h is too slow (0).
	{
		name: "minimum speed",
		rides: [
			{ id: 1, km: 20, movingH: 2 },
			{ id: 2, km: 19.99, movingH: 2, start: DAY2 },
		],
		training: 2,
		qualified: false,
	},
	// 1500 m in 1 h counts: 3 + 5; 1501 m in 1 h climbs too fast (0).
	{
		name: "climbing rate",
		rides: [
			{ id: 1, km: 30, movingH: 1, elevationM: 1500 },
			{ id: 2, km: 30, movingH: 1, elevationM: 1501, start: DAY2 },
		],
		training: 8,
		qualified: false,
	},
	// Both e-bike types give 0; the 30 km ride gives 3.
	{
		name: "e-bikes",
		rides: [
			{ id: 1, km: 100, movingH: 4, sportType: "EBikeRide" },
			{
				id: 2,
				km: 60,
				movingH: 3,
				sportType: "EMountainBikeRide",
				start: DAY2,
			},
			{ id: 3, km: 30, movingH: 1, start: DAY3 },
		],
		training: 3,
		qualified: false,
	},
	// Manual 0; recorded 5; unknown manual flag still counts, 3.
	{
		name: "manual entries",
		rides: [
			{ id: 1, km: 50, movingH: 2, manual: true },
			{ id: 2, km: 50, movingH: 2, start: DAY2 },
			{ id: 3, km: 30, movingH: 1, manual: null, start: DAY3 },
		],
		training: 8,
		qualified: false,
	},
	// Flagged 0; an unknown flag still counts, 8.
	{
		name: "flagged rides",
		rides: [
			{ id: 1, km: 80, movingH: 3, flagged: true },
			{ id: 2, km: 80, movingH: 3, flagged: null, start: DAY2 },
		],
		training: 8,
		qualified: false,
	},
	// Local 2025-12-31 is before the season (0); local 2026-01-01 00:30 counts
	// (3) although its UTC date is still 2025-12-31.
	{
		name: "season start by local date",
		rides: [
			{
				id: 1,
				km: 30,
				movingH: 1,
				start: "2025-12-31T20:00:00Z",
				startLocal: "2025-12-31T21:00:00",
			},
			{
				id: 2,
				km: 30,
				movingH: 1,
				start: "2025-12-31T23:30:00Z",
				startLocal: "2026-01-01T00:30:00",
			},
		],
		training: 3,
		qualified: false,
	},
	// Local 2026-08-31 23:00 is on the deadline (5); local 2026-09-01 is after
	// it (0).
	{
		name: "deadline by local date",
		rides: [
			{
				id: 1,
				km: 50,
				movingH: 2,
				start: "2026-08-31T21:00:00Z",
				startLocal: "2026-08-31T23:00:00",
			},
			{
				id: 2,
				km: 50,
				movingH: 2,
				start: "2026-09-01T04:00:00Z",
				startLocal: "2026-09-01T06:00:00",
			},
		],
		training: 5,
		qualified: false,
	},
	// 78 and 80 km recorded together: only the 80 km counts (8); a ride that
	// starts as it ends only touches it and counts too (2).
	{
		name: "overlapping recordings",
		rides: [
			{ id: 1, km: 78, movingH: 3 },
			{ id: 2, km: 80, movingH: 3 },
			{ id: 3, km: 20, movingH: 1, start: "2026-05-01T11:00:00Z" },
		],
		training: 10,
		qualified: false,
	},
	// Equal distance: the 400 m recording wins; 5 + 3 km Rynke, 400 + 650 m =
	// 1050 m → 5. Had the 300 m one won, 950 m would give 0.
	{
		name: "overlap decided by elevation",
		rides: [
			{ id: 1, km: 50, movingH: 2, elevationM: 300 },
			{ id: 2, km: 50, movingH: 2, elevationM: 400 },
			{ id: 3, km: 30, movingH: 2, elevationM: 650, start: DAY2 },
		],
		training: 13,
		qualified: false,
	},
	// The larger recording paused too long, so the overlapping 60 km counts: 6.
	{
		name: "overlap with a ride that doesn't count",
		rides: [
			{ id: 1, km: 100, movingH: 4, pausedH: 3 },
			{ id: 2, km: 60, movingH: 3, start: "2026-05-01T09:00:00Z" },
		],
		training: 6,
		qualified: false,
	},
	// Virtual rides count as training: 5 + 5 + 5.
	{
		name: "virtual and trainer rides",
		rides: [
			{ id: 1, km: 50, movingH: 2, sportType: "VirtualRide" },
			{ id: 2, km: 50, movingH: 2, trainer: true, start: DAY2 },
			{ id: 3, km: 50, movingH: 2, start: DAY3 },
		],
		training: 15,
		qualified: false,
	},
	// No moving time: paused for all of it, 0.
	{
		name: "no moving time",
		rides: [{ id: 1, km: 10, movingH: 0, pausedH: 1 }],
		training: 0,
		qualified: false,
	},
	// Unknown elapsed time can't fail the pause rule: 4.
	{
		name: "unknown elapsed time",
		rides: [{ id: 1, km: 40, movingH: 2, elapsedUnknown: true }],
		training: 4,
		qualified: false,
	},
	// Failing every rule at once still gives 0, never less.
	{
		name: "every reason",
		rides: [
			{
				id: 1,
				km: 1,
				movingH: 1,
				sportType: "EBikeRide",
				manual: true,
				flagged: true,
				start: "2025-06-01T08:00:00Z",
			},
		],
		training: 0,
		qualified: false,
	},
	// 10 × 3 km Rynke; 10 × 150 m = 1500 m → 5.
	{
		name: "many small climbs",
		rides: daily(10, 1, { km: 30, movingH: 1.5, elevationM: 150 }),
		training: 35,
		qualified: false,
	},
	// 10 × 26 = 260 training, but no team Rynke: not qualified.
	{
		name: "training met, team missing",
		rides: daily(10, 1, { km: 260, movingH: 9 }),
		training: 260,
		qualified: false,
	},
	// 260 training, 25 team, all outdoors: qualified.
	{
		name: "qualified",
		rides: daily(10, 1, { km: 260, movingH: 9 }),
		team: 25,
		training: 260,
		qualified: true,
	},
	// 6 × 26 = 156 outdoors + 4 × 26 virtual = 260; 156 < 167: not qualified.
	{
		name: "too much of it virtual",
		rides: [
			...daily(6, 1, { km: 260, movingH: 9 }),
			...daily(4, 11, { km: 260, movingH: 9, sportType: "VirtualRide" }, 10),
		],
		team: 25,
		training: 260,
		qualified: false,
	},
	// 6 × 26 + 11 = 167 outdoors, 3 × 26 + 5 = 83 virtual: exactly 250 with
	// exactly 167 outdoors, qualified.
	{
		name: "every threshold met exactly",
		rides: [
			...daily(6, 1, { km: 260, movingH: 9 }),
			...daily(1, 7, { km: 110, movingH: 4 }, 6),
			...daily(3, 11, { km: 260, movingH: 9, sportType: "VirtualRide" }, 10),
			...daily(1, 14, { km: 50, movingH: 2, sportType: "VirtualRide" }, 13),
		],
		team: 25,
		training: 250,
		qualified: true,
	},
	// 6 × 26 + 10 = 166 outdoors, 3 × 26 + 6 = 84 virtual: 250 in all, one
	// short of 167 outdoors.
	{
		name: "one outdoor Rynke short",
		rides: [
			...daily(6, 1, { km: 260, movingH: 9 }),
			...daily(1, 7, { km: 100, movingH: 4 }, 6),
			...daily(3, 11, { km: 260, movingH: 9, sportType: "VirtualRide" }, 10),
			...daily(1, 14, { km: 60, movingH: 2, sportType: "VirtualRide" }, 13),
		],
		team: 25,
		training: 250,
		qualified: false,
	},
	// 24 team Rynke, one short of 25.
	{
		name: "one team Rynke short",
		rides: daily(10, 1, { km: 260, movingH: 9 }),
		team: 24,
		training: 260,
		qualified: false,
	},
];

describe("reference riders (SC-001)", () => {
	it("has at least 20 riders", () => {
		expect(RIDERS.length).toBeGreaterThanOrEqual(20);
	});

	it.each(RIDERS)("$name", ({ rides, team = 0, training, qualified }) => {
		const evaluation = evaluateRides(
			rides.map(makeRide),
			CURRENT_RULES,
			WINDOW,
		);
		const balance = tally(
			evaluation.riding,
			{ training: 0, team },
			CURRENT_RULES,
		);
		expect({
			trainingRynke: balance.trainingRynke,
			teamRynke: balance.teamRynke,
			qualified: balance.qualified,
		}).toEqual({ trainingRynke: training, teamRynke: team, qualified });
	});
});
