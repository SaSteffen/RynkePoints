import {
	signValue,
	type VerifiedValue,
	verifySignedValue,
} from "../crypto/sign";
import type { Ctx } from "../ctx";
import { getCookie } from "./cookies";

// Signed session and OAuth state cookies, plus the Origin check for POSTs
// (research R9). The session slides: page views renew it (010 research R10).

export const SESSION_COOKIE = "rp_session";
export const OAUTH_STATE_COOKIE = "rp_oauth_state";
/** 180 days after the last visit (010 FR-007). */
export const SESSION_MAX_AGE = 180 * 24 * 3600;
/** A session is renewed at most once a day. */
const RENEW_AFTER = 24 * 3600;
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
): Promise<VerifiedValue | null> {
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

/** The signed-in athlete ID and when the session ends, or null. */
export async function readSessionExpiry(
	request: Request,
	env: Keys,
	now: number,
): Promise<{ athleteId: number; expiresAt: number } | null> {
	const signed = await readSigned(request, SESSION_COOKIE, env, now);
	return signed && /^\d+$/.test(signed.value)
		? { athleteId: Number(signed.value), expiresAt: signed.expiresAt }
		: null;
}

/** The signed-in athlete ID, or null. */
export async function readSession(
	request: Request,
	env: Keys,
	now: number,
): Promise<number | null> {
	return (await readSessionExpiry(request, env, now))?.athleteId ?? null;
}

/**
 * `response` with a fresh session cookie if the request's session is valid and
 * more than a day older than a fresh one, unless the response sets its own
 * (010 research R10, contracts/http-routes.md "Session renewal").
 */
export async function renewSession(
	request: Request,
	response: Response,
	ctx: Ctx,
): Promise<Response> {
	const now = ctx.now();
	const session = await readSessionExpiry(request, ctx.env, now);
	if (!session || session.expiresAt >= now + SESSION_MAX_AGE - RENEW_AFTER) {
		return response;
	}
	const setsSession = response.headers
		.getSetCookie()
		.some((c) => c.startsWith(`${SESSION_COOKIE}=`));
	if (setsSession) return response;
	const renewed = new Response(response.body, response);
	renewed.headers.append(
		"Set-Cookie",
		await createSessionCookie(session.athleteId, now, ctx.env),
	);
	return renewed;
}

export function clearSessionCookie(): string {
	return cookie(SESSION_COOKIE, "", 0);
}

export interface OAuthState {
	state: string;
	/** The consent version the rider agreed to on the way in; 0 for none (R21). */
	consentVersion: number;
}

/** Signs `<state>:<consentVersion>`; the signed format reserves `.`. */
export function createOAuthStateCookie(
	state: string,
	consentVersion: number,
	now: number,
	env: Keys,
): Promise<string> {
	return signedCookie(
		OAUTH_STATE_COOKIE,
		`${state}:${consentVersion}`,
		OAUTH_STATE_MAX_AGE,
		now,
		env,
	);
}

/** Null if missing, tampered, expired or without a consent version. */
export async function readOAuthState(
	request: Request,
	env: Keys,
	now: number,
): Promise<OAuthState | null> {
	const value = (await readSigned(request, OAUTH_STATE_COOKIE, env, now))
		?.value;
	const colon = value?.lastIndexOf(":") ?? -1;
	if (!value || colon === -1) return null;
	const version = value.slice(colon + 1);
	if (!/^\d+$/.test(version)) return null;
	return { state: value.slice(0, colon), consentVersion: Number(version) };
}

export function clearOAuthStateCookie(): string {
	return cookie(OAUTH_STATE_COOKIE, "", 0);
}

/** True only if the `Origin` header equals the request URL's origin. */
export function isSameOrigin(request: Request): boolean {
	return request.headers.get("Origin") === new URL(request.url).origin;
}
