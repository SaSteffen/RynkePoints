import type { ReasonCode, RideResult, UnknownFigureCode } from "../rynke/rides";
import type { CountingWindow } from "../rynke/rules";
import type { Balance } from "../rynke/tally";
import type { TeamEventSum } from "../rynke/team-events";

// Stored ride results and balances (feature 003 data-model.md, research R10,
// R13, R14). Writes are statements for `applyAndEvaluate`'s batch; the reads
// never evaluate.

export interface StoredRideResult extends RideResult {
	rulesVersion: number;
}

export interface StoredBalance extends Balance {
	/** Epoch seconds of the last write that changed the row. */
	computedAt: number;
}

export interface RideResultRow {
	strava_activity_id: number;
	athlete_id: number;
	counts: 0 | 1;
	reasons: string;
	overlaps_activity_id: number | null;
	distance_rynke: number;
	elevation_dm: number;
	is_virtual: 0 | 1;
	unknown_figures: string;
	rules_version: number;
	activity_refreshed_at: number;
}

export interface BalanceRow {
	athlete_id: number;
	distance_rynke: number;
	elevation_dm: number;
	elevation_rynke: number;
	elevation_to_next_step_dm: number;
	training_rynke: number;
	team_rynke: number;
	training_missing: number;
	team_missing: number;
	training_without_virtual: number;
	virtual_share_missing: number;
	qualified: 0 | 1;
	rules_version: number;
	rules_effective_date: string;
	computed_at: number;
	/** JSON array of `TeamEventSum`; `'[]'` on rows from before Story 3. */
	team_event_breakdown: string;
}

export function toStoredRideResult(row: RideResultRow): StoredRideResult {
	return {
		activityId: row.strava_activity_id,
		counts: row.counts === 1,
		reasons: JSON.parse(row.reasons) as ReasonCode[],
		overlapsActivityId: row.overlaps_activity_id,
		distanceRynke: row.distance_rynke,
		elevationDm: row.elevation_dm,
		isVirtual: row.is_virtual === 1,
		unknownFigures: JSON.parse(row.unknown_figures) as UnknownFigureCode[],
		activityRefreshedAt: row.activity_refreshed_at,
		rulesVersion: row.rules_version,
	};
}

export function toStoredBalance(row: BalanceRow): StoredBalance {
	return {
		distanceRynke: row.distance_rynke,
		elevationDm: row.elevation_dm,
		elevationRynke: row.elevation_rynke,
		elevationToNextStepDm: row.elevation_to_next_step_dm,
		trainingRynke: row.training_rynke,
		teamRynke: row.team_rynke,
		trainingMissing: row.training_missing,
		teamMissing: row.team_missing,
		trainingWithoutVirtual: row.training_without_virtual,
		virtualShareMissing: row.virtual_share_missing,
		qualified: row.qualified === 1,
		rulesVersion: row.rules_version,
		rulesEffectiveDate: row.rules_effective_date,
		teamEvents: JSON.parse(row.team_event_breakdown) as TeamEventSum[],
		computedAt: row.computed_at,
	};
}

export function readRideResultsStatement(db: D1Database, athleteId: number) {
	return db
		.prepare(
			`SELECT * FROM ride_results WHERE athlete_id = ?
			ORDER BY strava_activity_id`,
		)
		.bind(athleteId);
}

export function readBalanceStatement(db: D1Database, athleteId: number) {
	return db
		.prepare("SELECT * FROM rynke_balances WHERE athlete_id = ?")
		.bind(athleteId);
}

