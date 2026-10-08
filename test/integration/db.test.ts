import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
	deleteActivityStatement,
	deletePrivateActivitiesStatement,
	listActivityIdsMissingFigures,
	listRecentActivities,
	upsertActivity,
} from "../../src/db/activities";
import { getCurrentConsent, recordConsent } from "../../src/db/consents";
import {
	deleteFailedWorkByMessage,
	deleteFailedWorkFirstFailedBefore,
	listFailedWorkFirstFailedSince,
	upsertFailedWork,
} from "../../src/db/failed-work";
import {
	deleteRider,
	getCredentials,
	getRider,
	insertRider,
	listConnectedRiderIds,
	listExpiredReconnectRiderIds,
	listRidersBehindFiguresVersion,
	markNeedsReconnect,
	saveCredentials,
	setFiguresVersion,
	setImportStatus,
	setMembershipChecked,
	updateRiderOnReconnect,
} from "../../src/db/riders";
import { TEAM_EVENT_KINDS } from "../../src/rynke/team-events";
import {
	ACTIVITY_FIGURES_VERSION,
	type ActivityRecord,
	type ActivityRow,
} from "../../src/strava/activity";
import { makeCtx, resetDb, seedRider, tableCounts } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";

const db = env.DB;

function record(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		strava_activity_id: 7001,
		athlete_id: ATHLETE_A,
		sport_type: "Ride",
		start_date: "2026-10-05T07:30:00Z",
		start_date_local: "2026-10-05T09:30:00Z",
		timezone: "(GMT+01:00) Europe/Berlin",
		distance_m: 42195,
		moving_time_s: 5400,
		elapsed_time_s: 6000,
		elevation_gain_m: 312,
		is_manual: 0,
		is_trainer: 0,
		is_flagged: 0,
		is_private: 0,
		refreshed_at: NOW,
		name: null,
		...overrides,
	};
}

/** `record()` as the shared readers return it: without the name (008 R7). */
function row(overrides: Partial<ActivityRecord> = {}): ActivityRow {
	const { name: _, ...stored } = record(overrides);
	return stored;
}

beforeEach(resetDb);

