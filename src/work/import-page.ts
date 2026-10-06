import { upsertActivities } from "../db/activities";
import { setImportStatus } from "../db/riders";
import { type ActivityRecord, toActivityRecord } from "../strava/activity";
import { listAthleteActivities } from "../strava/client";
import type { Handler } from "./consumer";
import type { ImportPageMessage } from "./messages";

// The season import, one page of 200 activities per message (research R8,
// contracts/queue-messages.md). `after` travels with the message, so a changed
// season start only affects imports started afterwards.

const PER_PAGE = 200;

export const importPage: Handler<ImportPageMessage> = async (
	message,
	rider,
	ctx,
) => {
	const result = await listAthleteActivities(
		ctx,
		{ athleteId: rider.athleteId },
		{ after: message.after, page: message.page },
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
	for (const activity of result.value) {
		const record = toActivityRecord(activity, rider.athleteId, now);
		// The stored grant decides, even if Strava returns more (FR-007).
		if (record && (record.is_private === 0 || rider.scopeReadAll)) {
			records.push(record);
		}
	}
	await upsertActivities(ctx.env.DB, records);

	if (result.value.length === PER_PAGE) {
		await setImportStatus(ctx.env.DB, rider.athleteId, "running");
		await ctx.queue.send({ ...message, page: message.page + 1 });
	} else {
		await setImportStatus(ctx.env.DB, rider.athleteId, "done");
	}
	return { kind: "ok" };
};
