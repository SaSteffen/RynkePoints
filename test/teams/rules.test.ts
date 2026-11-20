import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { evaluateChange } from "../../src/rynke/apply";
import { evaluateRides } from "../../src/rynke/rides";
import {
	assertValidRules,
	countingWindow,
	currentRules,
	type RynkeRules,
	rulesFingerprint,
	rulesForVersion,
	seasonEnd,
} from "../../src/rynke/rules";
import { teamFor } from "../../src/teams";
import { europe } from "../../src/teams/europe";
import { hamburg } from "../../src/teams/hamburg";
import type { TeamData } from "../../src/teams/types";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { makeRide } from "../support/rides";
import { activityRecord } from "../support/rynke";

// Each team's own rules (feature 026 US3 scenarios 1, 2, FR-019): the
// evaluation reads the rule history from `ctx.team.rules`, so the same ride
// scored for two teams with different rules gives each team its own result,
// and a change to one team's rules leaves the other team's results alone.

const team = teamFor(env);

/** A synthetic second team whose rules in effect pay half per kilometre. */
function otherTeam(base: TeamData, distanceStepKm: number): TeamData {
	const inEffect = currentRules(base.rules);
	const rules: RynkeRules = {
		...inEffect,
		version: inEffect.version + 1,
		distanceStepKm,
	};
	return { ...base, id: "synthetic", rules: [...base.rules, rules] };
}

/** A 79 km ride on the window's first day, inside every team's window. */
async function seedRide(): Promise<void> {
	await upsertActivity(
		env.DB,
		activityRecord(1, {
			start_date: `${env.QUALIFICATION_START_DATE}T08:00:00Z`,
			start_date_local: `${env.QUALIFICATION_START_DATE}T08:00:00Z`,
			distance_m: 79000,
		}),
	);
}

/** The rider's Training Rynke and rules version after scoring as `scoring`. */
async function scoredAs(
	scoring: TeamData,
): Promise<{ training: number; version: number }> {
	const ctx = makeCtx({ team: scoring });
	await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
	const row = await env.DB.prepare(
		"SELECT training_rynke, rules_version FROM rynke_balances WHERE athlete_id = ?",
	)
		.bind(ATHLETE_A)
		.first<{ training_rynke: number; rules_version: number }>();
	if (!row) throw new Error("no balance stored");
	return { training: row.training_rynke, version: row.rules_version };
}

beforeEach(async () => {
	await resetDb();
	await seedRider(makeCtx());
	await seedRide();
});

describe(`${team.id}'s own rules (US3)`, () => {
	// The evaluation trusts the rules it is given: they are checked once, as
	// the team registry loads, not on each call.
	it("holds only valid rules in every version", () => {
		for (const rules of team.rules) {
			expect(() => assertValidRules(rules)).not.toThrow();
		}
	});

	it("scores the same ride with each team's rules", async () => {
		const step = currentRules(team.rules).distanceStepKm;
		const own = await scoredAs(team);
		const other = await scoredAs(otherTeam(team, step * 2));

		expect(own).toEqual({
			training: Math.floor(79 / step),
			version: currentRules(team.rules).version,
		});
		expect(other).toEqual({
			training: Math.floor(79 / (step * 2)),
			version: currentRules(team.rules).version + 1,
		});
	});

	it("keeps a team's result when another team's rules change", async () => {
		const step = currentRules(team.rules).distanceStepKm;
		const before = await scoredAs(team);
		await scoredAs(otherTeam(team, step * 2));
		await scoredAs(otherTeam(team, step * 4));

		expect(await scoredAs(team)).toEqual(before);
		expect(currentRules(team.rules).distanceStepKm).toBe(step);
	});
});