describe("riders", () => {
	it("deleting a rider cascades to everything they own", async () => {
		const ctx = makeCtx();
		await seedRider(ctx, { athleteId: ATHLETE_A, consentVersion: 1 });
		await seedRider(ctx, { athleteId: ATHLETE_B, consentVersion: 1 });
		await upsertActivity(db, record());
		await upsertActivity(
			db,
			record({ strava_activity_id: 7002, athlete_id: ATHLETE_B }),
		);
		await upsertFailedWork(db, {
			athleteId: ATHLETE_A,
			message: '{"kind":"check-membership","athleteId":900001}',
			lastError: "503",
			now: NOW,
		});

		await deleteRider(db, ATHLETE_A);

		expect(await getRider(db, ATHLETE_A)).toBeNull();
		expect(await tableCounts()).toEqual({
			riders: 1,
			strava_credentials: 1,
			activities: 1,
			consent_records: 1,
			failed_work: 0,
			strava_rate_limit: 1,
			ride_results: 0,
			rynke_balances: 0,
			team_events: 0,
			attendances: 0,
			push_subscriptions: 0,
		});
		expect(await getCurrentConsent(db, ATHLETE_A)).toBeNull();
	});

	it("inserts and reads a rider", async () => {
		await insertRider(
			db,
			{
				athleteId: ATHLETE_A,
				firstName: "Testrider A",
				scopes: "read,activity:read",
				scopeReadAll: false,
				scopeWrite: false,
				now: NOW,
			},
			{ version: 1, acceptedAt: NOW },
		);
		expect(await getRider(db, ATHLETE_A)).toEqual({
			athleteId: ATHLETE_A,
			firstName: "Testrider A",
			status: "connected",
			scopeReadAll: false,
			scopeWrite: false,
			scopes: "read,activity:read",
			connectedAt: NOW,
			scopesUpdatedAt: NOW,
			membershipCheckedAt: NOW,
			importStatus: "pending",
			reconnectRequestedAt: null,
			figuresVersion: ACTIVITY_FIGURES_VERSION,
			organiser: false,
		});
	});

	it("reads the organiser flag the app never writes (004 FR-002 to FR-004)", async () => {
		const setOrganiser = () =>
			db
				.prepare("UPDATE riders SET organiser = 1 WHERE athlete_id = ?")
				.bind(ATHLETE_A)
				.run();
		await seedRider(makeCtx());
		expect((await getRider(db, ATHLETE_A))?.organiser).toBe(false);

		await setOrganiser();
		expect((await getRider(db, ATHLETE_A))?.organiser).toBe(true);

		await updateRiderOnReconnect(db, ATHLETE_A, {
			firstName: "Testrider A",
			scopes: "read,activity:read",
			scopeReadAll: false,
			scopeWrite: false,
			now: NOW + 30,
		});
		expect((await getRider(db, ATHLETE_A))?.organiser).toBe(true);

		await deleteRider(db, ATHLETE_A);
		await insertRider(
			db,
			{
				athleteId: ATHLETE_A,
				firstName: "Testrider A",
				scopes: "read,activity:read",
				scopeReadAll: false,
				scopeWrite: false,
				now: NOW + 60,
			},
			{ version: 1, acceptedAt: NOW + 60 },
		);
		expect((await getRider(db, ATHLETE_A))?.organiser).toBe(false);
	});

	it("rejects an organiser flag other than 0 or 1", async () => {
		await seedRider(makeCtx());
		await expect(
			db
				.prepare("UPDATE riders SET organiser = 2 WHERE athlete_id = ?")
				.bind(ATHLETE_A)
				.run(),
		).rejects.toThrow(/CHECK/);
	});

	it("gives riders stored before 0002 figures version 0", async () => {
		await db
			.prepare(
				`INSERT INTO riders (athlete_id, first_name, status, scope_read_all, scopes,
					connected_at, scopes_updated_at, membership_checked_at, import_status,
					reconnect_requested_at)
				VALUES (?, 'Testrider A', 'connected', 1, 'read', 0, 0, 0, 'done', NULL)`,
			)
			.bind(ATHLETE_A)
			.run();
		expect((await getRider(db, ATHLETE_A))?.figuresVersion).toBe(0);
	});

	it("lists connected riders behind a figures version and marks them", async () => {
		const ctx = makeCtx();
		await seedRider(ctx, { athleteId: ATHLETE_A, figuresVersion: 0 });
		await seedRider(ctx, { athleteId: ATHLETE_B, figuresVersion: 2 });
		await seedRider(ctx, {
			athleteId: 900003,
			figuresVersion: 0,
			status: "needs_reconnect",
		});
		expect(await listRidersBehindFiguresVersion(db, 2)).toEqual([ATHLETE_A]);

		await setFiguresVersion(db, ATHLETE_A, 2);
		expect((await getRider(db, ATHLETE_A))?.figuresVersion).toBe(2);
		expect(await listRidersBehindFiguresVersion(db, 2)).toEqual([]);
	});

	it("rejects a negative figures version", async () => {
		await seedRider(makeCtx());
		await expect(setFiguresVersion(db, ATHLETE_A, -1)).rejects.toThrow(/CHECK/);
	});

	it("marks needs_reconnect once and reconnects", async () => {
		const ctx = makeCtx();
		await seedRider(ctx);
		await markNeedsReconnect(db, ATHLETE_A, NOW + 10);
		await markNeedsReconnect(db, ATHLETE_A, NOW + 20);
		expect(await getRider(db, ATHLETE_A)).toMatchObject({
			status: "needs_reconnect",
			reconnectRequestedAt: NOW + 10,
		});

		await updateRiderOnReconnect(db, ATHLETE_A, {
			firstName: "Testrider A2",
			scopes: "read,activity:read",
			scopeReadAll: false,
			scopeWrite: false,
			now: NOW + 30,
		});
		expect(await getRider(db, ATHLETE_A)).toMatchObject({
			firstName: "Testrider A2",
			status: "connected",
			reconnectRequestedAt: null,
			scopeReadAll: false,
			scopes: "read,activity:read",
			scopesUpdatedAt: NOW + 30,
			connectedAt: NOW,
		});
	});

	it("updates import status and membership check time", async () => {
		await seedRider(makeCtx());
		await setImportStatus(db, ATHLETE_A, "running");
		await setMembershipChecked(db, ATHLETE_A, NOW + 99);
		expect(await getRider(db, ATHLETE_A)).toMatchObject({
			importStatus: "running",
			membershipCheckedAt: NOW + 99,
		});
	});

	it("lists connected riders and expired reconnects", async () => {
		const ctx = makeCtx();
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			status: "needs_reconnect",
			reconnectRequestedAt: NOW - 8 * 86400,
		});
		await seedRider(ctx, {
			athleteId: 900003,
			status: "needs_reconnect",
			reconnectRequestedAt: NOW - 86400,
		});
		expect(await listConnectedRiderIds(db)).toEqual([ATHLETE_A]);
		expect(await listExpiredReconnectRiderIds(db, NOW - 7 * 86400)).toEqual([
			ATHLETE_B,
		]);
	});

	it("rejects status and reconnect time that disagree", async () => {
		const insert = (status: string, reconnect: number | null) =>
			db
				.prepare(
					`INSERT INTO riders (athlete_id, first_name, status, scope_read_all, scopes,
						connected_at, scopes_updated_at, membership_checked_at, import_status,
						reconnect_requested_at)
					VALUES (?, 'Testrider A', ?, 1, 'read', 0, 0, 0, 'done', ?)`,
				)
				.bind(ATHLETE_A, status, reconnect)
				.run();
		await expect(insert("connected", NOW)).rejects.toThrow(/CHECK/);
		await expect(insert("needs_reconnect", null)).rejects.toThrow(/CHECK/);
	});

	it("gives riders stored without scope_write 0 and rejects other values", async () => {
		const insert = (athleteId: number, scopeWrite?: number) =>
			db
				.prepare(
					`INSERT INTO riders (athlete_id, first_name, status, scope_read_all, scopes,
						connected_at, scopes_updated_at, membership_checked_at, import_status,
						reconnect_requested_at${scopeWrite === undefined ? "" : ", scope_write"})
					VALUES (?, 'Testrider A', 'connected', 1, 'read', 0, 0, 0, 'done', NULL${scopeWrite === undefined ? "" : ", ?"})`,
				)
				.bind(athleteId, ...(scopeWrite === undefined ? [] : [scopeWrite]))
				.run();
		await insert(ATHLETE_A);
		expect((await getRider(db, ATHLETE_A))?.scopeWrite).toBe(false);
		await expect(insert(ATHLETE_B, 2)).rejects.toThrow(/CHECK/);
	});

	it("records write access on reconnect", async () => {
		await seedRider(makeCtx());
		await updateRiderOnReconnect(db, ATHLETE_A, {
			firstName: "Testrider A",
			scopes: "read,activity:read,activity:read_all,activity:write",
			scopeReadAll: true,
			scopeWrite: true,
			now: NOW + 30,
		});
		expect((await getRider(db, ATHLETE_A))?.scopeWrite).toBe(true);
	});
});

