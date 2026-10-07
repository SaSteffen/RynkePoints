import type { Ctx } from "../ctx";
import { deleteFailedWorkByMessage, upsertFailedWork } from "../db/failed-work";
import {
	deleteRider,
	getRider,
	markNeedsReconnect,
	type Rider,
} from "../db/riders";
import { backoffSeconds, MAX_DELAY_SECONDS } from "../strava/rate-limit";
import {
	parseWorkMessage,
	serializeWorkMessage,
	type WorkMessage,
} from "./messages";

// The common consumer rules from contracts/queue-messages.md. Message-specific
// work lives in the handlers; this decides what happens to the message.

/**
 * Deliveries per message: `max_retries` (10 in wrangler.jsonc) plus the first
 * one. `message.attempts` reaches this on the last delivery.
 */
export const MAX_ATTEMPTS = 11;

export type HandlerResult =
	| { kind: "ok" }
	| { kind: "budget"; delaySeconds: number }
	| { kind: "transient"; reason: string }
	| { kind: "refresh-refused" };

export interface Attempt {
	attempts: number;
	isLastAttempt: boolean;
}

export type Handler<M extends WorkMessage> = (
	message: M,
	rider: Rider,
	ctx: Ctx,
	attempt: Attempt,
) => Promise<HandlerResult>;

export type Handlers = {
	[K in WorkMessage["kind"]]?: Handler<Extract<WorkMessage, { kind: K }>>;
};

/** Processes messages one at a time: the shared rate budget needs it (R6). */
export async function processBatch(
	batch: MessageBatch<unknown>,
	ctx: Ctx,
	handlers: Handlers,
): Promise<void> {
	for (const message of batch.messages) {
		try {
			await processMessage(message, ctx, handlers);
		} catch (err) {
			// A D1 or queue failure outside the handler. Retry this message only,
			// so the rest of the batch still runs.
			console.error(`Queue message processing failed: ${errorName(err)}`);
			message.retry({ delaySeconds: backoffSeconds(message.attempts) });
		}
	}
}

function errorName(err: unknown): string {
	return err instanceof Error ? err.name : "unknown error";
}

async function processMessage(
	message: Message<unknown>,
	ctx: Ctx,
	handlers: Handlers,
): Promise<void> {
	const body = parseWorkMessage(message.body);
	if (!body) {
		console.warn("Dropping invalid queue message");
		message.ack();
		return;
	}

	const rider = await getRider(ctx.env.DB, body.athleteId);
	if (
		!rider ||
		(rider.status === "needs_reconnect" && body.kind !== "delete-rider")
	) {
		message.ack();
		return;
	}

	const handler = handlers[body.kind] as Handler<WorkMessage> | undefined;
	if (!handler) {
		console.error(`No handler for ${body.kind}; dropping message`);
		message.ack();
		return;
	}

	const attempt = {
		attempts: message.attempts,
		isLastAttempt: message.attempts >= MAX_ATTEMPTS,
	};
	let result: HandlerResult;
	try {
		result = await handler(body, rider, ctx, attempt);
	} catch (err) {
		// Only the error name: messages may quote SQL or other internals.
		result = { kind: "transient", reason: `exception: ${errorName(err)}` };
	}

	if (body.kind === "delete-rider" && result.kind !== "ok") {
		// Deletion is never deferred or stopped by a refused refresh (rule 4):
		// keep retrying, and on the last attempt delete anyway.
		result = {
			kind: "transient",
			reason: result.kind === "transient" ? result.reason : result.kind,
		};
	}

	switch (result.kind) {
		case "ok":
			await deleteFailedWorkByMessage(ctx.env.DB, serializeWorkMessage(body));
			message.ack();
			return;
		case "budget":
			// Re-send rather than retry(), so deferrals never use up attempts.
			// Send first: if it fails, the original is retried.
			try {
				await ctx.queue.send(body, {
					delaySeconds: Math.min(result.delaySeconds, MAX_DELAY_SECONDS),
				});
			} catch {
				await transientFailure(message, body, ctx, attempt, "re-send failed");
				return;
			}
			message.ack();
			return;
		case "transient":
			await transientFailure(message, body, ctx, attempt, result.reason);
			return;
		case "refresh-refused":
			await markNeedsReconnect(ctx.env.DB, body.athleteId, ctx.now());
			message.ack();
			return;
	}
}

/** Backoff, or on the last attempt: record in failed_work (R7) and ack. */
async function transientFailure(
	message: Message<unknown>,
	body: WorkMessage,
	ctx: Ctx,
	attempt: Attempt,
	reason: string,
): Promise<void> {
	if (!attempt.isLastAttempt) {
		message.retry({ delaySeconds: backoffSeconds(message.attempts) });
		return;
	}
	if (body.kind === "send-notification") {
		// A notification never fails anything (feature 010 FR-018). The handler
		// already stops after 4 tries; this is defence in depth.
		console.error(
			`send-notification for athlete ${body.athleteId} dropped: ${reason}`,
		);
	} else if (body.kind === "delete-rider") {
		// The deletion must complete (Principle I), even if revoking never did.
		await deleteRider(ctx.env.DB, body.athleteId);
		console.error(
			`delete-rider for athlete ${body.athleteId} deleted after retries ran out: ${reason}`,
		);
	} else {
		await upsertFailedWork(ctx.env.DB, {
			athleteId: body.athleteId,
			message: serializeWorkMessage(body),
			lastError: reason,
			now: ctx.now(),
		});
		console.error(
			`${body.kind} for athlete ${body.athleteId} moved to failed_work: ${reason}`,
		);
	}
	message.ack();
}
