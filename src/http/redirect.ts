import { hasActivities } from "../db/activities";

/**
 * Where the app sends a signed-in rider: their own page until a first ride is
 * imported, then the Team page (issue #73).
 */
export async function home(db: D1Database, athleteId: number): Promise<string> {
	return (await hasActivities(db, athleteId)) ? "/team" : "/me";
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