describe("consent records", () => {
	it("stores a new rider together with their consent", async () => {
		await insertRider(
			db,
			{
				athleteId: ATHLETE_A,
				firstName: "Testrider A",
				scopes: "read,activity:read,activity:read_all,activity:write",
				scopeReadAll: true,
				scopeWrite: true,
				now: NOW,
			},
			{ version: 1, acceptedAt: NOW },
		);
		expect((await getRider(db, ATHLETE_A))?.scopeWrite).toBe(true);
		expect(await getCurrentConsent(db, ATHLETE_A)).toEqual({
			version: 1,
			acceptedAt: NOW,
		});
	});

	it("keeps the first acceptance of a version", async () => {
		await seedRider(makeCtx(), { consentVersion: 1 });
		await recordConsent(db, ATHLETE_A, 1, NOW + 3600);
		expect(await getCurrentConsent(db, ATHLETE_A)).toEqual({
			version: 1,
			acceptedAt: NOW,
		});
	});

	it("treats the highest version as the current consent", async () => {
		await seedRider(makeCtx(), { consentVersion: 1 });
		await recordConsent(db, ATHLETE_A, 2, NOW + 3600);
		expect(await getCurrentConsent(db, ATHLETE_A)).toEqual({
			version: 2,
			acceptedAt: NOW + 3600,
		});
	});

	it("never stores version 0", async () => {
		await seedRider(makeCtx(), { consentVersion: null });
		await expect(
			db
				.prepare(
					"INSERT INTO consent_records (athlete_id, version, accepted_at) VALUES (?, 0, ?)",
				)
				.bind(ATHLETE_A, NOW)
				.run(),
		).rejects.toThrow(/CHECK/);
		// OR IGNORE also skips a failed CHECK, so nothing is stored.
		await recordConsent(db, ATHLETE_A, 0, NOW);
		expect(await getCurrentConsent(db, ATHLETE_A)).toBeNull();
	});

	it("rejects a record without a rider and is deleted with the rider", async () => {
		await expect(recordConsent(db, ATHLETE_B, 1, NOW)).rejects.toThrow(
			/FOREIGN KEY/,
		);
		await seedRider(makeCtx(), { consentVersion: 1 });
		await deleteRider(db, ATHLETE_A);
		expect(await getCurrentConsent(db, ATHLETE_A)).toBeNull();
		expect((await tableCounts()).consent_records).toBe(0);
	});
});

