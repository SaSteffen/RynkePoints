import { CONSENT_VERSION } from "../../src/consent";
import type { Ctx } from "../../src/ctx";
import { insertReportStatement } from "../../src/db/participation";
import {
	sourceSuccessStatement,
	type UsageRecord,
	upsertUsageStatement,
} from "../../src/db/usage";
import { handleFetch } from "../../src/index";
import { teamEventChange } from "../../src/rynke/apply";
import {
	ATHLETE_CAPACITY,
	CLOUDFLARE_ALLOWANCES,
	CLOUDFLARE_LIMITS,
	type CloudflareAllowance,
	daysBefore,
	type RecordedAllowance,
	utcDay,
} from "../../src/usage/allowances";
import {
	EVENT_ORGANISER,
	eventDay,
	recipeToActivity,
	SAMPLE_RIDERS,
	SAMPLE_TEAM_EVENTS,
	type SampleRider,
} from "./samples";
import {
	clearActivities,
	ensureTable,
	insertActivities,
	markSeeded,
} from "./store";
import { encodeCode } from "./tokens";

// Resets fake mode and seeds the sample riders (specs/006-local-frontend-dev
// research R6, data-model.md). Riders get into the app only through its own
// connect flow, and their rides only through its own import, so every number
// on /me comes from the app's rules (FR-012).

/** `name=value` of a `Set-Cookie` header. */
function cookieOf(setCookie: string): string {
	return setCookie.split(";")[0] ?? "";
}

/**
 * Connects `rider` the way a browser would: the consent form, then Strava's
 * redirect back with a code for the rider's scopes. Throws if the app doesn't
 * end on `/me`.
 */
