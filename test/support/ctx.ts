import { env } from "cloudflare:test";
import { encryptToken } from "../../src/crypto/encrypt";
import type { Ctx } from "../../src/ctx";
import { CATALOGS, type Catalogs } from "../../src/i18n/catalogs";
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
	scopes?: string;
	importStatus?: "pending" | "running" | "done";
	accessToken?: string;
	refreshToken?: string;
	expiresAt?: number;
}

/** Inserts a rider and encrypted credentials straight into D1. */
export async function seedRider(ctx: Ctx, options: SeedRiderOptions = {}) {
	const now = ctx.now();
	const athleteId = options.athleteId ?? ATHLETE_A;
	const tokens = initialTokens(athleteId);
	const status = options.status ?? "connected";
	const scopeReadAll = options.scopeReadAll ?? true;
	const rider = {
		athleteId,
		accessToken: options.accessToken ?? tokens.accessToken,
		refreshToken: options.refreshToken ?? tokens.refreshToken,
		expiresAt: options.expiresAt ?? now + 6 * 3600,
	};
	const key = ctx.env.TOKEN_ENCRYPTION_KEY;
	await ctx.env.DB.batch([
		ctx.env.DB.prepare(
			`INSERT INTO riders (athlete_id, first_name, status, scope_read_all, scopes,
				connected_at, scopes_updated_at, membership_checked_at, import_status,
				reconnect_requested_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			athleteId,
			options.firstName ?? firstNameFor(athleteId),
			status,
			scopeReadAll ? 1 : 0,
			options.scopes ??
				(scopeReadAll
					? "read,activity:read,activity:read_all"
					: "read,activity:read"),
			now,
			now,
			now,
			options.importStatus ?? "done",
			status === "needs_reconnect"
				? (options.reconnectRequestedAt ?? now)
				: null,
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
	]);
	return rider;
}

/** Empties every table and resets the rate-limit row to zero usage. */
export async function resetDb(): Promise<void> {
	await env.DB.batch([
		env.DB.prepare("DELETE FROM failed_work"),
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
		"failed_work",
		"strava_rate_limit",
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
