import type { TeamBadgeSums } from "../badges/team";
import { berlinDate } from "../config";
import type { RideRider } from "../rynke/ride-figures";
import {
	attendedEvents,
	type BadgeRider,
	parseActive,
	parseAttended,
	parseDays,
	parseRides,
	parseRunDays,
	parseWeeks,
	type RideEntry,
	type StoredEvents,
	teamBadgeSumsOf,
} from "../rynke/summary";
import type { EventKind } from "../rynke/team-events";
import type { DatedCorrection, RiderInputs } from "../rynke/weeks";
import { SINCE_VERSION } from "../visibility";
import { sharedRiderExists } from "./consents";
import { LISTED_RIDER_IDS, listedRiderFilter } from "./organiser";
import {
	type AddedUpDays,
	type AddedUpWeeks,
	RIDE_SUMMARY_JOIN,
	readDaysAddedUp,
	readRidesAddedUp,
	readWeeksAddedUp,
	TEAM_SUMMARY_JOIN,
} from "./rider-summaries";
import { type BalanceRow, type StoredBalance, toStoredBalance } from "./rynke";

// The reads behind the Team page, the organiser overview and the team badges
// (feature 030 contracts/summary-reads.md): one row per listed rider from
// `rider_summaries`, so a page reads no rides. The listed-rider check stays
// inside each statement (004 FR-021), and team results are worked out on each
// read, never stored, so a rider leaving the list leaves the figures at once
// (FR-009). A rider without a current row is added up in a second round trip,
// which only happens when one exists (research R4). Nothing is written or
// evaluated here.

/** A listed rider with everything both pages need. */
export interface TeamRider extends RiderInputs {
	athleteId: number;
	firstName: string;
	balance: StoredBalance | null;
}

/**
 * A rider's corrections as JSON, `[[training, team, date], ...]`, oldest first,
 * for a query from `riders r`. The inner select fixes their order; they stay out
 * of the summary, as few rows that are always current (research R8).
 */
const CORRECTIONS_OF_RIDER = `(
	SELECT json_group_array(json_array(training, team, correction_date))
	FROM (
		SELECT training, team, correction_date FROM corrections k
		WHERE k.athlete_id = r.athlete_id
		ORDER BY correction_date, correction_id
	)
)`;

function parseCorrections(text: string): DatedCorrection[] {
	return (JSON.parse(text) as [number, number, string][]).map(
		([training, team, date]) => ({ date, training, team }),
	);
}

/** Every team event: only the listed attendees' IDs say who was there. */
function teamEventsStatement(db: D1Database) {
	return db.prepare("SELECT event_id, kind, event_date FROM team_events");
}

function toEvents(result: D1Result): StoredEvents {
	return new Map(
		(
			result.results as {
				event_id: number;
				kind: EventKind;
				event_date: string;
			}[]
		).map((row) => [row.event_id, { kind: row.kind, date: row.event_date }]),
	);
}

/** One row per listed rider; `b.*` is all nulls without a balance. */
type TeamRiderRow = BalanceRow & {
	rider_id: number;
	first_name: string;
	/** Null without a current summary. */
	weeks: string | null;
	attended: string | null;
	corrections: string;
};

/**
 * Listed riders by first name, each with their stored rows. FR-008: this reads
 * weekly sums only, never a rider's daily figures. `athlete_id` from `b.*` is
 * null without a balance, so the rider's own comes as `rider_id`.
 */
export async function readTeam(db: D1Database): Promise<TeamRider[]> {
	return (await readTeamWith(db, false)).team;
}

/**
 * `readTeam` and the ride figures' riders in the same batch (feature 032):
 * no round trip more, unless a rider has no row with rides yet.
 */
export async function readTeamAndRides(
	db: D1Database,
): Promise<{ team: TeamRider[]; rides: RideRider[] }> {
	return readTeamWith(db, true) as Promise<{
		team: TeamRider[];
		rides: RideRider[];
	}>;
}

/**
 * The riders of the ride figures (feature 032 research R4): the listed riders
 * whose consent reaches `since`, checked inside SQL, so a rider below it is in
 * no row, total, median or bar (FR-020). Their stored rides, or null without a
 * row that holds them. `since` comes from `SINCE_VERSION`, never request input.
 */
export function rideRidersStatement(db: D1Database, since: number) {
	return db.prepare(
		`SELECT r.athlete_id, rs.rides
		FROM riders r
		${RIDE_SUMMARY_JOIN}
		WHERE ${listedRiderFilter("r")}
			AND ${sharedRiderExists("r", since)}
		ORDER BY r.athlete_id`,
	);
}

/** The rows of `rideRidersStatement`, adding up riders without stored rides. */
export async function toRideRiders(
	db: D1Database,
	result: D1Result,
	since: number,
): Promise<RideRider[]> {
	const rows = result.results as { athlete_id: number; rides: string | null }[];
	const missing = rows.filter((r) => r.rides === null).map((r) => r.athlete_id);
	const addedUp =
		missing.length > 0
			? await readRidesAddedUp(db, missing, since)
			: new Map<number, RideEntry[]>();
	return rows.map((row) => ({
		athleteId: row.athlete_id,
		rides: addedUp.get(row.athlete_id) ?? parseRides(row.rides ?? "[]"),
	}));
}

const teamRidesStatement = (db: D1Database) =>
	rideRidersStatement(db, SINCE_VERSION.rideFigures);
