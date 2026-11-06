// The ride figures of the Team page and the organiser area (feature 032
// research R3, data-model.md): sessions, kilometres, elevation and the typical
// ride per period, places on the shown value, and the team's figures. Pure, like
// `leaderboard.ts`. Riders come in with their athlete IDs, which only order them
// and find the viewer; rows leave with nothing that names anyone (FR-019).

import type { TeamTotals, TeamWeek } from "./leaderboard";
import type { CountingWindow } from "./rules";
import type { RideEntry } from "./summary";
import { weekEndOf } from "./weeks";

export type RideFigure = "sessions" | "km" | "elevation";
export type RankBy = "rynke" | RideFigure;
export type Period = "season" | "month" | "week";

export const RIDE_FIGURES: readonly RideFigure[] = [
	"sessions",
	"km",
	"elevation",
];
export const PERIODS: readonly Period[] = ["season", "month", "week"];

/** `YYYY-MM-DD` to `YYYY-MM-DD`, both included, cut to the counting window. */
export interface DateRange {
	from: string;
	to: string;
}

export interface Figures {
	sessions: number;
	distanceM: number;
	elevationDm: number;
	/** The median ride length; null without a ride (FR-009). */
	typicalM: number | null;
}

export interface RideRider {
	athleteId: number;
	rides: readonly RideEntry[];
}

export interface RideRow {
	you: boolean;
	/** Standard competition ranking on the shown value: 1, 2, 2, 4. */
	place: number;
	joint: boolean;
	sessions: number;
	/** Shown: one decimal. */
	km: number;
	/** Shown: whole metres. */
	elevationM: number;
}

export interface RideViewer {
	place: number;
	joint: boolean;
	/** The number of ranked riders. */
	count: number;
	/** The picked figure to pass the next place, in shown units; null in 1st. */
	toNext: number | null;
	lead: boolean;
	figures: Figures;
}

/** The shown values, in the units places compare (FR-005). */
export function shownKm(distanceM: number): number {
	return Math.round(distanceM / 100) / 10;
}

export function shownElevationM(elevationDm: number): number {
	return Math.round(elevationDm / 10);
}

function utcDate(date: string): Date {
	return new Date(`${date}T00:00:00Z`);
}

function isoDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
	const d = utcDate(date);
	d.setUTCDate(d.getUTCDate() + days);
	return isoDate(d);
}

const later = (a: string, b: string) => (a > b ? a : b);
const earlier = (a: string, b: string) => (a < b ? a : b);

/**
 * The season, the calendar month or the Monday-to-Sunday week holding
 * `today`, cut to the counting window. Outside the window `from` may come
 * after `to`, and nothing falls in it.
 */
export function periodOf(
	period: Period,
	today: string,
	window: Pick<CountingWindow, "seasonStart" | "deadline">,
): DateRange {
	let range: DateRange;
	if (period === "season") {
		range = { from: window.seasonStart, to: window.deadline };
	} else if (period === "month") {
		const first = `${today.slice(0, 7)}-01`;
		const next = utcDate(first);
		next.setUTCMonth(next.getUTCMonth() + 1);
		range = { from: first, to: addDays(isoDate(next), -1) };
	} else {
		const sunday = weekEndOf(today);
		range = { from: addDays(sunday, -6), to: sunday };
	}
	return {
		from: later(range.from, window.seasonStart),
		to: earlier(range.to, window.deadline),
	};
}

const inRange = (date: string, range: DateRange) =>
	date >= range.from && date <= range.to;