describe("credentials", () => {
	it("stores tokens encrypted and reads them back", async () => {
		await insertRider(
			db,
			{
				athleteId: ATHLETE_A,
				firstName: "Testrider A",
				scopes: "read,activity:read",
				scopeReadAll: false,
				scopeWrite: false,
				now: NOW,
			},
			{ version: 1, acceptedAt: NOW },
		);
		const creds = {
			accessToken: "access-synthetic",
			refreshToken: "refresh-synthetic",
			expiresAt: NOW + 3600,
		};
		await saveCredentials(env, ATHLETE_A, creds);
		expect(await getCredentials(env, ATHLETE_A)).toEqual(creds);

		const raw = JSON.stringify(
			await db.prepare("SELECT * FROM strava_credentials").all(),
		);
		expect(raw).not.toContain("access-synthetic");
		expect(raw).not.toContain("refresh-synthetic");

		await saveCredentials(env, ATHLETE_A, { ...creds, refreshToken: "r2" });
		expect((await getCredentials(env, ATHLETE_A))?.refreshToken).toBe("r2");
		expect(await getCredentials(env, ATHLETE_B)).toBeNull();
	});
});

describe("activities", () => {
	beforeEach(async () => {
		const ctx = makeCtx();
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, { athleteId: ATHLETE_B });
	});

	it("upserts by activity ID", async () => {
		await upsertActivity(db, record({ distance_m: 1000 }));
		await upsertActivity(
			db,
			record({ distance_m: 2000, sport_type: "GravelRide", is_private: 1 }),
		);
		const rows = await listRecentActivities(db, ATHLETE_A, 20);
		expect(rows).toEqual([
			row({ distance_m: 2000, sport_type: "GravelRide", is_private: 1 }),
		]);
	});

	it("never moves an activity to another rider", async () => {
		await upsertActivity(db, record({ distance_m: 1000 }));
		await upsertActivity(
			db,
			record({ athlete_id: ATHLETE_B, distance_m: 9999 }),
		);
		expect(await listRecentActivities(db, ATHLETE_A, 20)).toEqual([
			row({ distance_m: 1000 }),
		]);
		expect(await listRecentActivities(db, ATHLETE_B, 20)).toEqual([]);
	});

	it("refuses rows for unknown riders", async () => {
		await expect(
			upsertActivity(db, record({ athlete_id: 999999 })),
		).rejects.toThrow(/FOREIGN KEY/);
		await expect(
			upsertFailedWork(db, {
				athleteId: 999999,
				message: "{}",
				lastError: "x",
				now: NOW,
			}),
		).rejects.toThrow(/FOREIGN KEY/);
	});

	it("lists a rider's newest activities only", async () => {
		for (let day = 1; day <= 5; day++) {
			await upsertActivity(
				db,
				record({
					strava_activity_id: 7000 + day,
					start_date: `2026-10-0${day}T07:00:00Z`,
				}),
			);
		}
		await upsertActivity(
			db,
			record({
				strava_activity_id: 8000,
				athlete_id: ATHLETE_B,
				start_date: "2026-10-09T07:00:00Z",
			}),
		);
		const rows = await listRecentActivities(db, ATHLETE_A, 3);
		expect(rows.map((r) => r.strava_activity_id)).toEqual([7005, 7004, 7003]);
	});

	it("deletes one activity of its owner", async () => {
		await upsertActivity(db, record());
		await deleteActivityStatement(db, ATHLETE_B, 7001).run();
		expect(await listRecentActivities(db, ATHLETE_A, 20)).toHaveLength(1);
		await deleteActivityStatement(db, ATHLETE_A, 7001).run();
		expect(await listRecentActivities(db, ATHLETE_A, 20)).toHaveLength(0);
	});

	it("stores the points figures and replaces unknown ones", async () => {
		const unknown = {
			elapsed_time_s: null,
			is_manual: null,
			is_trainer: null,
			is_flagged: null,
		};
		await upsertActivity(db, record(unknown));
		expect(await listRecentActivities(db, ATHLETE_A, 20)).toEqual([
			row(unknown),
		]);

		const known = {
			elapsed_time_s: 7200,
			is_manual: 1,
			is_trainer: 1,
			is_flagged: 1,
		} as const;
		await upsertActivity(db, record(known));
		expect(await listRecentActivities(db, ATHLETE_A, 20)).toEqual([row(known)]);
	});

	it("stores, replaces and clears the ride's name (008 FR-001, FR-005)", async () => {
		const name = () =>
			db
				.prepare("SELECT name FROM activities WHERE strava_activity_id = ?")
				.bind(7001)
				.first<string | null>("name");
		await upsertActivity(db, record({ name: "Synthetic loop" }));
		expect(await name()).toBe("Synthetic loop");
		await upsertActivity(db, record({ name: "Synthetic loop renamed" }));
		expect(await name()).toBe("Synthetic loop renamed");
		await upsertActivity(db, record({ name: null }));
		expect(await name()).toBeNull();
	});

	it.each([
		["elapsed_time_s", -1],
		["is_manual", 2],
		["is_trainer", 2],
		["is_flagged", 2],
	] as const)("rejects %s = %d", async (column, value) => {
		await expect(
			upsertActivity(db, record({ [column]: value })),
		).rejects.toThrow(/CHECK/);
	});

	it("lists a rider's activities with any unknown figure", async () => {
		await upsertActivity(db, record({ strava_activity_id: 1 }));
		await upsertActivity(
			db,
			record({ strava_activity_id: 2, elapsed_time_s: null }),
		);
		await upsertActivity(
			db,
			record({ strava_activity_id: 3, is_manual: null }),
		);
		await upsertActivity(
			db,
			record({ strava_activity_id: 4, is_trainer: null }),
		);
		await upsertActivity(
			db,
			record({ strava_activity_id: 6, is_flagged: null }),
		);
		await upsertActivity(
			db,
			record({
				strava_activity_id: 5,
				athlete_id: ATHLETE_B,
				elapsed_time_s: null,
				is_manual: null,
				is_trainer: null,
				is_flagged: null,
			}),
		);
		expect(await listActivityIdsMissingFigures(db, ATHLETE_A)).toEqual([
			2, 3, 4, 6,
		]);
		expect(await listActivityIdsMissingFigures(db, ATHLETE_B)).toEqual([5]);
	});

	it("deletes only private activities", async () => {
		await upsertActivity(db, record({ strava_activity_id: 1, is_private: 0 }));
		await upsertActivity(db, record({ strava_activity_id: 2, is_private: 1 }));
		await upsertActivity(
			db,
			record({ strava_activity_id: 3, is_private: 1, athlete_id: ATHLETE_B }),
		);
		await deletePrivateActivitiesStatement(db, ATHLETE_A).run();
		expect(
			(await listRecentActivities(db, ATHLETE_A, 20)).map(
				(r) => r.strava_activity_id,
			),
		).toEqual([1]);
		expect(await listRecentActivities(db, ATHLETE_B, 20)).toHaveLength(1);
	});
});

