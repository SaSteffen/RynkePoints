/** Where the app sends a signed-in rider: the Team page (issue #73). */
export const HOME = "/team";

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
