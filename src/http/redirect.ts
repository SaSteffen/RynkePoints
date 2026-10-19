import type { Ctx } from "../ctx";
import { hasNewBadges, newBadgesStatements } from "./sections/badges";

/**
 * Where the app sends a signed-in rider: the badges page while it has a new
 * badge to reveal (issue #150), else their own page until a first ride is
 * imported, then the Team page (issue #73).
 */
export async function home(ctx: Ctx, athleteId: number): Promise<string> {
	return (await homeOf(ctx, athleteId)) ?? "/me";
}

/**
 * `home()`, or null when the rider is gone, which the start page treats as
 * signed out (research R9). One batch decides, with what the badges need, so
 * the app starts after one round trip (issue #185).
 */
export async function homeOf(
	ctx: Ctx,
	athleteId: number,
): Promise<string | null> {
	const db = ctx.env.DB;
	const [rows, ...badges] = await db.batch([
		db
			.prepare(
				`SELECT connected_at,
				EXISTS (SELECT 1 FROM rynke_balances WHERE athlete_id = ?1) AS ready,
				EXISTS (SELECT 1 FROM activities WHERE athlete_id = ?1) AS rode
			FROM riders WHERE athlete_id = ?1`,
			)
			.bind(athleteId),
		...newBadgesStatements(db, athleteId),
	]);
	const row = (
		rows?.results as
			| { connected_at: number; ready: number; rode: number }[]
			| undefined
	)?.[0];
	if (!row) return null;
	if (row.ready === 1 && hasNewBadges(ctx, badges, row.connected_at)) {
		return "/me/badges";
	}
	return row.rode === 1 ? "/team" : "/me";
}

/** A redirect, plus any cookies to set on the way. */
export function redirect(
	location: string,
	status: 301 | 302 | 303,
	cookies: string[] = [],
): Response {
	const headers = new Headers({ Location: location });
	for (const cookie of cookies) headers.append("Set-Cookie", cookie);
	return new Response(null, { status, headers });
}
