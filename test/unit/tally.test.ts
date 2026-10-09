import { describe, expect, it } from "vitest";
import {
	evaluateRides,
	type RidingSums,
	type RidingTotals,
} from "../../src/rynke/rides";
import { CURRENT_RULES, type RynkeRules } from "../../src/rynke/rules";
import {
	type Extras,
	extrasFrom,
	extrasFromAttendance,
	NO_EXTRAS,
	tally,
	virtualShareRequired,
} from "../../src/rynke/tally";
import {
	type Attendance,
	evaluateAttendance,
	TEAM_EVENT_KINDS,
	type TeamEventKind,
} from "../../src/rynke/team-events";
import { makeRide, WINDOW } from "../support/rides";

/** Riding totals from whole Rynke and decimetres, elevation floored as R3 says. */
function sums(distanceRynke: number, elevationDm = 0): RidingSums {
	return {
		distanceRynke,
		elevationDm,
		elevationRynke: Math.floor(elevationDm / 10000) * 5,
	};
}

function riding(
	all: RidingSums,
	withoutVirtual: RidingSums = all,
): RidingTotals {
	return { ...all, withoutVirtual };
}

/** Extras without a breakdown, as Story 6's corrections would give them. */
function extras(training: number, team: number): Extras {
	return { ...NO_EXTRAS, training, team };
}

/** Extras from attending `kinds`, one event each, inside the window. */
function attending(...kinds: TeamEventKind[]): Extras {
	const attendance: Attendance[] = kinds.map((kind, i) => ({
		eventId: i + 1,
		kind,
		date: "2026-05-01",
	}));
	return extrasFromAttendance(
		evaluateAttendance(attendance, CURRENT_RULES, WINDOW),
	);
}

const ZERO_BREAKDOWN = TEAM_EVENT_KINDS.map((kind) => ({
	kind,
	attended: 0,
	team: 0,
	training: 0,
}));

