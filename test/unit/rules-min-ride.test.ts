import { describe, expect, it } from "vitest";
import {
	assertValidRules,
	type RynkeRules,
	rulesFingerprint,
} from "../../src/rynke/rules";
import { hamburg } from "../../src/teams/hamburg";
import { CURRENT_RULES } from "../support/team-rules";

// The minimum ride length is an optional rule value (feature 039 research R1):
// absent means no minimum, present a positive whole number of kilometres.
// Hamburg's rule objects never carry the key, so their fingerprints stay.

function withMinimum(minRideKm: number): RynkeRules {
	return { ...CURRENT_RULES, version: 99, minRideKm };
}

describe("minRideKm", () => {
	it("is accepted when absent", () => {
		expect("minRideKm" in CURRENT_RULES).toBe(false);
		expect(() => assertValidRules(CURRENT_RULES)).not.toThrow();
	});

	it("is accepted as a positive whole number of kilometres", () => {
		expect(() => assertValidRules(withMinimum(25))).not.toThrow();
	});

	it.each([0, -1, 2.5])("refuses %s", (minRideKm) => {
		expect(() => assertValidRules(withMinimum(minRideKm))).toThrow(/minRideKm/);
	});

	it("is on none of Hamburg's rule objects", () => {
		for (const rules of hamburg.rules) {
			expect("minRideKm" in rules).toBe(false);
		}
	});

	// The pinned fingerprint of test/unit/rules.test.ts holds the exact string.
	it("leaves the fingerprint of rules without it as it was", () => {
		for (const rules of hamburg.rules) {
			expect(rulesFingerprint(rules)).not.toContain("minRideKm");
		}
		expect(rulesFingerprint(withMinimum(25))).toContain('"minRideKm":25');
	});
});
