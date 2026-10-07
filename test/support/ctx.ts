import { env } from "cloudflare:test";
import { CONSENT_VERSION } from "../../src/consent";
import { encryptToken } from "../../src/crypto/encrypt";
import type { Ctx } from "../../src/ctx";
import {
	createOAuthStateCookie,
	createSessionCookie,
} from "../../src/http/session";
import { CATALOGS, type Catalogs } from "../../src/i18n/catalogs";
import { ACTIVITY_FIGURES_VERSION } from "../../src/strava/activity";
import type { WorkMessage } from "../../src/work/messages";
import { initialTokens } from "./fake-strava";
import { ATHLETE_A, firstNameFor, NOW } from "./fixtures";

export const ORIGIN = "https://rynke.test";

export interface SentMessage {
	body: WorkMessage;
	delaySeconds: number | undefined;
}

export type FakeQueue = Ctx["queue"] & { sent: SentMessage[] };

export type TestCtx = Ctx & { queue: FakeQueue };

const sendResponse = {
	metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
};

export function makeCtx(
	options: { now?: number; catalogs?: Catalogs } = {},
): TestCtx {
	const sent: SentMessage[] = [];
	const queue: FakeQueue = {
		sent,
		async send(body, opts) {
			sent.push({ body, delaySeconds: opts?.delaySeconds });
			return sendResponse;
		},
		async sendBatch(messages, opts) {
			for (const m of messages) {
				sent.push({
					body: m.body,
					delaySeconds: m.delaySeconds ?? opts?.delaySeconds,
				});
			}
			return sendResponse;
		},
	};
	const now = options.now ?? NOW;
	return {
		env,
		queue,
		now: () => now,
		catalogs: options.catalogs ?? CATALOGS,
	};
}

export interface SeedRiderOptions {
	athleteId?: number;
	firstName?: string;
	status?: "connected" | "needs_reconnect";
	reconnectRequestedAt?: number | null;
	scopeReadAll?: boolean;
	/** Defaults to false; true adds `activity:write` to the default scopes. */
	scopeWrite?: boolean;
	scopes?: string;
	importStatus?: "pending" | "running" | "done";
	/** Defaults to the current version; 0 is a rider stored before `0002`. */
	figuresVersion?: number;
	accessToken?: string;
	refreshToken?: string;
	expiresAt?: number;
	/**
	 * Inserts a consent record of this version accepted now. Defaults to null:
	 * no record, like a rider connected before `0004`.
	 */
	consentVersion?: number | null;
}

