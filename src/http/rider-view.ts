import {
	type AttendedEvent,
	RIDES_PER_PAGE,
	type RideRow,
	type RiderViewRead,
} from "../db/rider-view";
import type { StoredBalance } from "../db/rynke";
import type { UnknownFigureCode } from "../rynke/rides";
import type { RynkeRules, Share } from "../rynke/rules";
import { virtualShareRequired } from "../rynke/tally";
import type { TeamEventKind, TeamEventSum } from "../rynke/team-events";
import type { CyclingSportType } from "../strava/activity";

// The rider page's view model (feature 005 data-model.md, research R6): what
// the Rynke sections of /me show, built from one reading. Pure: no D1, no
// clock, no text. Every number is stored or derived from stored values
// (FR-004); every rule value comes from the rules of the stored version, and
// is left out when that version is unknown (FR-013).

export type RiderView =
	| { state: "not-worked-out"; importing: boolean; rides: RideTable }
	| {
			state: "ready";
			importing: boolean;
			/** `null` when the balance is of the version in effect (FR-051). */
			updating: UpdateNotice | null;
			summary: Summary;
			/** `null` when the balance's rules version is unknown (FR-013). */
			gauges: Gauges | null;
			breakdown: Breakdown;
			rules: RulesInfo;
			rides: RideTable;
	  };

/** The rules the numbers were computed with, and the counting window (FR-050). */
export interface RulesInfo {
	version: number;
	/** `YYYY-MM-DD` */
	effectiveDate: string;
	/** `YYYY-MM-DD`, `SEASON_START_DATE`. */
	seasonStart: string;
	/** Of the balance's rules; `null` when there is none or they are unknown. */
	deadline: string | null;
}

/** Other rules are in effect, so the numbers are being updated (research R4). */
export interface UpdateNotice {
	inEffectVersion: number;
	/** `YYYY-MM-DD` */
	inEffectSince: string;
}

export interface Summary {
	training: Condition;
	team: Condition;
	/** `null` when the rider has no virtual ride (FR-012). */
	withoutVirtual: Condition | null;
	/** Stored (FR-011, FR-023). */
	qualified: boolean;
}

export interface Condition {
	value: number;
	/** `null` when the balance's rules version is unknown (FR-013). */
	target: number | null;
	/** Stored; 0 when reached (FR-014). */
	missing: number;
	reached: boolean;
}

export interface Gauges {
	training: Gauge;
	team: Gauge;
	/** `null` when the rider has no virtual ride (FR-012). */
	withoutVirtual: Gauge | null;
	elevation: ElevationGauge;
}

export interface Gauge {
	value: number;
	target: number;
	/** Rounded down and capped at 100, so 100 only when reached (FR-020). */
	percent: number;
	reached: boolean;
	/** Empty: the gauge is undivided (FR-022). */
	parts: GaugePart[];
}

/** Decimetres within the current elevation step (FR-021). */
export interface ElevationGauge extends Gauge {
	/** The Training Rynke the step brings. */
	stepRynke: number;
}

/** Feature 003 Story 6 adds corrections (research R5). */
export type GaugeSource = "distance" | "elevation" | TeamEventKind;

export interface GaugePart<S extends string = GaugeSource> {
	source: S;
	value: number;
	/** Share of the bar, two decimals (research R7). */
	widthPercent: number;
}

/**
 * Where the Rynke come from (FR-030–FR-033, FR-035); feature 003 Story 6 adds
 * corrections (research R5).
 */
export interface Breakdown {
	distanceRynke: number;
	/** Rounded down. */
	elevationM: number;
	elevationRynke: number;
	/** `null` when the balance's rules version is unknown (FR-013). */
	elevationStepM: number | null;
	elevationStepRynke: number | null;
	/** Rounded up. */
	toNextStepM: number;
	trainingTotal: number;
	teamTotal: number;
	/**
	 * Stored per kind, in `TEAM_EVENT_KINDS` order (FR-032); empty for a balance
	 * stored before team events existed.
	 */
	kinds: TeamEventSum[];
	/** Newest first (FR-033). */
	events: EventLine[];
}

export interface EventLine {
	/** `YYYY-MM-DD` */
	date: string;
	kind: TeamEventKind;
	name: string | null;
	/** `false` outside the counting window (FR-033). */
	counts: boolean;
}

