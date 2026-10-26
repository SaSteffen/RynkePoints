// One rider's album data (feature 021 data-model.md "Album model", research
// R12): built on each request from the app's own readers and pure
// evaluations, with "today" set to the cut-off, so the album shows what the
// app showed that day (FR-023, SC-003). Nothing is written.

import {
	BADGES,
	type BadgeCategoryId,
	type BadgeId,
	categoryById,
} from "../src/badges/catalog";
import { badgeWindow } from "../src/badges/evaluate";
import { evaluateTeamBadges, type TeamBadgeSums } from "../src/badges/team";
import { berlinDate } from "../src/config";
import { listRiderBadgesStatement, type RiderBadgeRow } from "../src/db/badges";
import { type RiderViewRead, readRiderView } from "../src/db/rider-view";
import { type BalanceRow, toStoredBalance } from "../src/db/rynke";
import {
	listTeamBalancesStatement,
	teamBadgeSumsStatements,
	toTeamBadgeSums,
} from "../src/db/team";
import {
	listTeamEventsStatement,
	type TeamEventListRow,
} from "../src/db/team-events";
import { DEFAULT_LOCALE, type Locale } from "../src/i18n/catalogs";
import {
	type CountingWindow,
	CURRENT_RULES,
	countingWindow,
	rulesForVersion,
	seasonEnd,
} from "../src/rynke/rules";
import type { EventKind } from "../src/rynke/team-events";
import { lastDay, riderCurve, riderDays } from "../src/rynke/weeks";
import type { AlbumEnv } from "./routes";

export interface AlbumEvent {
	date: string;
	kind: EventKind;
	name: string | null;
	/** Listed riders who attended; never who. */
	attendees: number;
	attendedByRider: boolean;
}

export interface AlbumSlot {
	badgeId: BadgeId;
	group: "personal" | "team";
	category: BadgeCategoryId;
	/** Null: an empty slot. */
	earnedOn: string | null;
	/** A surprise badge: "?" while empty (feature 013 FR-015b). */
	surprise: boolean;
}

export interface AlbumData {
	season: { start: string; end: string; label: string };
	cutoff: string;
	locale: Locale;
	rider: {
		athleteId: number;
		firstName: string;
		trainingRynke: number;
		teamRynke: number;
		eventsAttended: number;
	};
	team: {
		/** The Team page's total (feature 016) on the cut-off date. */
		trainingRynke: number;
		/** The season's events up to the cut-off, oldest first. */
		events: AlbumEvent[];
	};
	/** One per catalog badge, in the gallery's order (FR-035). */
	slots: AlbumSlot[];
}

/** "2026/27" for a season starting in 2026. */
export function seasonLabel(seasonStart: string): string {
	const year = Number(seasonStart.slice(0, 4));
	return `${year}/${String(year + 1).slice(2)}`;
}

/** The last day the app's figures run to on `today`, as the rider page has it. */
function shownUntil(window: CountingWindow, today: string): string {
	const last = lastDay(today, window.deadline);
	// biome-ignore lint/complexity/useMathMinMax: ISO date strings, not numbers
	return last < window.seasonStart ? window.seasonStart : last;
}

/**
 * The rider's Training and Team Rynke on `cutoff`: the stored balance once
 * nothing counts after it, else the progress curve's value that day (feature
 * 009), which ends in the stored balance.
 */
function riderRynkeOn(
	read: RiderViewRead,
	window: CountingWindow,
	today: string,
	cutoff: string,
): { training: number; team: number } {
	const { balance, progress } = read;
	if (!balance) return { training: 0, team: 0 };
	const last = shownUntil(window, today);
	const rules = rulesForVersion(balance.rulesVersion);
	if (cutoff >= last || !progress || !rules) {
		return { training: balance.trainingRynke, team: balance.teamRynke };
	}
	const point = riderCurve(progress, window, last, balance, rules).find(
		(p) => p.date === cutoff,
	);
	return { training: point?.training ?? 0, team: point?.team ?? 0 };
}

