import type { Ctx } from "../ctx";
import { readStravaUsage } from "../db/rate-limit";
import { connectedCountStatement } from "../db/riders";
import {
	correctPastUsageStatement,
	latestTeamCounts,
	sourceFailureStatement,
	sourceSuccessStatement,
	type UsageRecord,
	upsertTeamCountStatement,
	upsertUsageStatement,
} from "../db/usage";
import { checkAlerts } from "./alerts";
import {
	ATHLETE_CAPACITY,
	CLOUDFLARE_ALLOWANCES,
	CLOUDFLARE_LIMITS,
	utcDay,
} from "./allowances";
import { type CloudflareResult, fetchCloudflareUsage } from "./cloudflare";
import { currentStrava } from "./figures";
import {
	exchangeToken,
	fetchPeerCounts,
	type Peer,
	type PeerResult,
	pullSince,
	usagePeers,
} from "./peers";

// The hourly recording (feature 025 research R2, R4): one value per allowance
// and UTC day, as an upsert, so a repeat can't double-count and a missed day
// stays a gap. Asks Strava nothing (FR-034). With other teams (feature 026
// contracts/usage-exchange.md) it also pulls their own counts, and connected
// riders are all teams' together, since Strava's capacity is shared (FR-041).

/** Today's Cloudflare records, and yesterday's as corrections, from a response. */
function cloudflareRecords(
	result: Extract<CloudflareResult, { kind: "ok" }>,
	now: number,
): { today: UsageRecord[]; yesterday: UsageRecord[] } {
	const figures = result.days.get(result.today) ?? {};
	const before = result.days.get(result.yesterday) ?? {};
	const record = (
		allowance: (typeof CLOUDFLARE_ALLOWANCES)[number],
		day: string,
		used: number,
	): UsageRecord => ({
		day,
		allowance,
		used,
		limit: CLOUDFLARE_LIMITS[allowance],
		teamUsed: null,
		peak15m: null,
		recordedAt: now,
	});
	const today: UsageRecord[] = [];
	const yesterday: UsageRecord[] = [];
	for (const allowance of CLOUDFLARE_ALLOWANCES) {
		// No group for today means nothing was used yet, except storage, which is
		// the latest day's size whenever Cloudflare reports it.
		const value =
			allowance === "cf_d1_storage_bytes"
				? (figures[allowance] ?? before[allowance])
				: (figures[allowance] ?? 0);
		if (value !== undefined) {
			today.push(record(allowance, result.today, value));
		}
		// A day Cloudflare says nothing about keeps what we have, or stays a gap.
		const corrected = before[allowance];
		if (corrected !== undefined) {
			yesterday.push(record(allowance, result.yesterday, corrected));
		}
	}
	return { today, yesterday };
}

/**
 * Records today's values, then checks the alerts with what this run really saw:
 * a Cloudflare failure records and alerts on Strava alone, keeps the stored rows
 * and notes the failure. A failed alert never fails the recording.
 */
/** Each other team's answer; none without peers or the exchange token. */
async function pullPeers(
	ctx: Ctx,
	day: string,
): Promise<{
	pulled: { peer: Peer; result: PeerResult }[];
	stored: Awaited<ReturnType<typeof latestTeamCounts>>;
}> {
	const peers = usagePeers(ctx.env);
	const token = exchangeToken(ctx.env);
	const stored = await latestTeamCounts(ctx.env.DB);
	if (peers.length === 0 || token === null) return { pulled: [], stored };
	const pulled = await Promise.all(
		peers.map(async (peer) => ({
			peer,
			result: await fetchPeerCounts(
				peer,
				token,
				pullSince(stored.get(peer.id)?.lastDay ?? null, day),
			),
		})),
	);
	return { pulled, stored };
}

/** Another team's riders now: from this pull, else the newest stored count. */
function peerConnected(
	peer: Peer,
	result: PeerResult,
	day: string,
	stored: Awaited<ReturnType<typeof latestTeamCounts>>,
): number {
	if (result.kind === "ok") {
		const today = result.days.find(
			(count) => count.day === day && count.allowance === "riders_connected",
		);
		if (today) return today.count;
	}
	return stored.get(peer.id)?.connected ?? 0;
}

export async function recordUsage(ctx: Ctx): Promise<void> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const day = utcDay(now);
	const [usage, connected, cloudflare, peers] = await Promise.all([
		readStravaUsage(db),
		connectedCountStatement(db).first<number>("n"),
		fetchCloudflareUsage(ctx.env, now),
		pullPeers(ctx, day),
	]);
	const strava = currentStrava(usage, now);
	const riders = connected ?? 0;
	const otherRiders = peers.pulled.reduce(
		(sum, { peer, result }) =>
			sum + peerConnected(peer, result, day, peers.stored),
		0,
	);
	const teamStatements: D1PreparedStatement[] = [];
	for (const { peer, result } of peers.pulled) {
		const source = `team:${peer.id}` as const;
		if (result.kind === "ok") {
			for (const count of result.days) {
				teamStatements.push(
					upsertTeamCountStatement(db, {
						day: count.day,
						allowance: count.allowance,
						team: peer.id,
						used: count.count,
						recordedAt: now,
					}),
				);
			}
			teamStatements.push(sourceSuccessStatement(db, now, source));
		} else {
			console.warn(`Usage of team ${peer.id} unavailable: ${result.reason}`);
			teamStatements.push(sourceFailureStatement(db, now, source));
		}
	}
	const records: UsageRecord[] = [
		{
			day,
			allowance: "strava_read_daily",
			used: strava.readDaily,
			limit: strava.limitReadDaily,
			teamUsed: strava.ownReadDaily,
			peak15m: strava.peakRead15m,
			recordedAt: now,
		},
		{
			day,
			allowance: "strava_all_daily",
			used: strava.allDaily,
			limit: strava.limitAllDaily,
			teamUsed: strava.ownAllDaily,
			peak15m: strava.peakAll15m,
			recordedAt: now,
		},
		{
			day,
			allowance: "riders_connected",
			used: riders + otherRiders,
			limit: ATHLETE_CAPACITY,
			teamUsed: riders,
			peak15m: null,
			recordedAt: now,
		},
	];
	const corrections: UsageRecord[] = [];
	if (cloudflare.kind === "ok") {
		const { today, yesterday } = cloudflareRecords(cloudflare, now);
		records.push(...today);
		corrections.push(...yesterday);
	} else {
		console.warn(`Cloudflare usage unavailable: ${cloudflare.reason}`);
	}
	await db.batch([
		...records.map((record) => upsertUsageStatement(db, ctx.env, record)),
		...corrections.map((record) =>
			correctPastUsageStatement(db, ctx.env, record),
		),
		cloudflare.kind === "ok"
			? sourceSuccessStatement(db, now)
			: sourceFailureStatement(db, now),
		...teamStatements,
	]);
	try {
		await checkAlerts(ctx, records);
	} catch (err) {
		const name = err instanceof Error ? err.name : "unknown error";
		console.error(`Usage alerts failed: ${name}`);
	}
}
