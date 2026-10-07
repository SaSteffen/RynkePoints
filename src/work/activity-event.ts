import { evaluateChange } from "../rynke/apply";
import { toActivityRecord } from "../strava/activity";
import { getActivity } from "../strava/client";
import type { Handler } from "./consumer";
import type { ActivityEventMessage } from "./messages";

// One webhook event (contracts/queue-messages.md, decision table). Every path
// converges to Strava's current state, so duplicates and reordering are
// harmless (FR-017). Writes go through `evaluateChange`, so the rider's Rynke
// change in the same batch (feature 003 research R11).

export const activityEvent: Handler<ActivityEventMessage> = async (
	message,
	rider,
	ctx,
) => {
	const remove = async () => {
		await evaluateChange(ctx, rider.athleteId, {
			kind: "delete",
			activityIds: [message.activityId],
		});
		return { kind: "ok" } as const;
	};

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
	await evaluateChange(ctx, rider.athleteId, {
		kind: "upsert",
		records: [record],
	});
	return { kind: "ok" };
};
