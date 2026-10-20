// Applies a change to a rider's activities, to team events and attendance, or
// to a rider's corrections (feature 014), and stores the result of a full
// evaluation of every affected rider in the same D1 batch, so a reader never
// sees an input, its ride results and the balance disagree (research R11, R21,
// FR-014b). Every kind of change shares
// one read (`readRiders`) and one evaluate-and-diff (`riderWrites`); only rows
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
import type { Ctx } from "../ctx";
import {
	activityOwnersStatement,
	deleteActivityStatement,
	deletePrivateActivitiesStatement,
	listActivitiesOfRidersStatement,
	upsertActivityStatement,
} from "../db/activities";
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
	type CorrectionFields,
	type CorrectionOfRidersRow,
	deleteCorrectionStatement,
	insertCorrectionStatement,
	listCorrectionsOfRidersStatement,
	readCorrectionStatement,
} from "../db/corrections";
import { deleteReportsStatement } from "../db/participation";
import {
	deletePrivateRunsStatement,
	deleteRunStatement,
	listRunsOfRidersStatement,
	runOwnersStatement,
	upsertRunStatement,
} from "../db/runs";
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
import {
	deletePrivateSwimsStatement,
	deleteSwimStatement,
	listSwimsOfRidersStatement,
	swimOwnersStatement,
	upsertSwimStatement,
} from "../db/swims";
import {
	type AttendanceOfRidersRow,
	deleteAttendancesStatement,
	deleteTeamEventStatement,
	insertAttendancesStatement,
	insertTeamEventStatement,
	listAttendanceOfRidersStatement,
	listEventAttendeesStatement,
	listTourEventsStatement,
	listTourRidersStatement,
	readTeamEventStatement,
	riderStatusesStatement,
	type TeamEventFields,
	type TeamEventRow,
	type TourEventRow,
	toAttendance,
	toTourEvent,
	updateTeamEventStatement,
} from "../db/team-events";
import type {
	ActivityRecord,
	ActivityRow,
	RunRecord,
	SwimRecord,
} from "../strava/activity";
import { sendAll } from "../work/messages";
import { notifyRiders } from "../work/send-notification";
import { teamBadgeNews } from "../work/team-badge-news";
import { type Evaluation, evaluateRides, rideFromRow } from "./rides";
import {
	type CountingWindow,
	CURRENT_RULES,
	countingWindow,
	isCalendarDate,
	type RynkeRules,
} from "./rules";
import { type Balance, extrasFrom, tally } from "./tally";
import {
	type Attendance,
	evaluateAttendance,
	isEventKind,
} from "./team-events";

/**
 * `runs` are outdoor runs and `swims` swims (feature 013); an activity id is
 * stored as a ride, a run or a swim, so upserting it as one removes it as the
 * others. `delete` and `delete-private` remove runs and swims as well as
 * rides.
 */
export type ActivityChange =
	| { kind: "none" }
	| {
			kind: "upsert";
			records: ActivityRecord[];
			runs?: RunRecord[];
			swims?: SwimRecord[];
	  }
	| { kind: "delete"; activityIds: number[] }
	| { kind: "delete-private" };

/** What an activity change did to the rider. */
export interface ActivityResult {
	/** Their Training or Team Rynke rose. */
	rose: boolean;
	/** Their new personal badges. */
	badges: string[];
	/**
	 * The figures of their counting rides or outdoor runs changed, which the
	 * team badges add up.
	 */
	figuresChanged: boolean;
}

/** An event as an organiser enters it; checked before anything is read. */
export interface TeamEventInput {
	kind: string;
	date: string;
	name: string | null;
}

/** `by` is the organiser making the change (feature 014 FR-040). */
export type TeamEventChange =
	| { kind: "create-event"; event: TeamEventInput; by?: number }
	| {
			kind: "update-event";
			eventId: number;
			event: TeamEventInput;
			by?: number;
	  }
	| { kind: "delete-event"; eventId: number }
	| {
			kind: "add-attendance";
			eventId: number;
			athleteIds: number[];
			by?: number;
	  }
	| { kind: "remove-attendance"; eventId: number; athleteIds: number[] };

/** The refusal codes of contracts/ride-evaluation.md; nothing was written. */
export class TeamEventRefused extends Error {
	readonly code:
		| "unknown_kind"
		| "invalid_date"
		| "invalid_name"
		| "event_missing"
		| "rider_not_connected";