/** The median: the middle length, the mean of the middle two, or null. */
export function typicalRide(lengths: readonly number[]): number | null {
	if (lengths.length === 0) return null;
	const sorted = [...lengths].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[middle] as number;
	return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

/** The rides in `range`, added up. */
export function figuresOf(
	rides: readonly RideEntry[],
	range: DateRange,
): Figures {
	const lengths: number[] = [];
	let elevationDm = 0;
	for (const [date, distanceM, elevation] of rides) {
		if (!inRange(date, range)) continue;
		lengths.push(distanceM);
		elevationDm += elevation;
	}
	return {
		sessions: lengths.length,
		distanceM: lengths.reduce((sum, m) => sum + m, 0),
		elevationDm,
		typicalM: typicalRide(lengths),
	};
}

/** A figure in whole shown units: sessions, tenths of a km, metres. */
function units(
	figure: RideFigure,
	row: { sessions: number; kmTenths: number; elevationM: number },
): number {
	if (figure === "sessions") return row.sessions;
	if (figure === "km") return row.kmTenths;
	return row.elevationM;
}

/**
 * The riders as rows ordered by `by`, then sessions, km and elevation, then
 * athlete ID, with places on the shown value; no viewer when the viewer isn't
 * ranked. Riders without a ride in `range` are ranked on zero.
 */
export function rideRows(
	riders: readonly RideRider[],
	viewerId: number,
	by: RideFigure,
	range: DateRange,
): { rows: RideRow[]; viewer: RideViewer | null } {
	const ranked = riders.map((rider) => {
		const figures = figuresOf(rider.rides, range);
		return {
			id: rider.athleteId,
			figures,
			sessions: figures.sessions,
			kmTenths: Math.round(figures.distanceM / 100),
			elevationM: shownElevationM(figures.elevationDm),
		};
	});
	ranked.sort(
		(a, b) =>
			units(by, b) - units(by, a) ||
			b.sessions - a.sessions ||
			b.kmTenths - a.kmTenths ||
			b.elevationM - a.elevationM ||
			a.id - b.id,
	);
	const rows = ranked.map(
		(rider): RideRow => ({
			you: rider.id === viewerId,
			// Sorted, so the first rider with this value holds its place.
			place: 1 + ranked.findIndex((o) => units(by, o) === units(by, rider)),
			joint: ranked.some(
				(o) => o !== rider && units(by, o) === units(by, rider),
			),
			sessions: rider.sessions,
			km: rider.kmTenths / 10,
			elevationM: rider.elevationM,
		}),
	);
	const index = ranked.findIndex((rider) => rider.id === viewerId);
	const own = ranked[index];
	const ownRow = rows[index];
	if (!own || !ownRow) return { rows, viewer: null };
	const next = ranked.filter((o) => units(by, o) > units(by, own)).at(-1);
	const gap = next ? units(by, next) - units(by, own) + 1 : null;
	return {
		rows,
		viewer: {
			place: ownRow.place,
			joint: ownRow.joint,
			count: rows.length,
			toNext: gap === null ? null : by === "km" ? gap / 10 : gap,
			lead: ownRow.place === 1,
			figures: own.figures,
		},
	};
}

/** The team's figures: every rider's rides, the median over all of them. */
export function teamRideTotals(
	riders: readonly RideRider[],
	range: DateRange,
): Figures {
	return figuresOf(
		riders.flatMap((rider) => rider.rides),
		range,
	);
}

/**
 * The team's kilometres up to each of `ends` (Sundays, ascending), shaped like
 * the Rynke `TeamTotals` so the team chart can draw them.
 */
export function teamWeeksKm(
	riders: readonly RideRider[],
	ends: readonly string[],
): TeamTotals {
	const rides = riders
		.flatMap((rider) => rider.rides)
		.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
	const weeks: TeamWeek[] = [];
	let metres = 0;
	let next = 0;
	for (const weekEnd of ends) {
		while (next < rides.length && (rides[next] as RideEntry)[0] <= weekEnd) {
			metres += (rides[next] as RideEntry)[1];
			next++;
		}
		const total = shownKm(metres);
		const before = weeks.at(-1);
		weeks.push({
			weekEnd,
			total,
			gain: before ? Math.round((total - before.total) * 10) / 10 : null,
		});
	}
	let bestWeek: TeamTotals["bestWeek"] = null;
	for (const week of weeks) {
		if (week.gain !== null && week.gain > (bestWeek?.gain ?? 0)) {
			bestWeek = { weekEnd: week.weekEnd, gain: week.gain };
		}
	}
	const last = weeks.at(-1);
	return {
		total: last?.total ?? 0,
		thisWeek: last?.gain ?? 0,
		weeks,
		bestWeek,
	};
}