describe("failed_work", () => {
	const message = '{"kind":"check-membership","athleteId":900001}';

	beforeEach(() => seedRider(makeCtx()));

	it("upserts per message, keeping the first failure", async () => {
		await upsertFailedWork(db, {
			athleteId: ATHLETE_A,
			message,
			lastError: "503",
			now: NOW,
		});
		await upsertFailedWork(db, {
			athleteId: ATHLETE_A,
			message,
			lastError: "network",
			now: NOW + 100,
		});
		const rows = await db.prepare("SELECT * FROM failed_work").all();
		expect(rows.results).toEqual([
			expect.objectContaining({
				athlete_id: ATHLETE_A,
				message,
				last_error: "network",
				first_failed_at: NOW,
				failed_at: NOW + 100,
				failures: 2,
			}),
		]);

		await deleteFailedWorkByMessage(db, message);
		expect((await tableCounts()).failed_work).toBe(0);
	});

	it("lists recent failures and gives up old ones", async () => {
		await upsertFailedWork(db, {
			athleteId: ATHLETE_A,
			message,
			lastError: "503",
			now: NOW - 8 * 86400,
		});
		const recent =
			'{"kind":"import-page","athleteId":900001,"page":1,"after":0}';
		await upsertFailedWork(db, {
			athleteId: ATHLETE_A,
			message: recent,
			lastError: "503",
			now: NOW - 86400,
		});

		const since = NOW - 7 * 86400;
		expect(
			(await listFailedWorkFirstFailedSince(db, since)).map((r) => r.message),
		).toEqual([recent]);

		const givenUp = await deleteFailedWorkFirstFailedBefore(db, since);
		expect(givenUp.map((r) => r.message)).toEqual([message]);
		expect(givenUp[0]).toMatchObject({
			athleteId: ATHLETE_A,
			lastError: "503",
			failures: 1,
		});
		expect((await tableCounts()).failed_work).toBe(1);
	});
});

