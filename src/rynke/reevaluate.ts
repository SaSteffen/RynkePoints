// The shared core of every change to a rider's inputs: activities
// (`apply.ts`), team events and attendance (`team-event-change.ts`) and
// corrections (`correction-change.ts`, feature 014). Each reads its riders
// with `readRiders`, edits their state, and has `reevaluate` work out a full
// evaluation before and after the edit; the caller stores its change and
// those writes in one D1 batch, so a reader never sees an input, its ride
// results and the balance disagree (research R11, R21, FR-014b). Only rows
// that changed are written (research R13).
//
// Each change also reports whether a rider's Training or Team Rynke rose,
// comparing the state before and after it, both evaluated now (feature 010
// research R5). Callers decide whether a rise notifies
// (010 contracts/push-delivery.md "Which changes notify"). A rise is stored
// with the change, so a notification can say how many Rynke are new (#45).
//
// The rider's personal badges are worked out from the same evaluation and
// written as a diff in the same batch (feature 013 research R13). New ones are
// reported and stored as a badge rise like a Rynke rise (R17).
//
// So is the rider's stored summary, what team reads add up (feature 030
// research R2): every change passes through `riderWrites`, which rewrites it
// only when it differs.

import { BADGE_CATALOG_VERSION } from "../badges/catalog";
import {
	badgeWindow,
	type CountingRide,
	type DatedRun,
	type DatedSwim,
	type EarnedBadge,
	evaluateBadges,
	type TourEvent,
} from "../badges/evaluate";
import { berlinDate } from "../config";
import { listActivitiesOfRidersStatement } from "../db/activities";
import {
	type BadgesVersionRow,
	deleteRiderBadgesStatement,
	listBadgesOfRidersStatement,
	type RiderBadgeRow,
	readBadgesVersionsStatement,
	setBadgesVersionStatement,
	upsertBadgeRiseStatement,
	upsertRevealsStatement,
	upsertRiderBadgesStatement,
} from "../db/badges";
import {
	type CorrectionOfRidersRow,
	listCorrectionsOfRidersStatement,
} from "../db/corrections";
import {
	type RiderSummaryRow,
	readSummariesOfRidersStatement,
	upsertSummaryStatement,
} from "../db/rider-summaries";
import { listRunsOfRidersStatement } from "../db/runs";
import {
	type BalanceRow,
	deleteRideResultsStatement,
	type RideResultRow,
	readBalancesOfRidersStatement,
	readRideResultsOfRidersStatement,
	type StoredBalance,
	type StoredRideResult,
	toStoredBalance,
	toStoredRideResult,
	upsertBalanceStatement,
	upsertRideResultsStatement,
	upsertRiseStatement,
} from "../db/rynke";
import { listSwimsOfRidersStatement } from "../db/swims";
import {
	type AttendanceOfRidersRow,
	listAttendanceOfRidersStatement,
	listTourEventsStatement,
	type TourEventRow,
	toAttendance,
	toTourEvent,
} from "../db/team-events";
import type { ActivityRow, RunRecord, SwimRecord } from "../strava/activity";
import {
	type Evaluation,
	evaluateRides,
	isPreWindow,
	rideFromRow,
} from "./rides";
import type { CountingWindow, RynkeRules } from "./rules";
import { RIDER_SUMMARY_VERSION, summaryOf } from "./summary";
import { type Balance, extrasFrom, tally } from "./tally";
import { type Attendance, evaluateAttendance } from "./team-events";

/** What a full evaluation of one rider needs, as stored. */
export interface RiderState {
	activities: Map<number, ActivityRow>;
	results: StoredRideResult[];
	balance: StoredBalance | null;
	attendance: Attendance[];
	corrections: {
		correctionId: number;
		training: number;
		team: number;
		date: string;
	}[];
	/** Stored personal badges: badge id → `earned_on` (feature 013). */
	badges: Map<string, string>;
	/** The `BADGE_CATALOG_VERSION` the stored badges were worked out with. */
	badgesVersion: number;
	/** Outdoor runs by activity id (feature 013). */
	runs: Map<number, RunRecord>;
	/** Swims by activity id (feature 013 part C). */
	swims: Map<number, SwimRecord>;
	/** Every tour day, which numbers the tour badges (feature 021 FR-011). */
	tourEvents: TourEvent[];
	/** The stored summary of any version (feature 030), `null` without one. */
	summary: RiderSummaryRow | null;
}

