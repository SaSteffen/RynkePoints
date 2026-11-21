import { teamId } from "../config";
import {
	signValue,
	type VerifiedValue,
	verifySignedValue,
} from "../crypto/sign";
import type { Ctx } from "../ctx";
import { isSessionCurrent } from "../db/riders";
import { getCookie } from "./cookies";

// Signed session and OAuth state cookies, plus the Origin check for POSTs
// (research R9). The session slides: page views renew it (010 research R10).
// It carries the rider's session epoch, and only the current one is signed
// in, so a rider can end every session (issue #314). Each signature covers
// the team, so a value signed for one team never verifies at another, even
// with the same key (issue #316).

export const SESSION_COOKIE = "rp_session";
export const OAUTH_STATE_COOKIE = "rp_oauth_state";
/** 180 days after the last visit (010 FR-007). */
export const SESSION_MAX_AGE = 180 * 24 * 3600;
/** A session is renewed at most once a day. */
const RENEW_AFTER = 24 * 3600;
const OAUTH_STATE_MAX_AGE = 10 * 60;

export type Keys = Pick<Env, "SESSION_SIGNING_KEY" | "TEAM_ID">;

/** What a signature of `name` covers: the team and the name (issue #316). */
export function signingContext(
	env: Pick<Env, "TEAM_ID">,
	name: string,
): string {
	return `${teamId(env)}:${name}`;
}

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
		signingContext(env, name),
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
		? verifySignedValue(
				value,
				env.SESSION_SIGNING_KEY,
				now,
				signingContext(env, name),
			)
		: null;
}

/** A rider and a session epoch, signed in only while it is theirs (#314). */
export interface Session {
	athleteId: number;
	epoch: number;
}

/** Signs `<athleteId>:<epoch>`; the signed format reserves `.`. */
export function createSessionCookie(
	{ athleteId, epoch }: Session,
	now: number,
	env: Keys,
): Promise<string> {
	return signedCookie(
		SESSION_COOKIE,
		`${athleteId}:${epoch}`,
		SESSION_MAX_AGE,
		now,
		env,
	);
}

/** What a validly signed session cookie claims. */
export interface SessionCookie extends Session {
	expiresAt: number;
	/** Signed before issues #314 and #316; renewal reissues it in the new form. */
	legacy: boolean;
}

/**
 * The session cookie's claim if its signature is valid and unexpired, else
 * null. Whether it is still signed in is the rider's epoch to decide: see
 * `readSession`, and `readViewer`, which compares the rider it reads.
 */
export async function readSessionCookie(
	request: Request,
	env: Keys,
	now: number,
): Promise<SessionCookie | null> {
	const signed = await readSigned(request, SESSION_COOKIE, env, now);
	const parts = signed?.value.match(/^(\d+):(\d+)$/);
	if (signed && parts) {
		return {
			athleteId: Number(parts[1]),
			epoch: Number(parts[2]),
			expiresAt: signed.expiresAt,
			legacy: false,
		};
	}
	return readLegacySessionCookie(request, env, now);
}

/**
 * A cookie from before issues #314 and #316: the athlete ID alone, signed
 * without the team. It counts as epoch 0, which every rider stored before
 * then has, so the deploy signs nobody out. Remove after one release, with
 * the follow-up issue.
 */
async function readLegacySessionCookie(
	request: Request,
	env: Keys,
	now: number,
): Promise<SessionCookie | null> {
	const value = getCookie(request, SESSION_COOKIE);
	const signed = value
		? await verifySignedValue(
				value,
				env.SESSION_SIGNING_KEY,
				now,
				SESSION_COOKIE,
			)
		: null;
	return signed && /^\d+$/.test(signed.value)
		? {
				athleteId: Number(signed.value),
				epoch: 0,
				expiresAt: signed.expiresAt,
				legacy: true,
			}
		: null;
}

/**
 * The signed-in athlete ID, or null: also null when the rider is gone or the
 * session was ended (issue #314). One D1 read, for routes that don't read the
 * rider anyway; those use `readViewer`.
 */
export async function readSession(
	request: Request,
	env: Keys & Pick<Env, "DB">,
	now: number,
): Promise<number | null> {
	const session = await readSessionCookie(request, env, now);
	if (!session) return null;
	return (await isSessionCurrent(env.DB, session.athleteId, session.epoch))
		? session.athleteId
		: null;
}

/**
 * `response` with a fresh session cookie if the request's session is valid and
 * more than a day older than a fresh one, or from before issues #314 and #316,
 * unless the response sets its own (010 research R10, contracts/http-routes.md
 * "Session renewal"). The fresh one keeps the epoch, so an ended session stays
 * ended.
 */
export async function renewSession(
	request: Request,
	response: Response,
	ctx: Ctx,
): Promise<Response> {
	const now = ctx.now();
	const session = await readSessionCookie(request, ctx.env, now);
	if (
		!session ||
		(!session.legacy &&
			session.expiresAt >= now + SESSION_MAX_AGE - RENEW_AFTER)
	) {
		return response;
	}
	const setsSession = response.headers
		.getSetCookie()
		.some((c) => c.startsWith(`${SESSION_COOKIE}=`));
	if (setsSession) return response;
	const renewed = new Response(response.body, response);
	renewed.headers.append(
		"Set-Cookie",
		await createSessionCookie(session, now, ctx.env),
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
	/** Where the callback returns the rider (feature 011 research R9). */
	next: string;
}

/**
 * Signs `<state>:<consentVersion>:<next>`; the signed format reserves `.`, and
 * `next` is one of `safeNext()`'s paths, none of which contains `:`.
 */
export function createOAuthStateCookie(
	state: string,
	consentVersion: number,
	next: string,
	now: number,
	env: Keys,
): Promise<string> {
	return signedCookie(
		OAUTH_STATE_COOKIE,
		`${state}:${consentVersion}:${next}`,
		OAUTH_STATE_MAX_AGE,
		now,
		env,
	);
}

/**
 * Null if missing, tampered, expired or without a consent version. A value
 * from before feature 011 has no `next` and returns home.
 */
export async function readOAuthState(
	request: Request,
	env: Keys,
	now: number,
): Promise<OAuthState | null> {
	const value = (await readSigned(request, OAUTH_STATE_COOKIE, env, now))
		?.value;
	const parts = value?.match(/^([^:]*):(\d+)(?::(.*))?$/);
	if (!parts) return null;
	return {
		state: parts[1] ?? "",
		consentVersion: Number(parts[2]),
		next: parts[3] || "/",
	};
}

export function clearOAuthStateCookie(): string {
	return cookie(OAUTH_STATE_COOKIE, "", 0);
}

/** True only if the `Origin` header equals the request URL's origin. */
export function isSameOrigin(request: Request): boolean {
	return request.headers.get("Origin") === new URL(request.url).origin;
}
