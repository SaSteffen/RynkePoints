import type { Ctx } from "../ctx";
import {
	deleteSubscriptionById,
	isPushEndpoint,
	subscriptionEndpoint,
	subscriptionIdsOfRiders,
} from "../db/push-subscriptions";
import { sendPush } from "../push/send";
import type { Handler } from "./consumer";
import { type SendNotificationMessage, sendAll } from "./messages";

// "You have new Rynke" on each device of a rider whose Rynke rose (feature 010
// contracts/push-delivery.md). A notification is a courtesy: it never holds up
// or fails the change that caused it (FR-018), and it is never written to
// `failed_work`.

/** About 7 minutes with the consumer's backoff; later the news is stale (R6). */
export const NOTIFY_MAX_ATTEMPTS = 4;

/** Queues one `send-notification` per device of these riders. Never throws. */
export async function notifyRiders(
	ctx: Ctx,
	athleteIds: number[],
): Promise<void> {
	if (athleteIds.length === 0) return;
	try {
		const devices = await subscriptionIdsOfRiders(ctx.env.DB, athleteIds);
		await sendAll(
			ctx,
			devices.map(({ athleteId, subscriptionId }) => ({
				kind: "send-notification",
				athleteId,
				subscriptionId,
			})),
		);
	} catch (err) {
		const name = err instanceof Error ? err.name : "unknown error";
		console.error(
			`Queueing notifications for ${athleteIds.length} riders failed: ${name}`,
		);
	}
}

export const sendNotification: Handler<SendNotificationMessage> = async (
	message,
	_rider,
	ctx,
	attempt,
) => {
	const db = ctx.env.DB;
	const { subscriptionId } = message;
	// Gone, or the device now belongs to another rider (FR-020).
	const endpoint = await subscriptionEndpoint(
		db,
		subscriptionId,
		message.athleteId,
	);
	if (endpoint === null) return { kind: "ok" };
	if (!isPushEndpoint(endpoint)) {
		await deleteSubscriptionById(db, subscriptionId);
		return { kind: "ok" };
	}

	const host = new URL(endpoint).host;
	const outcome = await sendPush(endpoint, ctx);
	switch (outcome) {
		case "sent":
			return { kind: "ok" };
		case "gone":
			// The device unsubscribed or the browser dropped it (FR-021).
			await deleteSubscriptionById(db, subscriptionId);
			return { kind: "ok" };
		case "refused":
			console.warn(`Push to ${host} refused`);
			return { kind: "ok" };
		case "transient":
			if (attempt.attempts < NOTIFY_MAX_ATTEMPTS) {
				return { kind: "transient", reason: `push to ${host} failed` };
			}
			console.warn(`Push to ${host} given up after ${attempt.attempts} tries`);
			return { kind: "ok" };
	}
};