export interface RideTable {
	rows: RideLine[];
	/** 1-based positions in the whole table; `from` is 0 without rows. */
	position: { from: number; to: number; total: number };
	/** `null` with `RIDES_PER_PAGE` rides or fewer (FR-045). */
	pager: Pager | null;
}

/** The pages a link leads to; `null` = the link isn't offered. */
export interface Pager {
	page: number;
	lastPage: number;
	first: number | null;
	previous: number | null;
	next: number | null;
	last: number | null;
}

export interface RideLine {
	activityId: number;
	startDateLocal: string;
	sportType: CyclingSportType;
	distanceM: number;
	elevationGainM: number;
	status: "being-evaluated" | "counts" | "does-not-count";
	/** 0 unless the ride counts. */
	distanceRynke: number;
	/** Metres towards the elevation total; 0 unless the ride counts. */
	elevationM: number;
	isVirtual: boolean;
	/** In the stored order; empty unless the ride doesn't count (FR-042). */
	reasons: ReasonLine[];
	/** Figures Strava hasn't sent yet, so the result may change (FR-043). */
	unknownFigures: UnknownFigureCode[];
	/** The rider can fix one of the reasons (FR-044). */
	fixHint: boolean;
}

/**
 * Why a ride doesn't count, with its own figure and the limit of the result's
 * rules version: `null` when that version is unknown (FR-013). Figures are
 * rounded towards the limit they broke (research R12).
 */
export type ReasonLine =
	| { code: "flagged" | "manual" }
	/** `pausedS` is `null` only without moving time. */
	| {
			code: "pause";
			pausedS: number | null;
			movingS: number;
			share: Share | null;
	  }
	/** Speed in tenths of km/h: rounded down when too slow, up when too fast. */
	| {
			code: "too_slow" | "too_fast";
			kmhTenths: number;
			limitKmh: number | null;
	  }
	| { code: "climbing_rate"; mPerH: number; limitMPerH: number | null }
	| { code: "excluded_sport_type"; sportType: CyclingSportType }
	/** `SEASON_START_DATE`. */
	| { code: "before_season"; date: string }
	| { code: "after_deadline"; date: string | null }
	| {
			code: "overlap";
			countedInstead: { startDateLocal: string; distanceM: number } | null;
	  }
	/** A code this page has no text for. */
	| { code: "unknown"; stored: string };

/** Reasons a rider can fix on Strava (FR-044). */
const FIXABLE = new Set<string>([
	"pause",
	"too_slow",
	"too_fast",
	"climbing_rate",
	"manual",
]);

export interface ViewContext {
	/** `YYYY-MM-DD`, `SEASON_START_DATE`. */
	seasonStart: string;
	/** The import isn't done, so more rides may still arrive (FR-052). */
	importing: boolean;
	/** `rulesForVersion`, passed in to keep this module pure. */
	rulesFor: (version: number) => RynkeRules | null;
}

/**
 * `rules` are those of the balance's version (`rulesForVersion`), `inEffect`
 * the version the evaluation uses now (`CURRENT_RULES`).
 */
export function buildRiderView(
	read: RiderViewRead,
	rules: RynkeRules | null,
	inEffect: RynkeRules,
	context: ViewContext,
): RiderView {
	const rides = rideTable(read, context);
	const balance = read.balance;
	if (!balance) {
		return { state: "not-worked-out", importing: context.importing, rides };
	}
	return {
		state: "ready",
		importing: context.importing,
		// "Differs", not "older": a higher version only shows while a deploy is
		// rolled back, and then the numbers are about to change too (research R4).
		updating:
			balance.rulesVersion === inEffect.version
				? null
				: {
						inEffectVersion: inEffect.version,
						inEffectSince: inEffect.effectiveDate,
					},
		summary: summary(balance, read.virtualCount, rules),
		gauges: rules && gauges(balance, read.virtualCount, rules),
		breakdown: breakdown(balance, rules, read.attendance, context),
		rules: {
			version: balance.rulesVersion,
			effectiveDate: balance.rulesEffectiveDate,
			seasonStart: context.seasonStart,
			deadline: rules?.qualificationDeadline ?? null,
		},
		rides,
	};
}

