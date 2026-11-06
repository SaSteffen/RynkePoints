import { SHARING_SINCE_VERSION } from "../consent";

// The consent a rider accepted (data-model.md, research R21). Records are
// deleted with the rider by the schema's cascade (FR-022).

export interface Consent {
	version: number;
	/** The minor revision of `version` accepted, 0 for none (constitution 2.4.0). */
	revision: number;
	acceptedAt: number;
}

/** A consent being recorded; without a revision it is revision 0. */
export type GivenConsent = Omit<Consent, "revision"> & { revision?: number };

/**
 * Ticking the same version again keeps the first acceptance, so a rider on 3
 * stays on revision 0 until they accept a newer major version.
 */
export function recordConsentStatement(
	db: D1Database,
	athleteId: number,
	version: number,
	acceptedAt: number,
	revision = 0,
): D1PreparedStatement {
	return db
		.prepare(
			`INSERT OR IGNORE INTO consent_records (athlete_id, version, accepted_at,
				revision)
			VALUES (?, ?, ?, ?)`,
		)
		.bind(athleteId, version, acceptedAt, revision);
}

export async function recordConsent(
	db: D1Database,
	athleteId: number,
	version: number,
	acceptedAt: number,
	revision = 0,
): Promise<void> {
	await recordConsentStatement(
		db,
		athleteId,
		version,
		acceptedAt,
		revision,
	).run();
}

/** The rider's current consent: the record with the highest version. */
export function currentConsentStatement(db: D1Database, athleteId: number) {
	return db
		.prepare(
			`SELECT version, revision, accepted_at FROM consent_records
			WHERE athlete_id = ?
			ORDER BY version DESC LIMIT 1`,
		)
		.bind(athleteId);
}

export interface ConsentRow {
	version: number;
	revision: number;
	accepted_at: number;
}

export function toConsent(row: ConsentRow): Consent {
	return {
		version: row.version,
		revision: row.revision,
		acceptedAt: row.accepted_at,
	};
}

export async function getCurrentConsent(
	db: D1Database,
	athleteId: number,
): Promise<Consent | null> {
	const row = await currentConsentStatement(db, athleteId).first<ConsentRow>();
	return row ? toConsent(row) : null;
}

/** The rider's highest accepted version, null without a record (004 R13). */
export async function consentVersionOf(
	db: D1Database,
	athleteId: number,
): Promise<number | null> {
	return db
		.prepare(
			"SELECT MAX(version) AS version FROM consent_records WHERE athlete_id = ?",
		)
		.bind(athleteId)
		.first<number | null>("version");
}

/**
 * SQL subquery: athlete IDs whose accepted consent reaches `version`, a number
 * from code, never request input. Every query that lists, counts or sums
 * riders for someone else filters inside SQL with
 * `athlete_id IN (${SHARED_RIDER_IDS})`, or
 * `sharedRiderIdsSince(SINCE_VERSION[item])` for an item shared later, so a
 * rider without that consent is in no row and no figure (004 FR-021, FR-013).
 */
export function sharedRiderIdsSince(version: number): string {
	return `SELECT athlete_id FROM consent_records WHERE version >= ${Math.trunc(version)}`;
}

/**
 * The same check as `sharedRiderIdsSince` as an `EXISTS` on one rider, for a
 * query that already goes through `riders` as `alias`: 80 rows instead of 200 at
 * 40 riders (feature 030 research R5). `alias` and `version` come from code,
 * never request input.
 */
export function sharedRiderExists(alias: string, version: number): string {
	return `EXISTS (SELECT 1 FROM consent_records c
		WHERE c.athlete_id = ${alias}.athlete_id AND c.version >= ${Math.trunc(version)})`;
}

/** SQL subquery: athlete IDs whose consent includes the FR-020 sharing. */
export const SHARED_RIDER_IDS = sharedRiderIdsSince(SHARING_SINCE_VERSION);

export async function listSharedRiderIds(db: D1Database): Promise<number[]> {
	const { results } = await db
		.prepare(
			`SELECT DISTINCT athlete_id FROM (${SHARED_RIDER_IDS}) ORDER BY athlete_id`,
		)
		.all<{ athlete_id: number }>();
	return results.map((row) => row.athlete_id);
}
