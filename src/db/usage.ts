import { teamId } from "../config";
import {
	CLOUDFLARE_ALLOWANCES,
	type CloudflareAllowance,
	type RecordedAllowance,
} from "../usage/allowances";

// The daily usage records and the sources' state (feature 025 data-model.md).
// They hold no rider identifiers and have no relation to `riders` (FR-017).

export interface UsageRecord {
	day: string;
	allowance: RecordedAllowance;
	used: number;
	limit: number;
	teamUsed: number | null;
	peak15m: number | null;
	recordedAt: number;
}

interface UsageRow {
	day: string;
	allowance: RecordedAllowance;
	used: number;
	limit_value: number;
	team_used: number | null;
	peak_15m: number | null;
	recorded_at: number;
}

function toRecord(row: UsageRow): UsageRecord {
	return {
		day: row.day,
		allowance: row.allowance,
		used: row.used,
		limit: row.limit_value,
		teamUsed: row.team_used,
		peak15m: row.peak_15m,
		recordedAt: row.recorded_at,
	};
}

/** Today's value: an upsert by day and allowance, so a repeat can't double-count. */
export function upsertUsageStatement(
	db: D1Database,
	env: Pick<Env, "TEAM_ID">,
	record: UsageRecord,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO usage_daily (day, allowance, team, used, limit_value,
				team_used, peak_15m, recorded_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT (day, allowance) DO UPDATE SET team = excluded.team,
				used = excluded.used, limit_value = excluded.limit_value,
				team_used = excluded.team_used, peak_15m = excluded.peak_15m,
				recorded_at = excluded.recorded_at`,
		)
		.bind(
			record.day,
			record.allowance,
			teamId(env),
			record.used,
			record.limit,
			record.teamUsed,
			record.peak15m,
			record.recordedAt,
		);
}

/**
 * A past day's value as Cloudflare now reports it. An existing record keeps the
 * limit it was recorded with (spec edge case).
 */
export function correctPastUsageStatement(
	db: D1Database,
	env: Pick<Env, "TEAM_ID">,
	record: UsageRecord,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO usage_daily (day, allowance, team, used, limit_value,
				team_used, peak_15m, recorded_at)
			VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)
			ON CONFLICT (day, allowance) DO UPDATE SET used = excluded.used,
				recorded_at = excluded.recorded_at`,
		)
		.bind(
			record.day,
			record.allowance,
			teamId(env),
			record.used,
			record.limit,
			record.recordedAt,
		);
}

export function sourceSuccessStatement(
	db: D1Database,
	now: number,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO usage_source_state (source, last_success_at)
			VALUES ('cloudflare', ?1)
			ON CONFLICT (source) DO UPDATE SET last_success_at = ?1`,
		)
		.bind(now);
}

export function sourceFailureStatement(
	db: D1Database,
	now: number,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT INTO usage_source_state (source, last_failure_at)
			VALUES ('cloudflare', ?1)
			ON CONFLICT (source) DO UPDATE SET last_failure_at = ?1`,
		)
		.bind(now);
}

/**
 * What the view shows of Cloudflare: each allowance's latest record, and whether
 * the source's last attempt failed or never happened (FR-011).
 */
export async function readCloudflareFigures(db: D1Database): Promise<{
	latest: Map<CloudflareAllowance, UsageRecord>;
	available: boolean;
}> {
	const results = await db.batch([
		db.prepare(
			"SELECT last_success_at, last_failure_at FROM usage_source_state WHERE source = 'cloudflare'",
		),
		...CLOUDFLARE_ALLOWANCES.map((allowance) =>
			db
				.prepare(
					"SELECT * FROM usage_daily WHERE allowance = ? ORDER BY day DESC LIMIT 1",
				)
				.bind(allowance),
		),
	]);
	const state = results[0]?.results[0] as
		| { last_success_at: number | null; last_failure_at: number | null }
		| undefined;
	const latest = new Map<CloudflareAllowance, UsageRecord>();
	for (const result of results.slice(1)) {
		const row = result.results[0] as UsageRow | undefined;
		if (row) latest.set(row.allowance as CloudflareAllowance, toRecord(row));
	}
	const success = state?.last_success_at ?? null;
	const failure = state?.last_failure_at ?? null;
	return {
		latest,
		available: success !== null && (failure === null || success > failure),
	};
}

/** Every allowance's records from `since` on, oldest first, for the page's batch. */
export function usageHistoryStatement(
	db: D1Database,
	since: string,
): D1PreparedStatement {
	return db
		.prepare("SELECT * FROM usage_daily WHERE day >= ? ORDER BY day")
		.bind(since);
}

/** The rows of `usageHistoryStatement`. */
export function usageRecords(rows: readonly unknown[]): UsageRecord[] {
	return (rows as UsageRow[]).map(toRecord);
}

/** Days before `firstKept` go; newer ones stay (FR-015). */
export async function pruneUsageHistory(
	db: D1Database,
	firstKept: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM usage_daily WHERE day < ?")
		.bind(firstKept)
		.run();
}

// Alert state (research R5, contracts/alerts.md).

export function fireAlertStatement(
	db: D1Database,
	allowance: RecordedAllowance,
	period: string,
	level: number,
	now: number,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT OR IGNORE INTO usage_alerts (allowance, period, level, fired_at)
			VALUES (?, ?, ?, ?)`,
		)
		.bind(allowance, period, level, now);
}

/** An open-ended allowance fell below `level`, so a later rise notifies again. */
export function clearOpenAlertStatement(
	db: D1Database,
	allowance: RecordedAllowance,
	level: number,
): D1PreparedStatement {
	return db
		.prepare(
			"DELETE FROM usage_alerts WHERE allowance = ? AND period = 'open' AND level = ?",
		)
		.bind(allowance, level);
}

/** Daily rows before `firstKept` go; `open` rows stay until the value falls. */
export async function pruneUsageAlerts(
	db: D1Database,
	firstKept: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM usage_alerts WHERE period <> 'open' AND period < ?")
		.bind(firstKept)
		.run();
}

export interface CurrentAlert {
	allowance: RecordedAllowance;
	level: number;
	used: number | null;
	limit_value: number | null;
}

/**
 * The newest alert `athleteId` would receive, fired since `since`: nothing for a
 * rider who isn't an administrator, or with their switch off
 * (contracts/alerts.md). The rows come with today's value for its percentage.
 */
export function currentAlertStatement(
	db: D1Database,
	athleteId: number,
	since: number,
	today: string,
): D1PreparedStatement {
	return db
		.prepare(
			`SELECT a.allowance, a.level, d.used, d.limit_value
			FROM riders r
			JOIN usage_alerts a ON a.fired_at >= ?2
			LEFT JOIN usage_daily d ON d.allowance = a.allowance AND d.day = ?3
			WHERE r.athlete_id = ?1 AND r.administrator = 1 AND r.admin_alerts = 1
			ORDER BY a.fired_at DESC, a.level DESC
			LIMIT 1`,
		)
		.bind(athleteId, since, today);
}
