// The Rynke rules as a versioned code constant until organisers can change them
// (research R8, FR-012, FR-023). Raise `version` and set `effectiveDate` in the
// same change as any change of a value or of rule logic: every stored result
// records the version, and the daily cron re-evaluates riders stored with
// another one. Flagged rides never count (FR-005g); that is deliberately not a
// rule value.
//
// When raising `version`, keep the previous object in `RULES_HISTORY`: the rider
// page explains stored results with the rules of the version they record
// (feature 005, research R3).
//
// The team-event amounts are rule values too (FR-012). Version 2 is Story 3's
// logic change: every evaluation counts attendance, with the same values as
// version 1 (research R18). Version 3 lets a ride pause as long as it moves,
// half of its elapsed time, instead of half its moving time (FR-005a).

import { TEAM_EVENT_KINDS, type TeamEventKind } from "./team-events";

/** What one attended event of a kind earns (FR-007). */
export interface TeamEventAmounts {
	team: number;
	training: number;
}

/** A share `num / den`, kept as a fraction for exact comparisons (research R3). */
export interface Share {
	num: number;
	den: number;
}

export interface RynkeRules {
	version: number;
	/** `YYYY-MM-DD` */
	effectiveDate: string;
	distanceStepKm: number;
	distanceStepRynke: number;
	elevationStepM: number;
	elevationStepRynke: number;
	maxPausedShare: Share;
	minSpeedKmh: number;
	maxSpeedKmh: number;
	maxClimbMPerH: number;
	excludedSportTypes: readonly string[];
	trainingThreshold: number;
	teamThreshold: number;
	maxVirtualShare: Share;
	teamEvents: Readonly<Record<TeamEventKind, TeamEventAmounts>>;
}

const RULES_V1: RynkeRules = {
	version: 1,
	effectiveDate: "2026-10-07",
	distanceStepKm: 10,
	distanceStepRynke: 1,
	elevationStepM: 1000,
	elevationStepRynke: 5,
	maxPausedShare: { num: 1, den: 2 },
	minSpeedKmh: 10,
	maxSpeedKmh: 45,
	maxClimbMPerH: 1500,
	excludedSportTypes: ["EBikeRide", "EMountainBikeRide"],
	trainingThreshold: 250,
	teamThreshold: 25,
	maxVirtualShare: { num: 1, den: 3 },
	teamEvents: {
		team_training: { team: 1, training: 5 },
		training_weekend_day: { team: 5, training: 10 },
		technique_training: { team: 5, training: 5 },
	},
};

const RULES_V2: RynkeRules = {
	...RULES_V1,
	version: 2,
	effectiveDate: "2026-10-07",
};

export const CURRENT_RULES: RynkeRules = {
	...RULES_V2,
	version: 3,
	effectiveDate: "2026-10-09",
	maxPausedShare: { num: 1, den: 1 },
};

/** Every version ever in effect, `CURRENT_RULES` being the highest. */
export const RULES_HISTORY: readonly RynkeRules[] = [
	RULES_V1,
	RULES_V2,
	CURRENT_RULES,
];

/** The rules of a stored version; `null` for a version this code doesn't know. */
export function rulesForVersion(version: number): RynkeRules | null {
	return RULES_HISTORY.find((rules) => rules.version === version) ?? null;
}

/** Inclusive `YYYY-MM-DD` bounds a ride's local start date must fall in (FR-011). */
export interface CountingWindow {
	seasonStart: string;
	deadline: string;
}

/** `SEASON_START_DATE` to `QUALIFICATION_DEADLINE`, team settings like the club. */
export function countingWindow(
	env: Pick<Env, "SEASON_START_DATE" | "QUALIFICATION_DEADLINE">,
): CountingWindow {
	if (!isCalendarDate(env.QUALIFICATION_DEADLINE)) {
		throw new Error("QUALIFICATION_DEADLINE must be a date YYYY-MM-DD");
	}
	return {
		seasonStart: env.SEASON_START_DATE,
		deadline: env.QUALIFICATION_DEADLINE,
	};
}

/** Whether a `YYYY-MM-DD` date falls inside `window`. */
export function inCountingWindow(
	date: string,
	window: CountingWindow,
): boolean {
	return date >= window.seasonStart && date <= window.deadline;
}

/** Throws on rules no evaluation can use; that is a programming error. */
export function assertValidRules(rules: RynkeRules): void {
	for (const field of [
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
	] as const) {
		const value = rules[field];
		if (!Number.isInteger(value) || value <= 0) {
			throw new Error(`rules.${field} must be a positive integer`);
		}
	}
	if (rules.minSpeedKmh >= rules.maxSpeedKmh) {
		throw new Error("rules.minSpeedKmh must be below rules.maxSpeedKmh");
	}
	for (const field of ["maxPausedShare", "maxVirtualShare"] as const) {
		const { num, den } = rules[field];
		if (
			!Number.isInteger(num) ||
			!Number.isInteger(den) ||
			den <= 0 ||
			num < 0 ||
			num > den
		) {
			throw new Error(`rules.${field} must be a share 0 ≤ num ≤ den, den > 0`);
		}
	}
	const kinds = Object.keys(rules.teamEvents);
	if (
		kinds.length !== TEAM_EVENT_KINDS.length ||
		!TEAM_EVENT_KINDS.every((kind) => kinds.includes(kind))
	) {
		throw new Error("rules.teamEvents must have exactly the team-event kinds");
	}
	for (const kind of TEAM_EVENT_KINDS) {
		const { team, training } = rules.teamEvents[kind];
		for (const value of [team, training]) {
			if (!Number.isInteger(value) || value < 0) {
				throw new Error(`rules.teamEvents.${kind} must be whole numbers ≥ 0`);
			}
		}
	}
	assertDate("effectiveDate", rules.effectiveDate);
}

function assertDate(field: string, value: string): void {
	if (!isCalendarDate(value)) {
		throw new Error(`rules.${field} must be a date YYYY-MM-DD`);
	}
}

/** `YYYY-MM-DD` naming a real day: not `2026-5-1`, not `2026-02-30`. */
export function isCalendarDate(value: string): boolean {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return false;
	const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(y, m - 1, d));
	return (
		date.getUTCFullYear() === y &&
		date.getUTCMonth() === m - 1 &&
		date.getUTCDate() === d
	);
}

/**
 * Every rule value except `version` and `effectiveDate`, as JSON with sorted
 * keys. A unit test pins it to the version, so a value changed without a
 * version bump fails.
 */
export function rulesFingerprint(rules: RynkeRules): string {
	const { version: _version, effectiveDate: _effectiveDate, ...values } = rules;
	return JSON.stringify(sortKeys(values));
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortKeys);
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value)
				.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
				.map(([k, v]) => [k, sortKeys(v)]),
		);
	}
	return value;
}
