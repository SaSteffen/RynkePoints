import type { CountingWindow } from "../rynke/rules";
import type { TeamEventKind } from "../rynke/team-events";
import { LISTED_RIDER_IDS } from "./organiser";

// Participation reports (feature 019 data-model.md, research R1, R7). A report
// is an intent before its event's date and a request from it on; nothing here
// stores which. Every read is limited to 014's listed riders (004 FR-021) and
// to events in the counting window, and ignores a report next to an
// attendance, which `add-attendance` deletes anyway (research R3).

/** `?1` today, `?2` season start, `?3` deadline. */
function window(column: string): string {
	return `${column} >= ?2 AND ${column} <= ?3`;
}

/** Reports of listed riders without attendance; `p` is the report. */
const COUNTED = `p.athlete_id IN (${LISTED_RIDER_IDS})
	AND NOT EXISTS (SELECT 1 FROM attendances a
		WHERE a.event_id = p.event_id AND a.athlete_id = p.athlete_id)`;

/** Open requests: events dated on or before today (research R7). */
const OPEN_REQUEST = `e.event_date <= ?1 AND ${window("e.event_date")} AND ${COUNTED}`;

export interface OpenRequestRow {
	event_id: number;
	kind: TeamEventKind;
	event_date: string;
	name: string | null;
	athlete_id: number;
	first_name: string;
	reported_at: number;
}

export interface IntentCountRow {
	event_id: number;
	intents: number;
}

export interface RiderEventRow {
	event_id: number;
	kind: TeamEventKind;
	event_date: string;
	name: string | null;
	/** 0 or 1 */
	attended: number;
	/** 0 or 1 */
	reported: number;
}

function bindWindow(
	statement: D1PreparedStatement,
	today: string,
	w: CountingWindow,
	...more: unknown[]
): D1PreparedStatement {
	return statement.bind(today, w.seasonStart, w.deadline, ...more);
}

/** The number of open requests, for the organisers' navigation (FR-030). */
export function openRequestCountStatement(
	db: D1Database,
	today: string,
	w: CountingWindow,
) {
	return bindWindow(
		db.prepare(
			`SELECT COUNT(*) AS n FROM participation_reports p
			JOIN team_events e ON e.event_id = p.event_id
			WHERE ${OPEN_REQUEST}`,
		),
		today,
		w,
	);
}

/**
 * Every open request with its event and the rider's first name, newest event
 * first, then by first name (FR-031, FR-034).
 */
export function listOpenRequestsStatement(
	db: D1Database,
	today: string,
	w: CountingWindow,
) {
	return bindWindow(
		db.prepare(
			`SELECT p.event_id, e.kind, e.event_date, e.name, p.athlete_id,
				r.first_name, p.reported_at
			FROM participation_reports p
			JOIN team_events e ON e.event_id = p.event_id
			JOIN riders r ON r.athlete_id = p.athlete_id
			WHERE ${OPEN_REQUEST}
			ORDER BY e.event_date DESC, e.event_id DESC,
				r.first_name COLLATE NOCASE, p.athlete_id`,
		),
		today,
		w,
	);
}

/** Intents per event still to come (FR-033). */
export function countIntentsStatement(
	db: D1Database,
	today: string,
	w: CountingWindow,
) {
	return bindWindow(
		db.prepare(
			`SELECT p.event_id, COUNT(*) AS intents FROM participation_reports p
			JOIN team_events e ON e.event_id = p.event_id
			WHERE e.event_date > ?1 AND ${window("e.event_date")} AND ${COUNTED}
			GROUP BY p.event_id`,
		),
		today,
		w,
	);
}

/** `athlete_id` and `reported_at` of the counted reports at one event (FR-040). */
export function listEventReportsStatement(db: D1Database, eventId: number) {
	return db
		.prepare(
			`SELECT p.athlete_id, p.reported_at FROM participation_reports p
			WHERE p.event_id = ? AND ${COUNTED}
			ORDER BY p.athlete_id`,
		)
		.bind(eventId);
}

/**
 * The counting window's events, oldest first, with whether `athleteId`
 * attended and reported each (FR-001–FR-006).
 */
export function listRiderEventsStatement(
	db: D1Database,
	athleteId: number,
	w: CountingWindow,
) {
	return db
		.prepare(
			`SELECT e.event_id, e.kind, e.event_date, e.name,
				EXISTS (SELECT 1 FROM attendances a
					WHERE a.event_id = e.event_id AND a.athlete_id = ?1) AS attended,
				EXISTS (SELECT 1 FROM participation_reports p
					WHERE p.event_id = e.event_id AND p.athlete_id = ?1) AS reported
			FROM team_events e
			WHERE e.event_date >= ?2 AND e.event_date <= ?3
			ORDER BY e.event_date, e.event_id`,
		)
		.bind(athleteId, w.seasonStart, w.deadline);
}

/** Whether `athleteId` is a listed rider (004 FR-021): one row with `n` 0 or 1. */
export function isListedStatement(db: D1Database, athleteId: number) {
	return db.prepare(`SELECT ? IN (${LISTED_RIDER_IDS}) AS n`).bind(athleteId);
}

/** Whether `athleteId` attended `eventId`: one row with `n` 0 or 1. */
export function attendedStatement(
	db: D1Database,
	eventId: number,
	athleteId: number,
) {
	return db
		.prepare(
			`SELECT EXISTS (SELECT 1 FROM attendances
				WHERE event_id = ? AND athlete_id = ?) AS n`,
		)
		.bind(eventId, athleteId);
}

/** Stores a report; an existing one stays as it is. `at` in Unix seconds. */
export function insertReportStatement(
	db: D1Database,
	eventId: number,
	athleteId: number,
	at: number,
) {
	return db
		.prepare(
			`INSERT OR IGNORE INTO participation_reports (event_id, athlete_id, reported_at)
			VALUES (?, ?, ?)`,
		)
		.bind(eventId, athleteId, at);
}

/** Deletes the reports of `athleteIds` at `eventId` (research R3, FR-023). */
export function deleteReportsStatement(
	db: D1Database,
	eventId: number,
	athleteIds: readonly number[],
) {
	return db
		.prepare(
			`DELETE FROM participation_reports
			WHERE event_id = ?1 AND athlete_id IN (SELECT value FROM json_each(?2))`,
		)
		.bind(eventId, JSON.stringify(athleteIds));
}
