import { describe, expect, it } from "vitest";
import { evaluateBadges, type PersonalInputs } from "../../src/badges/evaluate";
import { CURRENT_RULES } from "../../src/rynke/rules";

// A rider's personal badges and progress from what they have stored (feature
// 013 FR-001 to FR-004, FR-010, FR-013, data-model.md "Evaluation", research
// R14). Synthetic figures only.

const WINDOW = { seasonStart: "2026-01-01", deadline: "2027-06-30" };
const NONE: PersonalInputs = {
	rides: [],
	runs: [],
	attendance: [],
	corrections: [],
};

const ride = (date: string, km: number, elevationM = 0, distanceRynke = 0) => ({
	date,
	distanceM: km * 1000,
	distanceRynke,
	elevationDm: elevationM * 10,
});

const evaluate = (inputs: Partial<PersonalInputs>) =>
	evaluateBadges({ ...NONE, ...inputs }, CURRENT_RULES, WINDOW);

const progressOf = (
	result: ReturnType<typeof evaluateBadges>,
	category: string,
) => result.progress.find((p) => p.category === category);

describe("evaluateBadges", () => {
	it("dates the 100 km badge by the ride that reached it (US1 scenario 1)", () => {
		const result = evaluate({
			rides: [
				ride("2026-03-01", 60),
				ride("2026-03-08", 45),
				ride("2026-03-15", 30),
			],
		});
		expect(result.earned).toEqual([
			{ badgeId: "distance-100", earnedOn: "2026-03-08" },
		]);
	});

	it("shows what is missing to the next threshold (US1 scenario 2)", () => {
		const result = evaluate({
			rides: [ride("2026-03-01", 300), ride("2026-04-01", 112)],
		});
		expect(progressOf(result, "distance")).toEqual({
			category: "distance",
			value: 412,
			next: 500,
			missing: 88,
		});
	});

	it("has no next threshold once the last badge is earned (US1 scenario 3)", () => {
		const result = evaluate({
			attendance: [
				{ eventId: 1, kind: "technique_training", date: "2026-03-01" },
				{ eventId: 2, kind: "technique_training", date: "2026-04-01" },
			],
		});
		expect(progressOf(result, "technique")).toEqual({
			category: "technique",
			value: 2,
			next: null,
			missing: null,
		});
		expect(result.earned.map((b) => b.badgeId)).toContain("technique-2");
	});

	it("gives every threshold one ride crosses that ride's date", () => {
		const result = evaluate({ rides: [ride("2026-05-02", 600, 1200)] });
		expect(result.earned).toEqual([
			{ badgeId: "distance-100", earnedOn: "2026-05-02" },
			{ badgeId: "distance-500", earnedOn: "2026-05-02" },
			{ badgeId: "elevation-1000", earnedOn: "2026-05-02" },
			// 1,200 m are one elevation step of Training Rynke.
			{ badgeId: "training-rynke-1", earnedOn: "2026-05-02" },
		]);
	});

	it("counts team events of any kind and technique trainings on their own", () => {
		const result = evaluate({
			attendance: [
				{ eventId: 1, kind: "team_training", date: "2026-02-01" },
				{ eventId: 2, kind: "training_weekend_day", date: "2026-02-08" },
				{ eventId: 3, kind: "technique_training", date: "2026-02-15" },
				{ eventId: 4, kind: "team_training", date: "2026-02-22" },
				{ eventId: 5, kind: "team_training", date: "2026-03-01" },
				// Before the season start: counts nothing.
				{ eventId: 6, kind: "team_training", date: "2025-12-20" },
			],
		});
		expect(result.earned).toContainEqual({
			badgeId: "team-events-5",
			earnedOn: "2026-03-01",
		});
		expect(result.earned).toContainEqual({
			badgeId: "technique-1",
			earnedOn: "2026-02-15",
		});
		expect(progressOf(result, "team_events")?.value).toBe(5);
	});

	it("dates a Training Rynke badge by the correction that reached it", () => {
		const result = evaluate({
			rides: [ride("2026-03-01", 20, 0, 20)],
			corrections: [{ date: "2026-03-05", training: 6, team: 0 }],
		});
		expect(result.earned).toContainEqual({
			badgeId: "training-rynke-25",
			earnedOn: "2026-03-05",
		});
		expect(progressOf(result, "training_rynke")).toMatchObject({
			value: 26,
			next: 50,
			missing: 24,
		});
	});

	it("drops a badge when its ride stops counting", () => {
		expect(evaluate({ rides: [ride("2026-03-01", 99)] }).earned).toEqual([]);
	});

	it("keeps a Training Rynke badge dated from when the value last reached it", () => {
		const result = evaluate({
			rides: [ride("2026-03-01", 30, 0, 30), ride("2026-03-20", 10, 0, 10)],
			corrections: [{ date: "2026-03-10", training: -10, team: 0 }],
		});
		// 30, then 20 after the correction, then 30 again.
		expect(result.earned).toContainEqual({
			badgeId: "training-rynke-25",
			earnedOn: "2026-03-20",
		});
	});

	it("gives every personal category progress, and nothing earned, without inputs", () => {
		const result = evaluate({});
		expect(result.earned).toEqual([]);
		expect(result.progress.map((p) => [p.category, p.value, p.next])).toEqual([
			["distance", 0, 100],
			["elevation", 0, 1000],
			["team_events", 0, 1],
			["technique", 0, 1],
			["training_rynke", 0, 1],
			["run_length", 0, 5],
			["running", 0, 10],
		]);
	});

	it("gives the same output for the same inputs", () => {
		const inputs = { rides: [ride("2026-03-01", 150, 2000, 150)] };
		expect(evaluate(inputs)).toEqual(evaluate(inputs));
	});
});

describe("evaluateBadges for runs", () => {
	const run = (date: string, km: number) => ({ date, distanceM: km * 1000 });

	it("adds up runs without rounding per run (US3 scenario 1)", () => {
		const result = evaluate({
			runs: [run("2026-04-01", 7.8), run("2026-04-03", 4.6)],
		});
		expect(progressOf(result, "running")?.value).toBeCloseTo(12.4);
		expect(result.earned).toContainEqual({
			badgeId: "running-10",
			earnedOn: "2026-04-03",
		});
	});

	it("dates the running badge by the run that crossed it (US3 scenario 1a)", () => {
		const result = evaluate({
			runs: [run("2026-04-01", 9.6), run("2026-04-05", 0.5)],
		});
		expect(result.earned).toEqual([
			{ badgeId: "run-length-5", earnedOn: "2026-04-01" },
			{ badgeId: "running-10", earnedOn: "2026-04-05" },
		]);
	});

	it("gives a first long run every badge it reaches on one date (US3 1b)", () => {
		expect(evaluate({ runs: [run("2026-04-01", 22)] }).earned).toEqual([
			{ badgeId: "run-length-5", earnedOn: "2026-04-01" },
			{ badgeId: "run-length-10", earnedOn: "2026-04-01" },
			{ badgeId: "run-length-half", earnedOn: "2026-04-01" },
			{ badgeId: "running-10", earnedOn: "2026-04-01" },
		]);
	});

	it("measures run length by the longest run (US3 scenario 1c)", () => {
		const result = evaluate({
			runs: [run("2026-04-01", 21.3), run("2026-04-08", 8)],
		});
		expect(progressOf(result, "run_length")).toMatchObject({
			value: 21.3,
			next: 42.195,
		});
	});
});