	constructor(code: TeamEventRefused["code"]) {
		super(`team-event change refused: ${code}`);
		this.name = "TeamEventRefused";
		this.code = code;
	}
}

export interface TeamEventResult {
	eventId: number | null;
	affected: number[];
	rose: number[];
	/** The affected riders with a new personal badge (feature 013 R17). */
	earned: number[];
}

/** A correction as an organiser enters it; checked before anything is read. */
export interface CorrectionInput {
	training: number;
	team: number;
	reason: string;
	date: string;
}

/** `by` is the organiser adding it (feature 014 FR-040). */
export type CorrectionChange =
	| {
			kind: "add-correction";
			athleteId: number;
			correction: CorrectionInput;
			by: number;
	  }
	| { kind: "remove-correction"; correctionId: number };

export interface CorrectionResult {
	athleteId: number;
	rose: boolean;
	/** The rider's new personal badges, catalog order (feature 013 R17). */
	badges: string[];
}

/** The refusal codes of feature 014 research R8; nothing was written. */
export class CorrectionRefused extends Error {
	readonly code:
		| "invalid_amount"
		| "invalid_reason"
		| "invalid_date"
		| "correction_missing"
		| "rider_not_connected";

	constructor(code: CorrectionRefused["code"]) {
		super(`correction change refused: ${code}`);
		this.name = "CorrectionRefused";
		this.code = code;
	}
}

/** What a full evaluation of one rider needs, as stored. */
interface RiderState {
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
}

export async function applyAndEvaluate(
	db: D1Database,
	athleteId: number,
	change: ActivityChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): Promise<ActivityResult> {
	const ids =
		change.kind === "upsert"
			? [
					...change.records,
					...(change.runs ?? []),
					...(change.swims ?? []),
				].map((r) => r.strava_activity_id)
			: [];
	const ownerReads =
		change.kind === "upsert"
			? [
					activityOwnersStatement(db, ids),
					runOwnersStatement(db, ids),
					swimOwnersStatement(db, ids),
				]
			: [];
	const {
		riders,
		extra: [ownerRows, runOwnerRows, swimOwnerRows],
	} = await readRiders(db, [athleteId], ownerReads);
	const state = riders.get(athleteId) as RiderState;
	const { activities, runs, swims } = state;
	const before = evaluateState(state, rules, window, now);

	const writes: D1PreparedStatement[] = [];
	switch (change.kind) {
		case "none":
			break;
		case "upsert": {
			const owners = new Map<number, number>();
			for (const row of [
				...(ownerRows?.results ?? []),
				...(runOwnerRows?.results ?? []),
				...(swimOwnerRows?.results ?? []),
			] as {
				strava_activity_id: number;
				athlete_id: number;
			}[]) {
				owners.set(row.strava_activity_id, row.athlete_id);
			}
			// The SQL guards leave another rider's activity alone; so does this.
			const own = (r: { strava_activity_id: number; athlete_id: number }) =>
				r.athlete_id === athleteId &&
				(owners.get(r.strava_activity_id) ?? athleteId) === athleteId;
			for (const record of change.records) {
				if (!own(record)) continue;
				const id = record.strava_activity_id;
				activities.set(id, record);
				writes.push(upsertActivityStatement(db, record));
				if (runs.delete(id)) writes.push(deleteRunStatement(db, athleteId, id));
				if (swims.delete(id)) {
					writes.push(deleteSwimStatement(db, athleteId, id));
				}
			}
			for (const run of change.runs ?? []) {
				if (!own(run)) continue;
				const id = run.strava_activity_id;
				runs.set(id, run);
				writes.push(upsertRunStatement(db, run));
				if (activities.delete(id)) {
					writes.push(deleteActivityStatement(db, athleteId, id));
				}
				if (swims.delete(id)) {
					writes.push(deleteSwimStatement(db, athleteId, id));
				}
			}
			for (const swim of change.swims ?? []) {
				if (!own(swim)) continue;
				const id = swim.strava_activity_id;
				swims.set(id, swim);
				writes.push(upsertSwimStatement(db, swim));
				if (activities.delete(id)) {
					writes.push(deleteActivityStatement(db, athleteId, id));
				}
				if (runs.delete(id)) writes.push(deleteRunStatement(db, athleteId, id));
			}
			break;
		}
		case "delete":
			for (const id of change.activityIds) {
				if (activities.delete(id)) {
					writes.push(deleteActivityStatement(db, athleteId, id));
				}
				if (runs.delete(id)) writes.push(deleteRunStatement(db, athleteId, id));
				if (swims.delete(id)) {
					writes.push(deleteSwimStatement(db, athleteId, id));
				}
			}
			break;
		case "delete-private": {
			let removed = false;
			for (const [id, row] of activities) {
				if (row.is_private === 1) {
					activities.delete(id);
					removed = true;
				}
			}
			if (removed) writes.push(deletePrivateActivitiesStatement(db, athleteId));
			let removedRuns = false;
			for (const [id, run] of runs) {
				if (run.is_private === 1) {
					runs.delete(id);
					removedRuns = true;
				}
			}
			if (removedRuns) writes.push(deletePrivateRunsStatement(db, athleteId));
			let removedSwims = false;
			for (const [id, swim] of swims) {
				if (swim.is_private === 1) {
					swims.delete(id);
					removedSwims = true;
				}
			}
			if (removedSwims) {
				writes.push(deletePrivateSwimsStatement(db, athleteId));
			}
			break;
		}
	}

	const after = evaluateState(state, rules, window, now);
	writes.push(...riderWrites(db, athleteId, state, after, rules, now));
	const risen = rose(before.balance, after.balance);
	if (risen) {
		writes.push(riseWrite(db, athleteId, before.balance, after.balance, now));
	}
	const news = badgeNews(db, athleteId, state, before, after, rules, now);
	writes.push(...news.writes);
	if (writes.length > 0) await db.batch(writes);
	return {
		rose: risen,
		badges: news.badges,
		figuresChanged: teamFiguresChanged(before.figures, after.figures),
	};
}

