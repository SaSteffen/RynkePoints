import { evaluateTeamBadges } from "../badges/team";
import { berlinDate } from "../config";
import type { Ctx } from "../ctx";
import {
	advanceTeamBadgeNoticesStatement,
	mergeBadgeRiseStatement,
	readTeamBadgeNoticesStatement,
	revealedOf,
	seedTeamBadgeNoticesStatement,
	teamBadgeAudienceStatements,
} from "../db/badges";
import { readTeamBadgeSums } from "../db/team";
import { CURRENT_RULES, countingWindow } from "../rynke/rules";

// Team badges notify (issue #125, amending feature 013 FR-032). They are still
// worked out on read (research R15); after a change that notifies (activity
// events, team-event and correction changes), this works them out once more and
// compares them with the season's announced ones in `team_badge_notices`. Each
// new one is announced once per season: it becomes a badge rise of every listed
// rider it is new to, by the Team page's own rule (earned on or after the day
// they connected, not yet revealed, research R16). Nothing here tells who
// contributed: only sums are read, and every listed rider gets the same news.
//
// A notification is a courtesy (010 FR-018): this never throws, and a change it
// misses is caught by the next check, since the stored ids only grow.

/**
 * Announces the team badges new since the last check and returns the riders to
 * notify, sorted. Never throws.
 */
export async function teamBadgeNews(ctx: Ctx): Promise<number[]> {
	try {
		return await announce(ctx);
	} catch (err) {
		const name = err instanceof Error ? err.name : "unknown error";
		console.error(`Checking team badges failed: ${name}`);
		return [];
	}
}

async function announce(ctx: Ctx): Promise<number[]> {
	const db = ctx.env.DB;
	const window = countingWindow(ctx.env);
	const now = ctx.now();
	const [sums, stored] = await Promise.all([
		readTeamBadgeSums(db),
		readTeamBadgeNoticesStatement(db, window.seasonStart).first<{
			badge_ids: string;
		}>(),
	]);
	const { earned } = evaluateTeamBadges(sums, CURRENT_RULES, window);
	if (!stored) {
		// The season's first check, e.g. right after deploying: no news.
		await seedTeamBadgeNoticesStatement(
			db,
			window.seasonStart,
			earned.map((b) => b.badgeId).sort(),
			now,
		).run();
		return [];
	}

	const announced = new Set(JSON.parse(stored.badge_ids) as string[]);
	const fresh = earned.filter((b) => !announced.has(b.badgeId));
	if (fresh.length === 0) return [];
	const advanced = await advanceTeamBadgeNoticesStatement(
		db,
		window.seasonStart,
		stored.badge_ids,
		[...announced, ...fresh.map((b) => b.badgeId)].sort(),
		now,
	).run();
	// Another check announced them first.
	if (advanced.meta.changes !== 1) return [];

	const [riderRows, revealRows] = await db.batch(
		teamBadgeAudienceStatements(
			db,
			fresh.map((b) => b.badgeId),
		),
	);
	if (!riderRows || !revealRows) {
		throw new Error("D1 batch returned too few results");
	}
	const reveals = new Map<number, { badge_id: string; earned_on: string }[]>();
	for (const row of revealRows.results as {
		athlete_id: number;
		badge_id: string;
		earned_on: string;
	}[]) {
		reveals.set(row.athlete_id, [...(reveals.get(row.athlete_id) ?? []), row]);
	}

	const notify: number[] = [];
	const writes: D1PreparedStatement[] = [];
	for (const rider of riderRows.results as {
		athlete_id: number;
		connected_at: number;
	}[]) {
		const connectedOn = berlinDate(rider.connected_at);
		const revealed = revealedOf(reveals.get(rider.athlete_id) ?? []);
		const news = fresh.filter((b) => {
			const shown = revealed.get(b.badgeId);
			return (
				b.earnedOn >= connectedOn && (shown === undefined || shown < b.earnedOn)
			);
		});
		if (news.length === 0) continue;
		notify.push(rider.athlete_id);
		writes.push(
			mergeBadgeRiseStatement(
				db,
				rider.athlete_id,
				news.map((b) => b.badgeId),
				now,
			),
		);
	}
	if (writes.length > 0) await db.batch(writes);
	return notify;
}
