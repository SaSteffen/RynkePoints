import { describe, expect, it } from "vitest";
import {
	evaluateTeamBadges,
	type TeamBadgeSums,
	type TeamRiderDays,
} from "../../src/badges/team";
import { CURRENT_RULES } from "../../src/rynke/rules";

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

const event = (eventId: number, date: string, attendees: number) => ({
	eventId,
	date,
	attendees,
});

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
			"team_surprise",
		]);
		expect(evaluate(sums)).toEqual(result);
	});
});

// Part E: team surprise badges (spec User Story 7, FR-016, research R40).
describe("evaluateTeamBadges for the team surprises", () => {
	const act = (athleteId: number, date: string, hour = 10) => ({
		athleteId,
		date,
		hour,
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
					{ athleteId: 1, date: "2026-05-03", hour: 10 },
					{ athleteId: 2, date: "2026-05-05", hour: 10 },
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
