import { decryptToken, encryptToken } from "../crypto/encrypt";
import { ACTIVITY_FIGURES_VERSION } from "../strava/activity";
import { idJson, idsJson } from "../strava/id";
import {
	type GivenConsent,
	recordConsentStatement,
	SHARED_RIDER_IDS,
} from "./consents";
import { deleteSubscriptionsStatement } from "./push-subscriptions";
import { insertEmptySummaryStatement } from "./rider-summaries";

// Riders and their Strava credentials (data-model.md). Deleting a rider is a
// single DELETE; the schema cascades to everything they own (FR-022).

export type RiderStatus = "connected" | "needs_reconnect";
export type ImportStatus = "pending" | "running" | "done";

export interface Rider {
	athleteId: string;
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
	/** Set by the maintainer only; the app never writes it (004 FR-002, R2). */
	organiser: boolean;
	/** Set by the maintainer only, like `organiser` (feature 025 FR-002). */
	administrator: boolean;
	/** The administrator's own switch for Cloudflare's alerts (025 FR-039). */
	adminAlerts: boolean;
	/** When the rider finished or skipped the rider tour; null: still to show (#90). */
	onboardedAt: number | null;
	/** The same for the organiser tour; cleared with the organiser flag (#90). */
	organiserOnboardedAt: number | null;
	/** When the hourly run last chose the rider for a re-check; null: never (036). */
	recheckedAt: number | null;
	/**
	 * Set by the app at sign-in from the guest list: an administrator of another
	 * team, never counted for this one (feature 041 FR-007).
	 */
	guest: boolean;
	/** Whether the ID is on the guest list now; a guest off it is a visitor (041 R4). */
	onGuestList: boolean;
	/** Only a session cookie with this epoch is signed in (issue #314). */
	sessionEpoch: number;
}

export interface Credentials {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
}

export interface RiderRow {
	athlete_id: string;
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
	organiser: number;
	administrator: number;
	admin_alerts: number;
	onboarded_at: number | null;
	organiser_onboarded_at: number | null;
	rechecked_at: number | null;
	guest: number;
	on_guest_list: number;
	session_epoch: number;
}

export interface RiderGrant {
	firstName: string;
	scopes: string;
	scopeReadAll: boolean;
	now: number;
	/** On the guest list at this sign-in (feature 041 research R8). */
	guest: boolean;
}

/** The rider's row and whether they are on the guest list, for `toRider`. */
export function riderStatement(db: D1Database, athleteId: string) {
	return db
		.prepare(
			`SELECT r.*, CAST(r.athlete_id AS TEXT) AS athlete_id,
				EXISTS (SELECT 1 FROM guests g WHERE g.athlete_id = r.athlete_id)
				AS on_guest_list
			FROM riders r WHERE r.athlete_id = ?`,
		)
		.bind(athleteId);
}

/** A guest is an organiser and an administrator of the team (041 FR-004). */
export function toRider(row: RiderRow): Rider {
	const guest = row.guest === 1;
	return {
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
		organiser: row.organiser === 1 || guest,
		administrator: row.administrator === 1 || guest,
		adminAlerts: row.admin_alerts === 1,
		onboardedAt: row.onboarded_at,
		organiserOnboardedAt: row.organiser_onboarded_at,
		recheckedAt: row.rechecked_at,
		guest,
		onGuestList: row.on_guest_list === 1,
		sessionEpoch: row.session_epoch,
	};
}

export async function getRider(
	db: D1Database,
	athleteId: string,
): Promise<Rider | null> {
	const row = await riderStatement(db, athleteId).first<RiderRow>();
	return row ? toRider(row) : null;
}

/**
 * A newly connected rider: `connected`, import `pending`, stored together with
 * their consent so a rider never exists without it (research R21). Their import
 * reads every current figure, so they start at the current figures version.
 * Their session epoch is the time, so no cookie from before a disconnect signs
 * them in again (issue #314).
 */
