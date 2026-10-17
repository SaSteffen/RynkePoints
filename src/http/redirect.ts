import type { Ctx } from "../ctx";
import { hasNewBadges } from "./sections/badges";

/**
 * Where the app sends a signed-in rider: the badges page while it has a new
 * badge to reveal (issue #150), else their own page until a first ride is
 * imported, then the Team page (issue #73). One read decides, unless the
 * rider has Rynke and so may have badges.
 */
export async function home(ctx: Ctx, athleteId: number): Promise<string> {
	const row = await ctx.env.DB.prepare(
		`SELECT connected_at,
			EXISTS (SELECT 1 FROM rynke_balances WHERE athlete_id = ?1) AS ready,
			EXISTS (SELECT 1 FROM activities WHERE athlete_id = ?1) AS rode
		FROM riders WHERE athlete_id = ?1`,
	)
		.bind(athleteId)
		.first<{ connected_at: number; ready: number; rode: number }>();
	if (
		row?.ready === 1 &&
		(await hasNewBadges(ctx, athleteId, row.connected_at))
	) {
		return "/me/badges";
	}
	return row?.rode === 1 ? "/team" : "/me";
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
