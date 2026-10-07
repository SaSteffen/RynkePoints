import { describe, expect, it } from "vitest";
import type { RidingSums, RidingTotals } from "../../src/rynke/rides";
import { CURRENT_RULES, type RynkeRules } from "../../src/rynke/rules";
import { NO_EXTRAS, tally } from "../../src/rynke/tally";

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
			{ training: 0, team: 25 },
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
			{ training: 0, team: 25 },
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
			{ training: 30, team: 3 },
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
			{ training: -50, team: -2 },
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
				{ training: 0, team },
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

	it("rejects invalid rules", () => {
		expect(() =>
			tally(riding(sums(0)), NO_EXTRAS, { ...CURRENT_RULES, version: 0 }),
		).toThrow();
	});
});
