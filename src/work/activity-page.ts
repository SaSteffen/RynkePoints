import { seasonStart } from "../config";
import type { Ctx } from "../ctx";
import type { Rider } from "../db/riders";
import type { KeptActivities } from "../recheck/diff";
import { evaluateChange } from "../rynke/apply";
import {
	type ActivityRecord,
	type RunRecord,
	type StravaActivity,
	type SwimRecord,
	startsInSeason,
	toActivityRecord,
	toRunRecord,
	toSwimRecord,
} from "../strava/activity";
import { listAthleteActivities } from "../strava/client";
import type { HandlerResult } from "./consumer";

// One page of the rider's activity list, shared by the season import and the
// one-time re-read (research R8, R20), so the scope rule exists once. The ride
// edit re-check uses the same rule (`keptActivities`, feature 036).

export const PER_PAGE = 200;

export type PageResult =
	| { kind: "stored"; listed: number }
	| Exclude<HandlerResult, { kind: "ok" }>;

/**
 * Lists page `page` since `after` and upserts the cycling activities,
 * outdoor runs and swims with the rider's Rynke, also for an empty page, so
 * every rider gets a balance.
 */
export async function storeActivityPage(
	page: { page: number; after: number },
	rider: Rider,
	ctx: Ctx,
): Promise<PageResult> {
	const result = await listAthleteActivities(
		ctx,
		{ athleteId: rider.athleteId },
		{ after: page.after, page: page.page },
	);
	switch (result.kind) {
		case "ok":
			break;
		case "budget":
		case "transient":
		case "refresh-refused":
			return result;
		default:
			// 403/404 on the rider's own list: retry, then failed_work.
			return {
				kind: "transient",
				reason: `GET /athlete/activities: ${result.kind}`,
			};
	}

	await evaluateChange(ctx, rider.athleteId, {
		kind: "upsert",
		...keptActivities(result.value, rider, ctx),
	});
	return { kind: "stored", listed: result.value.length };
}

/**
 * The cycling activities, outdoor runs and swims of a list that may be stored:
 * the import's scope rule, shared with the ride edit re-check (feature 036
 * research R7).
 */
export function keptActivities(
	list: readonly StravaActivity[],
	rider: Rider,
	ctx: Ctx,
): KeptActivities {
	const now = ctx.now();
	const season = seasonStart(ctx.env);
	const records: ActivityRecord[] = [];
	const runs: RunRecord[] = [];
	const swims: SwimRecord[] = [];
	for (const activity of list) {
		const record = toActivityRecord(activity, rider.athleteId, now);
		const run = record ? null : toRunRecord(activity, rider.athleteId, now);
		const swim =
			record || run ? null : toSwimRecord(activity, rider.athleteId, now);
		// The stored grant decides, even if Strava returns more (FR-007), and
		// nothing from before the season start is stored, whatever `after` was.
		const allowed = (r: { is_private: 0 | 1; start_date: string }) =>
			(r.is_private === 0 || rider.scopeReadAll) &&
			startsInSeason(r.start_date, season);
		if (record && allowed(record)) records.push(record);
		if (run && allowed(run)) runs.push(run);
		if (swim && allowed(swim)) swims.push(swim);
	}
	return { records, runs, swims };
}
