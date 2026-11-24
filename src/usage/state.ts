import type { Ctx } from "../ctx";
import { subscriptionIdsOfRiders } from "../db/push-subscriptions";
import { readStravaUsage } from "../db/rate-limit";
import { type RecheckDay, readRecheckDays } from "../db/recheck";
import { connectedCountStatement } from "../db/riders";
import { readRoutingCounts } from "../db/routing";
import { readCalls } from "../db/strava-calls";
import {
	readCloudflareFigures,
	readCpuDays,
	readSourceStates,
	type SourceState,
	type TeamCountRecord,
	teamConnectedStatement,
	teamCountRecords,
	teamCountsStatement,
	type UsageRecord,
} from "../db/usage";
import { routingDays } from "../routing/warning";
import {
	type CallCount,
	type CallDayRow,
	callDayRows,
	firstCallDay,
	ownCallDays,
	type PeerCallDay,
} from "../strava/calls";
import {
	CLOUDFLARE_ALLOWANCES,
	type CloudflareAllowance,
	daysBefore,
	utcDay,
} from "./allowances";
import { type AttentionItem, attentionItems } from "./attention";
import {
	connectedFigure,
	type Figure,
	makeFigure,
	type StravaUsage,
	stravaFigures,
} from "./figures";
import { type Peer, usagePeers } from "./peers";

// What Admin › Nutzung's list and the Admin tab's number read (feature 048
// research R5): D1 only, never Strava or Cloudflare (feature 025 FR-027), and
// only the days a mark can come from, so the number stays cheap on every page.
// The page reads its longer tables beside it.

export interface UsageState {
	today: string;
	usage: StravaUsage;
	/** Strava's five figures, then Cloudflare's that have a value, in the page's order. */
	figures: Figure[];
	/** Cloudflare's figures without a value yet. */
	missing: CloudflareAllowance[];
	cloudflare: {
		latest: Map<CloudflareAllowance, UsageRecord>;
		available: boolean;
	};
	states: Map<string, SourceState>;
	recheckDays: RecheckDay[];
	calls: { counts: CallCount[]; seen: Map<string, number> };
	callDays: CallDayRow[];
	/** Whether the viewer gets notifications on any device. */
	hasDevice: boolean;
	items: AttentionItem[];
}

/**
 * Each other team's Strava call totals per day, as the exchange brought them.
 * Only from `since` on, the days the calls table shows, so a mark doesn't
 * depend on how far back the records were read.
 */
function peerCallDays(
	peers: readonly Peer[],
	records: readonly TeamCountRecord[],
	since: string,
): PeerCallDay[][] {
	return peers.map((peer) => {
		const theirs = records.filter((r) => r.team === peer.id && r.day >= since);
		const seen = new Map(
			theirs
				.filter((r) => r.allowance === "strava_seen")
				.map((r) => [r.day, r.used]),
		);
		return theirs
			.filter((r) => r.allowance === "strava_calls")
			.map((r) => ({ day: r.day, calls: r.used, seen: seen.get(r.day) ?? 0 }));
	});
}

export async function readUsageState(
	ctx: Ctx,
	athleteId: string,
): Promise<UsageState> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const today = utcDay(now);
	const yesterday = daysBefore(today, 1);
	const callsSince = firstCallDay(today);
	const peers = usagePeers(ctx.env);
	const [
		usage,
		cloudflare,
		counts,
		states,
		recheckDays,
		cpu,
		routingCounts,
		calls,
		devices,
	] = await Promise.all([
		readStravaUsage(db),
		readCloudflareFigures(db),
		db.batch([
			connectedCountStatement(db),
			teamCountsStatement(db, callsSince),
			...peers.map((peer) => teamConnectedStatement(db, peer.id)),
		]),
		readSourceStates(db),
		readRecheckDays(db),
		readCpuDays(db, today),
		readRoutingCounts(db, yesterday),
		readCalls(db, callsSince),
		subscriptionIdsOfRiders(db, [athleteId]),
	]);
	const connected =
		(counts[0]?.results[0] as { n: number } | undefined)?.n ?? 0;
	// Other teams' riders count against the same capacity (feature 026 FR-039).
	const otherRiders = counts
		.slice(2)
		.reduce(
			(sum, result) =>
				sum + ((result.results[0] as { used: number } | undefined)?.used ?? 0),
			0,
		);
	// Each keeps the limit it was recorded with, and its own time (FR-011).
	const account = CLOUDFLARE_ALLOWANCES.flatMap((id) => {
		const record = cloudflare.latest.get(id);
		return record
			? [
					makeFigure(
						id,
						record.used,
						record.limit,
						record.teamUsed,
						record.recordedAt,
					),
				]
			: [];
	});
	const figures = [
		...stravaFigures(usage, now),
		connectedFigure(connected + otherRiders, now, connected),
		...account,
	];
	const callDays = callDayRows(
		today,
		ownCallDays(calls.counts, calls.seen),
		peerCallDays(peers, teamCountRecords(counts[1]?.results ?? []), callsSince),
	);
	const hasDevice = devices.length > 0;
	return {
		today,
		usage,
		figures,
		missing: CLOUDFLARE_ALLOWANCES.filter((id) => !cloudflare.latest.has(id)),
		cloudflare,
		states,
		recheckDays,
		calls,
		callDays,
		hasDevice,
		items: attentionItems({
			today,
			figures,
			self: ctx.team.id,
			cpu,
			recheck: recheckDays,
			routing: routingDays(routingCounts, ctx.team.id),
			calls: callDays,
			peers: peers.map((peer) => states.get(`team:${peer.id}`)),
			hasDevice,
		}),
	};
}
