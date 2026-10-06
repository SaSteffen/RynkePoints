import { handleFetch } from "../../src/index";
import { oauthStateCookie, request, type TestCtx } from "./ctx";
import type { FakeStrava } from "./fake-strava";

// Drives GET /auth/callback the way Strava's redirect would, with a valid
// rp_oauth_state cookie unless told otherwise.

export const SCOPES_ALL = "read,activity:read,activity:read_all";
export const SCOPES_SHARED = "read,activity:read";

const STATE = "synthetic-state-0001";
let nextCode = 1;

export interface CallbackOptions {
	/** Callback query parameters; `state` defaults to the cookie's state. */
	params?: Record<string, string>;
	/** State carried by the cookie; `null` sends no state cookie. */
	cookieState?: string | null;
	cookies?: Record<string, string>;
}

export async function callback(
	ctx: TestCtx,
	options: CallbackOptions = {},
): Promise<Response> {
	const cookieState =
		options.cookieState === undefined ? STATE : options.cookieState;
	const params = new URLSearchParams({ state: STATE, ...options.params });
	const cookies = {
		...(cookieState === null ? {} : await oauthStateCookie(ctx, cookieState)),
		...options.cookies,
	};
	return handleFetch(request(`/auth/callback?${params}`, { cookies }), ctx);
}

/**
 * The rider approves on Strava with `scope`: the fake issues a code for them
 * and grants exactly those scopes, then the callback runs.
 */
export async function approve(
	ctx: TestCtx,
	fake: FakeStrava,
	athleteId: number,
	scope = SCOPES_ALL,
	cookies: Record<string, string> = {},
): Promise<Response> {
	const athlete =
		fake.athletes.get(athleteId) ?? fake.addAthlete({ id: athleteId });
	athlete.scopes = scope.split(",");
	const code = `synthetic-code-${nextCode++}`;
	fake.codes.set(code, athleteId);
	return callback(ctx, { params: { code, scope }, cookies });
}

/** Every `Set-Cookie` header of a response, keyed by cookie name. */
export function setCookies(res: Response): Record<string, string> {
	const out: Record<string, string> = {};
	for (const header of res.headers.getSetCookie()) {
		out[header.slice(0, header.indexOf("="))] = header;
	}
	return out;
}
