import { signValue, verifySignedValue } from "../crypto/sign";
import { getCookie } from "./cookies";

// Signed session and OAuth state cookies, plus the Origin check for POSTs
// (research R9).

export const SESSION_COOKIE = "rp_session";
export const OAUTH_STATE_COOKIE = "rp_oauth_state";
const SESSION_MAX_AGE = 30 * 24 * 3600;
const OAUTH_STATE_MAX_AGE = 10 * 60;

type Keys = Pick<Env, "SESSION_SIGNING_KEY">;

function cookie(name: string, value: string, maxAge: number): string {
	return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

async function signedCookie(
	name: string,
	value: string,
	maxAge: number,
	now: number,
	env: Keys,
): Promise<string> {
	const signed = await signValue(
		value,
		now + maxAge,
		env.SESSION_SIGNING_KEY,
		name,
	);
	return cookie(name, signed, maxAge);
}

async function readSigned(
	request: Request,
	name: string,
	env: Keys,
	now: number,
): Promise<string | null> {
	const value = getCookie(request, name);
	return value
		? verifySignedValue(value, env.SESSION_SIGNING_KEY, now, name)
		: null;
}

export function createSessionCookie(
	athleteId: number,
	now: number,
	env: Keys,
): Promise<string> {
	return signedCookie(
		SESSION_COOKIE,
		String(athleteId),
		SESSION_MAX_AGE,
		now,
		env,
	);
}

/** The signed-in athlete ID, or null. */
export async function readSession(
	request: Request,
	env: Keys,
	now: number,
): Promise<number | null> {
	const value = await readSigned(request, SESSION_COOKIE, env, now);
	return value && /^\d+$/.test(value) ? Number(value) : null;
}

export function clearSessionCookie(): string {
	return cookie(SESSION_COOKIE, "", 0);
}

export function createOAuthStateCookie(
	state: string,
	now: number,
	env: Keys,
): Promise<string> {
	return signedCookie(OAUTH_STATE_COOKIE, state, OAUTH_STATE_MAX_AGE, now, env);
}

export function readOAuthState(
	request: Request,
	env: Keys,
	now: number,
): Promise<string | null> {
	return readSigned(request, OAUTH_STATE_COOKIE, env, now);
}

export function clearOAuthStateCookie(): string {
	return cookie(OAUTH_STATE_COOKIE, "", 0);
}

/** True only if the `Origin` header equals the request URL's origin. */
export function isSameOrigin(request: Request): boolean {
	return request.headers.get("Origin") === new URL(request.url).origin;
}