describe("rynke tables (migration 0005)", () => {
	const result = (overrides: Record<string, unknown> = {}) => ({
		strava_activity_id: 7001,
		athlete_id: ATHLETE_A,
		counts: 1,
		reasons: "[]",
		overlaps_activity_id: null,
		distance_rynke: 4,
		elevation_dm: 3120,
		is_virtual: 0,
		unknown_figures: "[]",
		rules_version: 1,
		activity_refreshed_at: NOW,
		...overrides,
	});
	const balance = (overrides: Record<string, unknown> = {}) => ({
		athlete_id: ATHLETE_A,
		distance_rynke: 4,
		elevation_dm: 3120,
		elevation_rynke: 0,
		elevation_to_next_step_dm: 6880,
		training_rynke: 4,
		team_rynke: 0,
		training_missing: 246,
		team_missing: 25,
		training_without_virtual: 4,
		virtual_share_missing: 163,
		qualified: 0,
		rules_version: 1,
		rules_effective_date: "2026-10-07",
		computed_at: NOW,
		...overrides,
	});

	function insert(table: string, row: Record<string, unknown>) {
		const columns = Object.keys(row);
		return db
			.prepare(
				`INSERT INTO ${table} (${columns.join(", ")})
				VALUES (${columns.map(() => "?").join(", ")})`,
			)
			.bind(...Object.values(row))
			.run();
	}

	async function count(table: string, athleteId = ATHLETE_A) {
		return db
			.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE athlete_id = ?`)
			.bind(athleteId)
			.first<number>("n");
	}

	beforeEach(async () => {
		const ctx = makeCtx();
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await upsertActivity(db, record());
		await upsertActivity(
			db,
			record({ strava_activity_id: 7002, athlete_id: ATHLETE_B }),
		);
	});

	it("accepts a valid result and balance", async () => {
		await insert("ride_results", result());
		await insert("rynke_balances", balance());
		expect(await count("ride_results")).toBe(1);
		expect(await count("rynke_balances")).toBe(1);
	});

	it("refuses a result whose activity doesn't exist", async () => {
		await expect(
			insert("ride_results", result({ strava_activity_id: 7999 })),
		).rejects.toThrow(/FOREIGN KEY/);
	});

	it.each([
		["counts", 2],
		["reasons", "not json"],
		["unknown_figures", "not json"],
		["distance_rynke", -1],
		["elevation_dm", -1],
		["is_virtual", 2],
		["rules_version", 0],
	])("refuses a result with %s = %j", async (column, value) => {
		await expect(
			insert("ride_results", result({ [column]: value })),
		).rejects.toThrow(/CHECK/);
	});

	it.each([
		["elevation_to_next_step_dm", 0],
		["qualified", 2],
		["rules_effective_date", "2026-1-1"],
		["rules_version", 0],
		["training_rynke", -1],
		["virtual_share_missing", -1],
	])("refuses a balance with %s = %j", async (column, value) => {
		await expect(
			insert("rynke_balances", balance({ [column]: value })),
		).rejects.toThrow(/CHECK/);
	});

	it("deleting an activity deletes its result", async () => {
		await insert("ride_results", result());
		await deleteActivityStatement(db, ATHLETE_A, 7001).run();
		expect(await count("ride_results")).toBe(0);
	});

	it("deleting a rider deletes their results and balance only", async () => {
		await insert("ride_results", result());
		await insert("rynke_balances", balance());
		await insert(
			"ride_results",
			result({ strava_activity_id: 7002, athlete_id: ATHLETE_B }),
		);
		await insert("rynke_balances", balance({ athlete_id: ATHLETE_B }));

		await deleteRider(db, ATHLETE_A);

		expect(await count("ride_results")).toBe(0);
		expect(await count("rynke_balances")).toBe(0);
		expect(await count("ride_results", ATHLETE_B)).toBe(1);
		expect(await count("rynke_balances", ATHLETE_B)).toBe(1);
	});
});

describe("team-event tables (migration 0006)", () => {
	function insertEvent(kind: string, date: string, name: string | null) {
		return db
			.prepare(
				"INSERT INTO team_events (kind, event_date, name) VALUES (?, ?, ?) RETURNING event_id",
			)
			.bind(kind, date, name)
			.first<number>("event_id");
	}

	function attend(eventId: number, athleteId: number, onConflict = "") {
		return db
			.prepare(
				`INSERT INTO attendances (event_id, athlete_id) VALUES (?, ?) ${onConflict}`,
			)
			.bind(eventId, athleteId)
			.run();
	}

	async function attendees(eventId?: number) {
		const { results } = await db
			.prepare(
				`SELECT event_id, athlete_id FROM attendances
				WHERE ?1 IS NULL OR event_id = ?1 ORDER BY event_id, athlete_id`,
			)
			.bind(eventId ?? null)
			.all<{ event_id: number; athlete_id: number }>();
		return results;
	}

	beforeEach(async () => {
		const ctx = makeCtx();
		for (const athleteId of [ATHLETE_A, ATHLETE_B, ATHLETE_C]) {
			await seedRider(ctx, { athleteId });
		}
	});

	it("seeds exactly the kinds of TEAM_EVENT_KINDS", async () => {
		const { results } = await db
			.prepare("SELECT kind FROM team_event_kinds ORDER BY rowid")
			.all<{ kind: string }>();
		expect(results.map((r) => r.kind)).toEqual(TEAM_EVENT_KINDS);
	});

	it("refuses an unknown kind", async () => {
		await expect(insertEvent("ride", "2026-05-01", null)).rejects.toThrow(
			/FOREIGN KEY/,
		);
	});

	it.each([
		["event_date", "2026-5-1", null],
		["name", "2026-05-01", ""],
		["name", "2026-05-01", "x".repeat(101)],
	])("refuses an event with a bad %s", async (_column, date, name) => {
		await expect(insertEvent("team_training", date, name)).rejects.toThrow(
			/CHECK/,
		);
	});

	it("accepts a 100-character name and no name", async () => {
		expect(
			await insertEvent("team_training", "2026-05-01", "x".repeat(100)),
		).toBeGreaterThan(0);
		expect(
			await insertEvent("technique_training", "2026-05-02", null),
		).toBeGreaterThan(0);
	});

	it("refuses attendance of a missing event or rider", async () => {
		const eventId = (await insertEvent(
			"team_training",
			"2026-05-01",
			null,
		)) as number;
		await expect(attend(eventId + 1, ATHLETE_A)).rejects.toThrow(/FOREIGN KEY/);
		await expect(attend(eventId, 900999)).rejects.toThrow(/FOREIGN KEY/);
	});

	it("stores a rider's attendance once", async () => {
		const eventId = (await insertEvent(
			"team_training",
			"2026-05-01",
			null,
		)) as number;
		await attend(eventId, ATHLETE_A);
		await expect(attend(eventId, ATHLETE_A)).rejects.toThrow(/UNIQUE|PRIMARY/);
		await attend(eventId, ATHLETE_A, "ON CONFLICT DO NOTHING");
		expect(await attendees(eventId)).toHaveLength(1);
	});

	it("deleting an event deletes its attendances", async () => {
		const first = (await insertEvent(
			"team_training",
			"2026-05-01",
			null,
		)) as number;
		const second = (await insertEvent(
			"team_training",
			"2026-05-08",
			null,
		)) as number;
		await attend(first, ATHLETE_A);
		await attend(second, ATHLETE_A);
		await db
			.prepare("DELETE FROM team_events WHERE event_id = ?")
			.bind(first)
			.run();
		expect(await attendees()).toEqual([
			{ event_id: second, athlete_id: ATHLETE_A },
		]);
	});

	it("deleting a rider deletes their attendances and keeps the event", async () => {
		const eventId = (await insertEvent(
			"team_training",
			"2026-05-01",
			null,
		)) as number;
		await attend(eventId, ATHLETE_A);
		await attend(eventId, ATHLETE_B);
		await db
			.prepare("DELETE FROM riders WHERE athlete_id = ?")
			.bind(ATHLETE_A)
			.run();
		expect(await attendees()).toEqual([
			{ event_id: eventId, athlete_id: ATHLETE_B },
		]);
		expect((await tableCounts()).team_events).toBe(1);
	});

	it("gives a balance written without the breakdown '[]' and refuses invalid JSON", async () => {
		// As the previously deployed version writes it, without the new column.
		await db
			.prepare(
				`INSERT INTO rynke_balances (athlete_id, distance_rynke, elevation_dm,
					elevation_rynke, elevation_to_next_step_dm, training_rynke, team_rynke,
					training_missing, team_missing, training_without_virtual,
					virtual_share_missing, qualified, rules_version, rules_effective_date,
					computed_at)
				VALUES (?, 4, 3120, 0, 6880, 4, 0, 246, 25, 4, 163, 0, 1, '2026-10-07', ?)`,
			)
			.bind(ATHLETE_A, NOW)
			.run();
		expect(
			await db
				.prepare(
					"SELECT team_event_breakdown FROM rynke_balances WHERE athlete_id = ?",
				)
				.bind(ATHLETE_A)
				.first<string>("team_event_breakdown"),
		).toBe("[]");
		await expect(
			db
				.prepare(
					"UPDATE rynke_balances SET team_event_breakdown = 'not json' WHERE athlete_id = ?",
				)
				.bind(ATHLETE_A)
				.run(),
		).rejects.toThrow(/CHECK/);
	});
});
