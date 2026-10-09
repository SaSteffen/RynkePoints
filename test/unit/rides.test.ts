import { describe, expect, it } from "vitest";
import {
	evaluateRides,
	type Ride,
	type RideResult,
	type RidingTotals,
	rideFromRow,
} from "../../src/rynke/rides";
import {
	type CountingWindow,
	CURRENT_RULES,
	type RynkeRules,
} from "../../src/rynke/rules";
import { toActivityRecord } from "../../src/strava/activity";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";
import { makeRide, WINDOW } from "../support/rides";

function evaluate(
	rides: Ride[],
	rules: RynkeRules = CURRENT_RULES,
	window: CountingWindow = WINDOW,
) {
	return evaluateRides(rides, rules, window);
}

function resultFor(results: RideResult[], id: number): RideResult {
	const result = results.find((r) => r.activityId === id);
	if (!result) throw new Error(`no result for ${id}`);
	return result;
}

function training(riding: RidingTotals): number {
	return riding.distanceRynke + riding.elevationRynke;
}

/** A ride on its own day, so it overlaps no other ride of the test. */
function day(n: number): string {
	return `2026-05-${String(n).padStart(2, "0")}T08:00:00Z`;
}

describe("distance and elevation (FR-004, FR-004a)", () => {
	it("US2-1: 100 km without climbing earns 10", () => {
		const { results, riding } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4 }),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			counts: true,
			reasons: [],
			distanceRynke: 10,
			elevationDm: 0,
		});
		expect(riding.distanceRynke).toBe(10);
		expect(riding.elevationRynke).toBe(0);
		expect(training(riding)).toBe(10);
	});

	it("US2-2: 79 km with 1999 m earns 7 + 5", () => {
		const { riding } = evaluate([
			makeRide({ id: 1, km: 79, movingH: 4, elevationM: 1999 }),
		]);
		expect(riding.distanceRynke).toBe(7);
		expect(riding.elevationDm).toBe(19990);
		expect(riding.elevationRynke).toBe(5);
		expect(training(riding)).toBe(12);
	});

	it("US2-3: three rides of 7 km earn nothing", () => {
		const { riding } = evaluate(
			[1, 2, 3].map((id) =>
				makeRide({ id, km: 7, movingH: 0.5, start: day(id) }),
			),
		);
		expect(riding.distanceRynke).toBe(0);
	});

	it("US2-4: two rides of 25 km earn 2 each", () => {
		const { riding } = evaluate(
			[1, 2].map((id) => makeRide({ id, km: 25, movingH: 1, start: day(id) })),
		);
		expect(riding.distanceRynke).toBe(4);
	});

	it("US2-12: two rides of 600 m earn 5 for the elevation total", () => {
		const { results, riding } = evaluate(
			[1, 2].map((id) =>
				makeRide({ id, km: 30, movingH: 2, elevationM: 600, start: day(id) }),
			),
		);
		expect(resultFor(results, 1).elevationDm).toBe(6000);
		expect(riding.elevationDm).toBe(12000);
		expect(riding.elevationRynke).toBe(5);
	});

	it("US2-13: 1999 m and 1 m earn 10", () => {
		const { riding } = evaluate([
			makeRide({ id: 1, km: 80, movingH: 4, elevationM: 1999, start: day(1) }),
			makeRide({ id: 2, km: 20, movingH: 1, elevationM: 1, start: day(2) }),
		]);
		expect(riding.elevationDm).toBe(20000);
		expect(riding.elevationRynke).toBe(10);
	});

	it("sums elevation in exact decimetres", () => {
		const { riding } = evaluate([
			makeRide({ id: 1, km: 30, movingH: 2, elevationM: 600.1, start: day(1) }),
			makeRide({ id: 2, km: 30, movingH: 2, elevationM: 399.9, start: day(2) }),
		]);
		expect(riding.elevationDm).toBe(10000);
		expect(riding.elevationRynke).toBe(5);
	});

	it("counts a ride without climbing", () => {
		const { results } = evaluate([makeRide({ id: 1, km: 20, movingH: 2 })]);
		expect(resultFor(results, 1)).toMatchObject({
			counts: true,
			elevationDm: 0,
			distanceRynke: 2,
		});
	});
});

