import { describe, expect, it } from "vitest";
import { CURRENT_RULES, type RynkeRules } from "../../src/rynke/rules";
import {
	type Attendance,
	evaluateAttendance,
	TEAM_EVENT_KINDS,
	type TeamEventKind,
} from "../../src/rynke/team-events";
import { WINDOW } from "../support/rides";

// Story 3: attendance at team events earns fixed Team and Training Rynke per
// kind (FR-006–FR-009, research R19). Names start with the spec's scenario
// number where there is one.

function attend(
	eventId: number,
	kind: TeamEventKind,
	date = "2026-05-01",
): Attendance {
	return { eventId, kind, date };
}

function evaluate(attendance: Attendance[], rules = CURRENT_RULES) {
	return evaluateAttendance(attendance, rules, WINDOW);
}

/** The breakdown entry of `kind`. */
function sum(attendance: Attendance[], kind: TeamEventKind) {
	return evaluate(attendance).byKind.find((s) => s.kind === kind);
}

function permutations<T>(items: T[]): T[][] {
	if (items.length <= 1) return [items];
	return items.flatMap((item, i) =>
		permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
			item,
			...rest,
		]),
	);
}

describe("evaluateAttendance", () => {
	it("US3-1: 3 team trainings give 3 Team and 15 Training Rynke", () => {
		const result = evaluate([
			attend(1, "team_training", "2026-05-01"),
			attend(2, "team_training", "2026-05-08"),
			attend(3, "team_training", "2026-05-15"),
		]);
		expect(result).toEqual({
			byKind: [
				{ kind: "team_training", attended: 3, team: 3, training: 15 },
				{ kind: "training_weekend_day", attended: 0, team: 0, training: 0 },
				{ kind: "technique_training", attended: 0, team: 0, training: 0 },
			],
			team: 3,
			training: 15,
		});
	});

	it("US3-2: both days of a training weekend give 10 Team and 20 Training Rynke", () => {
		const result = evaluate([
			attend(1, "training_weekend_day", "2026-06-13"),
			attend(2, "training_weekend_day", "2026-06-14"),
		]);
		expect(result).toMatchObject({ team: 10, training: 20 });
		expect(result.byKind[1]).toEqual({
			kind: "training_weekend_day",
			attended: 2,
			team: 10,
			training: 20,
		});
	});

	it("US3-3: one technique training gives 5 Team and 5 Training Rynke", () => {
		expect(evaluate([attend(1, "technique_training")])).toMatchObject({
			team: 5,
			training: 5,
		});
	});

	it("US3-4: the same event recorded twice counts once", () => {
		const once = attend(1, "team_training");
		expect(evaluate([once, { ...once }])).toEqual(evaluate([once]));
		expect(sum([once, { ...once }], "team_training")).toEqual({
			kind: "team_training",
			attended: 1,
			team: 1,
			training: 5,
		});
	});

	it("lists every kind in TEAM_EVENT_KINDS order without attendance", () => {
		expect(evaluate([])).toEqual({
			byKind: TEAM_EVENT_KINDS.map((kind) => ({
				kind,
				attended: 0,
				team: 0,
				training: 0,
			})),
			team: 0,
			training: 0,
		});
	});

	describe("counting window (FR-011)", () => {
		it("counts the season start, not the day before", () => {
			expect(
				evaluate([attend(1, "team_training", WINDOW.seasonStart)]).team,
			).toBe(1);
			expect(evaluate([attend(1, "team_training", "2025-12-31")]).team).toBe(0);
		});

		it("counts the deadline, not the day after", () => {
			const window = { ...WINDOW, deadline: "2026-08-31" };
			expect(
				evaluateAttendance(
					[attend(1, "team_training", "2026-08-31")],
					CURRENT_RULES,
					window,
				).team,
			).toBe(1);
			expect(
				evaluateAttendance(
					[attend(1, "team_training", "2026-09-01")],
					CURRENT_RULES,
					window,
				).team,
			).toBe(0);
		});

		it("counts an event in the future: the clock is never read", () => {
			expect(
				evaluate([attend(1, "team_training", "2026-12-31")]),
			).toMatchObject({ team: 1, training: 5 });
		});
	});

	it("takes the amounts from the rules it is given", () => {
		const rules: RynkeRules = {
			...CURRENT_RULES,
			teamEvents: {
				...CURRENT_RULES.teamEvents,
				team_training: { team: 2, training: 0 },
			},
		};
		expect(
			evaluate(
				[attend(1, "team_training"), attend(2, "team_training", "2026-05-02")],
				rules,
			),
		).toMatchObject({ team: 4, training: 0 });
	});

	it("gives the same output in any order and leaves its input alone", () => {
		const attendance = [
			attend(1, "team_training", "2026-05-01"),
			attend(2, "training_weekend_day", "2026-06-13"),
			attend(3, "technique_training", "2026-07-01"),
			attend(4, "team_training", "2025-12-31"),
			attend(5, "training_weekend_day", "2026-06-14"),
		];
		const copy = structuredClone(attendance);
		const expected = evaluate(attendance);
		expect(expected).toMatchObject({ team: 16, training: 30 });
		for (const order of permutations(attendance)) {
			expect(evaluate(order)).toEqual(expected);
		}
		expect(attendance).toEqual(copy);
	});
});
