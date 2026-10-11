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
		]);
		expect(evaluate(sums)).toEqual(result);
	});
});