describe("counting window (FR-011)", () => {
	it("US2-6: a ride before the season start earns nothing", () => {
		const { results, riding } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4, start: "2025-12-31T08:00:00Z" }),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			counts: false,
			reasons: ["outside_window"],
			distanceRynke: 0,
		});
		expect(training(riding)).toBe(0);
	});

	it("counts a ride on the season start", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4, start: "2026-01-01T08:00:00Z" }),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
	});

	it("counts a ride on the deadline, not after it", () => {
		const window = { seasonStart: "2026-01-01", deadline: "2026-08-31" };
		const { results } = evaluate(
			[
				makeRide({ id: 1, km: 100, movingH: 4, start: "2026-08-31T20:00:00Z" }),
				makeRide({ id: 2, km: 100, movingH: 4, start: "2026-09-01T08:00:00Z" }),
			],
			CURRENT_RULES,
			window,
		);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(resultFor(results, 2).reasons).toEqual(["outside_window"]);
	});

	it("places a ride by its local start date", () => {
		const { results } = evaluate([
			makeRide({
				id: 1,
				km: 30,
				movingH: 1,
				start: "2025-12-31T23:30:00Z",
				startLocal: "2026-01-01T00:30:00Z",
			}),
			makeRide({
				id: 2,
				km: 30,
				movingH: 1,
				start: "2026-01-01T00:30:00Z",
				startLocal: "2025-12-31T23:30:00Z",
			}),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(resultFor(results, 2).reasons).toEqual(["outside_window"]);
	});
});

describe("pause rule (FR-005a)", () => {
	it("US2-7: a commute with 7 h at work earns nothing", () => {
		const { results, riding } = evaluate([
			makeRide({ id: 1, km: 40, movingH: 2, pausedH: 7 }),
		]);
		expect(resultFor(results, 1).reasons).toEqual(["pause"]);
		expect(training(riding)).toBe(0);
	});

	it("US2-8: 150 km with 2 h of breaks earns 15", () => {
		const { riding } = evaluate([
			makeRide({ id: 1, km: 150, movingH: 6, pausedH: 2 }),
		]);
		expect(training(riding)).toBe(15);
	});

	it("US2-9: 100 km paused for 5 h on 4 h moving earns nothing", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4, pausedH: 5 }),
		]);
		expect(resultFor(results, 1).reasons).toEqual(["pause"]);
	});

	it("US2-10: paused exactly as long as moving counts, a second more doesn't", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 60, movingH: 6, pausedH: 6, start: day(1) }),
			makeRide({
				id: 2,
				km: 60,
				movingH: 6,
				pausedH: 6 + 1 / 3600,
				start: day(2),
			}),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(resultFor(results, 2).reasons).toEqual(["pause"]);
	});

	it("US2-11: a 24 h ride past midnight earns 60", () => {
		const { riding } = evaluate([
			makeRide({
				id: 1,
				km: 600,
				movingH: 24,
				pausedH: 6,
				start: "2026-06-20T18:00:00Z",
			}),
		]);
		expect(training(riding)).toBe(60);
	});

	it("US2-14: a paused ride's metres don't join the elevation total", () => {
		const { results, riding } = evaluate([
			makeRide({ id: 1, km: 75, movingH: 3, elevationM: 1500, start: day(1) }),
			makeRide({
				id: 2,
				km: 40,
				movingH: 2,
				pausedH: 7,
				elevationM: 800,
				start: day(2),
			}),
		]);
		expect(riding.elevationDm).toBe(15000);
		expect(riding.elevationRynke).toBe(5);
		expect(resultFor(results, 2).elevationDm).toBe(0);
	});

	it.each([
		["0", { pausedH: 0 }],
		["600 s", { pausedH: 600 / 3600 }],
		["unknown", { elapsedUnknown: true }],
	])(
		"zero moving time with elapsed time %s is a full pause only",
		(_label, extra) => {
			const { results } = evaluate([
				makeRide({ id: 1, km: 10, movingH: 0, elevationM: 100, ...extra }),
			]);
			expect(resultFor(results, 1).reasons).toEqual(["pause"]);
		},
	);
});

