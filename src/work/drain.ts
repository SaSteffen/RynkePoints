import type { Ctx } from "../ctx";
import { readBadgeRiseStatement, upsertBadgeRiseStatement } from "../db/badges";
import { deleteFailedWorkByMessage, upsertFailedWork } from "../db/failed-work";
import { getRider, markNeedsReconnect } from "../db/riders";
import { upsertRiseStatement } from "../db/rynke";
import {
	addHeldBadges,
	claimWake,
	closeBacklog,
	dropRiderWork,
	earliestWaiting,
	finishWork,
	type HeldBacklog,
	holdRecipients,
	nextWork,
	readHeldBacklog,
	retryWork,
	type StravaWorkItem,
} from "../db/strava-work";
import { backoffSeconds, MAX_DELAY_SECONDS } from "../strava/rate-limit";
import {
	type Handler,
	type HandlerResult,
	type Handlers,
	MAX_ATTEMPTS,
} from "./handler";
import {
	type SendNotificationMessage,
	STRAVA_TURN,
	type StravaTurnMessage,
	sendAll,
	serializeWorkMessage,
	type WorkMessage,
} from "./messages";
import { notifyRiders } from "./send-notification";

// The drain of the Strava work table (feature 024 contracts/queue-messages.md):
// riders take turns, one item each (research R2), with the retry rules of the
// queue (R3). A rider's notifications wait until their queue is empty, then
// each rider owed one gets one (R6).

/** Items per invocation; then a wake continues at once (R4). */
export const DRAIN_LIMIT = 50;

export async function drain(ctx: Ctx, handlers: Handlers): Promise<void> {
	const db = ctx.env.DB;
	for (let done = 0; ; done++) {
		const now = ctx.now();
		const item = await nextWork(db, now);
		if (!item) {
			// Only rows backing off, if any: wake when the first is ready.
			const ready = await earliestWaiting(db);
			if (ready !== null) await wake(ctx, Math.max(ready, now));
			return;
		}
		if (done >= DRAIN_LIMIT) {
			await wake(ctx, now);
			return;
		}
		const deferral = await runItem(ctx, handlers, item);
		if (deferral !== null) {
			// The budget: everybody waits for the next window or day (FR-009).
			await wake(ctx, now + deferral);
			return;
		}
	}
}

/**
 * Asks for a `strava-turn` at `at` unless one is pending at or before it. Never
 * throws: a lost wake is made up by the next message that arrives.
 */
async function wake(ctx: Ctx, at: number): Promise<void> {
	const now = ctx.now();
	const delay = Math.min(Math.max(at - now, 0), MAX_DELAY_SECONDS);
	const when = now + delay;
	try {
		if (!(await claimWake(ctx.env.DB, when, now))) return;
		// The turn names no rider, so it isn't a WorkMessage (R4).
		const queue = ctx.queue as unknown as Pick<
			Queue<StravaTurnMessage>,
			"send"
		>;
		await queue.send(STRAVA_TURN, delay > 0 ? { delaySeconds: delay } : {});
	} catch (err) {
		console.error(`Scheduling the Strava turn failed: ${errorName(err)}`);
		try {
			await ctx.env.DB.prepare(
				"UPDATE strava_turn SET wake_at = 0 WHERE id = 1",
			).run();
		} catch {
			// The claim stays until its time passes; then wakes are sent again.
		}
	}
}

function errorName(err: unknown): string {
	return err instanceof Error ? err.name : "unknown error";
}

/**
 * Runs one item. Returns the budget's `delaySeconds` when the drain must stop,
 * otherwise `null`.
 */
async function runItem(
	ctx: Ctx,
	handlers: Handlers,
	item: StravaWorkItem,
): Promise<number | null> {
	const db = ctx.env.DB;
	const rider = await getRider(db, item.athleteId);
	if (!rider || rider.status === "needs_reconnect") {
		// Nothing of theirs is fetched any more (FR-010).
		await dropRiderWork(db, item.athleteId);
		return null;
	}
	const handler = handlers[item.message.kind] as
		| Handler<WorkMessage>
		| undefined;
	if (!handler) {
		console.error(`No handler for ${item.message.kind}; dropping strava_work`);
		await settle(ctx, item, await finishWork(db, item), [], null);
		return null;
	}

	const attempt = {
		attempts: item.attempts,
		isLastAttempt: item.attempts >= MAX_ATTEMPTS,
	};
	const badgesBefore = await readBadgeRise(db, item.athleteId);
	const { ctx: holding, captured } = holdingNotifications(ctx);
	let result: HandlerResult;
	try {
		result = await handler(item.message, rider, holding, attempt);
	} catch (err) {
		// Only the error name: messages may quote SQL or other internals.
		result = { kind: "transient", reason: `exception: ${errorName(err)}` };
	}

	switch (result.kind) {
		case "ok":
			await deleteFailedWorkByMessage(db, serializeWorkMessage(item.message));
			break;
		case "budget":
			// Nothing used up, the rider keeps their turn (FR-009).
			await holdRecipients(db, item.athleteId, recipientsOf(captured));
			return result.delaySeconds;
		case "transient":
			if (!attempt.isLastAttempt) {
				await retryWork(db, item, ctx.now() + backoffSeconds(item.attempts));
				await holdRecipients(db, item.athleteId, recipientsOf(captured));
				return null;
			}
			await upsertFailedWork(db, {
				athleteId: item.athleteId,
				message: serializeWorkMessage(item.message),
				lastError: result.reason,
				now: ctx.now(),
			});
			console.error(
				`${item.message.kind} for athlete ${item.athleteId} moved to failed_work: ${result.reason}`,
			);
			break;
		case "refresh-refused":
			await markNeedsReconnect(db, item.athleteId, ctx.now());
			await dropRiderWork(db, item.athleteId);
			return null;
	}
	await settle(ctx, item, await finishWork(db, item), captured, badgesBefore);
	return null;
}

