import type { Ctx } from "../ctx";
import { readStravaUsage } from "../db/rate-limit";
import { connectedCountStatement } from "../db/riders";
import {
	correctPastUsageStatement,
	sourceFailureStatement,
	sourceSuccessStatement,
	type UsageRecord,
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

// The hourly recording (feature 025 research R2, R4): one value per allowance
// and UTC day, as an upsert, so a repeat can't double-count and a missed day
// stays a gap. Asks Strava nothing (FR-034).

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
export async function recordUsage(ctx: Ctx): Promise<void> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const day = utcDay(now);
	const [usage, connected, cloudflare] = await Promise.all([
		readStravaUsage(db),
		connectedCountStatement(db).first<number>("n"),
		fetchCloudflareUsage(ctx.env, now),
	]);
	const strava = currentStrava(usage, now);
	const riders = connected ?? 0;
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
			used: riders,
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
	]);
	try {
		await checkAlerts(ctx, records);
	} catch (err) {
		const name = err instanceof Error ? err.name : "unknown error";
		console.error(`Usage alerts failed: ${name}`);
	}
}