describe("plausibility, manual, sport type and flagged (FR-005b, c, e, g)", () => {
	it("US2-17: 300 km in 4 h is too fast", () => {
		const { results } = evaluate([makeRide({ id: 1, km: 300, movingH: 4 })]);
		expect(resultFor(results, 1).reasons).toEqual(["too_fast"]);
	});

	it("US2-18: 15 km in 2 h is too slow", () => {
		const { results } = evaluate([makeRide({ id: 1, km: 15, movingH: 2 })]);
		expect(resultFor(results, 1).reasons).toEqual(["too_slow"]);
	});

	it("US2-19: exactly 10 km/h counts", () => {
		const { results, riding } = evaluate([
			makeRide({ id: 1, km: 20, movingH: 2 }),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(training(riding)).toBe(2);
	});

	it("exactly 45 km/h counts, a metre more doesn't", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 90, movingH: 2, start: day(1) }),
			makeRide({ id: 2, km: 90.001, movingH: 2, start: day(2) }),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(resultFor(results, 2).reasons).toEqual(["too_fast"]);
	});

	it("US2-20: 2000 m in 1 h exceeds the climbing rate", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 30, movingH: 1, elevationM: 2000 }),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			reasons: ["climbing_rate"],
			elevationDm: 0,
		});
	});

	it("exactly 1500 m/h counts, a decimetre more doesn't", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 30, movingH: 1, elevationM: 1500, start: day(1) }),
			makeRide({
				id: 2,
				km: 30,
				movingH: 1,
				elevationM: 1500.1,
				start: day(2),
			}),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(resultFor(results, 2).reasons).toEqual(["climbing_rate"]);
	});

	it("US2-21: a manual entry earns nothing", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 200, movingH: 8, manual: true }),
		]);
		expect(resultFor(results, 1).reasons).toEqual(["manual"]);
	});

	it.each(["EBikeRide", "EMountainBikeRide"])(
		"US2-22: a %s earns nothing",
		(sportType) => {
			const { results } = evaluate([
				makeRide({ id: 1, km: 100, movingH: 4, sportType }),
			]);
			expect(resultFor(results, 1).reasons).toEqual(["excluded_sport_type"]);
		},
	);

	it("lists every code that applies: manual 15 km over 2 h", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 15, movingH: 2, manual: true }),
		]);
		expect(resultFor(results, 1).reasons).toEqual(["manual", "too_slow"]);
	});

	it("US2-23: a flagged ride earns nothing", () => {
		const { results, riding } = evaluate([
			makeRide({
				id: 1,
				km: 100,
				movingH: 4,
				elevationM: 1000,
				flagged: true,
			}),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			reasons: ["flagged"],
			distanceRynke: 0,
			elevationDm: 0,
		});
		expect(training(riding)).toBe(0);
	});

	it("a flagged ride never counts, whatever the rule values", () => {
		const relaxed: RynkeRules = {
			...CURRENT_RULES,
			minSpeedKmh: 1,
			maxSpeedKmh: 1000,
			maxClimbMPerH: 100000,
			maxPausedShare: { num: 1, den: 1 },
			excludedSportTypes: [],
		};
		const { results } = evaluate(
			[makeRide({ id: 1, km: 100, movingH: 4, flagged: true })],
			relaxed,
		);
		expect(resultFor(results, 1).reasons).toEqual(["flagged"]);
	});

	it("a flagged ride never blocks an overlapping ride", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4, flagged: true }),
			makeRide({ id: 2, km: 80, movingH: 4 }),
		]);
		expect(resultFor(results, 1).reasons).toEqual(["flagged"]);
		expect(resultFor(results, 2).counts).toBe(true);
	});

	it("lists codes in contract order", () => {
		const { results } = evaluate([
			makeRide({
				id: 1,
				km: 10,
				movingH: 0,
				start: "2025-12-01T08:00:00Z",
				sportType: "EBikeRide",
				flagged: true,
				manual: true,
			}),
		]);
		expect(resultFor(results, 1).reasons).toEqual([
			"outside_window",
			"excluded_sport_type",
			"flagged",
			"manual",
			"pause",
		]);
	});
});