/** Inserts a rider and encrypted credentials straight into D1. */
export async function seedRider(ctx: Ctx, options: SeedRiderOptions = {}) {
	const now = ctx.now();
	const athleteId = options.athleteId ?? ATHLETE_A;
	const tokens = initialTokens(athleteId);
	const status = options.status ?? "connected";
	const scopeReadAll = options.scopeReadAll ?? true;
	const scopeWrite = options.scopeWrite ?? false;
	const defaultScopes =
		(scopeReadAll
			? "read,activity:read,activity:read_all"
			: "read,activity:read") + (scopeWrite ? ",activity:write" : "");
	const rider = {
		athleteId,
		accessToken: options.accessToken ?? tokens.accessToken,
		refreshToken: options.refreshToken ?? tokens.refreshToken,
		expiresAt: options.expiresAt ?? now + 6 * 3600,
	};
	const key = ctx.env.TOKEN_ENCRYPTION_KEY;
	const consentVersion = options.consentVersion ?? null;
	await ctx.env.DB.batch([
		ctx.env.DB.prepare(
			`INSERT INTO riders (athlete_id, first_name, status, scope_read_all,
				scope_write, scopes, connected_at, scopes_updated_at,
				membership_checked_at, import_status, reconnect_requested_at,
				figures_version)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			athleteId,
			options.firstName ?? firstNameFor(athleteId),
			status,
			scopeReadAll ? 1 : 0,
			scopeWrite ? 1 : 0,
			options.scopes ?? defaultScopes,
			now,
			now,
			now,
			options.importStatus ?? "done",
			status === "needs_reconnect"
				? (options.reconnectRequestedAt ?? now)
				: null,
			options.figuresVersion ?? ACTIVITY_FIGURES_VERSION,
		),
		ctx.env.DB.prepare(
			`INSERT INTO strava_credentials (athlete_id, access_token_enc,
				refresh_token_enc, expires_at) VALUES (?, ?, ?, ?)`,
		).bind(
			athleteId,
			await encryptToken(rider.accessToken, key),
			await encryptToken(rider.refreshToken, key),
			rider.expiresAt,
		),
		...(consentVersion === null
			? []
			: [
					ctx.env.DB.prepare(
						`INSERT INTO consent_records (athlete_id, version, accepted_at)
						VALUES (?, ?, ?)`,
					).bind(athleteId, consentVersion, now),
				]),
	]);
	return rider;
}

/** Empties every table and resets the rate-limit row to zero usage. */
export async function resetDb(): Promise<void> {
	await env.DB.batch([
		env.DB.prepare("DELETE FROM consent_records"),
		env.DB.prepare("DELETE FROM failed_work"),
		env.DB.prepare("DELETE FROM rynke_balances"),
		env.DB.prepare("DELETE FROM ride_results"),
		env.DB.prepare("DELETE FROM activities"),
		env.DB.prepare("DELETE FROM strava_credentials"),
		env.DB.prepare("DELETE FROM riders"),
		env.DB.prepare(
			`UPDATE strava_rate_limit SET observed_at = 0, read_15m = 0,
				read_daily = 0, all_15m = 0, all_daily = 0, limit_read_15m = 100,
				limit_read_daily = 1000, limit_all_15m = 200, limit_all_daily = 2000
			WHERE id = 1`,
		),
	]);
}

export async function tableCounts(): Promise<Record<string, number>> {
	const counts: Record<string, number> = {};
	for (const table of [
		"riders",
		"strava_credentials",
		"activities",
		"consent_records",
		"failed_work",
		"strava_rate_limit",
		"ride_results",
		"rynke_balances",
	]) {
		counts[table] =
			(await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<number>(
				"n",
			)) ?? 0;
	}
	return counts;
}

export interface RequestOptions {
	method?: string;
	form?: Record<string, string>;
	cookies?: Record<string, string>;
	acceptLanguage?: string;
	/** `null` sends no Origin header; POSTs default to the same origin. */
	origin?: string | null;
}

export function request(path: string, options: RequestOptions = {}): Request {
	const method = options.method ?? (options.form ? "POST" : "GET");
	const headers = new Headers();
	if (options.cookies) {
		headers.set(
			"Cookie",
			Object.entries(options.cookies)
				.map(([k, v]) => `${k}=${v}`)
				.join("; "),
		);
	}
	if (options.acceptLanguage !== undefined) {
		headers.set("Accept-Language", options.acceptLanguage);
	}
	const origin = options.origin === undefined ? ORIGIN : options.origin;
	if (method === "POST" && origin !== null) headers.set("Origin", origin);
	let body: string | undefined;
	if (options.form) {
		headers.set("Content-Type", "application/x-www-form-urlencoded");
		body = new URLSearchParams(options.form).toString();
	}
	return new Request(`${ORIGIN}${path}`, { method, headers, body });
}

/** The `name=value` pair of a `Set-Cookie` header, as a `{ name: value }` map. */
export function cookiePair(setCookie: string): Record<string, string> {
	const pair = setCookie.split(";")[0] ?? "";
	const eq = pair.indexOf("=");
	return { [pair.slice(0, eq)]: pair.slice(eq + 1) };
}

/** A valid signed `rp_session` cookie for `athleteId`. */
export async function sessionCookie(
	ctx: Ctx,
	athleteId: number,
): Promise<Record<string, string>> {
	return cookiePair(await createSessionCookie(athleteId, ctx.now(), ctx.env));
}

/** A valid signed `rp_oauth_state` cookie carrying `state` and a consent version. */
export async function oauthStateCookie(
	ctx: Ctx,
	state: string,
	consentVersion = CONSENT_VERSION,
): Promise<Record<string, string>> {
	return cookiePair(
		await createOAuthStateCookie(state, consentVersion, ctx.now(), ctx.env),
	);
}
