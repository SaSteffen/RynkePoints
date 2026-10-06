import type { Ctx } from "../ctx";
import {
	deleteFailedWorkFirstFailedBefore,
	listFailedWorkFirstFailedSince,
} from "../db/failed-work";
import {
	listConnectedRiderIds,
	listExpiredReconnectRiderIds,
} from "../db/riders";
import { parseWorkMessage, type WorkMessage } from "./messages";

// Daily cron work (contracts/queue-messages.md, "Scheduled").

const GIVE_UP_AFTER_SECONDS = 7 * 24 * 3600;
const RECONNECT_GRACE_SECONDS = 7 * 24 * 3600;
/** The Queues limit for one `sendBatch`. */
const MAX_BATCH = 100;

/** One `check-membership` per connected rider (FR-004a). */
export async function fanOutMembershipChecks(ctx: Ctx): Promise<void> {
	const ids = await listConnectedRiderIds(ctx.env.DB);
	await sendAll(
		ctx,
		ids.map((athleteId) => ({ kind: "check-membership", athleteId })),
	);
}

/** Deletes riders still `needs_reconnect` after 7 days (FR-020). */
export async function expireReconnectRiders(ctx: Ctx): Promise<void> {
	const ids = await listExpiredReconnectRiderIds(
		ctx.env.DB,
		ctx.now() - RECONNECT_GRACE_SECONDS,
	);
	await sendAll(
		ctx,
		ids.map((athleteId) => ({
			kind: "delete-rider",
			athleteId,
			reason: "reconnect-expired",
			revoke: true,
		})),
	);
}

/**
 * Gives up failures first seen more than 7 days ago and re-enqueues the rest
 * (R7, FR-019). Re-enqueued rows stay until their message succeeds.
 */
export async function requeueFailedWork(ctx: Ctx): Promise<void> {
	const cutoff = ctx.now() - GIVE_UP_AFTER_SECONDS;
	const givenUp = await deleteFailedWorkFirstFailedBefore(ctx.env.DB, cutoff);
	for (const row of givenUp) {
		// The message holds identifiers only, so it is safe to log.
		console.error(
			`Giving up failed work after 7 days (${row.failures} failures, last: ${row.lastError}): ${row.message}`,
		);
	}

	const retry: WorkMessage[] = [];
	for (const row of await listFailedWorkFirstFailedSince(ctx.env.DB, cutoff)) {
		const message = parseWorkMessage(safeParse(row.message));
		if (message) retry.push(message);
		else console.error(`Unreadable failed_work row ${row.id}; leaving it`);
	}
	await sendAll(ctx, retry);
}

async function sendAll(ctx: Ctx, messages: WorkMessage[]): Promise<void> {
	for (let i = 0; i < messages.length; i += MAX_BATCH) {
		await ctx.queue.sendBatch(
			messages.slice(i, i + MAX_BATCH).map((body) => ({ body })),
		);
	}
}

function safeParse(json: string): unknown {
	try {
		return JSON.parse(json);
	} catch {
		return null;
	}
}
