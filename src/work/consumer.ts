import type { Ctx } from "../ctx";
import { deleteFailedWorkByMessage, upsertFailedWork } from "../db/failed-work";
import { getRider, markNeedsReconnect, type Rider } from "../db/riders";
import { backoffSeconds, MAX_DELAY_SECONDS } from "../strava/rate-limit";
import {
	parseWorkMessage,
	serializeWorkMessage,
	type WorkMessage,
} from "./messages";

// The common consumer rules from contracts/queue-messages.md. Message-specific
// work lives in the handlers; this decides what happens to the message.

/** Matches `max_retries` in wrangler.jsonc. */
export const MAX_ATTEMPTS = 10;

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
		await processMessage(message, ctx, handlers);
	}
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
		const name = err instanceof Error ? err.message : "unknown error";
		result = { kind: "transient", reason: `exception: ${name}`.slice(0, 200) };
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
				message.ack();
			} catch {
				message.retry({ delaySeconds: backoffSeconds(message.attempts) });
			}
			return;
		case "transient":
			if (!attempt.isLastAttempt) {
				message.retry({ delaySeconds: backoffSeconds(message.attempts) });
				return;
			}
			if (body.kind === "delete-rider") {
				console.error(
					`delete-rider for athlete ${body.athleteId} gave up: ${result.reason}`,
				);
			} else {
				await upsertFailedWork(ctx.env.DB, {
					athleteId: body.athleteId,
					message: serializeWorkMessage(body),
					lastError: result.reason,
					now: ctx.now(),
				});
				console.error(
					`${body.kind} for athlete ${body.athleteId} moved to failed_work: ${result.reason}`,
				);
			}
			message.ack();
			return;
		case "refresh-refused":
			await markNeedsReconnect(ctx.env.DB, body.athleteId, ctx.now());
			message.ack();
			return;
	}
}
