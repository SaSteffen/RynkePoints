// Training Rynke from rides (FR-004–FR-005g, FR-011, FR-013a): a pure,
// deterministic evaluation of one rider's stored activities
// (contracts/ride-evaluation.md). No I/O, clock or randomness. Arithmetic is
// exact at every rule boundary: elevation in whole decimetres, limits compared
// by cross-multiplication, shares as fractions (research R3).

import type { ActivityRow } from "../strava/activity";
import {
	assertValidRules,
	type CountingWindow,
	type RynkeRules,
} from "./rules";

/** Why a ride doesn't count, in the order a result lists them (FR-016). */
export const REASON_CODES = [
	"outside_window",
	"excluded_sport_type",
	"flagged",
	"manual",
	"pause",
	"too_slow",
	"too_fast",
	"climbing_rate",
	"overlap",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

/** Figures Strava didn't send, in the order a result lists them (FR-005f). */
export const UNKNOWN_FIGURE_CODES = [
	"elapsed_time",
	"manual",
	"trainer",
	"flagged",
] as const;

export type UnknownFigureCode = (typeof UNKNOWN_FIGURE_CODES)[number];

/** One stored activity as the evaluation sees it (data-model.md "Input: Ride"). */
export interface Ride {
	activityId: number;
	sportType: string;
	/** ISO UTC; start of the overlap interval (research R5). */
	startUtc: string;
	/** Local wall-clock time; its date places the ride in the window (R4). */
	startLocal: string;
	distanceM: number;
	movingS: number;
	/** `null` = unknown. */
	elapsedS: number | null;
	elevationM: number;
	manual: boolean | null;
	trainer: boolean | null;
	flagged: boolean | null;
	refreshedAt: number;
}

export interface RideResult {
	activityId: number;
	counts: boolean;
	reasons: ReasonCode[];
	/** The larger counting ride this one overlaps; set only for `["overlap"]`. */
	overlapsActivityId: number | null;
	distanceRynke: number;
	/** Decimetres added to the elevation total; 0 when not counting. */
	elevationDm: number;
	isVirtual: boolean;
	unknownFigures: UnknownFigureCode[];
	activityRefreshedAt: number;
}

export interface RidingSums {
	distanceRynke: number;
	elevationDm: number;
	elevationRynke: number;
}

export interface RidingTotals extends RidingSums {
	/** The same over counting rides that aren't virtual (FR-013a). */
	withoutVirtual: RidingSums;
}

export interface Evaluation {
	results: RideResult[];
	riding: RidingTotals;
}

interface Checked {
	ride: Ride;
	reasons: ReasonCode[];
	elevationDm: number;
}

export function evaluateRides(
	rides: readonly Ride[],
	rules: RynkeRules,
	window: CountingWindow,
): Evaluation {
	assertValidRules(rules);
	const checked: Checked[] = rides.map((ride) => {
		const elevationDm = Math.round(ride.elevationM * 10);
		return {
			ride,
			elevationDm,
			reasons: reasonsFor(ride, elevationDm, rules, window),
		};
	});

	// FR-005d: among rides passing every other rule, the largest of overlapping
	// recordings counts (research R5).
	const candidates = checked
		.filter((c) => c.reasons.length === 0)
		.sort(
			(a, b) =>
				b.ride.distanceM - a.ride.distanceM ||
				b.elevationDm - a.elevationDm ||
				a.ride.activityId - b.ride.activityId,
		);
	const counting: Checked[] = [];
	const overlaps = new Map<number, number>();
	for (const candidate of candidates) {
		const larger = counting.find((c) => overlap(c.ride, candidate.ride));
		if (larger) {
			overlaps.set(candidate.ride.activityId, larger.ride.activityId);
		} else {
			counting.push(candidate);
		}
	}

	const results = checked
		.map(({ ride, reasons, elevationDm }): RideResult => {
			const overlapsActivityId = overlaps.get(ride.activityId) ?? null;
			const allReasons: ReasonCode[] =
				overlapsActivityId === null ? reasons : ["overlap"];
			const counts = allReasons.length === 0;
			return {
				activityId: ride.activityId,
				counts,
				reasons: allReasons,
				overlapsActivityId,
				distanceRynke: counts ? distanceRynke(ride, rules) : 0,
				elevationDm: counts ? elevationDm : 0,
				isVirtual: isVirtual(ride),
				unknownFigures: unknownFigures(ride),
				activityRefreshedAt: ride.refreshedAt,
			};
		})
		.sort((a, b) => a.activityId - b.activityId);

	const countingResults = results.filter((r) => r.counts);
	return {
		results,
		riding: {
			...sums(countingResults, rules),
			withoutVirtual: sums(
				countingResults.filter((r) => !r.isVirtual),
				rules,
			),
		},
	};
}

/** Every code except `overlap`; each rule is checked on its own. */
function reasonsFor(
	ride: Ride,
	elevationDm: number,
	rules: RynkeRules,
	window: CountingWindow,
): ReasonCode[] {
	const reasons: ReasonCode[] = [];
	const date = ride.startLocal.slice(0, 10);
	if (
		date < window.seasonStart ||
		(window.deadline !== null && date > window.deadline)
	) {
		reasons.push("outside_window");
	}
	if (rules.excludedSportTypes.includes(ride.sportType)) {
		reasons.push("excluded_sport_type");
	}
	// FR-005g: under every rule version, so not a rule value.
	if (ride.flagged === true) reasons.push("flagged");
	if (ride.manual === true) reasons.push("manual");

	const moving = ride.movingS;
	if (moving === 0) {
		// A ride paused for its whole duration; averages over no moving time
		// don't exist (research R7).
		reasons.push("pause");
		return reasons;
	}
	const { num, den } = rules.maxPausedShare;
	if (ride.elapsedS !== null && (ride.elapsedS - moving) * den > moving * num) {
		reasons.push("pause");
	}
	const speed = ride.distanceM * 3600;
	if (speed < rules.minSpeedKmh * 1000 * moving) reasons.push("too_slow");
	if (speed > rules.maxSpeedKmh * 1000 * moving) reasons.push("too_fast");
	if (elevationDm * 3600 > rules.maxClimbMPerH * 10 * moving) {
		reasons.push("climbing_rate");
	}
	return reasons;
}

/** Half-open intervals on the UTC start, so rides that only touch don't overlap. */
function overlap(a: Ride, b: Ride): boolean {
	const [aStart, aEnd] = interval(a);
	const [bStart, bEnd] = interval(b);
	return aStart < bEnd && bStart < aEnd;
}

function interval(ride: Ride): [number, number] {
	const start = Date.parse(ride.startUtc);
	return [start, start + (ride.elapsedS ?? ride.movingS) * 1000];
}

function distanceRynke(ride: Ride, rules: RynkeRules): number {
	return (
		Math.floor(ride.distanceM / (rules.distanceStepKm * 1000)) *
		rules.distanceStepRynke
	);
}

/** An unknown trainer flag makes only a `VirtualRide` virtual (research R6). */
function isVirtual(ride: Ride): boolean {
	return ride.sportType === "VirtualRide" || ride.trainer === true;
}

function unknownFigures(ride: Ride): UnknownFigureCode[] {
	const codes: UnknownFigureCode[] = [];
	if (ride.elapsedS === null) codes.push("elapsed_time");
	if (ride.manual === null) codes.push("manual");
	if (ride.trainer === null && ride.sportType !== "VirtualRide") {
		codes.push("trainer");
	}
	if (ride.flagged === null) codes.push("flagged");
	return codes;
}

/** Elevation Rynke are floored once on the total, never per ride (FR-004a). */
function sums(results: RideResult[], rules: RynkeRules): RidingSums {
	let distance = 0;
	let elevationDm = 0;
	for (const r of results) {
		distance += r.distanceRynke;
		elevationDm += r.elevationDm;
	}
	return {
		distanceRynke: distance,
		elevationDm,
		elevationRynke:
			Math.floor(elevationDm / (rules.elevationStepM * 10)) *
			rules.elevationStepRynke,
	};
}

/** Maps a stored `activities` row to the evaluation's input. */
export function rideFromRow(row: ActivityRow): Ride {
	return {
		activityId: row.strava_activity_id,
		sportType: row.sport_type,
		startUtc: row.start_date,
		startLocal: row.start_date_local,
		distanceM: row.distance_m,
		movingS: row.moving_time_s,
		elapsedS: row.elapsed_time_s,
		elevationM: row.elevation_gain_m,
		manual: bool(row.is_manual),
		trainer: bool(row.is_trainer),
		flagged: bool(row.is_flagged),
		refreshedAt: row.refreshed_at,
	};
}

function bool(value: 0 | 1 | null): boolean | null {
	return value === null ? null : value === 1;
}