// Team Europe's own rules beside Hamburg's (feature 039 research R1, R4):
// Hamburg's history stays versions 1–3 without a minimum; Europe's shares
// those three objects and adds its own version 4.
describe("Hamburg's and Europe's rule histories side by side", () => {
	it("keeps Hamburg on version 3 without a minimum ride length", () => {
		const inEffect = currentRules(hamburg.rules);
		expect(inEffect.version).toBe(3);
		for (const rules of hamburg.rules) {
			expect("minRideKm" in rules).toBe(false);
		}
	});

	it("gives Europe Hamburg's three versions, then its own versions 4 to 6", () => {
		expect(europe.rules.map((rules) => rules.version)).toEqual([
			1, 2, 3, 4, 5, 6,
		]);
		for (const [i, rules] of hamburg.rules.entries()) {
			expect(europe.rules[i]).toBe(rules);
		}
		expect(rulesForVersion(europe.rules, 4)?.minRideKm).toBe(25);
		const inEffect = currentRules(europe.rules);
		expect("minRideKm" in inEffect).toBe(false);
		expect(inEffect.distanceMinKm).toEqual({ outdoor: 25, virtual: 1 });
		expect(inEffect.virtualMaxSpeedKmh).toBe(50);
		for (const rules of hamburg.rules) {
			expect("virtualMaxSpeedKmh" in rules).toBe(false);
		}
	});

	// Research R15: Hamburg's "at most a third virtual" written as a whole
	// number in every version, with the same results; Europe needs a third.
	it("needs Hamburg's 2/3 of 250, rounded up, and Europe's third from outside virtual rides", () => {
		for (const rules of hamburg.rules) {
			expect(rules.minOutsideTraining).toBe(
				Math.ceil((rules.trainingThreshold * 2) / 3),
			);
			expect(rules.minOutsideTraining).toBe(167);
		}
		const inEffect = currentRules(europe.rules);
		expect(inEffect.minOutsideTraining).toBe(
			Math.ceil(inEffect.trainingThreshold / 3),
		);
		expect(inEffect.minOutsideTraining).toBe(84);
	});

	it("pins Europe's version 6 values to its version", () => {
		const inEffect = currentRules(europe.rules);
		const fingerprint =
			'{"distanceMinKm":{"outdoor":25,"virtual":1},"distanceStepKm":10,' +
			'"distanceStepRynke":1,"elevationStepM":1000,' +
			'"elevationStepRynke":5,"excludedSportTypes":["EBikeRide","EMountainBikeRide"],' +
			'"maxClimbMPerH":1500,"maxPausedShare":{"den":1,"num":1},"maxSpeedKmh":45,' +
			'"minOutsideTraining":84,"minSpeedKmh":10,' +
			'"teamEvents":{' +
			'"team_training":{"team":0,"training":0},' +
			'"technique_training":{"team":0,"training":0},' +
			'"training_weekend_day":{"team":0,"training":0}},' +
			'"teamThreshold":null,"trainingThreshold":250,"virtualMaxSpeedKmh":50}';
		expect(inEffect.version).toBe(6);
		expect(
			rulesFingerprint(inEffect),
			"a rule value changed: raise Europe's version and effectiveDate, then update this fingerprint",
		).toBe(fingerprint);
	});
});

// Hamburg stays exactly as it is (feature 040 US1, FR-019): its window opens
// on its season start, so no ride of its season is ever a pre-window ride.
describe.runIf(team.id === "hamburg")("hamburg's window (040 US1)", () => {
	const window = countingWindow(env);

	it("opens on the season start", () => {
		expect(window.windowStart).toBe(window.seasonStart);
	});

	it("never marks a ride of its season as before the window", () => {
		const rules = currentRules(team.rules);
		const last = seasonEnd(window);
		const rides = [];
		for (
			let day = Date.parse(`${window.seasonStart}T08:00:00Z`), id = 1;
			new Date(day).toISOString().slice(0, 10) <= last;
			day += 86_400_000, id++
		) {
			const start = new Date(day).toISOString().replace(".000Z", "Z");
			rides.push(makeRide({ id, km: 40, movingH: 1.6, start }));
		}
		const { results } = evaluateRides(rides, rules, window);
		expect(results).toHaveLength(365);
		for (const result of results) {
			expect(result.reasons as readonly string[]).not.toContain(
				"before_window",
			);
		}
	});
});
