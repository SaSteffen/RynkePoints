import { describe, expect, it } from "vitest";
import { badgeWindow } from "../../src/badges/evaluate";
import {
	evaluateTeamBadges,
	type TeamBadgeSums,
	type TeamRiderDays,
} from "../../src/badges/team";
import { CURRENT_RULES } from "../../src/rynke/rules";
import type { EventKind } from "../../src/rynke/team-events";

// The team's badges from sums over the listed riders (feature 013 US4,
// FR-011, research R15). Synthetic sums only.

const WINDOW = { seasonStart: "2026-01-01", deadline: "2027-06-30" };
const NONE: TeamBadgeSums = { riders: [], runs: [], events: [] };

const evaluate = (sums: Partial<TeamBadgeSums>) =>
	evaluateTeamBadges({ ...NONE, ...sums }, CURRENT_RULES, WINDOW);

const progressOf = (
	result: ReturnType<typeof evaluateTeamBadges>,
	category: string,
) => result.progress.find((p) => p.category === category);

/** A rider with one counting ride per `[date, km]`, 10 km per Rynke. */
function rider(rides: [string, number, number?][]): TeamRiderDays {
	return {
		rides: rides.map(([date, km, elevationM = 0]) => ({
			date,
			distanceM: km * 1000,
			distanceRynke: Math.floor(km / 10),
			elevationDm: elevationM * 10,
		})),
		attendance: [],
		corrections: [],
	};
}

const event = (
	eventId: number,
	date: string,
	attendees: number,
	kind: EventKind = "team_training",
) => ({ eventId, kind, date, attendees });

describe("evaluateTeamBadges", () => {
	it("dates a big training by the event with the most attendees (US4 scenario 1)", () => {
		const result = evaluate({
			events: [
				event(1, "2026-04-04", 6),
				event(2, "2026-04-11", 10),
				event(3, "2026-04-18", 8),
			],
		});
		expect(result.earned).toContainEqual({
			badgeId: "big-training-5",
			earnedOn: "2026-04-04",
		});
		expect(result.earned).toContainEqual({
			badgeId: "big-training-10",
			earnedOn: "2026-04-11",
		});
		expect(progressOf(result, "big_training")).toMatchObject({
			value: 10,
			next: 15,
			missing: 5,
		});
	});

	it("sums attendances over events (US4 scenario 3)", () => {
		const result = evaluate({
			events: [
				event(1, "2026-03-07", 20),
				event(2, "2026-03-14", 30),
				event(3, "2026-03-21", 42),
			],
		});
		expect(result.earned).toContainEqual({
			badgeId: "attendances-50",
			earnedOn: "2026-03-14",
		});
		expect(progressOf(result, "attendances")).toMatchObject({
			value: 92,
			next: 100,
			missing: 8,
		});
	});

	it("adds up every rider's Training Rynke (US4 scenario 2)", () => {
		// 2,105 Rynke each from one 21,050 km ride.
		const result = evaluate({
			riders: [rider([["2026-03-01", 21050]]), rider([["2026-04-01", 21050]])],
		});
		expect(progressOf(result, "team_training_rynke")).toMatchObject({
			value: 4210,
			next: 5000,
			missing: 790,
		});
		expect(result.earned).toContainEqual({
			badgeId: "team-training-rynke-2500",
			earnedOn: "2026-04-01",
		});
		expect(result.earned).toContainEqual({
			badgeId: "team-training-rynke-500",
			earnedOn: "2026-03-01",
		});
	});

	it("sums distance, elevation and running per day", () => {
		const result = evaluate({
			riders: [
				rider([
					["2026-03-01", 600, 4000],
					["2026-03-02", 300, 3000],
				]),
				rider([["2026-03-02", 200, 4000]]),
			],
			runs: [
				{ date: "2026-03-01", distanceM: 60000 },
				{ date: "2026-03-03", distanceM: 50000 },
			],
		});
		expect(result.earned).toContainEqual({
			badgeId: "team-distance-1000",
			earnedOn: "2026-03-02",
		});
		expect(result.earned).toContainEqual({
			badgeId: "team-elevation-10000",
			earnedOn: "2026-03-02",
		});
		expect(result.earned).toContainEqual({
			badgeId: "team-running-100",
			earnedOn: "2026-03-03",
		});
	});

	it("only counts inside the counting window", () => {
		const result = evaluate({
			events: [event(1, "2025-12-20", 30)],
			runs: [{ date: "2025-12-20", distanceM: 500000 }],
		});
		expect(result.earned).toEqual([]);
	});

	it("takes a badge back when the sums fall", () => {
		const events = [event(1, "2026-04-04", 5)];
		expect(evaluate({ events }).earned).toContainEqual({
			badgeId: "big-training-5",
			earnedOn: "2026-04-04",
		});
		expect(evaluate({ events: [event(1, "2026-04-04", 4)] }).earned).toEqual(
			[],
		);
	});

	it("gives only team badges, and the same output for the same sums", () => {
		const sums = { events: [event(1, "2026-04-04", 12)] };
		const result = evaluate(sums);
		expect(result.earned.every((b) => !b.badgeId.startsWith("distance"))).toBe(
			true,
		);
		expect(result.progress.map((p) => p.category)).toEqual([
			"team_training_rynke",
			"team_distance",
			"team_elevation",
			"team_running",
			"big_training",
			"attendances",
			"tour_de_paris",
			"team_surprise",
		]);
		expect(evaluate(sums)).toEqual(result);
	});
});

