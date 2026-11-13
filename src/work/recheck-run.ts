import type { Ctx } from "../ctx";
import { readRateLimitState } from "../db/rate-limit";
import {
	countRunStatement,
	readCandidates,
	stampStatement,
} from "../db/recheck";
import {
	checkedBefore,
	chooseRiders,
	OVERDUE_AFTER,
	runSize,
	spreadDelay,
} from "../recheck/pace";
import { halfDayUsed } from "../strava/rate-limit";
import { utcDay } from "../usage/allowances";
import type { RecheckRiderMessage } from "./messages";

// The hourly run of the ride edit re-check (feature 036
// contracts/hourly-run.md): chooses the riders to check, stamps and counts them
// in one batch, and sends one `recheck-rider` each, spread over the hour. It
// asks Strava nothing itself.

const DAY = 24 * 3600;
/** The Queues limit for one `sendBatch`. */
const MAX_BATCH = 100;

/**
 * One run. `byHand` is the fake mode's and the sandboxes' trigger, for looking
 * at the check without waiting hours: no hold, no pace and no delays, so every
 * eligible rider is checked at once, however recently the last run was.
 * Returns how many checks it sent.
 */
export async function recheckRun(ctx: Ctx, byHand = false): Promise<number> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const day = utcDay(now);
	const candidates = await readCandidates(db, now);
	// Riders active for more than 24 hours who waited longer than that; a
	// rider never checked counts once connected for 24 hours (data-model.md).
	const over24h = candidates.filter(
		(c) => c.settled && now - (c.recheckedAt ?? c.connectedAt) > DAY,
	).length;

	if (!byHand && halfDayUsed(await readRateLimitState(db), now)) {
		await countRunStatement(db, day, { sent: 0, over24h, held: true }).run();
		return 0;
	}

	const chosen = byHand
		? candidates
		: chooseRiders(
				candidates,
				runSize(
					new Date(now * 1000).getUTCHours(),
					ctx.team.recheckAllowance,
					candidates.length,
					candidates.filter((c) => checkedBefore(c, now, OVERDUE_AFTER)).length,
				),
				now,
			);
	await db.batch([
		...(chosen.length > 0
			? [
					stampStatement(
						db,
						chosen.map((c) => c.athleteId),
						now,
					),
				]
			: []),
		countRunStatement(db, day, { sent: chosen.length, over24h, held: false }),
	]);
	const messages = chosen.map((c, i) => {
		const body: RecheckRiderMessage = {
			kind: "recheck-rider",
			athleteId: c.athleteId,
			stamp: now,
			previous: c.recheckedAt,
		};
		return byHand
			? { body }
			: { body, delaySeconds: spreadDelay(i, chosen.length) };
	});
	// A run's own 55 fit one batch; by hand there may be more riders than that.
	for (let i = 0; i < messages.length; i += MAX_BATCH) {
		await ctx.queue.sendBatch(messages.slice(i, i + MAX_BATCH));
	}
	return chosen.length;
}
