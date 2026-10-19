import { afterEach, describe, expect, it, vi } from "vitest";
import { evaluateRides } from "../../src/rynke/rides";
import { CURRENT_RULES } from "../../src/rynke/rules";
import { extrasFromAttendance, tally } from "../../src/rynke/tally";
import type { Attendance } from "../../src/rynke/team-events";
import { evaluateAttendance } from "../../src/rynke/team-events";
import {
	type CurveInputs,
	type CurvePoint,
	type CurveRideSum,
	riderCurve,
	riderWeeks,
	type WeeklyRideSum,
	weekEnds,
} from "../../src/rynke/weeks";
import {
	EXAMPLE_BALANCE,
	EXAMPLE_INPUTS,
	EXAMPLE_TODAY,
	EXAMPLE_WINDOW,
} from "../support/progress";
import { RIDERS, WINDOW } from "../support/reference-riders";
import { ZERO_BALANCE } from "../support/rider-view";
import { makeRide } from "../support/rides";

// `riderCurve` (feature 009 research R1, R2): one point per day from the
// season start to the last day. Expected figures are the example rider's,
// worked out by hand in tasks.md; never by running the code.

const curve = (
	inputs: CurveInputs = EXAMPLE_INPUTS,
	last = EXAMPLE_TODAY,
	balance = EXAMPLE_BALANCE,
) => riderCurve(inputs, EXAMPLE_WINDOW, last, balance, CURRENT_RULES);

const on = (points: CurvePoint[], date: string) =>
	points.find((p) => p.date === date);

afterEach(() => {
	vi.restoreAllMocks();
});