export async function insertRider(
	db: D1Database,
	rider: RiderGrant & { athleteId: string },
	consent: GivenConsent,
): Promise<void> {
	await db.batch([
		db
			.prepare(
				`INSERT INTO riders (athlete_id, first_name, status, scope_read_all,
					scopes, connected_at, scopes_updated_at,
					membership_checked_at, import_status, reconnect_requested_at,
					figures_version, guest, session_epoch)
				VALUES (?1, ?2, 'connected', ?3, ?4, ?5, ?5, ?5, 'pending', NULL, ?6, ?7, ?5)`,
			)
			.bind(
				rider.athleteId,
				rider.firstName,
				rider.scopeReadAll ? 1 : 0,
				rider.scopes,
				rider.now,
				ACTIVITY_FIGURES_VERSION,
				rider.guest ? 1 : 0,
			),
		recordConsentStatement(
			db,
			rider.athleteId,
			consent.version,
			consent.acceptedAt,
			consent.revision,
		),
		insertEmptySummaryStatement(db, rider.athleteId),
	]);
}

/**
 * Records a new grant and ends `needs_reconnect` (data-model.md, Reconnect).
 * The guest mark follows the list at this sign-in (feature 041 R8).
 */
export async function updateRiderOnReconnect(
	db: D1Database,
	athleteId: string,
	grant: RiderGrant,
): Promise<void> {
	await db
		.prepare(
			`UPDATE riders SET first_name = ?2, scopes = ?3, scope_read_all = ?4,
				scopes_updated_at = ?5, status = 'connected',
				reconnect_requested_at = NULL, guest = ?6
			WHERE athlete_id = ?1`,
		)
		.bind(
			athleteId,
			grant.firstName,
			grant.scopes,
			grant.scopeReadAll ? 1 : 0,
			grant.now,
			grant.guest ? 1 : 0,
		)
		.run();
}

/**
 * Each stored rider of `athleteIds` with their count of stored evaluations
 * (review L-18).
 */
export function readEvaluationsStatement(db: D1Database, athleteIds: string[]) {
	return db
		.prepare(
			`SELECT CAST(athlete_id AS TEXT) AS athlete_id, evaluations FROM riders
			WHERE athlete_id IN (SELECT value FROM json_each(?1))`,
		)
		.bind(idsJson(athleteIds));
}

/**
 * Counts one more evaluation of each rider in `read` (athlete id → the count
 * read with their state). Where a count is no longer the one read, it would
 * become NULL, which the column refuses: the statement fails, and with it the
 * batch it is in (review L-18).
 */
export function countEvaluationsStatement(
	db: D1Database,
	read: Map<string, number>,
) {
	return db
		.prepare(
			`UPDATE riders SET evaluations = CASE riders.evaluations
				WHEN seen.evaluations THEN riders.evaluations + 1 END
			FROM (SELECT json_extract(value, '$[0]') AS athlete_id,
					json_extract(value, '$[1]') AS evaluations
				FROM json_each(?1)) AS seen
			WHERE riders.athlete_id = seen.athlete_id`,
		)
		.bind(JSON.stringify([...read].map(([id, n]) => [idJson(id), n])));
}

/**
 * Only a connected rider changes, so the first refusal's time is kept. `rider`
 * is as read before the refused token was: a rider who reconnected since holds
 * a new grant and stays connected (review L-18).
 */
export async function markNeedsReconnect(
	db: D1Database,
	rider: Pick<Rider, "athleteId" | "scopesUpdatedAt">,
	now: number,
): Promise<void> {
	await db
		.prepare(
			`UPDATE riders SET status = 'needs_reconnect', reconnect_requested_at = ?2
			WHERE athlete_id = ?1 AND status = 'connected'
				AND scopes_updated_at = ?3`,
		)
		.bind(rider.athleteId, now, rider.scopesUpdatedAt)
		.run();
}

export type TourId = "rider" | "organiser";

/** Records that the rider finished or skipped a tour, on every device (#90). */
export async function setOnboarded(
	db: D1Database,
	athleteId: string,
	tour: TourId,
	now: number,
): Promise<void> {
	const column = tour === "rider" ? "onboarded_at" : "organiser_onboarded_at";
	await db
		.prepare(`UPDATE riders SET ${column} = ? WHERE athlete_id = ?`)
		.bind(now, athleteId)
		.run();
}

/** A `pending` import starts its count of fetched activities again (024 R7). */
export async function setImportStatus(
	db: D1Database,
	athleteId: string,
	status: ImportStatus,
): Promise<void> {
	await db
		.prepare(
			`UPDATE riders SET import_status = ?1,
				import_fetched = CASE WHEN ?1 = 'pending' THEN 0 ELSE import_fetched END
			WHERE athlete_id = ?2`,
		)
		.bind(status, athleteId)
		.run();
}

