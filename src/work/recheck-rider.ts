import type { Ctx } from "../ctx";
import { readRateLimitState } from "../db/rate-limit";
import {
	type CheckOutcome,
	checkNotMade,
	readStoredActivities,
} from "../db/recheck";
import type { Rider } from "../db/riders";
import { anyWorkReady } from "../db/strava-work";
import { differences } from "../recheck/diff";
import type { StravaActivity } from "../strava/activity";
import { listNewestActivities } from "../strava/client";
import { budgetDecision, halfDayUsed } from "../strava/rate-limit";
import { utcDay } from "../usage/allowances";
import { evaluateAndNotify } from "./activity-event";
import { keptActivities } from "./activity-page";
import type { Handler } from "./handler";
import type { RecheckRiderMessage } from "./messages";

// One ride edit re-check (feature 036 contracts/queue-message.md): the rider's
// newest 200 activities in one request, compared with the stored ones; only
// what differs goes through the same evaluation as a reported activity. A check
// that can't or mustn't happen puts the rider's stamp back and is counted, and
// is never retried: the handler never returns `budget` or `transient` (FR-017).

const OK = { kind: "ok" } as const;

/** Whether `start_date` never increases from one entry to the next (FR-026). */
function newestFirst(list: readonly StravaActivity[]): boolean {
	for (let i = 1; i < list.length; i++) {
		const before = Date.parse(list[i - 1]?.start_date ?? "");
		const here = Date.parse(list[i]?.start_date ?? "");
		if (!(here <= before)) return false;
	}
	return true;
}

/** Whether the check stands back (research R8): what others wait for first. */
async function standsBack(rider: Rider, ctx: Ctx): Promise<boolean> {
	if (rider.status !== "connected" || rider.importStatus !== "done")
		return true;
	const state = await readRateLimitState(ctx.env.DB);
	const now = ctx.now();
	if (halfDayUsed(state, now)) return true;
	if (!budgetDecision(state, now, "background").ok) return true;
	return anyWorkReady(ctx.env.DB, now);
}

export const recheckRider: Handler<RecheckRiderMessage> = async (
	message,
	rider,
	ctx,
) => {
	const notMade = async (outcome: CheckOutcome) => {
		await checkNotMade(ctx.env.DB, message, utcDay(ctx.now()), outcome);
		return OK;
	};

	if (await standsBack(rider, ctx)) return notMade({ skipped: 1 });

	const result = await listNewestActivities(ctx, {
		athleteId: rider.athleteId,
	});
	if (result.kind === "refresh-refused") return result;
	if (result.kind !== "ok") {
		console.warn(
			`recheck-rider for athlete ${rider.athleteId} failed: ${result.kind}`,
		);
		return notMade({ failed: 1 });
	}
	if (!newestFirst(result.value)) {
		console.error(
			`recheck-rider for athlete ${rider.athleteId}: list not newest first`,
		);
		return notMade({ failed: 1, unordered: 1 });
	}

	const changed = differences(
		keptActivities(result.value, rider, ctx),
		await readStoredActivities(ctx.env.DB, rider.athleteId),
	);
	if (changed.records.length + changed.runs.length + changed.swims.length > 0) {
		await evaluateAndNotify(ctx, rider.athleteId, {
			kind: "upsert",
			...changed,
		});
	}
	return OK;
};