describe("tally", () => {
	it("S4-1: fills every balance field from the riding totals", () => {
		expect(tally(riding(sums(7, 12400)), NO_EXTRAS, CURRENT_RULES)).toEqual({
			distanceRynke: 7,
			elevationDm: 12400,
			elevationRynke: 5,
			elevationToNextStepDm: 7600,
			trainingRynke: 12,
			teamRynke: 0,
			trainingMissing: 238,
			teamMissing: 25,
			trainingWithoutVirtual: 12,
			virtualShareMissing: 155,
			qualified: false,
			rulesVersion: CURRENT_RULES.version,
			rulesEffectiveDate: CURRENT_RULES.effectiveDate,
			teamEvents: ZERO_BREAKDOWN,
		});
	});

	it.each([
		[0, 10000],
		[20000, 10000],
		[19999, 1],
		[10001, 9999],
	])("elevation %d dm leaves %d dm to the next step, never 0", (dm, toNext) => {
		expect(
			tally(riding(sums(0, dm)), NO_EXTRAS, CURRENT_RULES)
				.elevationToNextStepDm,
		).toBe(toNext);
	});

	it("S4-8: virtual rides beyond a third keep the rider from qualifying", () => {
		const balance = tally(
			riding(sums(260), sums(160)),
			extras(0, 25),
			CURRENT_RULES,
		);
		expect(balance).toMatchObject({
			trainingRynke: 260,
			trainingMissing: 0,
			teamRynke: 25,
			teamMissing: 0,
			trainingWithoutVirtual: 160,
			virtualShareMissing: 7,
			qualified: false,
		});
	});

	it("S4-8: 167 without virtual rides is enough", () => {
		const balance = tally(
			riding(sums(260), sums(167)),
			extras(0, 25),
			CURRENT_RULES,
		);
		expect(balance).toMatchObject({
			trainingWithoutVirtual: 167,
			virtualShareMissing: 0,
			qualified: true,
		});
	});

	it("counts extra Training Rynke with and without virtual rides (R12)", () => {
		const balance = tally(
			riding(sums(100), sums(40)),
			extras(30, 3),
			CURRENT_RULES,
		);
		expect(balance).toMatchObject({
			distanceRynke: 100,
			trainingRynke: 130,
			trainingWithoutVirtual: 70,
			teamRynke: 3,
			teamMissing: 22,
		});
	});

	it("floors totals at 0 for negative extras", () => {
		const balance = tally(
			riding(sums(10), sums(5)),
			extras(-50, -2),
			CURRENT_RULES,
		);
		expect(balance).toMatchObject({
			distanceRynke: 10,
			trainingRynke: 0,
			teamRynke: 0,
			trainingWithoutVirtual: 0,
			trainingMissing: 250,
			teamMissing: 25,
			virtualShareMissing: 167,
			qualified: false,
		});
	});

	it.each([
		[250, 25, 167, true],
		[249, 25, 167, false],
		[250, 24, 167, false],
		[250, 25, 166, false],
		[400, 30, 400, true],
	])(
		"training %d, team %d, %d without virtual → qualified %s",
		(training, team, withoutVirtual, qualified) => {
			const balance = tally(
				riding(sums(training), sums(withoutVirtual)),
				extras(0, team),
				CURRENT_RULES,
			);
			expect(balance.qualified).toBe(qualified);
			expect(
				balance.trainingMissing === 0 &&
					balance.teamMissing === 0 &&
					balance.virtualShareMissing === 0,
			).toBe(qualified);
		},
	);

	it("needs ceil(threshold × (den − num) / den) without virtual rides", () => {
		const rules: RynkeRules = { ...CURRENT_RULES, trainingThreshold: 10 };
		expect(
			tally(riding(sums(10), sums(0)), NO_EXTRAS, rules).virtualShareMissing,
		).toBe(7);
		const half: RynkeRules = {
			...CURRENT_RULES,
			trainingThreshold: 9,
			maxVirtualShare: { num: 1, den: 2 },
		};
		expect(
			tally(riding(sums(9), sums(0)), NO_EXTRAS, half).virtualShareMissing,
		).toBe(5);
		const any: RynkeRules = {
			...CURRENT_RULES,
			maxVirtualShare: { num: 1, den: 1 },
		};
		expect(
			tally(riding(sums(250), sums(0)), NO_EXTRAS, any).virtualShareMissing,
		).toBe(0);
	});

	it("uses the rules' steps for the elevation still to climb", () => {
		const rules: RynkeRules = { ...CURRENT_RULES, elevationStepM: 500 };
		expect(
			tally(riding(sums(0, 12400)), NO_EXTRAS, rules).elevationToNextStepDm,
		).toBe(2600);
	});

	it("has one zero breakdown entry per kind without extras", () => {
		expect(NO_EXTRAS).toEqual({
			training: 0,
			team: 0,
			teamEvents: ZERO_BREAKDOWN,
		});
	});

	it("copies the team-event breakdown into the balance unchanged", () => {
		const events = attending("team_training", "technique_training");
		expect(tally(riding(sums(0)), events, CURRENT_RULES).teamEvents).toEqual(
			events.teamEvents,
		);
	});

	describe("team events (Story 3)", () => {
		// 60 km and 1000 m: 6 + 5 = 11 Training Rynke.
		const ride = evaluateRides(
			[makeRide({ id: 1, km: 60, movingH: 2.5, elevationM: 1000 })],
			CURRENT_RULES,
			WINDOW,
		).riding;

		it("US3-5: a team training on top of the ride gives 1 Team and 16 Training Rynke", () => {
			expect(
				tally(ride, attending("team_training"), CURRENT_RULES),
			).toMatchObject({ teamRynke: 1, trainingRynke: 16 });
		});

		it("US3-6: the ride without recorded attendance gives 0 Team and 11 Training Rynke", () => {
			const balance = tally(ride, attending(), CURRENT_RULES);
			expect(balance).toMatchObject({ teamRynke: 0, trainingRynke: 11 });
			expect(balance.teamEvents).toEqual(ZERO_BREAKDOWN);
		});

		it("S4-9: lists every kind, the training weekend with 0", () => {
			const balance = tally(
				riding(sums(0)),
				attending("team_training", "team_training", "technique_training"),
				CURRENT_RULES,
			);
			expect(balance).toMatchObject({ teamRynke: 7, trainingRynke: 15 });
			expect(balance.teamEvents).toEqual([
				{ kind: "team_training", attended: 2, team: 2, training: 10 },
				{ kind: "training_weekend_day", attended: 0, team: 0, training: 0 },
				{ kind: "technique_training", attended: 1, team: 5, training: 5 },
			]);
		});

		it("qualifies through event Team Rynke", () => {
			const technique = Array<TeamEventKind>(5).fill("technique_training");
			expect(
				tally(riding(sums(250)), attending(...technique), CURRENT_RULES),
			).toMatchObject({ teamRynke: 25, teamMissing: 0, qualified: true });
			expect(
				tally(
					riding(sums(250)),
					attending(...technique.slice(1), "team_training"),
					CURRENT_RULES,
				),
			).toMatchObject({ teamRynke: 21, teamMissing: 4, qualified: false });
		});

		it("counts event Training Rynke without virtual rides (R12)", () => {
			const technique = Array<TeamEventKind>(5).fill("technique_training");
			expect(
				tally(
					riding(sums(100), sums(40)),
					attending(...technique),
					CURRENT_RULES,
				),
			).toMatchObject({ trainingRynke: 125, trainingWithoutVirtual: 65 });
		});
	});

	it("rejects invalid rules", () => {
		expect(() =>
			tally(riding(sums(0)), NO_EXTRAS, { ...CURRENT_RULES, version: 0 }),
		).toThrow();
	});
});