/** Counts a page of the import's listed activities (feature 024 R7). */
export async function addImportFetched(
	db: D1Database,
	athleteId: string,
	listed: number,
): Promise<void> {
	await db
		.prepare(
			"UPDATE riders SET import_fetched = import_fetched + ? WHERE athlete_id = ?",
		)
		.bind(listed, athleteId)
		.run();
}

export async function setMembershipChecked(
	db: D1Database,
	athleteId: string,
	now: number,
): Promise<void> {
	await db
		.prepare("UPDATE riders SET membership_checked_at = ? WHERE athlete_id = ?")
		.bind(now, athleteId)
		.run();
}

/**
 * Ends every session of the rider and every device's notifications, which end
 * with the sign-in (issue #314, feature 010 FR-013). Raised to at least the
 * time, the epoch never runs ahead of the clock by more than a few quick
 * presses, so the time a rider gets on connecting again lies above it.
 */
export async function endSessions(
	db: D1Database,
	athleteId: string,
	now: number,
): Promise<void> {
	await db.batch([
		db
			.prepare(
				`UPDATE riders SET session_epoch = MAX(session_epoch + 1, ?2)
				WHERE athlete_id = ?1`,
			)
			.bind(athleteId, now),
		deleteSubscriptionsStatement(db, athleteId),
	]);
}

/** A row only if the rider is stored and `epoch` is their session epoch. */
export function sessionCurrentStatement(
	db: D1Database,
	athleteId: string,
	epoch: number,
) {
	return db
		.prepare(
			"SELECT 1 AS current FROM riders WHERE athlete_id = ? AND session_epoch = ?",
		)
		.bind(athleteId, epoch);
}

export async function isSessionCurrent(
	db: D1Database,
	athleteId: string,
	epoch: number,
): Promise<boolean> {
	return (await sessionCurrentStatement(db, athleteId, epoch).first()) !== null;
}

export async function deleteRider(
	db: D1Database,
	athleteId: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM riders WHERE athlete_id = ?")
		.bind(athleteId)
		.run();
}

export async function listConnectedRiderIds(db: D1Database): Promise<string[]> {
	const { results } = await db
		.prepare(
			"SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM riders WHERE status = 'connected' ORDER BY riders.athlete_id",
		)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}

/** Connected riders of the team, guests left out: whose club the daily run checks (041 FR-006). */
export async function listClubRiderIds(db: D1Database): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM riders
			WHERE status = 'connected' AND guest = 0 ORDER BY riders.athlete_id`,
		)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}

/** Connected riders whose activities were read with an older field set (R20). */
export async function listRidersBehindFiguresVersion(
	db: D1Database,
	version: number,
): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM riders
			WHERE status = 'connected' AND figures_version < ?
			ORDER BY riders.athlete_id`,
		)
		.bind(version)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}

export async function setFiguresVersion(
	db: D1Database,
	athleteId: string,
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
): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM riders
			WHERE status = 'needs_reconnect' AND reconnect_requested_at < ?
			ORDER BY riders.athlete_id`,
		)
		.bind(before)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}

/**
 * Who gets usage alerts: every administrator, guests included (041 FR-004),
 * with their own switch (025).
 */
export async function listAlertRecipients(db: D1Database): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM riders
			WHERE (administrator = 1 OR guest = 1) AND admin_alerts = 1
			ORDER BY riders.athlete_id`,
		)
		.all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}

/**
 * The team's connected riders, against Strava's capacity (025 FR-005). A guest
 * already counts at their home team (041 R3).
 */
export function connectedCountStatement(db: D1Database): D1PreparedStatement {
	return db.prepare(
		"SELECT COUNT(*) AS n FROM riders WHERE status = 'connected' AND guest = 0",
	);
}

/** Sets the administrator's own switch for their usage alerts (025 FR-039). */
export async function setAdminAlerts(
	db: D1Database,
	athleteId: string,
	on: boolean,
): Promise<void> {
	await db
		.prepare("UPDATE riders SET admin_alerts = ? WHERE athlete_id = ?")
		.bind(on ? 1 : 0, athleteId)
		.run();
}

export interface OverviewRider {
	athleteId: string;
	firstName: string;
	status: RiderStatus;
	connectedAt: number;
	membershipCheckedAt: number;
	importStatus: ImportStatus;
}

