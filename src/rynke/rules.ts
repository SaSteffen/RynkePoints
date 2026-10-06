// The Rynke rules as a versioned code constant until organisers can change them
// (research R8, FR-012, FR-023). Raise `version` and set `effectiveDate` in the
// same change as any change of a value or of rule logic: every stored result
// records the version, and the daily cron re-evaluates riders stored with
// another one. Flagged rides never count (FR-005g); that is deliberately not a
// rule value.

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
	/** `YYYY-MM-DD`, inclusive; `null` = open. */
	qualificationDeadline: string | null;
	trainingThreshold: number;
	teamThreshold: number;
	maxVirtualShare: Share;
}

export const CURRENT_RULES: RynkeRules = {
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
	qualificationDeadline: null,
	trainingThreshold: 250,
	teamThreshold: 25,
	maxVirtualShare: { num: 1, den: 3 },
};

/** Inclusive `YYYY-MM-DD` bounds a ride's local start date must fall in (FR-011). */
export interface CountingWindow {
	seasonStart: string;
	deadline: string | null;
}

export function countingWindow(
	env: Pick<Env, "SEASON_START_DATE">,
	rules: RynkeRules,
): CountingWindow {
	return {
		seasonStart: env.SEASON_START_DATE,
		deadline: rules.qualificationDeadline,
	};
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
	assertDate("effectiveDate", rules.effectiveDate);
	if (rules.qualificationDeadline !== null) {
		assertDate("qualificationDeadline", rules.qualificationDeadline);
	}
}

function assertDate(field: string, value: string): void {
	const error = new Error(`rules.${field} must be a date YYYY-MM-DD`);
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) throw error;
	const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const date = new Date(Date.UTC(y, m - 1, d));
	if (
		date.getUTCFullYear() !== y ||
		date.getUTCMonth() !== m - 1 ||
		date.getUTCDate() !== d
	) {
		throw error;
	}
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