/**
 * The listed riders' Training Rynke together on `cutoff`: the stored
 * balances' sum, as the Team page shows it, once nothing counts after the
 * cut-off; else each rider's daily series on that day (feature 013 R14).
 */
function teamTrainingOn(
	balances: readonly { trainingRynke: number }[],
	sums: TeamBadgeSums,
	window: CountingWindow,
	today: string,
	cutoff: string,
): number {
	if (cutoff >= shownUntil(window, today)) {
		return balances.reduce((sum, b) => sum + b.trainingRynke, 0);
	}
	return sums.riders.reduce((sum, rider) => {
		const days = riderDays(rider, window, CURRENT_RULES).filter(
			(day) => day.date <= cutoff,
		);
		return sum + (days.at(-1)?.training ?? 0);
	}, 0);
}

export async function loadAlbum(
	db: D1Database,
	env: AlbumEnv,
	rider: { athleteId: number; firstName: string },
	cutoff: string,
	now: number,
): Promise<AlbumData> {
	const window = countingWindow(env);
	const end = seasonEnd(window);
	const today = berlinDate(now);
	const until = cutoff < end ? cutoff : end;
	const read = await readRiderView(db, rider.athleteId, 1, { progress: true });
	const [badgeRows, balanceRows, eventRows, ...sumRows] = await db.batch([
		listRiderBadgesStatement(db, rider.athleteId),
		listTeamBalancesStatement(db),
		listTeamEventsStatement(db, window.seasonStart),
		...teamBadgeSumsStatements(db),
	]);
	if (!badgeRows || !balanceRows || !eventRows) {
		throw new Error("D1 batch returned too few results");
	}
	const sums = toTeamBadgeSums(sumRows);
	const { training, team } = riderRynkeOn(read, window, today, cutoff);

	const attended = new Set(
		read.attendance
			.filter((a) => a.date >= window.seasonStart && a.date <= until)
			.map((a) => a.eventId),
	);
	const listedAttendees = new Map(
		sums.events.map((event) => [event.eventId, event.attendees]),
	);
	const events = (eventRows.results as TeamEventListRow[])
		.filter((row) => row.event_date <= until)
		.map((row) => ({
			id: row.event_id,
			date: row.event_date,
			kind: row.kind,
			name: row.name,
			attendees: listedAttendees.get(row.event_id) ?? 0,
			attendedByRider: attended.has(row.event_id),
		}))
		.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
		.map(({ id: _, ...event }) => event);

	const personal = new Map(
		(badgeRows.results as RiderBadgeRow[])
			.filter((row) => row.earned_on <= cutoff)
			.map((row) => [row.badge_id, row.earned_on]),
	);
	const teamEarned = new Map(
		evaluateTeamBadges(
			sums,
			CURRENT_RULES,
			badgeWindow(window, cutoff),
		).earned.map((b) => [b.badgeId, b.earnedOn]),
	);
	const slots = BADGES.map((badge) => ({
		badgeId: badge.id,
		group: badge.group,
		category: badge.category,
		earnedOn:
			(badge.group === "personal" ? personal : teamEarned).get(badge.id) ??
			null,
		surprise: categoryById(badge.category).surprise === true,
	}));

	return {
		season: {
			start: window.seasonStart,
			end,
			label: seasonLabel(window.seasonStart),
		},
		cutoff,
		// The app does not store a rider's language (feature 001 FR-028:
		// it lives in their browser), so every album is in the default one.
		locale: DEFAULT_LOCALE,
		rider: {
			athleteId: rider.athleteId,
			firstName: rider.firstName,
			trainingRynke: training,
			teamRynke: team,
			eventsAttended: attended.size,
		},
		team: {
			trainingRynke: teamTrainingOn(
				(balanceRows.results as BalanceRow[]).map(toStoredBalance),
				sums,
				window,
				today,
				cutoff,
			),
			events,
		},
		slots,
	};
}