// Feature 021 FR-005: a tour day counts for Big training and Attendances like
// every team event, also after the qualification deadline, but only once its
// day has come.
describe("evaluateTeamBadges and the Tour de Paris", () => {
	const SEASON = { seasonStart: "2026-09-01", deadline: "2027-06-30" };
	const onDay = (events: ReturnType<typeof event>[], today: string) =>
		evaluateTeamBadges(
			{ ...NONE, events },
			CURRENT_RULES,
			badgeWindow(SEASON, today),
		);

	it("counts a tour day after the deadline for Big training and Attendances", () => {
		const events = [
			event(1, "2027-06-01", 20),
			event(2, "2027-07-04", 30, "tour_de_paris"),
		];
		const result = onDay(events, "2027-07-31");
		expect(result.earned).toContainEqual({
			badgeId: "big-training-30",
			earnedOn: "2027-07-04",
		});
		expect(result.earned).toContainEqual({
			badgeId: "attendances-50",
			earnedOn: "2027-07-04",
		});
	});

	it("still counts no other kind after the deadline", () => {
		const result = onDay([event(1, "2027-07-04", 30)], "2027-07-31");
		expect(result.earned).toEqual([]);
	});

	it("counts a tour day only once its day has come", () => {
		const events = [event(1, "2027-07-04", 30, "tour_de_paris")];
		expect(onDay(events, "2027-07-03").earned).toEqual([]);
		expect(onDay(events, "2027-07-04").earned).toContainEqual({
			badgeId: "big-training-30",
			earnedOn: "2027-07-04",
		});
	});
});

