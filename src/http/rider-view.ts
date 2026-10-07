import {
	RIDES_PER_PAGE,
	type RideRow,
	type RiderViewRead,
} from "../db/rider-view";
import type { StoredBalance } from "../db/rynke";
import type { RynkeRules } from "../rynke/rules";
import { virtualShareRequired } from "../rynke/tally";
import type { CyclingSportType } from "../strava/activity";

// The rider page's view model (feature 005 data-model.md, research R6): what
// the Rynke sections of /me show, built from one reading. Pure: no D1, no
// clock, no text. Every number is stored or derived from stored values
// (FR-004); every rule value comes from the rules of the stored version, and
// is left out when that version is unknown (FR-013).

export type RiderView =
	| { state: "not-worked-out"; importing: boolean; rides: RideTable }
	| { state: "ready"; importing: boolean; summary: Summary; rides: RideTable };

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

export interface RideTable {
	rows: RideLine[];
	/** 1-based positions in the whole table; `from` is 0 without rows. */
	position: { from: number; to: number; total: number };
	pager: null;
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
}

export interface ViewContext {
	/** `YYYY-MM-DD`, `SEASON_START_DATE`. */
	seasonStart: string;
	/** The import isn't done, so more rides may still arrive (FR-052). */
	importing: boolean;
}

/**
 * `rules` are those of the balance's version (`rulesForVersion`), `inEffect`
 * the version the evaluation uses now (`CURRENT_RULES`).
 */
export function buildRiderView(
	read: RiderViewRead,
	rules: RynkeRules | null,
	_inEffect: RynkeRules,
	context: ViewContext,
): RiderView {
	const rides = rideTable(read);
	if (!read.balance) {
		return { state: "not-worked-out", importing: context.importing, rides };
	}
	return {
		state: "ready",
		importing: context.importing,
		summary: summary(read.balance, read.virtualCount, rules),
		rides,
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

function rideTable(read: RiderViewRead): RideTable {
	const from =
		read.rides.length === 0 ? 0 : (read.page - 1) * RIDES_PER_PAGE + 1;
	return {
		rows: read.rides.map(rideLine),
		position: {
			from,
			to: from === 0 ? 0 : from + read.rides.length - 1,
			total: read.rideCount,
		},
		pager: null,
	};
}

function rideLine(ride: RideRow): RideLine {
	const result = ride.result;
	const counts = result?.counts === true;
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
	};
}
