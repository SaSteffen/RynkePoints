import type { Ctx } from "../ctx";
import { hasActivities } from "../db/activities";
import { hasNewBadges } from "./sections/badges";

/**
 * Where the app sends a signed-in rider: the badges page while it has a new
 * badge to reveal (issue #150), else their own page until a first ride is
 * imported, then the Team page (issue #73).
 */
export async function home(ctx: Ctx, athleteId: number): Promise<string> {
	if (await hasNewBadges(ctx, athleteId)) return "/me/badges";
	return (await hasActivities(ctx.env.DB, athleteId)) ? "/team" : "/me";
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