/** `applyAndEvaluate` under the current rules, for the work handlers. */
export function evaluateChange(
	ctx: Ctx,
	athleteId: number,
	change: ActivityChange,
): Promise<ActivityResult> {
	return applyAndEvaluate(
		ctx.env.DB,
		athleteId,
		change,
		CURRENT_RULES,
		countingWindow(ctx.env),
		ctx.now(),
	);
}

/**
 * Applies a team-event change and re-evaluates every affected rider, all in
 * one batch (research R21). Refusals throw `TeamEventRefused` before anything
 * is written. `eventId` is set for `create-event` only; `rose` lists the
 * affected riders whose Rynke rose, `earned` those with a new badge, sorted.
 */
export async function applyTeamEventChange(
	db: D1Database,
	change: TeamEventChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): Promise<TeamEventResult> {
	if (change.kind === "create-event") {
		const event = validEvent(change.event);
		const eventId = await insertTeamEventStatement(
			db,
			event,
			change.by ?? null,
			now,
		).first<number>("event_id");
		if (event.kind !== "tour_de_paris" || eventId === null) {
			return { eventId, affected: [], rose: [], earned: [] };
		}
		// A new tour day numbers the later ones anew (feature 021 FR-012).
		const day = { eventId, date: event.date };
		const others = await tourRiders(db, window);
		const { riders } = await readRiders(db, others, []);
		for (const state of riders.values()) {
			state.tourEvents = state.tourEvents.filter((e) => e.eventId !== eventId);
		}
		const result = reevaluate(
			db,
			others,
			riders,
			rules,
			window,
			now,
			(state) => {
				state.tourEvents = [...state.tourEvents, day];
			},
		);
		if (result.writes.length > 0) await db.batch(result.writes);
		return {
			eventId,
			affected: others,
			rose: result.risen,
			earned: result.earned,
		};
	}
	const event =
		change.kind === "update-event" ? validEvent(change.event) : null;
	const { eventId } = change;

	const reads = [
		readTeamEventStatement(db, eventId),
		listEventAttendeesStatement(db, eventId),
		listTourRidersStatement(db, window.seasonStart),
	];
	if (change.kind === "add-attendance") {
		reads.push(riderStatusesStatement(db, change.athleteIds));
	}
	const [eventRows, attendeeRows, tourRiderRows, statusRows] =
		await db.batch(reads);
	if (!eventRows || !attendeeRows || !tourRiderRows) {
		throw new Error("D1 batch returned too few results");
	}
	const stored = (eventRows.results as TeamEventRow[])[0];
	if (!stored) throw new TeamEventRefused("event_missing");
	const attendees = new Set(
		(attendeeRows.results as { athlete_id: number }[]).map((r) => r.athlete_id),
	);

	let affected: number[];
	let statement: D1PreparedStatement | null;
	/** The rider's attendance with the change applied. */
	let edit: (attendance: Attendance[]) => Attendance[];
	/** The tour days with the change applied (feature 021 FR-012). */
	let editTour: ((tour: TourEvent[]) => TourEvent[]) | null = null;
	const without = (attendance: Attendance[]) =>
		attendance.filter((a) => a.eventId !== eventId);
	const withoutDay = (tour: TourEvent[]) =>
		tour.filter((e) => e.eventId !== eventId);
	switch (change.kind) {
		case "update-event": {
			const next = event as TeamEventFields;
			const counted =
				next.kind !== stored.kind || next.date !== stored.event_date;
			affected = counted ? [...attendees] : [];
			if (
				counted &&
				(stored.kind === "tour_de_paris" || next.kind === "tour_de_paris")
			) {
				editTour = (tour) =>
					next.kind === "tour_de_paris"
						? [...withoutDay(tour), { eventId, date: next.date }]
						: withoutDay(tour);
			}
			statement =
				counted || next.name !== stored.name
					? updateTeamEventStatement(db, eventId, next, change.by ?? null, now)
					: null;
			edit = (attendance) => [
				...without(attendance),
				{ eventId, kind: next.kind, date: next.date },
			];
			break;
		}
		case "delete-event":
			affected = [...attendees];
			statement = deleteTeamEventStatement(db, eventId);
			edit = without;
			if (stored.kind === "tour_de_paris") editTour = withoutDay;
			break;
		case "add-attendance": {
			const statuses = new Map(
				(
					(statusRows?.results ?? []) as {
						athlete_id: number;
						status: string;
					}[]
				).map((r) => [r.athlete_id, r.status]),
			);
			if (change.athleteIds.some((id) => statuses.get(id) !== "connected")) {
				throw new TeamEventRefused("rider_not_connected");
			}
			affected = [...new Set(change.athleteIds)].filter(
				(id) => !attendees.has(id),
			);
			statement =
				affected.length > 0
					? insertAttendancesStatement(
							db,
							eventId,
							affected,
							change.by ?? null,
							now,
						)
					: null;
			edit = (attendance) => [
				...attendance,
				{ eventId, kind: stored.kind, date: stored.event_date },
			];
			break;
		}
		case "remove-attendance":
			affected = [...new Set(change.athleteIds)].filter((id) =>
				attendees.has(id),
			);
			statement =
				affected.length > 0
					? deleteAttendancesStatement(db, eventId, affected)
					: null;
			edit = without;
			break;
	}
	const writes = statement ? [statement] : [];
	if (change.kind === "add-attendance") {
		// Recorded attendance replaces the riders' reports (019 research R3).
		writes.push(deleteReportsStatement(db, eventId, change.athleteIds));
	}
	// A tour day added, moved or gone numbers the days anew for every rider
	// at one (feature 021 FR-012).
	const direct = new Set(affected);
	if (editTour) {
		const others = (tourRiderRows.results as { athlete_id: number }[]).map(
			(r) => r.athlete_id,
		);
		affected = [...new Set([...affected, ...others])];
	}
	affected.sort((a, b) => a - b);
	let risen: number[] = [];
	let earned: number[] = [];
	if (affected.length > 0) {
		const { riders } = await readRiders(db, affected, []);
		const result = reevaluate(
			db,
			affected,
			riders,
			rules,
			window,
			now,
			(state, athleteId) => {
				if (direct.has(athleteId)) state.attendance = edit(state.attendance);
				if (editTour) state.tourEvents = editTour(state.tourEvents);
			},
		);
		writes.push(...result.writes);
		risen = result.risen;
		earned = result.earned;
	}
	if (writes.length > 0) await db.batch(writes);
	return { eventId: null, affected, rose: risen, earned };
}

