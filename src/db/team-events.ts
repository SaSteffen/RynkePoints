import type { Attendance, TeamEventKind } from "../rynke/team-events";

// Team events and attendance (feature 003 data-model.md, research R17, R21).
// Writes are statements for `applyTeamEventChange`'s batch. Reads for several
// riders are one statement each, filtered with `json_each` over the rider list.

export interface RiderAttendanceRow {
	event_id: number;
	kind: TeamEventKind;
	event_date: string;
	name: string | null;
}

export interface AttendanceOfRidersRow extends RiderAttendanceRow {
	athlete_id: number;
}

export interface TeamEventRow {
	event_id: number;
	kind: TeamEventKind;
	event_date: string;
	name: string | null;
}

/** An event as the write functions take it; `kind` already checked. */
export interface TeamEventFields {
	kind: TeamEventKind;
	date: string;
	name: string | null;
}

export function toAttendance(row: RiderAttendanceRow): Attendance {
	return { eventId: row.event_id, kind: row.kind, date: row.event_date };
}

/** The rider's attendances, newest first (feature 005 FR-033 reads it too). */
export function listRiderAttendanceStatement(
	db: D1Database,
	athleteId: number,
) {
	return db
		.prepare(
			`SELECT a.event_id, e.kind, e.event_date, e.name
			FROM attendances a JOIN team_events e ON e.event_id = a.event_id
			WHERE a.athlete_id = ?1
			ORDER BY e.event_date DESC, a.event_id DESC`,
		)
		.bind(athleteId);
}

export function listAttendanceOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT a.athlete_id, a.event_id, e.kind, e.event_date, e.name
			FROM attendances a JOIN team_events e ON e.event_id = a.event_id
			WHERE a.athlete_id IN (SELECT value FROM json_each(?1))
			ORDER BY a.athlete_id, e.event_date DESC, a.event_id DESC`,
		)
		.bind(JSON.stringify(athleteIds));
}

export function readTeamEventStatement(db: D1Database, eventId: number) {
	return db
		.prepare(
			"SELECT event_id, kind, event_date, name FROM team_events WHERE event_id = ?",
		)
		.bind(eventId);
}

/** `athlete_id` of every attendee, ascending. */
export function listEventAttendeesStatement(db: D1Database, eventId: number) {
	return db
		.prepare(
			"SELECT athlete_id FROM attendances WHERE event_id = ? ORDER BY athlete_id",
		)
		.bind(eventId);
}

/** `athlete_id, status` of those of `athleteIds` that are stored. */
export function riderStatusesStatement(db: D1Database, athleteIds: number[]) {
	return db
		.prepare(
			`SELECT athlete_id, status FROM riders
			WHERE athlete_id IN (SELECT value FROM json_each(?1))`,
		)
		.bind(JSON.stringify(athleteIds));
}

export function insertTeamEventStatement(
	db: D1Database,
	event: TeamEventFields,
) {
	return db
		.prepare(
			`INSERT INTO team_events (kind, event_date, name) VALUES (?, ?, ?)
			RETURNING event_id`,
		)
		.bind(event.kind, event.date, event.name);
}

export function updateTeamEventStatement(
	db: D1Database,
	eventId: number,
	event: TeamEventFields,
) {
	return db
		.prepare(
			"UPDATE team_events SET kind = ?, event_date = ?, name = ? WHERE event_id = ?",
		)
		.bind(event.kind, event.date, event.name, eventId);
}

/** The event's attendances go by cascade. */
export function deleteTeamEventStatement(db: D1Database, eventId: number) {
	return db.prepare("DELETE FROM team_events WHERE event_id = ?").bind(eventId);
}

/** Recording a rider twice changes nothing (Story 3 scenario 4). */
export function insertAttendancesStatement(
	db: D1Database,
	eventId: number,
	athleteIds: number[],
) {
	return db
		.prepare(
			`INSERT INTO attendances (event_id, athlete_id)
			SELECT ?1, value FROM json_each(?2) WHERE true
			ON CONFLICT DO NOTHING`,
		)
		.bind(eventId, JSON.stringify(athleteIds));
}

export function deleteAttendancesStatement(
	db: D1Database,
	eventId: number,
	athleteIds: number[],
) {
	return db
		.prepare(
			`DELETE FROM attendances WHERE event_id = ?1
			AND athlete_id IN (SELECT value FROM json_each(?2))`,
		)
		.bind(eventId, JSON.stringify(athleteIds));
}
