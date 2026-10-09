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

import type { Ctx } from "../ctx";
import {
	activityOwnersStatement,
	deleteActivityStatement,
	deletePrivateActivitiesStatement,
	listActivitiesOfRidersStatement,
	upsertActivityStatement,
} from "../db/activities";
import {
	type CorrectionFields,
	type CorrectionOfRidersRow,
	deleteCorrectionStatement,
	insertCorrectionStatement,
	listCorrectionsOfRidersStatement,
	readCorrectionStatement,
} from "../db/corrections";
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
	type AttendanceOfRidersRow,
	deleteAttendancesStatement,
	deleteTeamEventStatement,
	insertAttendancesStatement,
	insertTeamEventStatement,
	listAttendanceOfRidersStatement,
	listEventAttendeesStatement,
	readTeamEventStatement,
	riderStatusesStatement,
	type TeamEventFields,
	type TeamEventRow,
	toAttendance,
	updateTeamEventStatement,
} from "../db/team-events";
import type { ActivityRecord, ActivityRow } from "../strava/activity";
import { sendAll } from "../work/messages";
import { notifyRiders } from "../work/send-notification";
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
	isTeamEventKind,
} from "./team-events";

export type ActivityChange =
	| { kind: "none" }
	| { kind: "upsert"; records: ActivityRecord[] }
	| { kind: "delete"; activityIds: number[] }
	| { kind: "delete-private" };

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
	corrections: { correctionId: number; training: number; team: number }[];
}

