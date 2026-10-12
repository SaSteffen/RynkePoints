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
			// The first ride is also the longest (part C).
			{ badgeId: "ride-length-50", earnedOn: "2026-03-01" },
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
			{ badgeId: "ride-length-50", earnedOn: "2026-05-02" },
			{ badgeId: "ride-length-100", earnedOn: "2026-05-02" },
			{ badgeId: "ride-length-150", earnedOn: "2026-05-02" },
			{ badgeId: "ride-length-200", earnedOn: "2026-05-02" },
			{ badgeId: "ride-length-250", earnedOn: "2026-05-02" },
			{ badgeId: "ride-length-300", earnedOn: "2026-05-02" },
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
		expect(evaluate({ rides: [ride("2026-03-01", 49)] }).earned).toEqual([]);
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
			["ride_length", 0, 50],
			["virtual_rides", 0, 50],
			["swim_length", 0, 0.5],
			["swimming", 0, 5],
			["winter_november", 0, 1],
			["winter_december", 0, 1],
			["winter_january", 0, 1],
			["winter_february", 0, 1],
			["surprise", 0, null],
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

// Part C (2026-10-12): ride length, virtual rides, winter months and swims
// (spec User Story 5, FR-010, research R23, R24).

const virtual = (date: string, km: number) => ({
	...ride(date, km),
	virtual: true,
});

describe("evaluateBadges for ride length", () => {
	it("dates each threshold by the ride that first reached it (US5 1)", () => {
		const result = evaluate({
			rides: [
				ride("2026-03-01", 60),
				ride("2026-03-08", 40),
				ride("2026-04-02", 104),
			],
		});
		expect(
			result.earned.filter((b) => b.badgeId.startsWith("ride-length")),
		).toEqual([
			{ badgeId: "ride-length-50", earnedOn: "2026-03-01" },
			{ badgeId: "ride-length-100", earnedOn: "2026-04-02" },
		]);
		expect(progressOf(result, "ride_length")).toMatchObject({
			value: 104,
			next: 150,
		});
	});

	it("gives a 312 km ride every badge up to 300 on one date (US5 2)", () => {
		const result = evaluate({ rides: [ride("2026-06-13", 312)] });
		expect(
			result.earned
				.filter((b) => b.badgeId.startsWith("ride-length"))
				.map((b) => [b.badgeId, b.earnedOn]),
		).toEqual(
			[50, 100, 150, 200, 250, 300].map((km) => [
				`ride-length-${km}`,
				"2026-06-13",
			]),
		);
		expect(progressOf(result, "ride_length")?.next).toBeNull();
	});

	it("counts a virtual ride as a ride", () => {
		const result = evaluate({ rides: [virtual("2026-03-01", 55)] });
		expect(progressOf(result, "ride_length")?.value).toBe(55);
	});
});

describe("evaluateBadges for virtual rides", () => {
	it("adds up only virtual rides, which Distance still counts (US5 3)", () => {
		const result = evaluate({
			rides: [
				virtual("2026-03-01", 30),
				ride("2026-03-02", 40),
				virtual("2026-03-04", 25),
			],
		});
		expect(progressOf(result, "virtual_rides")?.value).toBe(55);
		expect(result.earned).toContainEqual({
			badgeId: "virtual-rides-50",
			earnedOn: "2026-03-04",
		});
		expect(progressOf(result, "distance")?.value).toBe(95);
	});
});