describe("overlapping recordings (FR-005d)", () => {
	it("US2-15: of two recordings of one ride only the longer counts", () => {
		const { results, riding } = evaluate([
			makeRide({
				id: 1,
				km: 80,
				movingH: 3,
				elevationM: 600,
				start: "2026-05-01T08:00:00Z",
			}),
			makeRide({
				id: 2,
				km: 78,
				movingH: 3,
				elevationM: 650,
				start: "2026-05-01T08:02:00Z",
			}),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(resultFor(results, 2)).toMatchObject({
			counts: false,
			reasons: ["overlap"],
			overlapsActivityId: 1,
			distanceRynke: 0,
			elevationDm: 0,
		});
		expect(riding.distanceRynke).toBe(8);
		expect(riding.elevationDm).toBe(6000);
	});

	it("US2-16: rides that only touch both count", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 40, movingH: 2, start: "2026-05-01T08:00:00Z" }),
			makeRide({ id: 2, km: 30, movingH: 2, start: "2026-05-01T10:00:00Z" }),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(resultFor(results, 2).counts).toBe(true);
	});

	it("breaks a distance tie by elevation, then by the lower activity ID", () => {
		const climb = evaluate([
			makeRide({ id: 1, km: 50, movingH: 2, elevationM: 300 }),
			makeRide({ id: 2, km: 50, movingH: 2, elevationM: 400 }),
		]);
		expect(resultFor(climb.results, 2).counts).toBe(true);
		expect(resultFor(climb.results, 1).overlapsActivityId).toBe(2);

		const same = evaluate([
			makeRide({ id: 7, km: 50, movingH: 2, elevationM: 300 }),
			makeRide({ id: 3, km: 50, movingH: 2, elevationM: 300 }),
		]);
		expect(resultFor(same.results, 3).counts).toBe(true);
		expect(resultFor(same.results, 7).overlapsActivityId).toBe(3);
	});

	it("only a counting ride blocks: in a chain the outer rides count", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4, start: "2026-05-01T08:00:00Z" }),
			makeRide({ id: 2, km: 90, movingH: 3, start: "2026-05-01T11:00:00Z" }),
			makeRide({ id: 3, km: 80, movingH: 3, start: "2026-05-01T13:00:00Z" }),
		]);
		expect(resultFor(results, 1).counts).toBe(true);
		expect(resultFor(results, 2)).toMatchObject({
			reasons: ["overlap"],
			overlapsActivityId: 1,
		});
		expect(resultFor(results, 3).counts).toBe(true);
	});

	it.each([
		["pause", { pausedH: 7 }, ["pause"]],
		["manual", { manual: true }, ["manual"]],
		["too fast", { km: 300 }, ["too_fast"]],
		[
			"outside the window",
			{ start: "2026-01-01T00:00:00Z", startLocal: "2025-12-31T23:00:00Z" },
			["outside_window"],
		],
	] as const)(
		"a ride excluded for %s never blocks an overlapping ride",
		(_label, extra, reasons) => {
			const { results } = evaluate([
				makeRide({
					id: 1,
					km: 120,
					movingH: 4,
					start: "2026-01-01T00:00:00Z",
					...extra,
				}),
				makeRide({ id: 2, km: 50, movingH: 2, start: "2026-01-01T01:00:00Z" }),
			]);
			expect(resultFor(results, 1).reasons).toEqual(reasons);
			expect(resultFor(results, 1).overlapsActivityId).toBeNull();
			expect(resultFor(results, 2).counts).toBe(true);
		},
	);

	it("uses the moving time when the elapsed time is unknown", () => {
		const ride = makeRide({
			id: 1,
			km: 60,
			movingH: 2,
			elapsedUnknown: true,
			start: "2026-05-01T08:00:00Z",
		});
		const touching = evaluate([
			ride,
			makeRide({ id: 2, km: 30, movingH: 1, start: "2026-05-01T10:00:00Z" }),
		]);
		expect(resultFor(touching.results, 2).counts).toBe(true);

		const overlapping = evaluate([
			ride,
			makeRide({ id: 2, km: 30, movingH: 1, start: "2026-05-01T09:59:00Z" }),
		]);
		expect(resultFor(overlapping.results, 2)).toMatchObject({
			reasons: ["overlap"],
			overlapsActivityId: 1,
		});
	});
});

