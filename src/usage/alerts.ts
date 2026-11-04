import type { Ctx } from "../ctx";
import { listAlertRecipients } from "../db/riders";
import {
	clearOpenAlertStatement,
	fireAlertStatement,
	type UsageRecord,
} from "../db/usage";
import { notifyRiders } from "../work/send-notification";
import {
	ALERT_LEVELS,
	type AlertLevel,
	isOpenEnded,
	type RecordedAllowance,
} from "./allowances";
import { reachesLevel } from "./figures";

// Telling administrators when an allowance is near its limit (feature 025
// contracts/alerts.md, research R5). Inserting first gives at most one
// notification per allowance, level and period, however often a run repeats; a
// lost push isn't retried, since the view still marks the figure.

/** The levels `used` has reached, lowest first. */
export function levelsReached(used: number, limit: number): AlertLevel[] {
	return ALERT_LEVELS.filter((level) => reachesLevel(used, limit, level));
}

/** The UTC day of a daily allowance, or `open` where nothing resets. */
export function alertPeriod(allowance: RecordedAllowance, day: string): string {
	return isOpenEnded(allowance) ? "open" : day;
}

/**
 * Checks this run's freshly recorded values. A level newly reached is inserted
 * even without recipients, so turning the switch on later doesn't send it. Both
 * levels newly reached in one run send one notification, which the device words
 * by the higher one. Never holds up recording: the caller keeps a failure out.
 */
export async function checkAlerts(
	ctx: Ctx,
	records: readonly UsageRecord[],
): Promise<void> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const fires: { allowance: RecordedAllowance; fire: D1PreparedStatement }[] =
		[];
	const clears: D1PreparedStatement[] = [];
	for (const { allowance, day, used, limit } of records) {
		const reached = levelsReached(used, limit);
		const period = alertPeriod(allowance, day);
		for (const level of reached) {
			fires.push({
				allowance,
				fire: fireAlertStatement(db, allowance, period, level, now),
			});
		}
		if (isOpenEnded(allowance)) {
			for (const level of ALERT_LEVELS) {
				if (!reached.includes(level)) {
					clears.push(clearOpenAlertStatement(db, allowance, level));
				}
			}
		}
	}
	if (fires.length + clears.length === 0) return;
	const results = await db.batch([...fires.map((f) => f.fire), ...clears]);
	const newly = new Set(
		fires
			.filter((_, i) => results[i]?.meta.changes === 1)
			.map((f) => f.allowance),
	);
	if (newly.size === 0) return;
	const recipients = await listAlertRecipients(db);
	for (const _ of newly) {
		await notifyRiders(ctx, recipients);
	}
}
