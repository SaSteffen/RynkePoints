import { decryptToken, encryptToken } from "../crypto/encrypt";
import { ACTIVITY_FIGURES_VERSION } from "../strava/activity";

// Riders and their Strava credentials (data-model.md). Deleting a rider is a
// single DELETE; the schema cascades to everything they own (FR-022).

export type RiderStatus = "connected" | "needs_reconnect";
export type ImportStatus = "pending" | "running" | "done";

export interface Rider {
	athleteId: number;
	firstName: string;
	status: RiderStatus;
	scopeReadAll: boolean;
	scopes: string;
	connectedAt: number;
	scopesUpdatedAt: number;
	membershipCheckedAt: number;
	importStatus: ImportStatus;
	reconnectRequestedAt: number | null;
	/** FR-013 field set the rider's activities were last read with (R20). */
	figuresVersion: number;
}

export interface Credentials {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

interface RiderRow {
	athlete_id: number;
	first_name: string;
	status: RiderStatus;
	scope_read_all: number;
	scopes: string;
	connected_at: number;
	scopes_updated_at: number;
	membership_checked_at: number;
	import_status: ImportStatus;
	reconnect_requested_at: number | null;
	figures_version: number;
}

export interface RiderGrant {
	firstName: string;
	scopes: string;
	scopeReadAll: boolean;
	now: number;
}

export async function getRider(
	db: D1Database,
	athleteId: number,
): Promise<Rider | null> {
	const row = await db
		.prepare("SELECT * FROM riders WHERE athlete_id = ?")
		.bind(athleteId)
		.first<RiderRow>();
	return row
		? {
				athleteId: row.athlete_id,
				firstName: row.first_name,
				status: row.status,
				scopeReadAll: row.scope_read_all === 1,
				scopes: row.scopes,
				connectedAt: row.connected_at,
				scopesUpdatedAt: row.scopes_updated_at,
				membershipCheckedAt: row.membership_checked_at,
				importStatus: row.import_status,
				reconnectRequestedAt: row.reconnect_requested_at,
				figuresVersion: row.figures_version,
			}
		: null;
}

/**
 * A newly connected rider: `connected`, import `pending`. Their import reads
 * every current figure, so they start at the current figures version.
 */
export async function insertRider(
	db: D1Database,
	rider: RiderGrant & { athleteId: number },
): Promise<void> {
	await db
		.prepare(
			`INSERT INTO riders (athlete_id, first_name, status, scope_read_all, scopes,
				connected_at, scopes_updated_at, membership_checked_at, import_status,
				reconnect_requested_at, figures_version)
			VALUES (?1, ?2, 'connected', ?3, ?4, ?5, ?5, ?5, 'pending', NULL, ?6)`,
		)
		.bind(
			rider.athleteId,
			rider.firstName,
			rider.scopeReadAll ? 1 : 0,
			rider.scopes,
			rider.now,
			ACTIVITY_FIGURES_VERSION,
		)
		.run();
}

/** Records a new grant and ends `needs_reconnect` (data-model.md, Reconnect). */
export async function updateRiderOnReconnect(
	db: D1Database,
	athleteId: number,
	grant: RiderGrant,
): Promise<void> {
	await db
		.prepare(
			`UPDATE riders SET first_name = ?2, scopes = ?3, scope_read_all = ?4,
				scopes_updated_at = ?5, status = 'connected', reconnect_requested_at = NULL
			WHERE athlete_id = ?1`,
		)
		.bind(
			athleteId,
			grant.firstName,
			grant.scopes,
			grant.scopeReadAll ? 1 : 0,
			grant.now,
		)
		.run();
}

/** Only a connected rider changes, so the first refusal's time is kept. */
export async function markNeedsReconnect(
	db: D1Database,
	athleteId: number,
	now: number,
): Promise<void> {
	await db
		.prepare(
			`UPDATE riders SET status = 'needs_reconnect', reconnect_requested_at = ?2
			WHERE athlete_id = ?1 AND status = 'connected'`,
		)
		.bind(athleteId, now)
		.run();
}

export async function setImportStatus(
	db: D1Database,
	athleteId: number,
	status: ImportStatus,
): Promise<void> {
	await db
		.prepare("UPDATE riders SET import_status = ? WHERE athlete_id = ?")
		.bind(status, athleteId)
		.run();
}

export async function setMembershipChecked(
	db: D1Database,
	athleteId: number,
	now: number,
): Promise<void> {
	await db
		.prepare("UPDATE riders SET membership_checked_at = ? WHERE athlete_id = ?")
		.bind(now, athleteId)
		.run();
}

export async function deleteRider(
	db: D1Database,
	athleteId: number,
): Promise<void> {
	await db
		.prepare("DELETE FROM riders WHERE athlete_id = ?")
		.bind(athleteId)
		.run();
}

export async function listConnectedRiderIds(db: D1Database): Promise<number[]> {
	const { results } = await db
		.prepare(
			"SELECT athlete_id FROM riders WHERE status = 'connected' ORDER BY athlete_id",
		)
		.all<{ athlete_id: number }>();
	return results.map((r) => r.athlete_id);
}

/** Connected riders whose activities were read with an older field set (R20). */
export async function listRidersBehindFiguresVersion(
	db: D1Database,
	version: number,
): Promise<number[]> {
	const { results } = await db
		.prepare(
			`SELECT athlete_id FROM riders
			WHERE status = 'connected' AND figures_version < ?
			ORDER BY athlete_id`,
		)
		.bind(version)
		.all<{ athlete_id: number }>();
	return results.map((r) => r.athlete_id);
}

export async function setFiguresVersion(
	db: D1Database,
	athleteId: number,
	version: number,
): Promise<void> {
	await db
		.prepare("UPDATE riders SET figures_version = ? WHERE athlete_id = ?")
		.bind(version, athleteId)
		.run();
}

/** `needs_reconnect` riders whose refusal happened before `before`. */
export async function listExpiredReconnectRiderIds(
	db: D1Database,
	before: number,
): Promise<number[]> {
	const { results } = await db
		.prepare(
			`SELECT athlete_id FROM riders
			WHERE status = 'needs_reconnect' AND reconnect_requested_at < ?
			ORDER BY athlete_id`,
		)
		.bind(before)
		.all<{ athlete_id: number }>();
	return results.map((r) => r.athlete_id);
}

type CredentialEnv = Pick<Env, "DB" | "TOKEN_ENCRYPTION_KEY">;

export async function getCredentials(
	env: CredentialEnv,
	athleteId: number,
): Promise<Credentials | null> {
	const row = await env.DB.prepare(
		"SELECT * FROM strava_credentials WHERE athlete_id = ?",
	)
		.bind(athleteId)
		.first<{
			access_token_enc: string;
			refresh_token_enc: string;
			expires_at: number;
		}>();
	if (!row) return null;
	return {
		accessToken: await decryptToken(
			row.access_token_enc,
			env.TOKEN_ENCRYPTION_KEY,
		),
		refreshToken: await decryptToken(
			row.refresh_token_enc,
			env.TOKEN_ENCRYPTION_KEY,
		),
		expiresAt: row.expires_at,
	};
}

/** Inserts or replaces the rider's credentials, encrypted (FR-027). */
export async function saveCredentials(
	env: CredentialEnv,
	athleteId: number,
	creds: Credentials,
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO strava_credentials (athlete_id, access_token_enc, refresh_token_enc, expires_at)
		VALUES (?1, ?2, ?3, ?4)
		ON CONFLICT (athlete_id) DO UPDATE SET access_token_enc = ?2,
			refresh_token_enc = ?3, expires_at = ?4`,
	)
		.bind(
			athleteId,
			await encryptToken(creds.accessToken, env.TOKEN_ENCRYPTION_KEY),
			await encryptToken(creds.refreshToken, env.TOKEN_ENCRYPTION_KEY),
			creds.expiresAt,
		)
		.run();
}