describe("unknown figures and virtual rides (FR-005f, FR-013a)", () => {
	it("counts a ride with unknown elapsed time without a pause check", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 40, movingH: 2, elapsedUnknown: true }),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			counts: true,
			unknownFigures: ["elapsed_time"],
		});
	});

	it("counts a ride with an unknown manual or flagged state", () => {
		const { results } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4, manual: null, start: day(1) }),
			makeRide({ id: 2, km: 100, movingH: 4, flagged: null, start: day(2) }),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			counts: true,
			unknownFigures: ["manual"],
		});
		expect(resultFor(results, 2)).toMatchObject({
			counts: true,
			unknownFigures: ["flagged"],
		});
	});

	it("lists unknown figures in contract order", () => {
		const { results } = evaluate([
			makeRide({
				id: 1,
				km: 100,
				movingH: 4,
				elapsedUnknown: true,
				manual: null,
				trainer: null,
				flagged: null,
			}),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			counts: true,
			unknownFigures: ["elapsed_time", "manual", "trainer", "flagged"],
		});
	});

	it("tells virtual rides by sport type or trainer flag", () => {
		const { results } = evaluate([
			makeRide({
				id: 1,
				km: 30,
				movingH: 1,
				sportType: "VirtualRide",
				start: day(1),
			}),
			makeRide({ id: 2, km: 30, movingH: 1, trainer: true, start: day(2) }),
			makeRide({ id: 3, km: 30, movingH: 1, trainer: null, start: day(3) }),
			makeRide({
				id: 4,
				km: 30,
				movingH: 1,
				sportType: "VirtualRide",
				trainer: null,
				start: day(4),
			}),
		]);
		expect(resultFor(results, 1)).toMatchObject({
			isVirtual: true,
			unknownFigures: [],
		});
		expect(resultFor(results, 2).isVirtual).toBe(true);
		expect(resultFor(results, 3)).toMatchObject({
			isVirtual: false,
			unknownFigures: ["trainer"],
		});
		expect(resultFor(results, 4)).toMatchObject({
			isVirtual: true,
			unknownFigures: [],
		});
	});

	it("totals the riding with and without virtual rides", () => {
		const { riding } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4, elevationM: 600, start: day(1) }),
			makeRide({
				id: 2,
				km: 50,
				movingH: 2,
				elevationM: 600,
				sportType: "VirtualRide",
				start: day(2),
			}),
		]);
		expect(riding).toEqual({
			distanceRynke: 15,
			elevationDm: 12000,
			elevationRynke: 5,
			withoutVirtual: {
				distanceRynke: 10,
				elevationDm: 6000,
				elevationRynke: 0,
			},
		});
	});

	it("decides overlaps before leaving virtual rides out", () => {
		const { results, riding } = evaluate([
			makeRide({ id: 1, km: 100, movingH: 4, sportType: "VirtualRide" }),
			makeRide({ id: 2, km: 80, movingH: 4 }),
		]);
		expect(resultFor(results, 2)).toMatchObject({
			reasons: ["overlap"],
			overlapsActivityId: 1,
		});
		expect(riding.distanceRynke).toBe(10);
		expect(riding.withoutVirtual.distanceRynke).toBe(0);
	});
});