/**
 * Each rider's evaluation before and after `edit` changes their state: the
 * writes, and who rose or earned a badge.
 */
function reevaluate(
	db: D1Database,
	athleteIds: readonly number[],
	riders: Map<number, RiderState>,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
	edit: (state: RiderState, athleteId: number) => void,
): { writes: D1PreparedStatement[]; risen: number[]; earned: number[] } {
	const writes: D1PreparedStatement[] = [];
	const risen: number[] = [];
	const earned: number[] = [];
	for (const athleteId of athleteIds) {
		const state = riders.get(athleteId) as RiderState;
		const before = evaluateState(state, rules, window, now);
		edit(state, athleteId);
		const after = evaluateState(state, rules, window, now);
		writes.push(...riderWrites(db, athleteId, state, after, rules, now));
		if (rose(before.balance, after.balance)) {
			writes.push(riseWrite(db, athleteId, before.balance, after.balance, now));
			risen.push(athleteId);
		}
		const news = badgeNews(db, athleteId, state, before, after, rules, now);
		writes.push(...news.writes);
		if (news.badges.length > 0) earned.push(athleteId);
	}
	return { writes, risen, earned };
}

/** The riders recorded at a tour day of the season (feature 021 FR-012). */
async function tourRiders(
	db: D1Database,
	window: CountingWindow,
): Promise<number[]> {
	const { results } = await listTourRidersStatement(
		db,
		window.seasonStart,
	).all<{
		athlete_id: number;
	}>();
	return results.map((r) => r.athlete_id);
}

