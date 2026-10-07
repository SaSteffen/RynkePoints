// Applies a change to a rider's activities, or to team events and attendance,
// and stores the result of a full evaluation of every affected rider in the
// same D1 batch, so a reader never sees an input, its ride results and the
// balance disagree (research R11, R21, FR-014b). Both kinds of change share
// one read (`readRiders`) and one evaluate-and-diff (`riderWrites`); only rows
// that changed are written (research R13).

import type { Ctx } from "../ctx";
import {
	activityOwnersStatement,
	deleteActivityStatement,
	deletePrivateActivitiesStatement,
	listActivitiesOfRidersStatement,
	upsertActivityStatement,
} from "../db/activities";
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
import { evaluateRides, rideFromRow } from "./rides";
import {
	type CountingWindow,
	CURRENT_RULES,
	countingWindow,
	isCalendarDate,
	type RynkeRules,
} from "./rules";
import { type Balance, extrasFromAttendance, tally } from "./tally";
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

export type TeamEventChange =
	| { kind: "create-event"; event: TeamEventInput }
	| { kind: "update-event"; eventId: number; event: TeamEventInput }
	| { kind: "delete-event"; eventId: number }
	| { kind: "add-attendance"; eventId: number; athleteIds: number[] }
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

/** What a full evaluation of one rider needs, as stored. */
interface RiderState {
	activities: Map<number, ActivityRow>;
	results: StoredRideResult[];
	balance: StoredBalance | null;
	attendance: Attendance[];
}

export async function applyAndEvaluate(
	db: D1Database,
	athleteId: number,
	change: ActivityChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): Promise<void> {
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

	writes.push(...riderWrites(db, athleteId, state, rules, window, now));
	if (writes.length > 0) await db.batch(writes);
}

/** `applyAndEvaluate` under the current rules, for the work handlers. */
export function evaluateChange(
	ctx: Ctx,
	athleteId: number,
	change: ActivityChange,
): Promise<void> {
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
 * is written. `eventId` is set for `create-event` only.
 */
export async function applyTeamEventChange(
	db: D1Database,
	change: TeamEventChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): Promise<{ eventId: number | null; affected: number[] }> {
	if (change.kind === "create-event") {
		const event = validEvent(change.event);
		const eventId = await insertTeamEventStatement(db, event).first<number>(
			"event_id",
		);
		return { eventId, affected: [] };
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
					? updateTeamEventStatement(db, eventId, next)
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
					? insertAttendancesStatement(db, eventId, affected)
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
	if (affected.length > 0) {
		const { riders } = await readRiders(db, affected, []);
		for (const athleteId of affected) {
			const state = riders.get(athleteId) as RiderState;
			state.attendance = edit(state.attendance);
			writes.push(...riderWrites(db, athleteId, state, rules, window, now));
		}
	}
	if (writes.length > 0) await db.batch(writes);
	return { eventId: null, affected };
}

/**
 * `applyTeamEventChange` under the current rules, for callers outside the
 * serial queue consumer (the organiser pages). One `evaluate-rider` per
 * affected rider then settles a race with an activity event (research R21).
 */
export async function teamEventChange(
	ctx: Ctx,
	change: TeamEventChange,
): Promise<{ eventId: number | null; affected: number[] }> {
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
	return result;
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
	const [activityRows, resultRows, balanceRows, attendanceRows, ...extra] =
		await db.batch([
			listActivitiesOfRidersStatement(db, athleteIds),
			readRideResultsOfRidersStatement(db, athleteIds),
			readBalancesOfRidersStatement(db, athleteIds),
			listAttendanceOfRidersStatement(db, athleteIds),
			...extraReads,
		]);
	if (!activityRows || !resultRows || !balanceRows || !attendanceRows) {
		throw new Error("D1 batch returned too few results");
	}
	const riders = new Map<number, RiderState>(
		athleteIds.map((id) => [
			id,
			{ activities: new Map(), results: [], balance: null, attendance: [] },
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
	return { riders, extra };
}

/** Evaluates the rider and returns the writes of what changed. */
function riderWrites(
	db: D1Database,
	athleteId: number,
	state: RiderState,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
): D1PreparedStatement[] {
	const evaluation = evaluateRides(
		[...state.activities.values()].map(rideFromRow),
		rules,
		window,
	);
	const balance = tally(
		evaluation.riding,
		extrasFromAttendance(evaluateAttendance(state.attendance, rules, window)),
		rules,
	);

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