/** What a change did to one rider, and the writes that store it. */
export interface Reevaluation {
	/**
	 * The rider's ride results, balance, rise, badges and summary as far as
	 * they changed. The caller batches its change ahead of them, so a ride
	 * result never comes before its activity.
	 */
	writes: D1PreparedStatement[];
	/** Their Training or Team Rynke rose. */
	rose: boolean;
	/** Their new personal badges, catalog order. */
	badges: string[];
	/**
	 * The figures of their counting rides or outdoor runs changed, which the
	 * team badges add up.
	 */
	figuresChanged: boolean;
}

/**
 * The rider's evaluation before and after `edit` changes their state, both
 * at `now`.
 */
export function reevaluate(
	db: D1Database,
	athleteId: number,
	state: RiderState,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
	news: BadgeNewsSwitch,
	edit: (state: RiderState) => void,
): Reevaluation {
	const before = evaluateState(state, rules, window, now);
	edit(state);
	const after = evaluateState(state, rules, window, now);
	const writes = riderWrites(db, athleteId, state, after, rules, now);
	const risen = rose(before.balance, after.balance);
	if (risen) {
		writes.push(riseWrite(db, athleteId, before.balance, after.balance, now));
	}
	const announced = badgeNews(
		db,
		athleteId,
		state,
		before,
		after,
		rules,
		now,
		news,
	);
	writes.push(...announced.writes);
	return {
		writes,
		rose: risen,
		badges: announced.badges,
		figuresChanged: teamFiguresChanged(before.figures, after.figures),
	};
}

/**
 * The stored state of every rider in `athleteIds` plus the results of
 * `extraReads`, from one batch: one statement per table (research R21).
 */
export async function readRiders(
	db: D1Database,
	athleteIds: number[],
	extraReads: D1PreparedStatement[],
): Promise<{ riders: Map<number, RiderState>; extra: D1Result[] }> {
	const [
		activityRows,
		resultRows,
		balanceRows,
		attendanceRows,
		correctionRows,
		badgeRows,
		versionRows,
		runRows,
		swimRows,
		tourRows,
		summaryRows,
		...extra
	] = await db.batch([
		listActivitiesOfRidersStatement(db, athleteIds),
		readRideResultsOfRidersStatement(db, athleteIds),
		readBalancesOfRidersStatement(db, athleteIds),
		listAttendanceOfRidersStatement(db, athleteIds),
		listCorrectionsOfRidersStatement(db, athleteIds),
		listBadgesOfRidersStatement(db, athleteIds),
		readBadgesVersionsStatement(db, athleteIds),
		listRunsOfRidersStatement(db, athleteIds),
		listSwimsOfRidersStatement(db, athleteIds),
		listTourEventsStatement(db),
		readSummariesOfRidersStatement(db, athleteIds),
		...extraReads,
	]);
	if (
		!activityRows ||
		!resultRows ||
		!balanceRows ||
		!attendanceRows ||
		!correctionRows ||
		!badgeRows ||
		!versionRows ||
		!runRows ||
		!swimRows ||
		!tourRows ||
		!summaryRows
	) {
		throw new Error("D1 batch returned too few results");
	}
	const tourEvents = (tourRows.results as TourEventRow[]).map(toTourEvent);
	const riders = new Map<number, RiderState>(
		athleteIds.map((id) => [
			id,
			{
				activities: new Map(),
				results: [],
				balance: null,
				attendance: [],
				corrections: [],
				badges: new Map(),
				badgesVersion: 0,
				runs: new Map(),
				swims: new Map(),
				tourEvents,
				summary: null,
			},
		]),
	);
	for (const row of activityRows.results as ActivityRow[]) {
		riders.get(row.athlete_id)?.activities.set(row.strava_activity_id, row);
	}
	for (const row of resultRows.results as RideResultRow[]) {
		riders.get(row.athlete_id)?.results.push(toStoredRideResult(row));
	}
	for (const row of balanceRows.results as BalanceRow[]) {
		const rider = riders.get(row.athlete_id);
		if (rider) rider.balance = toStoredBalance(row);
	}
	for (const row of attendanceRows.results as AttendanceOfRidersRow[]) {
		riders.get(row.athlete_id)?.attendance.push(toAttendance(row));
	}
	for (const row of correctionRows.results as CorrectionOfRidersRow[]) {
		riders.get(row.athlete_id)?.corrections.push({
			correctionId: row.correction_id,
			training: row.training,
			team: row.team,
			date: row.correction_date,
		});
	}
	for (const row of badgeRows.results as RiderBadgeRow[]) {
		riders.get(row.athlete_id)?.badges.set(row.badge_id, row.earned_on);
	}
	for (const row of versionRows.results as BadgesVersionRow[]) {
		const rider = riders.get(row.athlete_id);
		if (rider) rider.badgesVersion = row.badges_version;
	}
	for (const row of runRows.results as RunRecord[]) {
		riders.get(row.athlete_id)?.runs.set(row.strava_activity_id, row);
	}
	for (const row of swimRows.results as SwimRecord[]) {
		riders.get(row.athlete_id)?.swims.set(row.strava_activity_id, row);
	}
	for (const row of summaryRows.results as RiderSummaryRow[]) {
		const rider = riders.get(row.athlete_id);
		if (rider) rider.summary = row;
	}
	return { riders, extra };
}

