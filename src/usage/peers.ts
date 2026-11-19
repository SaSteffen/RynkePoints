import type { Ctx } from "../ctx";
import { readStravaUsage } from "../db/rate-limit";
import { connectedCountStatement } from "../db/riders";
import { ownCountsStatement } from "../db/usage";
import { parseTeamOrigins, type TeamOrigin } from "../team-origins";
import {
	daysBefore,
	historyStart,
	STRAVA_RECORDED,
	utcDay,
} from "./allowances";
import { currentStrava } from "./figures";

// The usage exchange between teams (feature 026 FR-039, FR-041,
// contracts/usage-exchange.md). Each team serves its own counts at
// `/admin/usage/export`, and each hourly recording pulls the other teams'. Only
// counts per allowance and day cross: no rider identifiers. The admin view then
// reads D1 alone, so a team that doesn't answer can't slow it down or break it.

export type Peer = TeamOrigin;

/** The allowances whose own count a team exports: Strava's daily, and riders. */
export const EXCHANGED = STRAVA_RECORDED;
export type ExchangedAllowance = (typeof EXCHANGED)[number];

export interface TeamCount {
	day: string;
	allowance: ExchangedAllowance;
	count: number;
}

export interface UsageExport {
	team: string;
	days: TeamCount[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const FETCH_TIMEOUT_MS = 5_000;
/** Thirteen months of three allowances, with room to spare. */
const MAX_COUNTS = 1_500;
/** How far back a team asks after it missed days. */
const MAX_CATCH_UP_DAYS = 31;

/** Parses `USAGE_PEERS`; throws on anything but a valid list without this team. */
export function parsePeers(raw: string, self: string): Peer[] {
	const peers = parseTeamOrigins(raw, "USAGE_PEERS");
	if (peers.some((peer) => peer.id === self)) {
		throw new Error("USAGE_PEERS repeats a team");
	}
	return peers;
}

/** The other teams; none, with an error logged, while the setting is invalid. */
export function usagePeers(env: Pick<Env, "USAGE_PEERS" | "TEAM_ID">): Peer[] {
	try {
		return parsePeers(env.USAGE_PEERS || "[]", env.TEAM_ID);
	} catch (err) {
		console.error(
			`USAGE_PEERS ignored: ${err instanceof Error ? err.message : "invalid"}`,
		);
		return [];
	}
}

/** Optional secret, the same in every team; set by hand, so not required. */
export function exchangeToken(env: object): string | null {
	const token = (env as { USAGE_EXCHANGE_TOKEN?: string }).USAGE_EXCHANGE_TOKEN;
	return token ? token : null;
}

/**
 * The first day an export covers: what was asked for, no earlier than the
 * history keeps and no later than today. Yesterday when nothing valid was asked.
 */
export function exportSince(asked: string | null, today: string): string {
	const first = historyStart(today);
	if (asked === null || !DAY.test(asked) || Number.isNaN(Date.parse(asked))) {
		return daysBefore(today, 1);
	}
	if (asked < first) return first;
	return asked > today ? today : asked;
}

/**
 * This team's own counts from `since` on: past days as recorded, today live,
 * so a team pulling just before this team's recording still gets today.
 */
export async function ownCounts(ctx: Ctx, since: string): Promise<UsageExport> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const today = utcDay(now);
	const [usage, counts] = await Promise.all([
		readStravaUsage(db),
		db.batch([
			ownCountsStatement(db, since, today),
			connectedCountStatement(db),
		]),
	]);
	const past = (counts[0]?.results ?? []) as {
		day: string;
		allowance: ExchangedAllowance;
		team_used: number;
	}[];
	const connected =
		(counts[1]?.results[0] as { n: number } | undefined)?.n ?? 0;
	const strava = currentStrava(usage, now);
	return {
		team: ctx.team.id,
		days: [
			...past.map((row) => ({
				day: row.day,
				allowance: row.allowance,
				count: row.team_used,
			})),
			{
				day: today,
				allowance: "strava_read_daily",
				count: strava.ownReadDaily,
			},
			{ day: today, allowance: "strava_all_daily", count: strava.ownAllDaily },
			{ day: today, allowance: "riders_connected", count: connected },
		],
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** An export from `team`, or null when it isn't one. */
export function parseExport(body: unknown, team: string): TeamCount[] | null {
	if (!isRecord(body) || body.team !== team || !Array.isArray(body.days)) {
		return null;
	}
	if (body.days.length > MAX_COUNTS) return null;
	const days: TeamCount[] = [];
	for (const entry of body.days) {
		if (
			!isRecord(entry) ||
			typeof entry.day !== "string" ||
			!DAY.test(entry.day) ||
			!(EXCHANGED as readonly unknown[]).includes(entry.allowance) ||
			!Number.isSafeInteger(entry.count) ||
			(entry.count as number) < 0
		) {
			return null;
		}
		days.push({
			day: entry.day,
			allowance: entry.allowance as ExchangedAllowance,
			count: entry.count as number,
		});
	}
	return days;
}

export type PeerResult =
	| { kind: "ok"; days: TeamCount[] }
	| { kind: "unavailable"; reason: string };

/** The day to ask a team from: after the last one stored, within a month. */
export function pullSince(lastStored: string | null, today: string): string {
	const yesterday = daysBefore(today, 1);
	if (lastStored === null) return yesterday;
	const earliest = daysBefore(today, MAX_CATCH_UP_DAYS);
	// Days as `YYYY-MM-DD` strings, so compared as text.
	if (lastStored >= yesterday) return yesterday;
	if (lastStored < earliest) return earliest;
	return lastStored;
}

/** One team's counts. Never throws; the token and bodies are never logged. */
export async function fetchPeerCounts(
	peer: Peer,
	token: string,
	since: string,
): Promise<PeerResult> {
	const url = new URL("/admin/usage/export", peer.origin);
	url.searchParams.set("since", since);
	let response: Response;
	try {
		response = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			redirect: "manual",
		});
	} catch (err) {
		return {
			kind: "unavailable",
			reason: err instanceof Error ? err.name : "network error",
		};
	}
	if (!response.ok) {
		await response.body?.cancel();
		return { kind: "unavailable", reason: `HTTP ${response.status}` };
	}
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return { kind: "unavailable", reason: "unreadable response" };
	}
	const days = parseExport(body, peer.id);
	return days
		? { kind: "ok", days }
		: { kind: "unavailable", reason: "unexpected response" };
}
