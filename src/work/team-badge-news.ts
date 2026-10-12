import { badgeWindow } from "../badges/evaluate";
import { evaluateTeamBadges } from "../badges/team";
import { berlinDate } from "../config";
import type { Ctx } from "../ctx";
import {
	advanceTeamBadgeNoticesStatement,
	readTeamBadgeNoticesStatement,
	revealedOf,
	seedTeamBadgeNoticesStatement,
	teamBadgeAudienceStatements,
	teamBadgeRiseStatement,
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
// misses is caught by the next check, since the announced ids and the riders'
// rises are stored in one batch.

/**
 * Announces the team badges new since the last check and returns the riders to
 * notify, sorted. `keep` are the riders whose badge rise the same change just
 * wrote; their team badges join it. Never throws.
 */
export async function teamBadgeNews(
	ctx: Ctx,
	keep: readonly number[],
): Promise<number[]> {
	try {
		return await announce(ctx, new Set(keep));
	} catch (err) {
		const name = err instanceof Error ? err.name : "unknown error";
		console.error(`Checking team badges failed: ${name}`);
		return [];
	}
}

async function announce(ctx: Ctx, keep: Set<number>): Promise<number[]> {
	const db = ctx.env.DB;
	const window = countingWindow(ctx.env);
	const { seasonStart } = window;
	const now = ctx.now();
	const [sums, stored] = await Promise.all([
		readTeamBadgeSums(db),
		readTeamBadgeNoticesStatement(db, seasonStart).first<{
			badge_ids: string | null;
			checked: number;
		}>(),
	]);
	// Nothing dated after today counts (`badgeWindow`).
	const { earned } = evaluateTeamBadges(
		sums,
		CURRENT_RULES,
		badgeWindow(window, berlinDate(now)),
	);
	let previous = stored?.badge_ids ?? null;
	if (previous === null) {
		// The very first check, right after deploying, stores what the team has
		// without news. A later season starts with none announced, so the change
		// that brings its first badges announces them.
		const first = stored?.checked !== 1;
		previous = JSON.stringify([]);
		await seedTeamBadgeNoticesStatement(
			db,
			seasonStart,
			first ? earned.map((b) => b.badgeId).sort() : [],
			now,
		).run();
		if (first) return [];
	}

	const announced = new Set(JSON.parse(previous) as string[]);
	const fresh = earned.filter((b) => !announced.has(b.badgeId));
	if (fresh.length === 0) return [];
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

	const notice = {
		seasonStart,
		announced: [...announced, ...fresh.map((b) => b.badgeId)].sort(),
	};
	const notify: number[] = [];
	const rises: D1PreparedStatement[] = [];
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
		rises.push(
			teamBadgeRiseStatement(
				db,
				rider.athlete_id,
				news.map((b) => b.badgeId),
				keep.has(rider.athlete_id),
				notice,
				now,
			),
		);
	}
	const [advanced] = await db.batch([
		advanceTeamBadgeNoticesStatement(
			db,
			seasonStart,
			previous,
			notice.announced,
			now,
		),
		...rises,
	]);
	// Another check announced them first.
	if (advanced?.meta.changes !== 1) return [];
	return notify;
}
