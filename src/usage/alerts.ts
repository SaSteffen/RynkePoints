import type { Ctx } from "../ctx";
import { listAlertRecipients } from "../db/riders";
import {
	type AlertSubject,
	CPU_ALERT,
	clearOpenAlertStatement,
	fireAlertStatement,
	type UsageRecord,
} from "../db/usage";
import { notifyRiders } from "../work/send-notification";
import {
	alertLevels,
	CRITICAL_LEVEL,
	isOpenEnded,
	type RecordedAllowance,
	WARNING_LEVEL,
} from "./allowances";
import type { CpuLevel } from "./cpu";
import { reachesLevel } from "./figures";

// Telling administrators when an allowance is near its limit (feature 025
// contracts/alerts.md, research R5). Inserting first gives at most one
// notification per allowance, level and period, however often a run repeats; a
// lost push isn't retried, since the view still marks the figure.

/** The levels `used` has reached, lowest first, Hinweis included (feature 048). */
export function levelsReached(
	allowance: RecordedAllowance,
	used: number,
	limit: number,
): number[] {
	return alertLevels(allowance).filter((level) =>
		reachesLevel(used, limit, level),
	);
}

/** The UTC day of a daily allowance, or `open` where nothing resets. */
export function alertPeriod(allowance: RecordedAllowance, day: string): string {
	return isOpenEnded(allowance) ? "open" : day;
}

/**
 * Checks this run's freshly recorded values. A level newly reached is inserted
 * even without recipients, so turning the switch on later doesn't send it. Each
 * allowance with a level newly reached sends one notification, one even when it
 * reached both levels in this run, which the device words by the higher one.
 * Never holds up recording: the caller keeps a failure out.
 */
export async function checkAlerts(
	ctx: Ctx,
	records: readonly UsageRecord[],
): Promise<void> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const fires: Fire[] = [];
	const clears: D1PreparedStatement[] = [];
	for (const { allowance, day, used, limit } of records) {
		const reached = levelsReached(allowance, used, limit);
		const period = alertPeriod(allowance, day);
		for (const level of reached) {
			fires.push({
				subject: allowance,
				fire: fireAlertStatement(db, allowance, period, level, now),
			});
		}
		if (isOpenEnded(allowance)) {
			for (const level of alertLevels(allowance)) {
				if (!reached.includes(level)) {
					clears.push(clearOpenAlertStatement(db, allowance, level));
				}
			}
		}
	}
	await fireAndNotify(ctx, fires, clears);
}

interface Fire {
	subject: AlertSubject;
	fire: D1PreparedStatement;
}

/**
 * Today's CPU marks of this team's Worker and the gateway, as alert levels: a
 * warning is the lower level, critical the higher (FR-044). The same insert-first
 * rule gives one notification per level and day.
 */
export async function checkCpuAlerts(
	ctx: Ctx,
	day: string,
	levels: readonly CpuLevel[],
): Promise<void> {
	const db = ctx.env.DB;
	const now = ctx.now();
	const reached = new Set<number>();
	for (const level of levels) {
		if (level !== "ok") reached.add(WARNING_LEVEL);
		if (level === "critical") reached.add(CRITICAL_LEVEL);
	}
	await fireAndNotify(
		ctx,
		[...reached].map((level) => ({
			subject: CPU_ALERT,
			fire: fireAlertStatement(db, CPU_ALERT, day, level, now),
		})),
		[],
	);
}

/** Inserts the levels, then notifies once per subject with a level newly reached. */
async function fireAndNotify(
	ctx: Ctx,
	fires: readonly Fire[],
	clears: readonly D1PreparedStatement[],
): Promise<void> {
	const db = ctx.env.DB;
	if (fires.length + clears.length === 0) return;
	const results = await db.batch([...fires.map((f) => f.fire), ...clears]);
	const newly = new Set(
		fires
			.filter((_, i) => results[i]?.meta.changes === 1)
			.map((f) => f.subject),
	);
	if (newly.size === 0) return;
	const recipients = await listAlertRecipients(db);
	for (const _ of newly) {
		await notifyRiders(ctx, recipients);
	}
}
