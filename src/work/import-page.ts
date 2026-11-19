import { listActivityIdsRefreshedBefore } from "../db/activities";
import { addImportFetched, setImportStatus } from "../db/riders";
import { storeActivityPage } from "./activity-page";
import type { Handler } from "./consumer";
import {
	type ActivityEventMessage,
	type ImportPageMessage,
	sendAll,
} from "./messages";

// The season import, one page of 200 activities per message (research R8,
// contracts/queue-messages.md). The first page starts after the season start
// the import was started with, so a changed season start only affects imports
// started afterwards; each next one after the newest start listed so far
// (review L-21). Every listed activity is stored again, so one the finished
// import didn't refresh wasn't listed: deleted, made private or changed while
// the rider had to reconnect (review L-03). Each gets one refetch, and the
// activity-event decision table keeps or removes it, as the re-read does
// (research R20).

export const importPage: Handler<ImportPageMessage> = async (
	message,
	rider,
	ctx,
) => {
	const stored = await storeActivityPage(message, rider, ctx);
	if (stored.kind !== "stored") return stored;
	// For the rider's line while the import continues (feature 024 FR-019).
	await addImportFetched(ctx.env.DB, rider.athleteId, stored.listed);

	if (stored.next) {
		await setImportStatus(ctx.env.DB, rider.athleteId, "running");
		await ctx.queue.send({ ...message, ...stored.next });
		return { kind: "ok" };
	}
	await setImportStatus(ctx.env.DB, rider.athleteId, "done");
	if (message.startedAt === undefined) return { kind: "ok" };
	const ids = await listActivityIdsRefreshedBefore(
		ctx.env.DB,
		rider.athleteId,
		message.startedAt,
	);
	await sendAll(
		ctx,
		ids.map(
			(activityId): ActivityEventMessage => ({
				kind: "activity-event",
				athleteId: rider.athleteId,
				activityId,
				aspect: "update",
				changed: [],
			}),
		),
	);
	return { kind: "ok" };
};
