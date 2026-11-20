// The Rynke rules' shape and the pure functions around them (research R8,
// FR-012, FR-023). The values are team data: each team's rule history lives in
// `src/teams/<id>.ts` (feature 026 research R15), with the note on raising
// `version` beside it.

import {
	type EventKind,
	TEAM_EVENT_KINDS,
	type TeamEventKind,
} from "./team-events";

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
	/**
	 * The highest average speed of a virtual ride, in whole km/h (decided with
	 * Team Europe on 2026-11-20): descents on Rouvy or Zwift push an honest
	 * indoor average past the outdoor limit, and no car or train can be
	 * recorded as a virtual ride. Absent means `maxSpeedKmh` for every ride, so
	 * a team without one keeps its rule objects and fingerprints.
	 */
	virtualMaxSpeedKmh?: number;
	maxClimbMPerH: number;
	/**
	 * The shortest ride that counts, in whole kilometres (feature 039 research
	 * R1). Absent means no minimum: a team without one leaves it out, never
	 * writes 0, so its rule objects and fingerprints stay as they were.
	 */
	minRideKm?: number;
	/**
	 * The shortest ride whose kilometres earn Rynke, in whole kilometres, one
	 * for outdoor and one for virtual rides (decided with Team Europe on
	 * 2026-11-19). A shorter ride still counts, its elevation included; only
	 * its kilometres earn nothing. Absent means none, as `minRideKm`.
	 */
	distanceMinKm?: { outdoor: number; virtual: number };
	excludedSportTypes: readonly string[];
	trainingThreshold: number;
	/**
	 * `null`: the team has no Team Rynke (feature 039 research R2). Nobody
	 * misses any then, and every team-event amount's `team` is 0.
	 */
	teamThreshold: number | null;
	/**
	 * How many of the `trainingThreshold` Training Rynke must come from
	 * anything but virtual rides, a whole number (FR-014a, feature 039 research
	 * R15). 0: no such requirement at all, nothing shows it.
	 */
	minOutsideTraining: number;
	teamEvents: Readonly<Record<TeamEventKind, TeamEventAmounts>>;
}

/** The highest average speed a ride of this kind may have under `rules`. */
export function maxSpeedKmhFor(rules: RynkeRules, virtual: boolean): number {
	return virtual
		? (rules.virtualMaxSpeedKmh ?? rules.maxSpeedKmh)
		: rules.maxSpeedKmh;
}

/**
 * The rules in effect: the last of a team's rule history (`ctx.team.rules`,
 * every version ever in effect, ordered by `effectiveDate`).
 */
export function currentRules(history: readonly RynkeRules[]): RynkeRules {
	const latest = history[history.length - 1];
	if (!latest) throw new Error("A team's rule history is never empty");
	return latest;
}

/**
 * The rules of a stored version in a team's history; `null` for a version
 * the history doesn't know.
 */
export function rulesForVersion(
	history: readonly RynkeRules[],
	version: number,
): RynkeRules | null {
	return history.find((rules) => rules.version === version) ?? null;
}

/**
 * `rulesForVersion` over one team's history, as the rider views take it. A
 * team whose rules in effect have no Team Rynke shows none, also for a result
 * stored under an earlier version that had it (feature 039).
 */
export function versionsOf(
	history: readonly RynkeRules[],
): (version: number) => RynkeRules | null {
	const withTeam = currentRules(history).teamThreshold !== null;
	return (version) => {
		const rules = rulesForVersion(history, version);
		return rules && !withTeam ? withoutTeamRynke(rules) : rules;
	};
}

/** `rules` with no Team threshold and no event earning Team Rynke. */
function withoutTeamRynke(rules: RynkeRules): RynkeRules {
	const teamEvents = Object.fromEntries(
		Object.entries(rules.teamEvents).map(([kind, amounts]) => [
			kind,
			{ ...amounts, team: 0 },
		]),
	) as RynkeRules["teamEvents"];
	return { ...rules, teamThreshold: null, teamEvents };
}

/**
 * A team's season and qualification window, inclusive `YYYY-MM-DD` days
 * (feature 040 data-model.md). Hamburg's window opens on its season start;
 * Europe's opens later.
 */
export interface CountingWindow {
	/** The season's first day (fetch, season end, badges, tour days). */
	seasonStart: string;
	/** The first day a ride can count (Rynke, pace, graphs; FR-011). */
	windowStart: string;
	/** The last day a ride can count; badges end here too. */
	deadline: string;
	/**
	 * The team's calendar day, set by feature 013's `badgeWindow` only: the
	 * last day a tour day counts for badges (feature 021 research R10).
	 * Absent: tour days count to the season end.
	 */
	today?: string;
}

/**
 * `SEASON_START_DATE`, `QUALIFICATION_START_DATE` and `QUALIFICATION_DEADLINE`,
 * team settings like the club.
 */