/**
 * `applyTeamEventChange` under the current rules, for callers outside the
 * serial queue consumer (the organiser pages). One `evaluate-rider` per
 * affected rider then settles a race with an activity event (research R21).
 * Each rider whose Rynke rose or who has a new badge gets a notification on
 * their devices (feature 013 research R17), as does each listed rider a new
 * team badge is new to (#125).
 */
export async function teamEventChange(
	ctx: Ctx,
	change: TeamEventChange,
): Promise<TeamEventResult> {
	const result = await applyTeamEventChange(
		ctx.env.DB,
		change,
		CURRENT_RULES,
		countingWindow(ctx.env),
		ctx.now(),
	);
	await sendAll(
		ctx,
		result.affected.map((athleteId) => ({ kind: "evaluate-rider", athleteId })),
	);
	const team = await teamBadgeNews(ctx, result.earned);
	await notifyRiders(
		ctx,
		[...new Set([...result.rose, ...result.earned, ...team])].sort(
			(a, b) => a - b,
		),
	);
	return result;
}

/**
 * Adds or removes a correction and re-evaluates its rider in one batch, as
 * `applyTeamEventChange` does (feature 014 research R8). Refusals throw
 * `CorrectionRefused` before anything is written. `athleteId` is the
 * correction's rider.
 */
export async function applyCorrectionChange(
	db: D1Database,
	change: CorrectionChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): Promise<CorrectionResult> {
	let athleteId: number;
	let statement: D1PreparedStatement;
	let edit: (state: RiderState) => void;
	const extraReads: D1PreparedStatement[] = [];
	if (change.kind === "add-correction") {
		const correction = validCorrection(change.correction);
		athleteId = change.athleteId;
		statement = insertCorrectionStatement(
			db,
			athleteId,
			correction,
			change.by,
			now,
		);
		edit = (state) => {
			state.corrections.push({
				correctionId: 0,
				training: correction.training,
				team: correction.team,
				date: correction.date,
			});
		};
		extraReads.push(riderStatusesStatement(db, [athleteId]));
	} else {
		const { correctionId } = change;
		const stored = await readCorrectionStatement(db, correctionId).first<{
			athlete_id: number;
		}>();
		if (!stored) throw new CorrectionRefused("correction_missing");
		athleteId = stored.athlete_id;
		statement = deleteCorrectionStatement(db, correctionId);
		edit = (state) => {
			state.corrections = state.corrections.filter(
				(c) => c.correctionId !== correctionId,
			);
		};
	}

	const {
		riders,
		extra: [statusRows],
	} = await readRiders(db, [athleteId], extraReads);
	if (
		statusRows &&
		(statusRows.results as { status: string }[])[0]?.status !== "connected"
	) {
		throw new CorrectionRefused("rider_not_connected");
	}
	const state = riders.get(athleteId) as RiderState;
	const before = evaluateState(state, rules, window, now);
	edit(state);
	const after = evaluateState(state, rules, window, now);
	const writes = [
		statement,
		...riderWrites(db, athleteId, state, after, rules, now),
	];
	const risen = rose(before.balance, after.balance);
	if (risen) {
		writes.push(riseWrite(db, athleteId, before.balance, after.balance, now));
	}
	const news = badgeNews(db, athleteId, state, before, after, rules, now);
	writes.push(...news.writes);
	await db.batch(writes);
	return { athleteId, rose: risen, badges: news.badges };
}

