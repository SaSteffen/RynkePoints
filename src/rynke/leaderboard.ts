// Places, ties, the neighbourhood and the team totals of the Team page
// (feature 016 research R6, data-model.md `LeaderboardRow`, `Viewer`,
// `Neighbourhood`, `TeamTotals`). Pure. The
// riders come in with their athlete IDs, which only order them and find the
// viewer; the rows leave with nothing that names anyone (FR-010, SC-002).

import type { WeekPoint } from "./weeks";

export type RynkeKind = "training" | "team";

/** A listed rider as the leaderboard needs them; extra fields are ignored. */
export interface LeaderboardRider {
	athleteId: number;
	/** `null` without a stored balance: every figure counts as 0. */
	balance: { trainingRynke: number; teamRynke: number } | null;
	weeks: readonly WeekPoint[];
}

export interface LeaderboardRow {
	you: boolean;
	/** Standard competition ranking in the picked kind: 1, 2, 2, 4. */
	place: number;
	/** Another row shares `place`. */
	joint: boolean;
	total: number;
	/** The other kind's total. */
	other: number;
	/** The picked kind at the end of each week, for the sparkline. */
	weeks: number[];
}

export interface Viewer {
	place: number;
	joint: boolean;
	/** The number of rows. */
	count: number;
	/** The Rynke to pass the next place; `null` in 1st place. */
	toNext: number | null;
	/** 1st place, shared or not. */
	lead: boolean;
}

export interface Neighbourhood {
	rows: LeaderboardRow[];
	hiddenAhead: number;
	hiddenBehind: number;
	/** The "Around you / Everyone" toggle is shown. */
	toggle: boolean;
}

export interface TeamWeek {
	weekEnd: string;
	total: number;
	/** The total minus the week before's; `null` for the first week. */
	gain: number | null;
}

export interface TeamTotals {
	/** The picked kind summed over the listed riders. */
	total: number;
	/** `total` minus the week before's team total; 0 with one week. */
	thisWeek: number;
	weeks: TeamWeek[];
	/** The largest gain, the earliest on ties; none without a gain. */
	bestWeek: { weekEnd: string; gain: number } | null;
}

/** Rows shown either side of the viewer's own (FR-013). */
const AROUND = 3;
/** Up to this many rows, every row is shown and there is no toggle. */
const SHORT_LIST = AROUND * 2 + 1;

/**
 * The listed riders as rows ordered by `kind`, then the other kind, then
 * athlete ID, and the viewer's place; no `Viewer` when the viewer isn't
 * listed.
 */
export function leaderboardRows(
	riders: readonly LeaderboardRider[],
	viewerId: number,
	kind: RynkeKind,
): { rows: LeaderboardRow[]; viewer: Viewer | null } {
	const otherKind: RynkeKind = kind === "training" ? "team" : "training";
	const totals = riders.map((rider) => ({
		id: rider.athleteId,
		training: rider.balance?.trainingRynke ?? 0,
		team: rider.balance?.teamRynke ?? 0,
		weeks: rider.weeks.map((week) => week[kind]),
	}));
	totals.sort(
		(a, b) => b[kind] - a[kind] || b[otherKind] - a[otherKind] || a.id - b.id,
	);
	const rows = totals.map((rider) => ({
		you: rider.id === viewerId,
		// Sorted, so the first row with this total holds its place.
		place: 1 + totals.findIndex((o) => o[kind] === rider[kind]),
		joint: totals.some((o) => o !== rider && o[kind] === rider[kind]),
		total: rider[kind],
		other: rider[otherKind],
		weeks: rider.weeks,
	}));
	const own = rows.find((row) => row.you);
	if (!own) return { rows, viewer: null };
	const above = rows.filter((row) => row.total > own.total);
	const next = above.at(-1);
	return {
		rows,
		viewer: {
			place: own.place,
			joint: own.joint,
			count: rows.length,
			toNext: next ? next.total - own.total + 1 : null,
			lead: own.place === 1,
		},
	};
}

/**
 * The viewer's row and three either side, cut at the ends; every row for
 * `all`, a short list, or a viewer who isn't listed (research R6).
 */
export function neighbourhood(
	rows: readonly LeaderboardRow[],
	all: boolean,
): Neighbourhood {
	const own = rows.findIndex((row) => row.you);
	const toggle = own >= 0 && rows.length > SHORT_LIST;
	if (all || !toggle) {
		return { rows: [...rows], hiddenAhead: 0, hiddenBehind: 0, toggle };
	}
	const first = Math.max(0, own - AROUND);
	const end = Math.min(rows.length, own + AROUND + 1);
	return {
		rows: rows.slice(first, end),
		hiddenAhead: first,
		hiddenBehind: rows.length - end,
		toggle,
	};
}

/**
 * The team total of `kind` at each week end; every rider's points share the
 * same week ends (`riderWeeks`).
 */
export function teamTotals(
	riderWeeks: readonly (readonly WeekPoint[])[],
	kind: RynkeKind,
): TeamTotals {
	const weeks: TeamWeek[] = (riderWeeks[0] ?? []).map((point, i) => ({
		weekEnd: point.weekEnd,
		total: riderWeeks.reduce((sum, rider) => sum + (rider[i]?.[kind] ?? 0), 0),
		gain: null,
	}));
	let bestWeek: TeamTotals["bestWeek"] = null;
	for (let i = 1; i < weeks.length; i++) {
		const week = weeks[i] as TeamWeek;
		const gain = week.total - (weeks[i - 1] as TeamWeek).total;
		week.gain = gain;
		if (gain > (bestWeek?.gain ?? 0))
			bestWeek = { weekEnd: week.weekEnd, gain };
	}
	const last = weeks.at(-1);
	return {
		total: last?.total ?? 0,
		thisWeek: last?.gain ?? 0,
		weeks,
		bestWeek,
	};
}