describe("evaluateBadges for the winter months", () => {
	const WINTER = { seasonStart: "2026-09-01", deadline: "2027-07-31" };
	const inWinter = (rides: ReturnType<typeof ride>[]) =>
		evaluateBadges({ ...NONE, rides }, CURRENT_RULES, WINTER);

	it("counts days, not rides (US5 6)", () => {
		const result = inWinter([
			ride("2027-01-10", 20),
			ride("2027-01-10", 15),
			ride("2027-01-11", 30),
		]);
		expect(progressOf(result, "winter_january")).toMatchObject({
			value: 2,
			next: 5,
			missing: 3,
		});
		expect(result.earned).toContainEqual({
			badgeId: "winter-january-1",
			earnedOn: "2027-01-10",
		});
	});

	it("leaves out the days of virtual and trainer rides (US5 7)", () => {
		const result = inWinter([virtual("2026-12-05", 40)]);
		expect(progressOf(result, "winter_december")?.value).toBe(0);
		expect(result.earned.some((b) => b.badgeId.startsWith("winter-"))).toBe(
			false,
		);
	});

	it("places a ride by its local start date (US5 8)", () => {
		const result = inWinter([ride("2026-11-30", 25)]);
		expect(progressOf(result, "winter_november")?.value).toBe(1);
		expect(progressOf(result, "winter_december")?.value).toBe(0);
	});

	it("counts each month on its own and nothing outside them", () => {
		const result = inWinter([
			ride("2026-10-31", 20),
			ride("2026-11-02", 20),
			ride("2026-12-24", 20),
			ride("2027-02-14", 20),
			ride("2027-03-01", 20),
		]);
		expect(
			[
				"winter_november",
				"winter_december",
				"winter_january",
				"winter_february",
			].map((c) => progressOf(result, c)?.value),
		).toEqual([1, 1, 0, 1]);
	});

	it("dates the 10-day badge by the tenth day", () => {
		const days = Array.from({ length: 10 }, (_, i) =>
			ride(`2027-02-${String(i + 1).padStart(2, "0")}`, 20),
		);
		const result = inWinter(days);
		expect(result.earned).toContainEqual({
			badgeId: "winter-february-10",
			earnedOn: "2027-02-10",
		});
		expect(progressOf(result, "winter_february")?.next).toBeNull();
	});

	it("takes the badge back when the day's only ride stops counting", () => {
		expect(
			inWinter([]).earned.some((b) => b.badgeId.startsWith("winter-")),
		).toBe(false);
	});
});

describe("evaluateBadges for swims", () => {
	const swim = (date: string, km: number) => ({ date, distanceM: km * 1000 });

	it("adds up pool and open-water swims, longest apart (US5 4)", () => {
		const result = evaluate({
			swims: [swim("2026-05-01", 1.2), swim("2026-05-03", 0.8)],
		});
		expect(progressOf(result, "swimming")?.value).toBeCloseTo(2);
		expect(progressOf(result, "swim_length")?.value).toBeCloseTo(1.2);
		expect(result.earned).toEqual([
			{ badgeId: "swim-length-500", earnedOn: "2026-05-01" },
			{ badgeId: "swim-length-1000", earnedOn: "2026-05-01" },
		]);
	});

	it("gives a first 2 km swim every length badge it reaches on one date", () => {
		expect(
			evaluate({ swims: [swim("2026-05-01", 2)] }).earned.map((b) => b.badgeId),
		).toEqual(["swim-length-500", "swim-length-1000", "swim-length-1900"]);
	});

	it("counts no swim outside the counting window", () => {
		const result = evaluate({ swims: [swim("2025-12-30", 3)] });
		expect(progressOf(result, "swimming")?.value).toBe(0);
		expect(result.earned).toEqual([]);
	});

	it("leaves every ride and run category alone", () => {
		const result = evaluate({ swims: [swim("2026-05-01", 6)] });
		for (const category of ["distance", "running", "ride_length"]) {
			expect(progressOf(result, category)?.value).toBe(0);
		}
	});
});

