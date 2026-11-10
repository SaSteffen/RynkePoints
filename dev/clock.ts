import { berlinDate } from "../src/config";
import type { Ctx } from "../src/ctx";

// Fake mode's clock (feature 021): `/_dev/` can pretend today is another day,
// so the sample season's later days can be seen before they come, the Tour de
// Paris days in July above all. Pages, the queue and the daily cron all run on
// it; the time of day stays the real one. The day lives in fake mode's local D1,
// in a table the dev entry creates itself, never a migration.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Whether `day` is a real `YYYY-MM-DD` date. */
export function isDay(day: string): boolean {
	return DAY.test(day) && Date.parse(`${day}T00:00:00Z`) > 0;
}

/** The pretended day, or null when the clock is the real one. */
export async function pretendedDay(db: D1Database): Promise<string | null> {
	const [, read] = await db.batch([
		db.prepare("CREATE TABLE IF NOT EXISTS fake_dev_clock (day TEXT NOT NULL)"),
		db.prepare("SELECT day FROM fake_dev_clock"),
	]);
	return (read?.results[0] as { day: string } | undefined)?.day ?? null;
}

/** Pretends today is `day`, or goes back to the real clock with null. */
export async function pretendDay(
	db: D1Database,
	day: string | null,
): Promise<void> {
	await db.batch([
		db.prepare("CREATE TABLE IF NOT EXISTS fake_dev_clock (day TEXT NOT NULL)"),
		db.prepare("DELETE FROM fake_dev_clock"),
		...(day === null
			? []
			: [db.prepare("INSERT INTO fake_dev_clock (day) VALUES (?)").bind(day)]),
	]);
}

/**
 * `realNow` (epoch seconds) moved to `day` in Europe/Berlin, at the same time
 * of day, give or take the hour a change of summer time adds.
 */
export function shiftedNow(day: string, realNow: number): number {
	const days =
		(Date.parse(`${day}T00:00:00Z`) -
			Date.parse(`${berlinDate(realNow)}T00:00:00Z`)) /
		1000;
	const shifted = realNow + days;
	const landed = berlinDate(shifted);
	if (landed < day) return shifted + 3600;
	if (landed > day) return shifted - 3600;
	return shifted;
}

/**
 * The browser tests' fixed day (issue #301): `RYNKE_FAKE_SEASON_DAY` days after
 * the team's season start, so every run sees the same season whatever the real
 * date, and the day moves along when the season settings do. Null without it.
 */
export function fixedDay(
	env: Pick<Env, "SEASON_START_DATE"> & { RYNKE_FAKE_SEASON_DAY?: string },
): string | null {
	const days = env.RYNKE_FAKE_SEASON_DAY;
	if (days === undefined || days === "") return null;
	if (!/^\d+$/.test(days)) {
		throw new Error("RYNKE_FAKE_SEASON_DAY must be a number of days");
	}
	const start = Date.parse(`${env.SEASON_START_DATE}T00:00:00Z`);
	return new Date(start + Number(days) * 86_400_000).toISOString().slice(0, 10);
}

/** The day `/_dev/` pretends, else the fixed day, else null: the real one. */
export async function devDay(
	env: Env & { RYNKE_FAKE_SEASON_DAY?: string },
): Promise<string | null> {
	return (await pretendedDay(env.DB)) ?? fixedDay(env);
}

/** `ctx` on the pretended or fixed day, if there is one. */
export async function onDevClock(ctx: Ctx): Promise<Ctx> {
	const day = await devDay(ctx.env);
	if (day === null) return ctx;
	const real = ctx.now;
	return { ...ctx, now: () => shiftedNow(day, real()) };
}