/** The ride results of every rider in `athleteIds`, for one batch (R21). */
export function readRideResultsOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT * FROM ride_results
			WHERE athlete_id IN (SELECT value FROM json_each(?1))
			ORDER BY athlete_id, strava_activity_id`,
		)
		.bind(JSON.stringify(athleteIds));
}

export function readBalancesOfRidersStatement(
	db: D1Database,
	athleteIds: number[],
) {
	return db
		.prepare(
			`SELECT * FROM rynke_balances
			WHERE athlete_id IN (SELECT value FROM json_each(?1))`,
		)
		.bind(JSON.stringify(athleteIds));
}

/** Maps the results of the two read statements above. */
export function storedRynke(
	results: D1Result<unknown>,
	balance: D1Result<unknown>,
): { balance: StoredBalance | null; results: StoredRideResult[] } {
	const balanceRow = (balance.results as BalanceRow[])[0];
	return {
		balance: balanceRow ? toStoredBalance(balanceRow) : null,
		results: (results.results as RideResultRow[]).map(toStoredRideResult),
	};
}

/**
 * Inserts or replaces `results` with one statement: all rows travel as one
 * JSON parameter, clear of D1's bound-parameter limit (research R13).
 */
export function upsertRideResultsStatement(
	db: D1Database,
	athleteId: number,
	results: StoredRideResult[],
) {
	const rows = results.map((r) => ({
		id: r.activityId,
		counts: r.counts ? 1 : 0,
		reasons: r.reasons,
		overlaps: r.overlapsActivityId,
		distance: r.distanceRynke,
		elevation: r.elevationDm,
		virtual: r.isVirtual ? 1 : 0,
		unknown: r.unknownFigures,
		version: r.rulesVersion,
		refreshed: r.activityRefreshedAt,
	}));
	return db
		.prepare(
			`INSERT INTO ride_results (strava_activity_id, athlete_id, counts, reasons,
				overlaps_activity_id, distance_rynke, elevation_dm, is_virtual,
				unknown_figures, rules_version, activity_refreshed_at)
			SELECT json_extract(value, '$.id'), ?2, json_extract(value, '$.counts'),
				json_extract(value, '$.reasons'), json_extract(value, '$.overlaps'),
				json_extract(value, '$.distance'), json_extract(value, '$.elevation'),
				json_extract(value, '$.virtual'), json_extract(value, '$.unknown'),
				json_extract(value, '$.version'), json_extract(value, '$.refreshed')
			FROM json_each(?1) WHERE true
			ON CONFLICT (strava_activity_id) DO UPDATE SET
				counts = excluded.counts, reasons = excluded.reasons,
				overlaps_activity_id = excluded.overlaps_activity_id,
				distance_rynke = excluded.distance_rynke,
				elevation_dm = excluded.elevation_dm, is_virtual = excluded.is_virtual,
				unknown_figures = excluded.unknown_figures,
				rules_version = excluded.rules_version,
				activity_refreshed_at = excluded.activity_refreshed_at
			WHERE ride_results.athlete_id = excluded.athlete_id`,
		)
		.bind(JSON.stringify(rows), athleteId);
}

export function deleteRideResultsStatement(
	db: D1Database,
	athleteId: number,
	activityIds: number[],
) {
	return db
		.prepare(
			`DELETE FROM ride_results WHERE athlete_id = ?2
			AND strava_activity_id IN (SELECT value FROM json_each(?1))`,
		)
		.bind(JSON.stringify(activityIds), athleteId);
}

export function upsertBalanceStatement(
	db: D1Database,
	athleteId: number,
	b: Balance,
	now: number,
) {
	return db
		.prepare(
			`INSERT INTO rynke_balances (athlete_id, distance_rynke, elevation_dm,
				elevation_rynke, elevation_to_next_step_dm, training_rynke, team_rynke,
				training_missing, team_missing, training_without_virtual,
				virtual_share_missing, qualified, rules_version, rules_effective_date,
				computed_at, team_event_breakdown)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
				?16)
			ON CONFLICT (athlete_id) DO UPDATE SET
				distance_rynke = ?2, elevation_dm = ?3, elevation_rynke = ?4,
				elevation_to_next_step_dm = ?5, training_rynke = ?6, team_rynke = ?7,
				training_missing = ?8, team_missing = ?9, training_without_virtual = ?10,
				virtual_share_missing = ?11, qualified = ?12, rules_version = ?13,
				rules_effective_date = ?14, computed_at = ?15,
				team_event_breakdown = ?16`,
		)
		.bind(
			athleteId,
			b.distanceRynke,
			b.elevationDm,
			b.elevationRynke,
			b.elevationToNextStepDm,
			b.trainingRynke,
			b.teamRynke,
			b.trainingMissing,
			b.teamMissing,
			b.trainingWithoutVirtual,
			b.virtualShareMissing,
			b.qualified ? 1 : 0,
			b.rulesVersion,
			b.rulesEffectiveDate,
			now,
			JSON.stringify(b.teamEvents),
		);
}

/**
 * The rider's balance and ride results from one snapshot (FR-014b); `balance`
 * is `null` before their first evaluation.
 */
export async function readRynke(
	db: D1Database,
	athleteId: number,
): Promise<{ balance: StoredBalance | null; results: StoredRideResult[] }> {
	const [results, balance] = await db.batch([
		readRideResultsStatement(db, athleteId),
		readBalanceStatement(db, athleteId),
	]);
	if (!results || !balance)
		throw new Error("D1 batch returned too few results");
	return storedRynke(results, balance);
}

/**
 * Connected riders whose stored Rynke are missing or stale (research R14,
 * R22): no balance, a row from another rules version, an activity without a
 * result computed from its current figures, or attendance inside `window`
 * whose count per kind differs from the stored breakdown (`EXCEPT` both ways).
 * A renamed event, or attendance moved to another event of the same kind,
 * changes no count and lists no one.
 */
export async function listRidersNeedingEvaluation(
	db: D1Database,
	rulesVersion: number,
	window: CountingWindow,
): Promise<number[]> {
	const attended = `SELECT e.kind, count(*) FROM attendances a
		JOIN team_events e ON e.event_id = a.event_id
		WHERE a.athlete_id = r.athlete_id AND e.event_date >= ?2
			AND e.event_date <= ?3
		GROUP BY e.kind`;
	const stored = `SELECT json_extract(value, '$.kind'),
			json_extract(value, '$.attended')
		FROM rynke_balances b, json_each(b.team_event_breakdown)
		WHERE b.athlete_id = r.athlete_id AND json_extract(value, '$.attended') > 0`;
	const { results } = await db
		.prepare(
			`SELECT athlete_id FROM riders r WHERE status = 'connected' AND (
				NOT EXISTS (SELECT 1 FROM rynke_balances b
					WHERE b.athlete_id = r.athlete_id AND b.rules_version = ?1)
				OR EXISTS (SELECT 1 FROM ride_results x
					WHERE x.athlete_id = r.athlete_id AND x.rules_version <> ?1)
				OR EXISTS (SELECT 1 FROM activities a
					LEFT JOIN ride_results x ON x.strava_activity_id = a.strava_activity_id
					WHERE a.athlete_id = r.athlete_id AND (x.strava_activity_id IS NULL
						OR x.activity_refreshed_at <> a.refreshed_at))
				OR EXISTS (${attended} EXCEPT ${stored})
				OR EXISTS (${stored} EXCEPT ${attended})
			)
			ORDER BY athlete_id`,
		)
		.bind(rulesVersion, window.seasonStart, window.deadline)
		.all<{ athlete_id: number }>();
	return results.map((r) => r.athlete_id);
}

/** The rider's last rise (issue #45); replaces the one before. */
export function upsertRiseStatement(
	db: D1Database,
	athleteId: number,
	rise: { training: number; team: number },
	now: number,
) {
	return db
		.prepare(
			`INSERT INTO rynke_rises (athlete_id, training_rynke, team_rynke, risen_at)
			VALUES (?1, ?2, ?3, ?4)
			ON CONFLICT (athlete_id) DO UPDATE SET
				training_rynke = ?2, team_rynke = ?3, risen_at = ?4`,
		)
		.bind(athleteId, rise.training, rise.team, now);
}

export function readRiseStatement(db: D1Database, athleteId: number) {
	return db
		.prepare(
			"SELECT training_rynke, team_rynke FROM rynke_rises WHERE athlete_id = ?",
		)
		.bind(athleteId);
}