// Part D: surprise badges (spec User Story 6, FR-015a, research R33).
describe("evaluateBadges for the surprise badges", () => {
	const SEASON = { seasonStart: "2026-09-01", deadline: "2027-07-31" };
	const at = (date: string, time: string, km = 20) => ({
		...ride(date, km),
		startTime: time,
	});
	const run = (date: string) => ({ date, distanceM: 5000 });
	const surprises = (inputs: Partial<PersonalInputs>) =>
		evaluateBadges({ ...NONE, ...inputs }, CURRENT_RULES, SEASON).earned.filter(
			(b) => b.badgeId.startsWith("surprise-"),
		);

	it("gives the holiday badges for a ride, a run or a swim (US6 2, 3)", () => {
		expect(
			surprises({
				rides: [at("2026-12-24", "10:00")],
				runs: [run("2027-01-01")],
				swims: [{ date: "2026-12-26", distanceM: 1000 }],
			}),
		).toEqual([
			{ badgeId: "surprise-new-year", earnedOn: "2027-01-01" },
			{ badgeId: "surprise-christmas-eve", earnedOn: "2026-12-24" },
			{ badgeId: "surprise-christmas", earnedOn: "2026-12-26" },
		]);
	});

	it("dates Christmas by the first of the two holidays", () => {
		expect(
			surprises({
				rides: [at("2026-12-26", "10:00"), at("2026-12-25", "10:00")],
			}),
		).toEqual([{ badgeId: "surprise-christmas", earnedOn: "2026-12-25" }]);
	});

	it("makes a night owl from 21:30 on (US6 4)", () => {
		expect(surprises({ rides: [at("2026-10-03", "21:29")] })).toEqual([]);
		expect(surprises({ rides: [at("2026-10-04", "21:30")] })).toEqual([
			{ badgeId: "surprise-night-owl", earnedOn: "2026-10-04" },
		]);
	});

	it("makes an early bird before 6:00, from rides only (US6 5)", () => {
		expect(surprises({ rides: [at("2026-10-03", "06:00")] })).toEqual([]);
		expect(surprises({ rides: [at("2026-10-04", "05:59")] })).toEqual([
			{ badgeId: "surprise-early-bird", earnedOn: "2026-10-04" },
		]);
		expect(surprises({ rides: [at("2026-10-05", "00:30")] })).toEqual([
			{ badgeId: "surprise-early-bird", earnedOn: "2026-10-05" },
		]);
	});

	it("gives the rest day after a full week, dated the day off (US6 6)", () => {
		const week = Array.from({ length: 7 }, (_, i) => run(`2026-10-0${1 + i}`));
		// No later activity yet: the day off isn't over.
		expect(surprises({ runs: week })).toEqual([]);
		expect(
			surprises({ runs: week, rides: [at("2026-10-09", "10:00")] }),
		).toEqual([{ badgeId: "surprise-rest-day", earnedOn: "2026-10-08" }]);
	});

	it("gives no rest day after six days (US6 7)", () => {
		const six = Array.from({ length: 6 }, (_, i) => run(`2026-10-0${1 + i}`));
		expect(surprises({ runs: [...six, run("2026-10-09")] })).toEqual([]);
	});

	it("counts mixed activities and several on one day towards the week", () => {
		expect(
			surprises({
				rides: [
					at("2026-10-01", "10:00"),
					at("2026-10-01", "17:00"),
					at("2026-10-03", "10:00"),
				],
				runs: [run("2026-10-02"), run("2026-10-05"), run("2026-10-07")],
				swims: [
					{ date: "2026-10-04", distanceM: 1000 },
					{ date: "2026-10-06", distanceM: 1000 },
					{ date: "2026-10-12", distanceM: 1000 },
				],
			}),
		).toEqual([{ badgeId: "surprise-rest-day", earnedOn: "2026-10-08" }]);
	});

	it("counts nothing outside the counting window", () => {
		expect(
			surprises({
				rides: [at("2026-01-01", "05:00")],
				runs: [run("2026-08-31")],
			}),
		).toEqual([]);
	});

	it("shows no next step for the surprise category", () => {
		const result = evaluateBadges(
			{ ...NONE, rides: [at("2026-12-24", "22:00")] },
			CURRENT_RULES,
			SEASON,
		);
		expect(progressOf(result, "surprise")).toEqual({
			category: "surprise",
			value: 2,
			next: null,
			missing: null,
		});
	});
});