describe("determinism and output shape (FR-002)", () => {
	const five = [
		makeRide({ id: 11, km: 80, movingH: 3, elevationM: 600, start: day(1) }),
		makeRide({ id: 12, km: 78, movingH: 3, elevationM: 650, start: day(1) }),
		makeRide({
			id: 13,
			km: 50,
			movingH: 2,
			sportType: "VirtualRide",
			start: day(2),
		}),
		makeRide({ id: 14, km: 50, movingH: 2, elevationM: 100, start: day(2) }),
		makeRide({ id: 15, km: 40, movingH: 2, pausedH: 7, start: day(3) }),
	];

	function permutations<T>(items: T[]): T[][] {
		if (items.length <= 1) return [items];
		return items.flatMap((item, i) =>
			permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(
				(rest) => [item, ...rest],
			),
		);
	}

	it("gives the same output for every order of the rides", () => {
		const expected = evaluate(five);
		const orders = permutations(five);
		expect(orders).toHaveLength(120);
		for (const order of orders) {
			expect(evaluate(order)).toEqual(expected);
		}
	});

	it("gives the same output for a season of rides in any order", () => {
		const season = Array.from({ length: 60 }, (_, i) =>
			makeRide({
				id: 1000 + ((i * 37) % 60),
				km: 20 + ((i * 7) % 60),
				movingH: 1 + (i % 4) * 0.5,
				pausedH: i % 7 === 0 ? 5 : 0.25,
				elevationM: (i * 37) % 900,
				sportType: i % 5 === 0 ? "VirtualRide" : "Ride",
				start: new Date(Date.UTC(2026, 3, 1, 6) + i * 90 * 60_000)
					.toISOString()
					.replace(".000Z", "Z"),
			}),
		);
		const expected = evaluate(season);
		expect(expected.results.some((r) => r.reasons[0] === "overlap")).toBe(true);
		expect(evaluate([...season].reverse())).toEqual(expected);
		expect(evaluate([...season.slice(17), ...season.slice(0, 17)])).toEqual(
			expected,
		);
	});

	it("returns one consistent result per ride, sorted by activity ID", () => {
		const input = [...five].reverse();
		const copy = structuredClone(input);
		const { results } = evaluate(input);
		expect(input).toEqual(copy);
		expect(results.map((r) => r.activityId)).toEqual([11, 12, 13, 14, 15]);
		for (const r of results) {
			expect(r.counts).toBe(r.reasons.length === 0);
			if (r.reasons.length === 1 && r.reasons[0] === "overlap") {
				expect(r.overlapsActivityId).not.toBeNull();
			} else {
				expect(r.overlapsActivityId).toBeNull();
			}
			if (!r.counts) {
				expect(r.distanceRynke).toBe(0);
				expect(r.elevationDm).toBe(0);
			}
		}
	});

	it("copies each ride's refresh time into its result", () => {
		const { results } = evaluate([
			{ ...makeRide({ id: 1, km: 30, movingH: 1 }), refreshedAt: 1234 },
		]);
		expect(resultFor(results, 1).activityRefreshedAt).toBe(1234);
	});

	it("rejects invalid rules", () => {
		expect(() =>
			evaluate([makeRide({ id: 1, km: 30, movingH: 1 })], {
				...CURRENT_RULES,
				distanceStepKm: 0,
			}),
		).toThrow();
	});
});

describe("rideFromRow", () => {
	it("maps a stored activity, keeping unknown flags unknown", () => {
		const activity = makeStravaActivity({ id: 7001, trainer: true });
		delete activity.manual;
		const record = toActivityRecord(activity, ATHLETE_A, NOW);
		if (!record) throw new Error("not cycling");
		expect(rideFromRow(record)).toEqual({
			activityId: 7001,
			sportType: "Ride",
			startUtc: "2026-10-05T07:30:00Z",
			startLocal: "2026-10-05T09:30:00Z",
			distanceM: 42195,
			movingS: 5400,
			elapsedS: 6000,
			elevationM: 312,
			manual: null,
			trainer: true,
			flagged: false,
			refreshedAt: NOW,
		});
	});
});
