import type { Ctx } from "../ctx";
import type { Rider } from "../db/riders";
import { evaluateChange } from "../rynke/apply";
import {
	type ActivityRecord,
	type RunRecord,
	toActivityRecord,
	toRunRecord,
} from "../strava/activity";
import { listAthleteActivities } from "../strava/client";
import type { HandlerResult } from "./consumer";

// One page of the rider's activity list, shared by the season import and the
// one-time re-read (research R8, R20), so the scope rule exists once.

export const PER_PAGE = 200;

export type PageResult =
	| { kind: "stored"; listed: number }
	| Exclude<HandlerResult, { kind: "ok" }>;

/**
 * Lists page `page` since `after` and upserts the cycling activities and
 * outdoor runs with the rider's Rynke, also for an empty page, so every rider
 * gets a balance.
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

	const now = ctx.now();
	const records: ActivityRecord[] = [];
	const runs: RunRecord[] = [];
	for (const activity of result.value) {
		const record = toActivityRecord(activity, rider.athleteId, now);
		const run = record ? null : toRunRecord(activity, rider.athleteId, now);
		// The stored grant decides, even if Strava returns more (FR-007).
		const allowed = (r: { is_private: 0 | 1 }) =>
			r.is_private === 0 || rider.scopeReadAll;
		if (record && allowed(record)) records.push(record);
		if (run && allowed(run)) runs.push(run);
	}
	await evaluateChange(ctx, rider.athleteId, {
		kind: "upsert",
		records,
		runs,
	});
	return { kind: "stored", listed: result.value.length };
}
