import type { Ctx } from "../ctx";
import type { Rider } from "../db/riders";
import type { WorkMessage } from "./messages";

// What a handler gets and returns, shared by the queue consumer and the
// Strava work drain (feature 024 research R3).

/**
 * Deliveries per message: `max_retries` (10 in wrangler.jsonc) plus the first
 * one. `message.attempts` reaches this on the last delivery; a Strava work row
 * counts its attempts the same way (feature 024 R3).
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
