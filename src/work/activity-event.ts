import { type ActivityChange, evaluateChange } from "../rynke/apply";
import { toActivityRecord, toRunRecord } from "../strava/activity";
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

export const activityEvent: Handler<ActivityEventMessage> = async (
	message,
	rider,
	ctx,
) => {
	const evaluate = async (change: ActivityChange) => {
		const { rose, badges } = await evaluateChange(ctx, rider.athleteId, change);
		// Removing a ride or run never raises the team's sums.
		const team = change.kind === "upsert" ? await teamBadgeNews(ctx) : [];
		const own = rose || badges.length > 0 ? [rider.athleteId] : [];
		await notifyRiders(ctx, [...new Set([...own, ...team])]);
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
	const kept = record ?? run;
	// The stored grant decides, even if Strava returns more (FR-007).
	if (!kept || (kept.is_private === 1 && !rider.scopeReadAll)) {
		return remove();
	}
	return evaluate(
		record
			? { kind: "upsert", records: [record] }
			: { kind: "upsert", records: [], runs: run ? [run] : [] },
	);
};