const OVERVIEW_COLUMNS = `CAST(athlete_id AS TEXT) AS athlete_id, first_name, status, connected_at,
	membership_checked_at, import_status`;

type OverviewRow = Pick<
	RiderRow,
	| "athlete_id"
	| "first_name"
	| "status"
	| "connected_at"
	| "membership_checked_at"
	| "import_status"
>;

function toOverviewRiders(rows: unknown[] | undefined): OverviewRider[] {
	return ((rows ?? []) as OverviewRow[]).map((r) => ({
		athleteId: r.athlete_id,
		firstName: r.first_name,
		status: r.status,
		connectedAt: r.connected_at,
		membershipCheckedAt: r.membership_checked_at,
		importStatus: r.import_status,
	}));
}

/**
 * The rider overview (025 FR-018, FR-038): riders with a recorded consent of any
 * version, and how many others there are, filtered inside SQL; then the guests
 * apart (041 FR-008), the only list that shows them. Selects only what the rows
 * show, so nothing else can reach the page (FR-019).
 */
export async function readRiderOverview(db: D1Database): Promise<{
	riders: OverviewRider[];
	unlisted: number;
	guests: OverviewRider[];
}> {
	const listed = SHARED_RIDER_IDS;
	const [rows, unlisted, guests] = await db.batch([
		db.prepare(
			`SELECT ${OVERVIEW_COLUMNS}
			FROM riders WHERE athlete_id IN (${listed})
			ORDER BY first_name COLLATE NOCASE, riders.athlete_id`,
		),
		db.prepare(
			`SELECT COUNT(*) AS n FROM riders
			WHERE athlete_id NOT IN (${listed}) AND guest = 0`,
		),
		db.prepare(
			`SELECT ${OVERVIEW_COLUMNS}
			FROM riders WHERE guest = 1
			ORDER BY first_name COLLATE NOCASE, riders.athlete_id`,
		),
	]);
	return {
		riders: toOverviewRiders(rows?.results),
		unlisted: (unlisted?.results[0] as { n: number } | undefined)?.n ?? 0,
		guests: toOverviewRiders(guests?.results),
	};
}

/**
 * One rider the overview lists, a guest included; null when the ID is no rider
 * the view lists.
 */
export async function listedRider(
	db: D1Database,
	athleteId: string,
): Promise<{ firstName: string; guest: boolean } | null> {
	const listed = SHARED_RIDER_IDS;
	const row = await db
		.prepare(
			`SELECT first_name, guest FROM riders WHERE athlete_id = ?
			AND (athlete_id IN (${listed}) OR guest = 1)`,
		)
		.bind(athleteId)
		.first<{ first_name: string; guest: number }>();
	return row ? { firstName: row.first_name, guest: row.guest === 1 } : null;
}

type CredentialEnv = Pick<Env, "DB" | "TOKEN_ENCRYPTION_KEY">;

export async function getCredentials(
	env: CredentialEnv,
	athleteId: string,
): Promise<Credentials | null> {
	const row = await env.DB.prepare(
		"SELECT *, CAST(athlete_id AS TEXT) AS athlete_id FROM strava_credentials WHERE athlete_id = ?",
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
	athleteId: string,
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

/**
 * Whether this team holds the person, for another team about to withdraw
 * their grant (feature 041 research R14): `connected` with a working
 * connection, `reconnect` only with a broken one, `none` without a row.
 */
export async function riderHold(
	db: D1Database,
	athleteId: string,
): Promise<{ held: "connected" | "reconnect" | "none"; rider: boolean }> {
	const row = await db
		.prepare("SELECT status, guest FROM riders WHERE athlete_id = ?")
		.bind(athleteId)
		.first<{ status: RiderStatus; guest: number }>();
	if (!row) return { held: "none", rider: false };
	return {
		held: row.status === "connected" ? "connected" : "reconnect",
		// Held as a rider, not a guest (feature 044 R2).
		rider: row.guest === 0,
	};
}

/**
 * Lets a rider go for a switch to another team (feature 044 R4): the row and
 * everything that cascades from it, never a guest's. No block, no withdrawal:
 * the team they switch to holds the grant.
 */
export async function letGoRider(
	db: D1Database,
	athleteId: string,
): Promise<void> {
	await db
		.prepare("DELETE FROM riders WHERE athlete_id = ? AND guest = 0")
		.bind(athleteId)
		.run();
}