describe("virtualShareRequired", () => {
	it("is 167 under the current rules", () => {
		expect(virtualShareRequired(CURRENT_RULES)).toBe(167);
	});

	it("follows the threshold and the share", () => {
		expect(
			virtualShareRequired({
				...CURRENT_RULES,
				trainingThreshold: 300,
				maxVirtualShare: { num: 1, den: 3 },
			}),
		).toBe(200);
	});
});

describe("extrasFrom (feature 014 Story 3)", () => {
	const attendance = evaluateAttendance(
		[
			{ eventId: 1, kind: "team_training", date: "2026-05-01" },
			{ eventId: 2, kind: "technique_training", date: "2026-05-02" },
		],
		CURRENT_RULES,
		WINDOW,
	);

	it("adds the corrections to attendance's Training and Team Rynke", () => {
		const base = extrasFromAttendance(attendance);
		expect(
			extrasFrom(attendance, [
				{ training: 10, team: 0 },
				{ training: -3, team: 2 },
			]),
		).toEqual({
			training: base.training + 7,
			team: base.team + 2,
			teamEvents: base.teamEvents,
		});
	});

	it("equals extrasFromAttendance without corrections", () => {
		expect(extrasFrom(attendance, [])).toEqual(
			extrasFromAttendance(attendance),
		);
	});

	it("clamps Team Rynke at 0 after a -20 correction on 5", () => {
		const fromAttendance = evaluateAttendance(
			Array.from({ length: 5 }, (_, i) => ({
				eventId: i + 1,
				kind: "team_training" as const,
				date: "2026-05-01",
			})),
			CURRENT_RULES,
			WINDOW,
		);
		expect(fromAttendance.team).toBe(5);
		expect(
			tally(
				riding(sums(0)),
				extrasFrom(fromAttendance, [{ training: 0, team: -20 }]),
				CURRENT_RULES,
			).teamRynke,
		).toBe(0);
	});
});