/** A context whose queue keeps `send-notification` back (R6). */
function holdingNotifications(ctx: Ctx): {
	ctx: Ctx;
	captured: SendNotificationMessage[];
} {
	const captured: SendNotificationMessage[] = [];
	const sent = { metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } } };
	const queue: Ctx["queue"] = {
		async send(body, options) {
			if (body.kind === "send-notification") {
				captured.push(body);
				return sent;
			}
			return ctx.queue.send(body, options);
		},
		async sendBatch(messages, options) {
			const rest: MessageSendRequest<WorkMessage>[] = [];
			for (const m of messages) {
				if (m.body.kind === "send-notification") captured.push(m.body);
				else rest.push(m);
			}
			if (rest.length === 0) return sent;
			return ctx.queue.sendBatch(rest, options);
		},
	};
	return { ctx: { ...ctx, queue }, captured };
}

function recipientsOf(captured: readonly SendNotificationMessage[]): number[] {
	return [...new Set(captured.map((m) => m.athleteId))].sort((a, b) => a - b);
}

interface BadgeRise {
	badge_ids: string;
	risen_at: number;
}

async function readBadgeRise(
	db: D1Database,
	athleteId: number,
): Promise<BadgeRise | null> {
	return readBadgeRiseStatement(db, athleteId).first<BadgeRise>();
}

/** The badges the item's change wrote as the rider's badge rise, if any. */
async function newBadges(
	db: D1Database,
	athleteId: number,
	before: BadgeRise | null,
): Promise<string[]> {
	const after = await readBadgeRise(db, athleteId);
	if (!after) return [];
	if (
		before &&
		before.risen_at === after.risen_at &&
		before.badge_ids === after.badge_ids
	) {
		return [];
	}
	return JSON.parse(after.badge_ids) as string[];
}

/**
 * After a finished item: hold its notifications while the rider has work
 * waiting; once the queue is empty, send them as they are when nothing was held
 * (a lone event notifies as today, FR-017), or one per rider owed one with the
 * whole backlog's rise and badges (FR-015, FR-016).
 */
async function settle(
	ctx: Ctx,
	item: StravaWorkItem,
	waiting: number,
	captured: SendNotificationMessage[],
	badgesBefore: BadgeRise | null,
): Promise<void> {
	const db = ctx.env.DB;
	const owner = item.athleteId;
	const recipients = recipientsOf(captured);
	const ownBadges = recipients.includes(owner)
		? await newBadges(db, owner, badgesBefore)
		: [];
	if (waiting > 0) {
		await holdRecipients(db, owner, recipients);
		await addHeldBadges(db, owner, ownBadges);
		return;
	}

	const held = await readHeldBacklog(db, owner);
	await closeBacklog(db, owner);
	if (!held || held.recipients.length === 0) {
		if (captured.length === 0) return;
		try {
			await sendAll(ctx, captured);
		} catch (err) {
			// A notification never fails the change that caused it (010 FR-018);
			// logged as `notifyRiders` logs it.
			console.error(
				`Queueing notifications for ${recipients.length} riders failed: ${errorName(err)}`,
			);
		}
		return;
	}

	const owed = new Set([...held.recipients, ...recipients]);
	if (owed.has(owner)) {
		const badges = [...new Set([...held.badges, ...ownBadges])].sort();
		if (!(await writeBacklogRise(ctx, owner, held, badges))) owed.delete(owner);
	}
	await notifyRiders(
		ctx,
		[...owed].sort((a, b) => a - b),
	);
}

/**
 * Writes the rider's rise for the whole backlog, so the one notification's text
 * tells all of it (R6): their Rynke now against when the backlog began, and
 * every badge it brought. Returns whether there is anything to tell.
 */
async function writeBacklogRise(
	ctx: Ctx,
	owner: number,
	held: HeldBacklog,
	badges: string[],
): Promise<boolean> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const balance = await db
		.prepare(
			"SELECT training_rynke, team_rynke FROM rynke_balances WHERE athlete_id = ?",
		)
		.bind(owner)
		.first<{ training_rynke: number; team_rynke: number }>();
	const training =
		balance && held.startTraining !== null
			? Math.max(0, balance.training_rynke - held.startTraining)
			: 0;
	const team =
		balance && held.startTeam !== null
			? Math.max(0, balance.team_rynke - held.startTeam)
			: 0;
	const writes: D1PreparedStatement[] = [];
	if (training > 0 || team > 0) {
		writes.push(upsertRiseStatement(db, owner, { training, team }, now));
	}
	if (badges.length > 0) {
		writes.push(upsertBadgeRiseStatement(db, owner, badges, now));
	}
	if (writes.length === 0) return false;
	await db.batch(writes);
	return true;
}