export async function connectThroughApp(
	ctx: Ctx,
	origin: string,
	rider: SampleRider,
): Promise<void> {
	const connect = await handleFetch(
		new Request(`${origin}/connect`, {
			method: "POST",
			headers: {
				Origin: origin,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: `consent=${CONSENT_VERSION}`,
		}),
		ctx,
	);
	const authorize = connect.headers.get("Location") ?? "";
	const state = URL.canParse(authorize)
		? new URL(authorize).searchParams.get("state")
		: null;
	const stateCookie = connect.headers.getSetCookie().map(cookieOf).join("; ");
	if (!state || !stateCookie) {
		throw new Error(
			`Seeding ${rider.firstName} (${rider.athleteId}): POST /connect answered ${connect.status}`,
		);
	}

	const scopes = rider.scopes.split(",");
	const query = new URLSearchParams({
		state,
		code: encodeCode({ athleteId: rider.athleteId, scopes }),
		scope: rider.scopes,
	});
	const callback = await handleFetch(
		new Request(`${origin}/auth/callback?${query}`, {
			headers: { Cookie: stateCookie },
		}),
		ctx,
	);
	const landed = callback.headers.get("Location");
	// A new rider has no rides yet, so lands on their own page.
	if (landed !== "/me") {
		throw new Error(
			`Seeding ${rider.firstName} (${rider.athleteId}): the callback answered ${callback.status} to ${landed}`,
		);
	}
}

/**
 * Names the sample data, so a database seeded from older samples is seeded
 * again (`seededWith`).
 */
export async function sampleFingerprint(): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(
			JSON.stringify([SAMPLE_RIDERS, SAMPLE_TEAM_EVENTS]),
		),
	);
	return [...new Uint8Array(digest)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * Deletes every rider, team event and fake activity, resets the request
 * budget, then stores the recipes, connects every club member and enters
 * their team events, then the shared ones. `seedDay` is the Europe/Berlin day
 * (`YYYY-MM-DD`) the recipes count back from. Only a seeding that finishes is
 * recorded, so one that fails is tried again.
 */
export async function seed(
	ctx: Ctx,
	origin: string,
	seedDay: string,
): Promise<void> {
	const db = ctx.env.DB;
	await ensureTable(db);
	await markSeeded(db, null);
	await db.batch([
		// Everything rider-owned cascades.
		db.prepare("DELETE FROM riders"),
		db.prepare("DELETE FROM team_events"),
		// The values migrations/0001_init.sql starts with.
		db.prepare(
			`UPDATE strava_rate_limit SET observed_at = 0, read_15m = 0,
				read_daily = 0, all_15m = 0, all_daily = 0, limit_read_15m = 100,
				limit_read_daily = 1000, limit_all_15m = 200, limit_all_daily = 2000,
				own_read_15m = 0, own_all_15m = 0, own_read_daily = 0,
				own_all_daily = 0, peak_read_15m = 0, peak_all_15m = 0
			WHERE id = 1`,
		),
		db.prepare("DELETE FROM usage_daily"),
		db.prepare("DELETE FROM usage_source_state"),
		db.prepare("DELETE FROM usage_alerts"),
		db.prepare("DELETE FROM blocked_athletes"),
		db.prepare("DELETE FROM removal_log"),
	]);
	await clearActivities(db);

	await insertActivities(
		db,
		SAMPLE_RIDERS.flatMap((rider) =>
			rider.rides.map((recipe) => ({
				athleteId: rider.athleteId,
				body: recipeToActivity(recipe, seedDay, ctx.env.SEASON_START_DATE, 0),
			})),
		),
	);

	// Non-members would only be turned away; their state is reached through
	// "Connect as" (research R6).
	const members = SAMPLE_RIDERS.filter((r) => r.clubMember);
	for (const rider of members) {
		await connectThroughApp(ctx, origin, rider);
		// `/connect` only takes the current version (feature 029 research R11).
		if (rider.consentVersion !== undefined) {
			await db.batch([
				db
					.prepare("DELETE FROM consent_records WHERE athlete_id = ?")
					.bind(rider.athleteId),
				db
					.prepare(
						"INSERT INTO consent_records (athlete_id, version, accepted_at) VALUES (?, ?, 1)",
					)
					.bind(rider.athleteId, rider.consentVersion),
			]);
		}
	}
	// Entered as an organiser would, with the change record (feature 014), once
	// the organiser's rider row exists.
	for (const rider of members) {
		for (const recipe of rider.events ?? []) {
			const { eventId } = await teamEventChange(ctx, {
				kind: "create-event",
				event: {
					kind: recipe.kind,
					date: eventDay(recipe, seedDay, ctx.env.SEASON_START_DATE),
					name: recipe.name,
				},
				by: EVENT_ORGANISER,
			});
			if (eventId === null) throw new Error("No event ID");
			await teamEventChange(ctx, {
				kind: "add-attendance",
				eventId,
				athleteIds: [rider.athleteId],
				by: EVENT_ORGANISER,
			});
		}
	}
	for (const recipe of SAMPLE_TEAM_EVENTS) {
		const { eventId } = await teamEventChange(ctx, {
			kind: "create-event",
			event: {
				kind: recipe.kind,
				date: eventDay(recipe, seedDay, ctx.env.SEASON_START_DATE),
				name: recipe.name,
			},
			by: EVENT_ORGANISER,
		});
		if (eventId === null) throw new Error("No event ID");
		if (recipe.attendees.length > 0) {
			await teamEventChange(ctx, {
				kind: "add-attendance",
				eventId,
				athleteIds: [...recipe.attendees],
				by: EVENT_ORGANISER,
			});
		}
		// Reported by the riders themselves (feature 019), an hour apart.
		const reports = recipe.reports ?? [];
		if (reports.length > 0) {
			await db.batch(
				reports.map((athleteId, i) =>
					insertReportStatement(db, eventId, athleteId, ctx.now() - 3600 * i),
				),
			);
		}
	}
	// The app never sets the flag; the maintainer does it in D1 (004 FR-004).
	for (const rider of SAMPLE_RIDERS.filter((r) => r.organiser)) {
		await db
			.prepare("UPDATE riders SET organiser = 1 WHERE athlete_id = ?")
			.bind(rider.athleteId)
			.run();
	}
	for (const rider of SAMPLE_RIDERS.filter((r) => r.administrator)) {
		await db
			.prepare("UPDATE riders SET administrator = 1 WHERE athlete_id = ?")
			.bind(rider.athleteId)
			.run();
	}
	await seedUsage(ctx);
	await markSeeded(db, await sampleFingerprint());
}

/** Today's share of Cloudflare's limits: one figure at each level (025 T016). */
const SAMPLE_SHARES: Record<CloudflareAllowance, number> = {
	cf_worker_requests: 0.4,
	cf_queue_operations: 0.85,
	cf_d1_rows_read: 0.97,
	cf_d1_rows_written: 0.12,
	cf_d1_storage_bytes: 0.03,
};

/** The one day of the sample history without a record, shown as a gap. */
const SAMPLE_GAP_DAYS_AGO = 12;
const SAMPLE_HISTORY_DAYS = 60;

/**
 * 60 days of synthetic usage with one empty day, and Cloudflare as answering
 * (research R12). The rate-limit row stays what the sample imports really caused,
 * so the budget works as ever and the live Strava figures are real ones.
 */
async function seedUsage(ctx: Ctx): Promise<void> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const today = utcDay(now);
	const statements: D1PreparedStatement[] = [sourceSuccessStatement(db, now)];
	for (let ago = 0; ago < SAMPLE_HISTORY_DAYS; ago++) {
		if (ago === SAMPLE_GAP_DAYS_AGO) continue;
		const day = daysBefore(today, ago);
		// A gentle, repeatable wave, never a figure from real use.
		const wave = 0.75 + 0.25 * Math.sin(ago / 3);
		const record = (
			allowance: RecordedAllowance,
			used: number,
			limit: number,
			team: boolean,
		): UsageRecord => ({
			day,
			allowance,
			used: Math.round(used),
			limit,
			teamUsed: team ? Math.round(used * 0.9) : null,
			peak15m: team ? Math.round(used / 12) : null,
			recordedAt: now,
		});
		statements.push(
			upsertUsageStatement(
				db,
				ctx.env,
				record("strava_read_daily", 400 * wave, 1000, true),
			),
			upsertUsageStatement(
				db,
				ctx.env,
				record("strava_all_daily", 450 * wave, 2000, true),
			),
			upsertUsageStatement(
				db,
				ctx.env,
				record("riders_connected", 30 + 10 * wave, ATHLETE_CAPACITY, true),
			),
		);
		for (const allowance of CLOUDFLARE_ALLOWANCES) {
			const limit = CLOUDFLARE_LIMITS[allowance];
			const share = SAMPLE_SHARES[allowance] * (ago === 0 ? 1 : wave * 0.7);
			statements.push(
				upsertUsageStatement(
					db,
					ctx.env,
					record(allowance, limit * share, limit, false),
				),
			);
		}
	}
	await db.batch(statements);
}
