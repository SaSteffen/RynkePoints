import { type ActivityChange, evaluateChange } from "../rynke/apply";
import { toActivityRecord } from "../strava/activity";
import { getActivity } from "../strava/client";
import type { Handler } from "./consumer";
import type { ActivityEventMessage } from "./messages";
import { notifyRiders } from "./send-notification";

// One webhook event (contracts/queue-messages.md, decision table). Every path
// converges to Strava's current state, so duplicates and reordering are
// harmless (FR-017). Writes go through `evaluateChange`, so the rider's Rynke
// change in the same batch (feature 003 research R11). When the rider's Rynke
// rose, each of their devices gets a notification (feature 010 FR-015).

export const activityEvent: Handler<ActivityEventMessage> = async (
	message,
	rider,
	ctx,
) => {
	const evaluate = async (change: ActivityChange) => {
		const { rose } = await evaluateChange(ctx, rider.athleteId, change);
		if (rose) await notifyRiders(ctx, [rider.athleteId]);
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
	// The stored grant decides, even if Strava returns more (FR-007).
	if (!record || (record.is_private === 1 && !rider.scopeReadAll)) {
		return remove();
	}
	return evaluate({ kind: "upsert", records: [record] });
};