describe("riderCurve (feature 009)", () => {
	it("gives the example rider's totals day by day", () => {
		const points = curve();
		expect(points).toHaveLength(37);
		expect(points[0]).toEqual({
			date: "2026-09-01",
			training: 0,
			team: 0,
			outside: 0,
		});
		expect(points.at(-1)?.date).toBe("2026-10-07");
		const totals = [
			["2026-09-05", 21, 1],
			["2026-09-06", 21, 1],
			["2026-09-13", 30, 1],
			["2026-09-19", 46, 6],
			["2026-09-20", 69, 11],
			["2026-09-27", 80, 16],
			["2026-10-04", 112, 17],
			["2026-10-07", 112, 17],
		] as const;
		for (const [date, training, team] of totals) {
			expect({ date, ...on(points, date) }).toMatchObject({
				date,
				training,
				team,
			});
		}
		// The correction's 10 land on its date.
		expect(on(points, "2026-10-03")?.training).toBe(102);
	});

	it("adds the elevation step on the day the total passes 2000 m", () => {
		const points = curve();
		expect(on(points, "2026-09-19")?.training).toBe(46);
		expect(on(points, "2026-09-20")?.training).toBe(69);
	});

	it("keeps the total at 0 or more", () => {
		const inputs: CurveInputs = {
			rides: [ride("2026-09-02", 20), ride("2026-09-06", 5)],
			attendance: [],
			corrections: [{ date: "2026-09-04", training: -30, team: 0 }],
		};
		const points = curve(inputs, "2026-09-07", {
			...ZERO_BALANCE,
			distanceRynke: 25,
			trainingRynke: 0,
		});
		expect(on(points, "2026-09-03")?.training).toBe(20);
		expect(on(points, "2026-09-04")?.training).toBe(0);
		// −30 still stands against the 25 ridden: 25 − 30 → 0.
		expect(on(points, "2026-09-06")?.training).toBe(0);
	});

	it("gives a later ride its Rynke after a correction to 0", () => {
		const inputs: CurveInputs = {
			rides: [ride("2026-09-02", 20)],
			attendance: [],
			corrections: [{ date: "2026-09-04", training: -20, team: 0 }],
		};
		const points = curve(
			{ ...inputs, rides: [...inputs.rides, ride("2026-09-06", 5)] },
			"2026-09-07",
			{
				...ZERO_BALANCE,
				distanceRynke: 25,
				trainingRynke: 5,
				trainingWithoutVirtual: 5,
			},
		);
		expect(on(points, "2026-09-04")?.training).toBe(0);
		expect(on(points, "2026-09-06")?.training).toBe(5);
	});

	it("counts anything dated after the last day on the last day", () => {
		const attendance: Attendance[] = [
			{ eventId: 1, kind: "team_training", date: "2026-10-09" },
		];
		const points = curve(
			{ rides: [], attendance, corrections: [] },
			EXAMPLE_TODAY,
			{
				...ZERO_BALANCE,
				trainingRynke: 5,
				teamRynke: 1,
				trainingWithoutVirtual: 5,
			},
		);
		expect(on(points, "2026-10-06")).toMatchObject({ training: 0, team: 0 });
		expect(points.at(-1)).toMatchObject({
			date: "2026-10-07",
			training: 5,
			team: 1,
		});
	});

	it("ends on the deadline once it has passed", () => {
		const points = curve(EXAMPLE_INPUTS, "2027-06-30");
		expect(points).toHaveLength(303);
		expect(points.at(-1)?.date).toBe("2027-06-30");
	});

	it("sums the Training Rynke without virtual rides", () => {
		const inputs: CurveInputs = {
			rides: [
				ride("2026-09-05", 6),
				{ ...ride("2026-09-10", 10), virtual: true },
			],
			attendance: [],
			corrections: [],
		};
		const points = curve(inputs, "2026-09-12", {
			...ZERO_BALANCE,
			distanceRynke: 16,
			trainingRynke: 16,
			trainingWithoutVirtual: 6,
		});
		expect(on(points, "2026-09-09")).toMatchObject({
			training: 6,
			outside: 6,
		});
		for (const date of ["2026-09-10", "2026-09-11", "2026-09-12"]) {
			expect(on(points, date)).toMatchObject({ training: 16, outside: 6 });
		}
	});

	it("takes the stored balance on the last day when they disagree", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const points = curve(EXAMPLE_INPUTS, EXAMPLE_TODAY, {
			...EXAMPLE_BALANCE,
			trainingRynke: 120,
			teamRynke: 18,
			trainingWithoutVirtual: 120,
		});
		expect(points.at(-1)).toMatchObject({
			training: 120,
			team: 18,
			outside: 120,
		});
		expect(on(points, "2026-10-06")?.training).toBe(112);
		expect(error).toHaveBeenCalledTimes(1);
		expect(String(error.mock.calls[0]?.[0])).not.toMatch(/\d{4,}/);
	});

	it("logs nothing when the curve meets the balance", () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		curve();
		expect(error).not.toHaveBeenCalled();
	});

	describe.each(RIDERS.map((rider) => ({ ...rider, label: rider.name })))(
		"reference rider $label",
		({ rides, attendance = [], team = 0 }) => {
			// The riders' window, today after its deadline, so every point is
			// rebuilt; the team stand-in is a correction on the season start.
			const evaluation = evaluateRides(
				rides.map(makeRide),
				CURRENT_RULES,
				WINDOW,
			);
			const startOf = new Map(
				rides.map((r) => [
					r.id,
					(r.startLocal ?? r.start ?? "2026-05-01T08:00:00Z").slice(0, 10),
				]),
			);
			const counting = evaluation.results.filter((r) => r.counts);
			const events: Attendance[] = attendance.map((a, i) => ({
				eventId: a.eventId ?? 100 + i,
				kind: a.kind,
				date: a.date,
			}));
			const corrections =
				team === 0 ? [] : [{ date: WINDOW.seasonStart, training: 0, team }];
			const extras = extrasFromAttendance(
				evaluateAttendance(events, CURRENT_RULES, WINDOW),
			);
			const balance = tally(
				evaluation.riding,
				{ ...extras, team: extras.team + team },
				CURRENT_RULES,
			);
			const daily: CurveRideSum[] = counting.map((r) => ({
				date: startOf.get(r.activityId) ?? "",
				virtual: r.isVirtual,
				distanceRynke: r.distanceRynke,
				elevationDm: r.elevationDm,
			}));
			const last = WINDOW.deadline;
			const points = riderCurve(
				{ rides: daily, attendance: events, corrections },
				WINDOW,
				last,
				balance,
				CURRENT_RULES,
			);

			it("ends on its balance", () => {
				const error = vi.spyOn(console, "error");
				expect(points.at(-1)).toMatchObject({
					training: balance.trainingRynke,
					team: balance.teamRynke,
					outside: balance.trainingWithoutVirtual,
				});
				expect(error).not.toHaveBeenCalled();
			});

			it("equals the Team section's weekly line at every week end", () => {
				const ends = weekEnds(WINDOW.seasonStart, last);
				const weekly: WeeklyRideSum[] = daily.map((d) => ({
					weekEnd: ends.find((end) => end >= d.date) ?? last,
					distanceRynke: d.distanceRynke,
					elevationDm: d.elevationDm,
				}));
				const weeks = riderWeeks(
					{ rides: weekly, attendance: events, corrections },
					WINDOW,
					ends,
					balance,
				);
				for (const week of weeks) {
					expect(on(points, week.weekEnd)).toMatchObject({
						training: week.training,
						team: week.team,
					});
				}
			});
		},
	);
});

function ride(date: string, distanceRynke: number): CurveRideSum {
	return { date, virtual: false, distanceRynke, elevationDm: 0 };
}