/**
 * The rider's counting and pre-window rides, outdoor runs and swims, as the
 * badges add them up, and with when they started for the team surprises.
 */
interface Figures {
	rides: (CountingRide & { startTime: string; preWindow?: true })[];
	runs: (DatedRun & { startTime: string })[];
	swims: (DatedSwim & { startTime: string })[];
}

/**
 * Whether what the team badges read changed: rides and runs, and swims, whose
 * dates and hours count for the team surprises (FR-016, research R39).
 */
function teamFiguresChanged(before: Figures, after: Figures): boolean {
	return JSON.stringify(before) !== JSON.stringify(after);
}

/**
 * A full evaluation of the rider's state at `now`: the Rynke over the whole
 * counting window, the badges only up to today in Berlin (`badgeWindow`).
 */
function evaluateState(
	state: RiderState,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): {
	evaluation: Evaluation;
	balance: Balance;
	badges: EarnedBadge[];
	figures: Figures;
} {
	const evaluation = evaluateRides(
		[...state.activities.values()].map(rideFromRow),
		rules,
		window,
	);
	const balance = tally(
		evaluation.riding,
		extrasFrom(
			evaluateAttendance(state.attendance, rules, window),
			state.corrections,
		),
		rules,
	);
	const figures = figuresOf(state, evaluation);
	return {
		evaluation,
		balance,
		badges: evaluateBadges(
			{
				...figures,
				attendance: state.attendance,
				corrections: state.corrections,
				tourEvents: state.tourEvents,
			},
			rules,
			badgeWindow(window, berlinDate(now)),
		).earned,
		figures,
	};
}

/**
 * The rider's counting rides and outdoor runs, which their personal badges
 * (R13, R14) and the team's (R15) are worked out from, and their pre-window
 * rides, which count for the badges too (feature 040 FR-014).
 */
function figuresOf(state: RiderState, evaluation: Evaluation): Figures {
	const rides: Figures["rides"] = [];
	for (const result of evaluation.results) {
		const activity = state.activities.get(result.activityId);
		const preWindow = isPreWindow(result.reasons);
		if ((!result.counts && !preWindow) || !activity) continue;
		rides.push({
			date: activity.start_date_local.slice(0, 10),
			distanceM: activity.distance_m,
			distanceRynke: result.distanceRynke,
			elevationDm: result.elevationDm,
			virtual: result.isVirtual,
			startTime: activity.start_date_local.slice(11, 16),
			...(preWindow ? { preWindow: true as const } : {}),
		});
	}
	const dated = (activity: RunRecord | SwimRecord) => ({
		date: activity.start_date_local.slice(0, 10),
		distanceM: activity.distance_m,
		startTime: activity.start_date_local.slice(11, 16),
	});
	return {
		rides,
		runs: [...state.runs.values()].map(dated),
		swims: [...state.swims.values()].map(dated),
	};
}

/**
 * Whether a change announces new badges: the rider's badge rise, the reveals,
 * and so the notifications. Off while the team has switched badges off
 * (feature 026 FR-018); the badges themselves are still worked out, so turning
 * them on again finds them in place.
 */
export interface BadgeNewsSwitch {
	badges: boolean;
}

export const BADGE_NEWS_ON: BadgeNewsSwitch = { badges: true };

/**
 * The badges new with this change, compared with the state before it evaluated
 * now (as `rose` does), written as the rider's badge rise (feature 013
 * research R17). Under new rules or a new badge catalog the awards are silent:
 * the badges they bring (already in `before`, which is worked out under them)
 * are marked as revealed instead (FR-012, FR-031, research R16, R18). A badge
 * the change itself brings is still new. A rider's first evaluation has no
 * balance yet and is never silent, so the import still shows its reveal.
 */
