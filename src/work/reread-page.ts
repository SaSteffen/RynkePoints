import { listActivityIdsMissingFigures } from "../db/activities";
import { PER_PAGE, storeActivityPage } from "./activity-page";
import type { Handler } from "./consumer";
import {
	type ActivityEventMessage,
	type RereadPageMessage,
	sendAll,
} from "./messages";

// The one-time re-read after FR-013 gained a figure (research R20,
// contracts/queue-messages.md). Pages like the import, but leaves
// `import_status` alone: the rider's import is not being redone.

export const rereadPage: Handler<RereadPageMessage> = async (
	message,
	rider,
	ctx,
) => {
	const stored = await storeActivityPage(message, rider, ctx);
	if (stored.kind !== "stored") return stored;

	if (stored.listed === PER_PAGE) {
		await ctx.queue.send({ ...message, page: message.page + 1 });
		return { kind: "ok" };
	}

	// Rows the list didn't fill (outside it, or a field missing from the
	// summary) get one refetch each; the activity-event decision table fills
	// or deletes them. Not repeated, so a field Strava never sends stays NULL.
	const ids = await listActivityIdsMissingFigures(ctx.env.DB, rider.athleteId);
	const refetches = ids.map(
		(activityId): ActivityEventMessage => ({
			kind: "activity-event",
			athleteId: rider.athleteId,
			activityId,
			aspect: "update",
			changed: [],
		}),
	);
	await sendAll(ctx, refetches);
	return { kind: "ok" };
};