function breakdown(
	balance: StoredBalance,
	rules: RynkeRules | null,
	attendance: AttendedEvent[],
	context: ViewContext,
): Breakdown {
	// Feature 003's window for attendance; with unknown rules only the season
	// start is known (FR-013).
	const deadline = rules?.qualificationDeadline ?? null;
	return {
		distanceRynke: balance.distanceRynke,
		elevationM: Math.floor(balance.elevationDm / 10),
		elevationRynke: balance.elevationRynke,
		elevationStepM: rules?.elevationStepM ?? null,
		elevationStepRynke: rules?.elevationStepRynke ?? null,
		toNextStepM: Math.ceil(balance.elevationToNextStepDm / 10),
		trainingTotal: balance.trainingRynke,
		teamTotal: balance.teamRynke,
		kinds: balance.teamEvents,
		events: attendance.map(({ date, kind, name }) => ({
			date,
			kind,
			name,
			counts:
				date >= context.seasonStart && (deadline === null || date <= deadline),
		})),
	};
}

function summary(
	balance: StoredBalance,
	virtualCount: number,
	rules: RynkeRules | null,
): Summary {
	return {
		training: condition(
			balance.trainingRynke,
			rules?.trainingThreshold ?? null,
			balance.trainingMissing,
		),
		team: condition(
			balance.teamRynke,
			rules?.teamThreshold ?? null,
			balance.teamMissing,
		),
		withoutVirtual:
			virtualCount === 0
				? null
				: condition(
						balance.trainingWithoutVirtual,
						rules ? virtualShareRequired(rules) : null,
						balance.virtualShareMissing,
					),
		qualified: balance.qualified,
	};
}

function condition(
	value: number,
	target: number | null,
	missing: number,
): Condition {
	return { value, target, missing, reached: missing === 0 };
}

function gauges(
	balance: StoredBalance,
	virtualCount: number,
	rules: RynkeRules,
): Gauges {
	const stepDm = rules.elevationStepM * 10;
	// The stored per-kind sums, never recomputed from counts (FR-004).
	const kinds = balance.teamEvents;
	return {
		training: gauge(
			balance.trainingRynke,
			rules.trainingThreshold,
			gaugeParts<GaugeSource>(
				[
					{ source: "distance", value: balance.distanceRynke },
					{ source: "elevation", value: balance.elevationRynke },
					...kinds.map((k) => ({ source: k.kind, value: k.training })),
				],
				rules.trainingThreshold,
			),
		),
		team: gauge(
			balance.teamRynke,
			rules.teamThreshold,
			gaugeParts<GaugeSource>(
				kinds.map((k) => ({ source: k.kind, value: k.team })),
				rules.teamThreshold,
			),
		),
		withoutVirtual:
			virtualCount === 0
				? null
				: gauge(balance.trainingWithoutVirtual, virtualShareRequired(rules)),
		elevation: {
			...gauge(stepDm - balance.elevationToNextStepDm, stepDm),
			stepRynke: rules.elevationStepRynke,
		},
	};
}

function gauge(value: number, target: number, parts: GaugePart[] = []): Gauge {
	return {
		value,
		target,
		percent: percent(value, target),
		reached: value >= target,
		parts,
	};
}

/** Rounded down, so 249.5 of 250 never shows 100 (research R7). */
export function percent(value: number, target: number): number {
	return Math.min(100, Math.floor((value * 100) / target));
}

/**
 * Each part's share of `max(total, target)`: the filled width matches the
 * percentage, and above the target the parts fill the bar in proportion.
 * Rounded down to two decimals, so the widths never add up to more than 100.
 * Parts of 0 get no segment; negative corrections leave the gauge undivided
 * (FR-022).
 */
export function gaugeParts<S extends string>(
	parts: { source: S; value: number }[],
	target: number,
): GaugePart<S>[] {
	if (parts.some((p) => p.source === "corrections" && p.value < 0)) return [];
	const total = parts.reduce((sum, p) => sum + p.value, 0);
	const whole = Math.max(total, target);
	return parts
		.filter((p) => p.value > 0)
		.map((p) => ({
			...p,
			widthPercent: Math.floor((p.value * 10000) / whole) / 100,
		}));
}