// Part E: team surprise badges (spec User Story 7, FR-016, research R40).
describe("evaluateTeamBadges for the team surprises", () => {
	const act = (athleteId: number, date: string, hour = 10, ride = true) => ({
		athleteId,
		date,
		hour,
		ride,
	});
	const surprises = (sums: Partial<TeamBadgeSums>) =>
		evaluate(sums).earned.filter((b) => b.badgeId.startsWith("team-surprise-"));
	const days = (from: string, n: number) =>
		Array.from({ length: n }, (_, i) =>
			new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000)
				.toISOString()
				.slice(0, 10),
		);

	it("finds the team's day off between two active days (US7 2)", () => {
		expect(
			surprises({ active: [act(1, "2026-05-03"), act(2, "2026-05-05")] }),
		).toEqual([{ badgeId: "team-surprise-day-off", earnedOn: "2026-05-04" }]);
		// Not before the first activity, not after the last.
		expect(surprises({ active: [act(1, "2026-05-03")] })).toEqual([]);
	});

	it("finds a day everyone connected by then was out (US7 3)", () => {
		const connectedOn = new Map([
			[1, "2026-05-01"],
			[2, "2026-05-02"],
			[3, "2026-05-08"],
		]);
		expect(
			surprises({
				connectedOn,
				active: [act(1, "2026-05-06"), act(2, "2026-05-06")],
			}),
		).toEqual([{ badgeId: "team-surprise-all-out", earnedOn: "2026-05-06" }]);
		// One rider alone is not a team.
		expect(
			surprises({
				connectedOn: new Map([[1, "2026-05-01"]]),
				active: [act(1, "2026-05-06")],
			}),
		).toEqual([]);
		// Someone missing: no badge.
		expect(
			surprises({
				connectedOn: new Map([
					[1, "2026-05-01"],
					[2, "2026-05-01"],
				]),
				active: [act(1, "2026-05-06")],
			}),
		).toEqual([]);
	});

	it("needs all 24 hours of one day (US7 4)", () => {
		const hours = Array.from({ length: 24 }, (_, h) =>
			act(1 + (h % 3), "2026-06-20", h),
		);
		expect(surprises({ active: hours })).toEqual([
			{ badgeId: "team-surprise-round-the-clock", earnedOn: "2026-06-20" },
		]);
		expect(surprises({ active: hours.slice(1) })).toEqual([]);
	});

	it("dates the relay with the 30th day in a row (US7 5)", () => {
		const month = days("2026-04-01", 30).map((d, i) => act(1 + (i % 4), d));
		expect(surprises({ active: month })).toEqual([
			{ badgeId: "team-surprise-relay", earnedOn: "2026-04-30" },
		]);
		expect(surprises({ active: month.slice(1) })).toEqual([]);
	});

	it("needs five riders on New Year's Eve (US7 6)", () => {
		const five = [1, 2, 3, 4, 5].map((id) => act(id, "2026-12-31"));
		expect(surprises({ active: five })).toEqual([
			{ badgeId: "team-surprise-new-years-eve", earnedOn: "2026-12-31" },
		]);
		expect(surprises({ active: five.slice(1) })).toEqual([]);
	});

	it("needs ten riders on a Sunday without a team event (US7 7)", () => {
		// 7 June 2026 is a Sunday.
		const ten = Array.from({ length: 10 }, (_, i) => act(i + 1, "2026-06-07"));
		expect(surprises({ active: ten })).toEqual([
			{ badgeId: "team-surprise-sunday-outing", earnedOn: "2026-06-07" },
		]);
		expect(
			surprises({ active: ten, events: [event(1, "2026-06-07", 4)] }),
		).toEqual([]);
		expect(
			surprises({
				active: ten.map((a) => ({ ...a, date: "2026-06-06" })),
			}),
		).toEqual([]);
	});

	// Part F (spec User Story 8, FR-017a, research R45).
	describe("Festive Team", () => {
		const connectedOn = new Map([
			[1, "2026-09-01"],
			[2, "2026-10-15"],
			[3, "2026-12-24"],
		]);
		// Gaps in these dates are team days off (part E); only Festive Team here.
		const festive = (sums: Partial<TeamBadgeSums>) =>
			surprises(sums).filter((b) => b.badgeId === "team-surprise-festive-team");

		it("is earned the day the last rider due rides between 24 and 31 December (US8 9)", () => {
			expect(
				festive({
					connectedOn,
					active: [
						act(1, "2026-12-24"),
						act(2, "2026-12-27"),
						act(1, "2026-12-29"),
						act(3, "2026-12-26"),
						act(2, "2026-12-30"),
					],
				}),
			).toEqual([
				{ badgeId: "team-surprise-festive-team", earnedOn: "2026-12-27" },
			]);
		});

		it("needs every rider due to ride", () => {
			expect(
				festive({
					connectedOn,
					active: [
						act(1, "2026-12-24"),
						act(2, "2026-12-27"),
						act(3, "2026-12-23"),
						act(3, "2027-01-01"),
					],
				}),
			).toEqual([]);
		});

		it("counts rides only, not runs or swims", () => {
			expect(
				festive({
					connectedOn,
					active: [
						act(1, "2026-12-24"),
						act(2, "2026-12-27"),
						act(3, "2026-12-26", 10, false),
					],
				}),
			).toEqual([]);
		});

		it("doesn't wait for a rider who connected after 24 December", () => {
			expect(
				festive({
					connectedOn: new Map([...connectedOn, [4, "2026-12-27"]]),
					active: [
						act(1, "2026-12-24"),
						act(2, "2026-12-25"),
						act(3, "2026-12-31"),
					],
				}),
			).toEqual([
				{ badgeId: "team-surprise-festive-team", earnedOn: "2026-12-31" },
			]);
		});

		it("needs at least two riders due", () => {
			expect(
				festive({
					connectedOn: new Map([[1, "2026-09-01"]]),
					active: [act(1, "2026-12-24")],
				}),
			).toEqual([]);
		});
	});

	it("counts nothing outside the counting window and shows no next step", () => {
		const result = evaluate({
			active: [act(1, "2025-12-29"), act(2, "2025-12-31")],
		});
		expect(
			result.earned.filter((b) => b.badgeId.startsWith("team-surprise-")),
		).toEqual([]);
		expect(progressOf(result, "team_surprise")).toEqual({
			category: "team_surprise",
			value: 0,
			next: null,
			missing: null,
		});
	});
});

describe("evaluateTeamBadges and future dates", () => {
	it("finds no day off before a later activity dated today at the latest", () => {
		const window = { seasonStart: "2026-01-01", deadline: "2026-05-04" };
		const result = evaluateTeamBadges(
			{
				...NONE,
				active: [
					{ athleteId: 1, date: "2026-05-03", hour: 10, ride: true },
					{ athleteId: 2, date: "2026-05-05", hour: 10, ride: true },
				],
			},
			CURRENT_RULES,
			window,
		);
		expect(
			result.earned.filter((b) => b.badgeId.startsWith("team-surprise-")),
		).toEqual([]);
	});
});