export async function applyAndEvaluate(
	db: D1Database,
	athleteId: number,
	change: ActivityChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): Promise<{ rose: boolean }> {
	const ownerReads =
		change.kind === "upsert"
			? [
					activityOwnersStatement(
						db,
						change.records.map((r) => r.strava_activity_id),
					),
				]
			: [];
	const {
		riders,
		extra: [ownerRows],
	} = await readRiders(db, [athleteId], ownerReads);
	const state = riders.get(athleteId) as RiderState;
	const { activities } = state;
	const before = evaluateState(state, rules, window).balance;

	const writes: D1PreparedStatement[] = [];
	switch (change.kind) {
		case "none":
			break;
		case "upsert": {
			const owners = new Map<number, number>();
			for (const row of (ownerRows?.results ?? []) as {
				strava_activity_id: number;
				athlete_id: number;
			}[]) {
				owners.set(row.strava_activity_id, row.athlete_id);
			}
			for (const record of change.records) {
				// The SQL guard leaves another rider's activity alone; so does this.
				const owner = owners.get(record.strava_activity_id) ?? athleteId;
				if (owner !== athleteId || record.athlete_id !== athleteId) continue;
				activities.set(record.strava_activity_id, record);
				writes.push(upsertActivityStatement(db, record));
			}
			break;
		}
		case "delete":
			for (const id of change.activityIds) {
				if (activities.delete(id)) {
					writes.push(deleteActivityStatement(db, athleteId, id));
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
			break;
		}
	}

	const after = evaluateState(state, rules, window);
	writes.push(...riderWrites(db, athleteId, state, after, rules, now));
	const risen = rose(before, after.balance);
	if (risen) writes.push(riseWrite(db, athleteId, before, after.balance, now));
	if (writes.length > 0) await db.batch(writes);
	return { rose: risen };
}

/** `applyAndEvaluate` under the current rules, for the work handlers. */
export function evaluateChange(
	ctx: Ctx,
	athleteId: number,
	change: ActivityChange,
): Promise<{ rose: boolean }> {
	return applyAndEvaluate(
		ctx.env.DB,
		athleteId,
		change,
		CURRENT_RULES,
		countingWindow(ctx.env, CURRENT_RULES),
		ctx.now(),
	);
}

/**
 * Applies a team-event change and re-evaluates every affected rider, all in
 * one batch (research R21). Refusals throw `TeamEventRefused` before anything
 * is written. `eventId` is set for `create-event` only; `rose` lists the
 * affected riders whose Rynke rose, sorted.
 */
export async function applyTeamEventChange(
	db: D1Database,
	change: TeamEventChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): Promise<{ eventId: number | null; affected: number[]; rose: number[] }> {
	if (change.kind === "create-event") {
		const event = validEvent(change.event);
		const eventId = await insertTeamEventStatement(
			db,
			event,
			change.by ?? null,
			now,
		).first<number>("event_id");
		return { eventId, affected: [], rose: [] };
	}
	const event =
		change.kind === "update-event" ? validEvent(change.event) : null;
	const { eventId } = change;

	const reads = [
		readTeamEventStatement(db, eventId),
		listEventAttendeesStatement(db, eventId),
	];
	if (change.kind === "add-attendance") {
		reads.push(riderStatusesStatement(db, change.athleteIds));
	}
	const [eventRows, attendeeRows, statusRows] = await db.batch(reads);
	if (!eventRows || !attendeeRows) {
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
	const without = (attendance: Attendance[]) =>
		attendance.filter((a) => a.eventId !== eventId);
	switch (change.kind) {
		case "update-event": {
			const next = event as TeamEventFields;
			const counted =
				next.kind !== stored.kind || next.date !== stored.event_date;
			affected = counted ? [...attendees] : [];
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
	affected.sort((a, b) => a - b);

	const writes = statement ? [statement] : [];
	const risen: number[] = [];
	if (affected.length > 0) {
		const { riders } = await readRiders(db, affected, []);
		for (const athleteId of affected) {
			const state = riders.get(athleteId) as RiderState;
			const before = evaluateState(state, rules, window).balance;
			state.attendance = edit(state.attendance);
			const after = evaluateState(state, rules, window);
			writes.push(...riderWrites(db, athleteId, state, after, rules, now));
			if (rose(before, after.balance)) {
				writes.push(riseWrite(db, athleteId, before, after.balance, now));
				risen.push(athleteId);
			}
		}
	}
	if (writes.length > 0) await db.batch(writes);
	return { eventId: null, affected, rose: risen };
}

/**
 * `applyTeamEventChange` under the current rules, for callers outside the
 * serial queue consumer (the organiser pages). One `evaluate-rider` per
 * affected rider then settles a race with an activity event (research R21).
 * Each rider whose Rynke rose gets a notification on their devices.
 */
export async function teamEventChange(
	ctx: Ctx,
	change: TeamEventChange,
): Promise<{ eventId: number | null; affected: number[]; rose: number[] }> {
	const result = await applyTeamEventChange(
		ctx.env.DB,
		change,
		CURRENT_RULES,
		countingWindow(ctx.env, CURRENT_RULES),
		ctx.now(),
	);
	await sendAll(
		ctx,
		result.affected.map((athleteId) => ({ kind: "evaluate-rider", athleteId })),
	);
	await notifyRiders(ctx, result.rose);
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
): Promise<{ athleteId: number; rose: boolean }> {
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
	const before = evaluateState(state, rules, window).balance;
	edit(state);
	const after = evaluateState(state, rules, window);
	const writes = [
		statement,
		...riderWrites(db, athleteId, state, after, rules, now),
	];
	const risen = rose(before, after.balance);
	if (risen) writes.push(riseWrite(db, athleteId, before, after.balance, now));
	await db.batch(writes);
	return { athleteId, rose: risen };
}

/**
 * `applyCorrectionChange` under the current rules, for the organiser pages:
 * one `evaluate-rider` settles a race with an activity event, and a rise
 * notifies the rider, as `teamEventChange` does.
 */
export async function correctionChange(
	ctx: Ctx,
	change: CorrectionChange,
): Promise<{ athleteId: number; rose: boolean }> {
	const result = await applyCorrectionChange(
		ctx.env.DB,
		change,
		CURRENT_RULES,
		countingWindow(ctx.env, CURRENT_RULES),
		ctx.now(),
	);
	await sendAll(ctx, [{ kind: "evaluate-rider", athleteId: result.athleteId }]);
	await notifyRiders(ctx, result.rose ? [result.athleteId] : []);
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
	if (!isTeamEventKind(event.kind)) throw new TeamEventRefused("unknown_kind");
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
		...extra
	] = await db.batch([
		listActivitiesOfRidersStatement(db, athleteIds),
		readRideResultsOfRidersStatement(db, athleteIds),
		readBalancesOfRidersStatement(db, athleteIds),
		listAttendanceOfRidersStatement(db, athleteIds),
		listCorrectionsOfRidersStatement(db, athleteIds),
		...extraReads,
	]);
	if (
		!activityRows ||
		!resultRows ||
		!balanceRows ||
		!attendanceRows ||
		!correctionRows
	) {
		throw new Error("D1 batch returned too few results");
	}
	const riders = new Map<number, RiderState>(
		athleteIds.map((id) => [
			id,
			{
				activities: new Map(),
				results: [],
				balance: null,
				attendance: [],
				corrections: [],
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
		});
	}
	return { riders, extra };
}

/** A full evaluation of the rider's state. */
function evaluateState(
	state: RiderState,
	rules: RynkeRules,
	window: CountingWindow,
): { evaluation: Evaluation; balance: Balance } {
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
	return { evaluation, balance };
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
	{ evaluation, balance }: { evaluation: Evaluation; balance: Balance },
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