/**
 * `applyCorrectionChange` under the current rules, for the organiser pages:
 * one `evaluate-rider` settles a race with an activity event, and a rise or
 * a new badge notifies the rider, and a new team badge the listed riders, as
 * `teamEventChange` does.
 */
export async function correctionChange(
	ctx: Ctx,
	change: CorrectionChange,
): Promise<CorrectionResult> {
	const result = await applyCorrectionChange(
		ctx.env.DB,
		change,
		CURRENT_RULES,
		countingWindow(ctx.env),
		ctx.now(),
	);
	await sendAll(ctx, [{ kind: "evaluate-rider", athleteId: result.athleteId }]);
	const team = await teamBadgeNews(
		ctx,
		result.badges.length > 0 ? [result.athleteId] : [],
	);
	const own = result.rose || result.badges.length > 0 ? [result.athleteId] : [];
	await notifyRiders(
		ctx,
		[...new Set([...own, ...team])].sort((a, b) => a - b),
	);
	return result;
}

/** The bounds of the `corrections` table (data-model.md, R8). */
const MAX_AMOUNT = 10000;

function validCorrection(correction: CorrectionInput): CorrectionFields {
	const { training, team } = correction;
	if (
		![training, team].every(
			(n) => Number.isInteger(n) && Math.abs(n) <= MAX_AMOUNT,
		) ||
		(training === 0 && team === 0)
	) {
		throw new CorrectionRefused("invalid_amount");
	}
	const reason = correction.reason.trim();
	// Characters as SQLite's length() counts them.
	const length = [...reason].length;
	if (length < 1 || length > 200) {
		throw new CorrectionRefused("invalid_reason");
	}
	if (!isCalendarDate(correction.date)) {
		throw new CorrectionRefused("invalid_date");
	}
	return { training, team, reason, date: correction.date };
}

function validEvent(event: TeamEventInput): TeamEventFields {
	if (!isEventKind(event.kind)) throw new TeamEventRefused("unknown_kind");
	if (!isCalendarDate(event.date)) throw new TeamEventRefused("invalid_date");
	// Characters as SQLite's length() counts them.
	const length = event.name === null ? null : [...event.name].length;
	if (length !== null && (length < 1 || length > 100)) {
		throw new TeamEventRefused("invalid_name");
	}
	return { kind: event.kind, date: event.date, name: event.name };
}

/**
 * The stored state of every rider in `athleteIds` plus the results of
 * `extraReads`, from one batch: one statement per table (research R21).
 */
async function readRiders(
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
		!tourRows
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
	return { riders, extra };
}

/**
 * The rider's counting rides, outdoor runs and swims, as the badges add them
 * up.
 */
interface Figures {
	rides: CountingRide[];
	runs: DatedRun[];
	swims: DatedSwim[];
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
 * (R13, R14) and the team's (R15) are worked out from.
 */
function figuresOf(state: RiderState, evaluation: Evaluation): Figures {
	const rides = [];
	for (const result of evaluation.results) {
		const activity = state.activities.get(result.activityId);
		if (!result.counts || !activity) continue;
		rides.push({
			date: activity.start_date_local.slice(0, 10),
			distanceM: activity.distance_m,
			distanceRynke: result.distanceRynke,
			elevationDm: result.elevationDm,
			virtual: result.isVirtual,
			startTime: activity.start_date_local.slice(11, 16),
		});
	}
	const dated = (activity: RunRecord | SwimRecord) => ({
		date: activity.start_date_local.slice(0, 10),
		distanceM: activity.distance_m,
	});
	return {
		rides,
		runs: [...state.runs.values()].map(dated),
		swims: [...state.swims.values()].map(dated),
	};
}

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
): { writes: D1PreparedStatement[]; badges: string[] } {
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
	}: { evaluation: Evaluation; balance: Balance; badges: EarnedBadge[] },
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