function badgeNews(
	db: D1Database,
	athleteId: number,
	state: RiderState,
	before: { badges: EarnedBadge[] },
	after: { badges: EarnedBadge[] },
	rules: RynkeRules,
	now: number,
	news: BadgeNewsSwitch,
): { writes: D1PreparedStatement[]; badges: string[] } {
	if (!news.badges) return { writes: [], badges: [] };
	const silent =
		state.balance !== null &&
		(state.balance.rulesVersion !== rules.version ||
			state.badgesVersion !== BADGE_CATALOG_VERSION);
	const had = new Set(before.badges.map((b) => b.badgeId));
	const appeared = silent
		? after.badges.filter(
				(b) => had.has(b.badgeId) && state.badges.get(b.badgeId) !== b.earnedOn,
			)
		: [];
	const badges = after.badges
		.map((b) => b.badgeId)
		.filter((id) => !had.has(id));
	return {
		writes: [
			...(appeared.length > 0
				? [upsertRevealsStatement(db, athleteId, appeared)]
				: []),
			...(badges.length > 0
				? [upsertBadgeRiseStatement(db, athleteId, badges, now)]
				: []),
		],
		badges,
	};
}

/** Whether the rider gained Training or Team Rynke (research R5). */
function rose(before: Balance, after: Balance): boolean {
	return (
		after.trainingRynke > before.trainingRynke ||
		after.teamRynke > before.teamRynke
	);
}

/** What the rider gained; a total that fell counts as 0. */
function riseWrite(
	db: D1Database,
	athleteId: number,
	before: Balance,
	after: Balance,
	now: number,
): D1PreparedStatement {
	return upsertRiseStatement(
		db,
		athleteId,
		{
			training: Math.max(0, after.trainingRynke - before.trainingRynke),
			team: Math.max(0, after.teamRynke - before.teamRynke),
		},
		now,
	);
}

/** The writes of what changed between the stored state and `evaluated`. */
function riderWrites(
	db: D1Database,
	athleteId: number,
	state: RiderState,
	{
		evaluation,
		balance,
		badges,
		figures,
	}: {
		evaluation: Evaluation;
		balance: Balance;
		badges: EarnedBadge[];
		figures: Figures;
	},
	rules: RynkeRules,
	now: number,
): D1PreparedStatement[] {
	const writes: D1PreparedStatement[] = [];
	const before = new Map(state.results.map((r) => [r.activityId, r]));
	const changed: StoredRideResult[] = [];
	for (const result of evaluation.results) {
		const next = { ...result, rulesVersion: rules.version };
		const previous = before.get(result.activityId);
		before.delete(result.activityId);
		if (!previous || !sameFields(previous, next)) changed.push(next);
	}
	// Results of removed activities go by cascade as well; deleting them here
	// keeps the batch right on its own.
	const gone = [...before.keys()];
	if (gone.length > 0) {
		writes.push(deleteRideResultsStatement(db, athleteId, gone));
	}
	if (changed.length > 0) {
		writes.push(upsertRideResultsStatement(db, athleteId, changed));
	}
	if (!state.balance || !sameBalance(state.balance, balance)) {
		writes.push(upsertBalanceStatement(db, athleteId, balance, now));
	}
	writes.push(...badgeWrites(db, athleteId, state, badges));
	const summary = summaryOf(figures, state.attendance);
	const stored = state.summary;
	if (
		stored?.version !== RIDER_SUMMARY_VERSION ||
		stored.days !== summary.days ||
		stored.weeks !== summary.weeks ||
		stored.run_days !== summary.runDays ||
		stored.active !== summary.active ||
		stored.attended !== summary.attended ||
		stored.virtual_days !== summary.virtualDays ||
		stored.own_days !== summary.ownDays ||
		stored.rides !== summary.rides
	) {
		writes.push(upsertSummaryStatement(db, athleteId, summary));
	}
	return writes;
}

/** Only badges that appeared, disappeared or changed date (research R13). */
function badgeWrites(
	db: D1Database,
	athleteId: number,
	state: RiderState,
	badges: EarnedBadge[],
): D1PreparedStatement[] {
	const writes: D1PreparedStatement[] = [];
	const gone = new Set(state.badges.keys());
	const changed = badges.filter((b) => {
		gone.delete(b.badgeId);
		return state.badges.get(b.badgeId) !== b.earnedOn;
	});
	if (gone.size > 0) {
		writes.push(deleteRiderBadgesStatement(db, athleteId, [...gone]));
	}
	if (changed.length > 0) {
		writes.push(upsertRiderBadgesStatement(db, athleteId, changed));
	}
	if (state.badgesVersion !== BADGE_CATALOG_VERSION) {
		writes.push(
			setBadgesVersionStatement(db, athleteId, BADGE_CATALOG_VERSION),
		);
	}
	return writes;
}

function sameBalance(stored: StoredBalance, next: Balance): boolean {
	const { computedAt: _computedAt, ...fields } = stored;
	return sameFields(fields, next);
}

/** Field by field; the code lists and the breakdown compare as JSON. */
function sameFields<T extends object>(a: T, b: T): boolean {
	const keys = Object.keys(b) as (keyof T)[];
	return (
		Object.keys(a).length === keys.length &&
		keys.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]))
	);
}
