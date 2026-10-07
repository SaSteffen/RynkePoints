import { CONSENT_VERSION } from "../../src/consent";
import type { Ctx } from "../../src/ctx";
import { handleFetch } from "../../src/index";
import { recipeToActivity, SAMPLE_RIDERS, type SampleRider } from "./samples";
import { clearActivities, ensureTable, insertActivities } from "./store";
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
	if (landed !== "/me") {
		throw new Error(
			`Seeding ${rider.firstName} (${rider.athleteId}): the callback answered ${callback.status} to ${landed}`,
		);
	}
}

/**
 * Deletes every rider and fake activity, resets the request budget, then
 * stores the recipes and connects every club member. `seedDay` is the
 * Europe/Berlin day (`YYYY-MM-DD`) the recipes count back from.
 */
export async function seed(
	ctx: Ctx,
	origin: string,
	seedDay: string,
): Promise<void> {
	const db = ctx.env.DB;
	await ensureTable(db);
	await db.batch([
		// Everything rider-owned cascades.
		db.prepare("DELETE FROM riders"),
		// The values migrations/0001_init.sql starts with.
		db.prepare(
			`UPDATE strava_rate_limit SET observed_at = 0, read_15m = 0,
				read_daily = 0, all_15m = 0, all_daily = 0, limit_read_15m = 100,
				limit_read_daily = 1000, limit_all_15m = 200, limit_all_daily = 2000
			WHERE id = 1`,
		),
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
	for (const rider of SAMPLE_RIDERS.filter((r) => r.clubMember)) {
		await connectThroughApp(ctx, origin, rider);
	}
}
