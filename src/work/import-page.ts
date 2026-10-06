import { setImportStatus } from "../db/riders";
import { PER_PAGE, storeActivityPage } from "./activity-page";
import type { Handler } from "./consumer";
import type { ImportPageMessage } from "./messages";

// The season import, one page of 200 activities per message (research R8,
// contracts/queue-messages.md). `after` travels with the message, so a changed
// season start only affects imports started afterwards.

export const importPage: Handler<ImportPageMessage> = async (
	message,
	rider,
	ctx,
) => {
	const stored = await storeActivityPage(message, rider, ctx);
	if (stored.kind !== "stored") return stored;

	if (stored.listed === PER_PAGE) {
		await setImportStatus(ctx.env.DB, rider.athleteId, "running");
		await ctx.queue.send({ ...message, page: message.page + 1 });
	} else {
		await setImportStatus(ctx.env.DB, rider.athleteId, "done");
	}
	return { kind: "ok" };
};