const toTeamRides = (db: D1Database, result: D1Result) =>
	toRideRiders(db, result, SINCE_VERSION.rideFigures);

/** The ride figures' riders alone, for a team without Rynke views. */
export async function readTeamRides(db: D1Database): Promise<RideRider[]> {
	return toTeamRides(db, await teamRidesStatement(db).all());
}

async function readTeamWith(
	db: D1Database,
	withRides: boolean,
): Promise<{ team: TeamRider[]; rides: RideRider[] | null }> {
	const [riderRows, eventRows, rideRows] = await db.batch([
		db.prepare(
			`SELECT b.*, r.athlete_id AS rider_id, r.first_name, s.weeks, s.attended,
				${CORRECTIONS_OF_RIDER} AS corrections
			FROM riders r
			LEFT JOIN rynke_balances b ON b.athlete_id = r.athlete_id
			${TEAM_SUMMARY_JOIN}
			WHERE ${listedRiderFilter("r")}
			ORDER BY r.first_name COLLATE NOCASE, r.athlete_id`,
		),
		teamEventsStatement(db),
		...(withRides ? [teamRidesStatement(db)] : []),
	]);
	if (!riderRows || !eventRows || (withRides && !rideRows)) {
		throw new Error("D1 batch returned too few results");
	}
	const rows = riderRows.results as TeamRiderRow[];
	const events = toEvents(eventRows);
	const missing = rows.filter((r) => r.weeks === null).map((r) => r.rider_id);
	const [addedUp, rides] = await Promise.all([
		missing.length > 0
			? readWeeksAddedUp(db, missing)
			: new Map<number, AddedUpWeeks>(),
		rideRows ? toTeamRides(db, rideRows) : null,
	]);
	const team = rows.map((row) => {
		const own = addedUp.get(row.rider_id);
		return {
			athleteId: row.rider_id,
			firstName: row.first_name,
			balance: row.athlete_id === null ? null : toStoredBalance(row),
			rides: (own?.weeks ?? parseWeeks(row.weeks ?? "[]")).map(
				([weekEnd, distanceRynke, elevationDm]) => ({
					weekEnd,
					distanceRynke,
					elevationDm,
				}),
			),
			attendance: attendedEvents(
				own?.attended ?? parseAttended(row.attended ?? "[]"),
				events,
			),
			corrections: parseCorrections(row.corrections),
		};
	});
	return { team, rides };
}

/** One row per listed rider; the summary's columns are null without one. */
interface BadgeRiderRow {
	athlete_id: number;
	connected_at: number;
	days: string | null;
	run_days: string | null;
	active: string | null;
	attended: string | null;
	corrections: string;
}

/**
 * What the team badges need (feature 013 research R15), over the listed riders
 * only: per rider their daily figures, activity times, attendance and
 * corrections, which `teamBadgeSumsOf` adds up. Riders leave the sums once
 * they're no longer listed (US4 scenario 4). Rider ids only tell riders apart
 * for the team surprises and the tour days; `evaluateTeamBadges` never passes
 * them on.
 */
export async function readTeamBadgeSums(
	db: D1Database,
): Promise<TeamBadgeSums> {
	return toTeamBadgeSums(db, await db.batch(teamBadgeSumsStatements(db)));
}

/**
 * The statements of `readTeamBadgeSums`, for a caller's batch that needs the
 * team badges next to its own reads (issue #185).
 */
export function teamBadgeSumsStatements(db: D1Database): D1PreparedStatement[] {
	return [
		db.prepare(
			`SELECT r.athlete_id, r.connected_at, s.days, s.run_days, s.active,
				s.attended, ${CORRECTIONS_OF_RIDER} AS corrections
			FROM riders r
			${TEAM_SUMMARY_JOIN}
			WHERE ${listedRiderFilter("r")}
			ORDER BY r.athlete_id`,
		),
		teamEventsStatement(db),
	];
}

/**
 * The results of `teamBadgeSumsStatements`, in their order, plus a second round
 * trip for riders without a current summary (research R4).
 */
export async function toTeamBadgeSums(
	db: D1Database,
	results: readonly (D1Result | undefined)[],
): Promise<TeamBadgeSums> {
	const [riderRows, eventRows] = results;
	if (!riderRows || !eventRows) {
		throw new Error("D1 batch returned too few results");
	}
	const rows = riderRows.results as BadgeRiderRow[];
	const missing = rows.filter((r) => r.days === null).map((r) => r.athlete_id);
	const addedUp =
		missing.length > 0
			? await readDaysAddedUp(db, missing)
			: new Map<number, AddedUpDays>();
	const riders = rows.map((row): BadgeRider => {
		const own = addedUp.get(row.athlete_id);
		return {
			athleteId: row.athlete_id,
			connectedOn: berlinDate(row.connected_at),
			days: own?.days ?? parseDays(row.days ?? "[]"),
			runDays: own?.runDays ?? parseRunDays(row.run_days ?? "[]"),
			active: own?.active ?? parseActive(row.active ?? "[]"),
			attended: own?.attended ?? parseAttended(row.attended ?? "[]"),
			corrections: parseCorrections(row.corrections),
		};
	});
	return teamBadgeSumsOf(riders, toEvents(eventRows));
}

/** The listed riders' balances, for the season album. */
export function listTeamBalancesStatement(db: D1Database) {
	return db.prepare(
		`SELECT * FROM rynke_balances WHERE athlete_id IN (${LISTED_RIDER_IDS})`,
	);
}