/**
 * The requested table page: `?page=N` with N of 1 to 4 digits and no leading
 * zero, otherwise 1, also for several `page` parameters (contracts/http-routes.md).
 */
export function parsePage(url: URL): number {
	const pages = url.searchParams.getAll("page");
	const page = pages.length === 1 ? pages[0] : undefined;
	return page && /^[1-9][0-9]{0,3}$/.test(page) ? Number(page) : 1;
}

function rideTable(read: RiderViewRead, context: ViewContext): RideTable {
	const from =
		read.rides.length === 0 ? 0 : (read.page - 1) * RIDES_PER_PAGE + 1;
	return {
		rows: read.rides.map((ride) => rideLine(ride, context)),
		position: {
			from,
			to: from === 0 ? 0 : from + read.rides.length - 1,
			total: read.rideCount,
		},
		pager: pager(read.page, read.rideCount),
	};
}

/** Only the links that lead somewhere else (research R11). */
function pager(page: number, rideCount: number): Pager | null {
	if (rideCount <= RIDES_PER_PAGE) return null;
	const lastPage = Math.ceil(rideCount / RIDES_PER_PAGE);
	const newer = page > 1;
	const older = page < lastPage;
	return {
		page,
		lastPage,
		first: newer ? 1 : null,
		previous: newer ? page - 1 : null,
		next: older ? page + 1 : null,
		last: older ? lastPage : null,
	};
}

function rideLine(ride: RideRow, context: ViewContext): RideLine {
	const result = ride.result;
	const counts = result?.counts === true;
	const reasons =
		result && !counts
			? reasonLines(ride, context.rulesFor(result.rulesVersion), context)
			: [];
	return {
		activityId: ride.activityId,
		startDateLocal: ride.startDateLocal,
		sportType: ride.sportType,
		distanceM: ride.distanceM,
		elevationGainM: ride.elevationGainM,
		status: !result ? "being-evaluated" : counts ? "counts" : "does-not-count",
		distanceRynke: counts ? result.distanceRynke : 0,
		elevationM: counts ? result.elevationDm / 10 : 0,
		isVirtual: result?.isVirtual ?? false,
		reasons,
		unknownFigures: result?.unknownFigures ?? [],
		fixHint: (result?.reasons ?? []).some((code) => FIXABLE.has(code)),
	};
}

/** Each stored reason with its figures (research R12). */
function reasonLines(
	ride: RideRow,
	rules: RynkeRules | null,
	context: ViewContext,
): ReasonLine[] {
	// Feature 003 records only `pause` without moving time, so the speeds and
	// the climbing rate always have one to divide by.
	const tenths = (ride.distanceM * 36) / ride.movingS;
	return (ride.result?.reasons ?? []).map((stored): ReasonLine => {
		const code: string = stored;
		switch (code) {
			case "flagged":
			case "manual":
				return { code };
			case "pause":
				return {
					code,
					pausedS:
						ride.movingS === 0 || ride.elapsedS === null
							? null
							: ride.elapsedS - ride.movingS,
					movingS: ride.movingS,
					share: rules?.maxPausedShare ?? null,
				};
			case "too_slow":
				return {
					code,
					kmhTenths: Math.floor(tenths),
					limitKmh: rules?.minSpeedKmh ?? null,
				};
			case "too_fast":
				return {
					code,
					kmhTenths: Math.ceil(tenths),
					limitKmh: rules?.maxSpeedKmh ?? null,
				};
			case "climbing_rate":
				return {
					code,
					// The decimetres feature 003 compares.
					mPerH: Math.ceil(
						(Math.round(ride.elevationGainM * 10) * 360) / ride.movingS,
					),
					limitMPerH: rules?.maxClimbMPerH ?? null,
				};
			case "excluded_sport_type":
				return { code, sportType: ride.sportType };
			case "outside_window":
				return ride.startDateLocal.slice(0, 10) < context.seasonStart
					? { code: "before_season", date: context.seasonStart }
					: {
							code: "after_deadline",
							date: rules?.qualificationDeadline ?? null,
						};
			case "overlap":
				return { code, countedInstead: ride.countedInstead };
			default:
				return { code: "unknown", stored: code };
		}
	});
}