export function countingWindow(
	env: Pick<
		Env,
		"SEASON_START_DATE" | "QUALIFICATION_START_DATE" | "QUALIFICATION_DEADLINE"
	>,
): CountingWindow {
	if (!isCalendarDate(env.SEASON_START_DATE)) {
		throw new Error("SEASON_START_DATE must be a date YYYY-MM-DD");
	}
	if (!isCalendarDate(env.QUALIFICATION_START_DATE)) {
		throw new Error("QUALIFICATION_START_DATE must be a date YYYY-MM-DD");
	}
	if (!isCalendarDate(env.QUALIFICATION_DEADLINE)) {
		throw new Error("QUALIFICATION_DEADLINE must be a date YYYY-MM-DD");
	}
	return {
		seasonStart: env.SEASON_START_DATE,
		windowStart: env.QUALIFICATION_START_DATE,
		deadline: env.QUALIFICATION_DEADLINE,
	};
}

/** Whether a ride dated `YYYY-MM-DD` falls inside the qualification window. */
export function inCountingWindow(
	date: string,
	window: Pick<CountingWindow, "windowStart" | "deadline">,
): boolean {
	return date >= window.windowStart && date <= window.deadline;
}

/**
 * Whether a day dated `YYYY-MM-DD` falls in the season, up to the deadline: the
 * days whose activities the badges count (feature 040 research R5). Unlike
 * `inCountingWindow`, the days before the window opens are in.
 */
export function inBadgeSeason(
	date: string,
	window: Pick<CountingWindow, "seasonStart" | "deadline">,
): boolean {
	return date >= window.seasonStart && date <= window.deadline;
}

/**
 * The season's last day: the day before the season start's anniversary
 * (2026-09-01 → 2027-08-31, feature 021 research R10).
 */
export function seasonEnd(window: Pick<CountingWindow, "seasonStart">): string {
	const [y, m, d] = window.seasonStart.split("-").map(Number) as [
		number,
		number,
		number,
	];
	// A 29 February start has its anniversary on 1 March.
	const anniversary = new Date(Date.UTC(y + 1, m - 1, d));
	return new Date(anniversary.getTime() - 86_400_000)
		.toISOString()
		.slice(0, 10);
}

/**
 * Whether an event of `kind` dated `date` counts: a tour day from the season
 * start to the season end (feature 021 FR-003), and to `window.today` when
 * that is set; every other kind inside the qualification window, as rides
 * (feature 003 FR-011). Every filter of events uses this; rides keep
 * `inCountingWindow`.
 */
export function eventInWindow(
	kind: EventKind,
	date: string,
	window: CountingWindow,
): boolean {
	if (kind !== "tour_de_paris") return inCountingWindow(date, window);
	const end = seasonEnd(window);
	const last =
		window.today !== undefined && window.today < end ? window.today : end;
	return date >= window.seasonStart && date <= last;
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
	] as const) {
		const value = rules[field];
		if (!Number.isInteger(value) || value <= 0) {
			throw new Error(`rules.${field} must be a positive integer`);
		}
	}
	if (
		rules.teamThreshold !== null &&
		(!Number.isInteger(rules.teamThreshold) || rules.teamThreshold <= 0)
	) {
		throw new Error("rules.teamThreshold must be a positive integer or null");
	}
	if (
		rules.minRideKm !== undefined &&
		(!Number.isInteger(rules.minRideKm) || rules.minRideKm <= 0)
	) {
		throw new Error("rules.minRideKm must be a positive integer when set");
	}
	if (
		rules.distanceMinKm !== undefined &&
		![rules.distanceMinKm.outdoor, rules.distanceMinKm.virtual].every(
			(km) => Number.isInteger(km) && km > 0,
		)
	) {
		throw new Error(
			"rules.distanceMinKm must be positive integers for outdoor and virtual when set",
		);
	}
	if (rules.minSpeedKmh >= rules.maxSpeedKmh) {
		throw new Error("rules.minSpeedKmh must be below rules.maxSpeedKmh");
	}
	if (
		rules.virtualMaxSpeedKmh !== undefined &&
		(!Number.isInteger(rules.virtualMaxSpeedKmh) ||
			rules.virtualMaxSpeedKmh <= rules.minSpeedKmh)
	) {
		throw new Error(
			"rules.virtualMaxSpeedKmh must be a whole number above rules.minSpeedKmh when set",
		);
	}
	const { num, den } = rules.maxPausedShare;
	if (
		!Number.isInteger(num) ||
		!Number.isInteger(den) ||
		den <= 0 ||
		num < 0 ||
		num > den
	) {
		throw new Error(
			"rules.maxPausedShare must be a share 0 ≤ num ≤ den, den > 0",
		);
	}
	if (
		!Number.isInteger(rules.minOutsideTraining) ||
		rules.minOutsideTraining < 0 ||
		rules.minOutsideTraining > rules.trainingThreshold
	) {
		throw new Error(
			"rules.minOutsideTraining must be a whole number from 0 to trainingThreshold",
		);
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
		if (rules.teamThreshold === null && team !== 0) {
			throw new Error(
				`rules.teamEvents.${kind}.team must be 0 without Team Rynke`,
			);
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
