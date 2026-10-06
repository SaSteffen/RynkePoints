import { clientId, clientSecret } from "../config";
import { getCredentials, saveCredentials } from "../db/riders";
import { deferUntilNextWindow } from "./rate-limit";
import {
	STRAVA_ORIGIN,
	type StravaCtx,
	type StravaResult,
	stravaFetch,
	transient,
} from "./result";

// Token exchange, refresh-before-use with rotation, and revocation
// (research R2, contracts/strava-api-usage.md).

const REFRESH_MARGIN_SECONDS = 300;
const TOKEN_ENDPOINT = "POST /oauth/token";
const REVOKE_ENDPOINT = "POST /oauth/revoke";

export interface TokenExchange {
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	athleteId: number;
	firstName: string;
}

interface TokenBody {
	access_token?: unknown;
	refresh_token?: unknown;
	expires_at?: unknown;
	athlete?: { id?: unknown; firstname?: unknown };
}

function postToken(ctx: StravaCtx, form: Record<string, string>) {
	return stravaFetch(ctx, TOKEN_ENDPOINT, `${STRAVA_ORIGIN}/oauth/token`, {
		method: "POST",
		body: new URLSearchParams({
			client_id: clientId(ctx.env),
			client_secret: clientSecret(ctx.env),
			...form,
		}),
	});
}

function tokensOf(body: TokenBody) {
	const { access_token, refresh_token, expires_at } = body;
	if (
		typeof access_token !== "string" ||
		typeof refresh_token !== "string" ||
		typeof expires_at !== "number"
	) {
		return null;
	}
	return {
		accessToken: access_token,
		refreshToken: refresh_token,
		expiresAt: expires_at,
	};
}

/** Exchanges an OAuth code. `forbidden` means Strava's capacity is reached (R14). */
export async function exchangeCode(
	ctx: StravaCtx,
	code: string,
): Promise<StravaResult<TokenExchange>> {
	const res = await postToken(ctx, { grant_type: "authorization_code", code });
	if (!(res instanceof Response)) return res;
	if (res.ok) {
		const body = (await res.json()) as TokenBody;
		const tokens = tokensOf(body);
		const { id, firstname } = body.athlete ?? {};
		if (!tokens || typeof id !== "number" || typeof firstname !== "string") {
			return transient(TOKEN_ENDPOINT, "malformed response");
		}
		return {
			kind: "ok",
			value: { ...tokens, athleteId: id, firstName: firstname },
		};
	}
	if (res.status === 403) return { kind: "forbidden" };
	if (res.status === 400 || res.status === 401) return { kind: "unauthorized" };
	if (res.status === 429) {
		return { kind: "budget", delaySeconds: deferUntilNextWindow(ctx.now()) };
	}
	return transient(TOKEN_ENDPOINT, `HTTP ${res.status}`);
}

async function refresh(
	ctx: StravaCtx,
	athleteId: number,
	refreshToken: string,
): Promise<StravaResult<string>> {
	const res = await postToken(ctx, {
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});
	if (!(res instanceof Response)) return res;
	if (res.ok) {
		const tokens = tokensOf((await res.json()) as TokenBody);
		if (!tokens) return transient(TOKEN_ENDPOINT, "malformed response");
		// Strava invalidates the old refresh token at once: persist the new one.
		await saveCredentials(ctx.env, athleteId, tokens);
		return { kind: "ok", value: tokens.accessToken };
	}
	if (res.status === 400 || res.status === 401) {
		return { kind: "refresh-refused" };
	}
	if (res.status === 429) {
		return { kind: "budget", delaySeconds: deferUntilNextWindow(ctx.now()) };
	}
	return transient(TOKEN_ENDPOINT, `HTTP ${res.status}`);
}

/**
 * The rider's access token, refreshed first if it expires within 5 minutes
 * (or always, with `force`, after a 401).
 */
export async function getAccessToken(
	ctx: StravaCtx,
	athleteId: number,
	options: { force?: boolean } = {},
): Promise<StravaResult<string>> {
	const creds = await getCredentials(ctx.env, athleteId);
	if (!creds) return { kind: "refresh-refused" };
	if (!options.force && creds.expiresAt >= ctx.now() + REFRESH_MARGIN_SECONDS) {
		return { kind: "ok", value: creds.accessToken };
	}
	return refresh(ctx, athleteId, creds.refreshToken);
}

/**
 * Revokes a token. Network errors, 5xx and 429 are transient; any other
 * answer means there is nothing left to revoke.
 */
export async function revokeToken(
	ctx: StravaCtx,
	token: string,
): Promise<StravaResult<null>> {
	const credentials = btoa(`${clientId(ctx.env)}:${clientSecret(ctx.env)}`);
	const res = await stravaFetch(
		ctx,
		REVOKE_ENDPOINT,
		`${STRAVA_ORIGIN}/oauth/revoke`,
		{
			method: "POST",
			headers: { Authorization: `Basic ${credentials}` },
			body: new URLSearchParams({ token }),
		},
	);
	if (!(res instanceof Response)) return res;
	if (res.status >= 500 || res.status === 429) {
		return transient(REVOKE_ENDPOINT, `HTTP ${res.status}`);
	}
	return { kind: "ok", value: null };
}

/**
 * Revokes a stored rider's refresh token without refreshing first, so it also
 * works for `needs_reconnect` riders. No credentials means nothing to revoke.
 */
export async function revokeStoredToken(
	ctx: StravaCtx,
	athleteId: number,
): Promise<StravaResult<null>> {
	const creds = await getCredentials(ctx.env, athleteId);
	if (!creds) return { kind: "ok", value: null };
	return revokeToken(ctx, creds.refreshToken);
}
