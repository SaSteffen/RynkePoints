import { seasonStart } from "../config";
import type { Ctx } from "../ctx";
import { type ActivityChange, evaluateChange } from "../rynke/apply";
import {
	startsInSeason,
	toActivityRecord,
	toRunRecord,
	toSwimRecord,
} from "../strava/activity";
import { getActivity } from "../strava/client";
import type { Handler } from "./consumer";
import type { ActivityEventMessage } from "./messages";
import { notifyRiders } from "./send-notification";
import { teamBadgeNews } from "./team-badge-news";

// One webhook event (contracts/queue-messages.md, decision table). Every path
// converges to Strava's current state, so duplicates and reordering are
// harmless (FR-017). Writes go through `evaluateChange`, so the rider's Rynke
// change in the same batch (feature 003 research R11). When the rider's Rynke
// rose or a badge is new, each of their devices gets a notification (feature
// 010 FR-015, feature 013 research R17). A new or changed ride or run may also
// earn a team badge, which notifies every listed rider it is new to (#125).

/**
 * Applies a change to the rider's activities and tells whoever it concerns:
 * the rider when their Rynke rose or a badge is new, and every rider a new team
 * badge is new to. Shared by reported activities and the ride edit re-check
 * (feature 036 FR-003).
 */
export async function evaluateAndNotify(
	ctx: Ctx,
	athleteId: number,
	change: ActivityChange,
): Promise<void> {
	const { rose, badges, figuresChanged } = await evaluateChange(
		ctx,
		athleteId,
		change,
	);
	// Removing a ride or run never raises the team's sums, and neither does
	// an edit that leaves its figures alone, such as a new title.
	const team =
		change.kind === "upsert" && figuresChanged
			? await teamBadgeNews(ctx, badges.length > 0 ? [athleteId] : [])
			: [];
	const own = rose || badges.length > 0 ? [athleteId] : [];
	await notifyRiders(ctx, [...new Set([...own, ...team])]);
}

export const activityEvent: Handler<ActivityEventMessage> = async (
	message,
	rider,
	ctx,
) => {
	const evaluate = async (change: ActivityChange) => {
		await evaluateAndNotify(ctx, rider.athleteId, change);
		return { kind: "ok" } as const;
	};
	const remove = () =>
		evaluate({ kind: "delete", activityIds: [message.activityId] });

	if (message.aspect === "delete") return remove();

	const result = await getActivity(
		ctx,
		{ athleteId: rider.athleteId },
		message.activityId,
	);
	switch (result.kind) {
		case "ok":
			break;
		case "not-found":
		case "forbidden":
			return remove();
		case "budget":
		case "transient":
		case "refresh-refused":
			return result;
		default:
			return {
				kind: "transient",
				reason: `GET /activities/{id}: ${result.kind}`,
			};
	}

	const record = toActivityRecord(result.value, rider.athleteId, ctx.now());
	// An outdoor run counts for the running badges (feature 013 FR-020).
	const run = record
		? null
		: toRunRecord(result.value, rider.athleteId, ctx.now());
	// A swim counts for the swim badges (feature 013 FR-024).
	const swim =
		record || run
			? null
			: toSwimRecord(result.value, rider.athleteId, ctx.now());
	const kept = record ?? run ?? swim;
	// The stored grant decides, even if Strava returns more (FR-007). An
	// activity from before the season start is never stored, also when an edit
	// on Strava sends an event about it; one stored earlier goes.
	if (
		!kept ||
		(kept.is_private === 1 && !rider.scopeReadAll) ||
		!startsInSeason(kept.start_date, seasonStart(ctx.env))
	) {
		return remove();
	}
	return evaluate(
		record
			? { kind: "upsert", records: [record] }
			: {
					kind: "upsert",
					records: [],
					runs: run ? [run] : [],
					swims: swim ? [swim] : [],
				},
	);
};
