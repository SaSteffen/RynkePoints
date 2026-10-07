import { describe, expect, it } from "vitest";
import {
	assertValidRules,
	CURRENT_RULES,
	countingWindow,
	RULES_HISTORY,
	type RynkeRules,
	rulesFingerprint,
	rulesForVersion,
} from "../../src/rynke/rules";
import { TEAM_EVENT_KINDS } from "../../src/rynke/team-events";

const TEAM_EVENTS = {
	team_training: { team: 1, training: 5 },
	training_weekend_day: { team: 5, training: 10 },
	technique_training: { team: 5, training: 5 },
};

describe("CURRENT_RULES", () => {
	it("has the values of data-model.md", () => {
		const { effectiveDate, ...values } = CURRENT_RULES;
		expect(values).toEqual({
			version: 2,
			distanceStepKm: 10,
			distanceStepRynke: 1,
			elevationStepM: 1000,
			elevationStepRynke: 5,
			maxPausedShare: { num: 1, den: 2 },
			minSpeedKmh: 10,
			maxSpeedKmh: 45,
			maxClimbMPerH: 1500,
			excludedSportTypes: ["EBikeRide", "EMountainBikeRide"],
			qualificationDeadline: null,
			trainingThreshold: 250,
			teamThreshold: 25,
			maxVirtualShare: { num: 1, den: 3 },
			teamEvents: TEAM_EVENTS,
		});
		expect(effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});

	it("has one event amount per kind, in TEAM_EVENT_KINDS order", () => {
		expect(Object.keys(CURRENT_RULES.teamEvents)).toEqual(TEAM_EVENT_KINDS);
	});

	it("pins its values to its version", () => {
		// version: 2
		const fingerprint =
			'{"distanceStepKm":10,"distanceStepRynke":1,"elevationStepM":1000,' +
			'"elevationStepRynke":5,"excludedSportTypes":["EBikeRide","EMountainBikeRide"],' +
			'"maxClimbMPerH":1500,"maxPausedShare":{"den":2,"num":1},"maxSpeedKmh":45,' +
			'"maxVirtualShare":{"den":3,"num":1},"minSpeedKmh":10,' +
			'"qualificationDeadline":null,"teamEvents":{' +
			'"team_training":{"team":1,"training":5},' +
			'"technique_training":{"team":5,"training":5},' +
			'"training_weekend_day":{"team":5,"training":10}},' +
			'"teamThreshold":25,"trainingThreshold":250}';
		expect(CURRENT_RULES.version).toBe(2);
		expect(
			rulesFingerprint(CURRENT_RULES),
			"a rule value changed: raise CURRENT_RULES.version and effectiveDate, then update this fingerprint",
		).toBe(fingerprint);
	});

	it("has no rule value for flagged rides (FR-005g)", () => {
		expect(Object.keys(CURRENT_RULES).filter((k) => /flag/i.test(k))).toEqual(
			[],
		);
	});
});

describe("rulesFingerprint", () => {
	it("ignores version, effective date and key order", () => {
		const reordered = Object.fromEntries(
			Object.entries(CURRENT_RULES).reverse(),
		) as unknown as RynkeRules;
		expect(
			rulesFingerprint({
				...reordered,
				version: 9,
				effectiveDate: "2030-01-01",
			}),
		).toBe(rulesFingerprint(CURRENT_RULES));
	});

	it("changes with any value", () => {
		expect(rulesFingerprint({ ...CURRENT_RULES, minSpeedKmh: 11 })).not.toBe(
			rulesFingerprint(CURRENT_RULES),
		);
	});
});

describe("assertValidRules", () => {
	it("accepts CURRENT_RULES", () => {
		expect(() => assertValidRules(CURRENT_RULES)).not.toThrow();
	});

	const positiveIntegers = [
		"version",
		"distanceStepKm",
		"distanceStepRynke",
		"elevationStepM",
		"elevationStepRynke",
		"minSpeedKmh",
		"maxSpeedKmh",
		"maxClimbMPerH",
		"trainingThreshold",
		"teamThreshold",
	] as const;

	it.each(
		positiveIntegers.flatMap((field) =>
			[0, -1, 1.5].map((value) => [field, value] as const),
		),
	)("rejects %s = %d", (field, value) => {
		expect(() =>
			assertValidRules({ ...CURRENT_RULES, [field]: value }),
		).toThrow();
	});

	it("rejects a minimum speed not below the maximum", () => {
		expect(() =>
			assertValidRules({ ...CURRENT_RULES, minSpeedKmh: 45 }),
		).toThrow();
		expect(() =>
			assertValidRules({ ...CURRENT_RULES, minSpeedKmh: 46 }),
		).toThrow();
	});

	it.each([
		{ num: 1, den: 0 },
		{ num: 0, den: -1 },
		{ num: -1, den: 2 },
		{ num: 3, den: 2 },
		{ num: 0.5, den: 2 },
	])("rejects the share %j", (share) => {
		expect(() =>
			assertValidRules({ ...CURRENT_RULES, maxPausedShare: share }),
		).toThrow();
		expect(() =>
			assertValidRules({ ...CURRENT_RULES, maxVirtualShare: share }),
		).toThrow();
	});

	it("accepts shares at their bounds", () => {
		expect(() =>
			assertValidRules({
				...CURRENT_RULES,
				maxPausedShare: { num: 0, den: 1 },
				maxVirtualShare: { num: 1, den: 1 },
			}),
		).not.toThrow();
	});

	it.each(["", "2026-1-1", "01.01.2026", "2026-13-01", "2026-02-30"])(
		"rejects the date %j",
		(date) => {
			expect(() =>
				assertValidRules({ ...CURRENT_RULES, effectiveDate: date }),
			).toThrow();
			expect(() =>
				assertValidRules({ ...CURRENT_RULES, qualificationDeadline: date }),
			).toThrow();
		},
	);

	it.each([
		["misses a kind", { team_training: { team: 1, training: 5 } }],
		["has an unknown kind", { ...TEAM_EVENTS, ride: { team: 1, training: 1 } }],
		[
			"has a negative amount",
			{ ...TEAM_EVENTS, team_training: { team: -1, training: 5 } },
		],
		[
			"has a fractional amount",
			{ ...TEAM_EVENTS, team_training: { team: 1, training: 2.5 } },
		],
		["misses an amount", { ...TEAM_EVENTS, technique_training: { team: 5 } }],
	])("rejects team events that %s", (_case, teamEvents) => {
		expect(() =>
			assertValidRules({
				...CURRENT_RULES,
				teamEvents: teamEvents as unknown as RynkeRules["teamEvents"],
			}),
		).toThrow();
	});

	it("accepts an event amount of 0", () => {
		expect(() =>
			assertValidRules({
				...CURRENT_RULES,
				teamEvents: { ...TEAM_EVENTS, team_training: { team: 0, training: 0 } },
			}),
		).not.toThrow();
	});

	it("accepts a qualification deadline", () => {
		expect(() =>
			assertValidRules({
				...CURRENT_RULES,
				qualificationDeadline: "2026-08-31",
			}),
		).not.toThrow();
	});
});

describe("countingWindow", () => {
	it("runs from the season start to the rules' deadline", () => {
		expect(
			countingWindow({ SEASON_START_DATE: "2026-01-01" }, CURRENT_RULES),
		).toEqual({
			seasonStart: "2026-01-01",
			deadline: CURRENT_RULES.qualificationDeadline,
		});
		expect(
			countingWindow(
				{ SEASON_START_DATE: "2026-01-01" },
				{ ...CURRENT_RULES, qualificationDeadline: "2026-08-31" },
			),
		).toEqual({ seasonStart: "2026-01-01", deadline: "2026-08-31" });
	});
});

describe("RULES_HISTORY", () => {
	it("holds unique versions, up to and including CURRENT_RULES", () => {
		expect(RULES_HISTORY.length).toBeGreaterThan(0);
		const versions = RULES_HISTORY.map((rules) => rules.version);
		expect(new Set(versions).size).toBe(versions.length);
		expect(RULES_HISTORY).toContain(CURRENT_RULES);
		expect(Math.max(...versions)).toBe(CURRENT_RULES.version);
	});

	it("holds versions 1 and 2, in this order", () => {
		expect(RULES_HISTORY.map((rules) => rules.version)).toEqual([1, 2]);
	});

	it("keeps the event amounts in version 1: version 2 changes logic, not values", () => {
		expect(rulesForVersion(1)?.teamEvents).toEqual(TEAM_EVENTS);
		expect(rulesFingerprint(rulesForVersion(1) as RynkeRules)).toBe(
			rulesFingerprint(CURRENT_RULES),
		);
	});

	it("holds only valid rules", () => {
		for (const rules of RULES_HISTORY) {
			expect(() => assertValidRules(rules)).not.toThrow();
		}
	});
});

describe("rulesForVersion", () => {
	it("finds every version of the history", () => {
		for (const rules of RULES_HISTORY) {
			expect(rulesForVersion(rules.version)).toBe(rules);
		}
	});

	it.each([0, -1, CURRENT_RULES.version + 1])(
		"knows no version %i",
		(version) => {
			expect(rulesForVersion(version)).toBeNull();
		},
	);
});
