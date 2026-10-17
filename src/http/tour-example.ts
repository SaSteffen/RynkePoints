import type { AttendedEvent, RideRow, RiderViewRead } from "../db/rider-view";
import { evaluateRides, type Ride } from "../rynke/rides";
import {
	type CountingWindow,
	CURRENT_RULES,
	type RynkeRules,
} from "../rynke/rules";
import { extrasFromAttendance, tally } from "../rynke/tally";
import { evaluateAttendance, type TeamEventKind } from "../rynke/team-events";
import type { CyclingSportType } from "../strava/activity";

// The example rider of the tour's Du and Fahrten steps (feature 020 FR-005 –
// FR-007, research R3): what those pages read for a rider, built from a few
// synthetic rides and team events instead of D1. Worked out by the same rules
// functions as real Rynke, with the rules in effect, so the gauges, the
// breakdown and the ride cards show what the hints explain. Never stored,
// never linked to Strava. It lives here, not in `dev/`, which `src/` must not
// import (feature 006 FR-009).

interface ExampleRide {
	id: number;
	/** Days before the anchor day (research R4). */
	daysAgo: number;
	/** Start hour; the rides never overlap even on one day. */
	hour: number;
	sportType: CyclingSportType;
	distanceM: number;
	elevationM: number;
	movingMin: number;
	elapsedMin: number;
}

/** The ride under one distance step: it counts, but earns no distance Rynke. */
export const EXAMPLE_SHORT_RIDE_ID = 2;

const RIDES: readonly ExampleRide[] = [
	{
		id: 1,
		daysAgo: 1,
		hour: 18,
		sportType: "Ride",
		distanceM: 85_000,
		elevationM: 900,
		movingMin: 180,
		elapsedMin: 195,
	},
	{
		id: EXAMPLE_SHORT_RIDE_ID,
		daysAgo: 3,
		hour: 9,
		sportType: "Ride",
		distanceM: 7_400,
		elevationM: 40,
		movingMin: 22,
		elapsedMin: 25,
	},
	{
		id: 3,
		daysAgo: 6,
		hour: 10,
		sportType: "VirtualRide",
		distanceM: 35_000,
		elevationM: 300,
		movingMin: 70,
		elapsedMin: 70,
	},
	{
		id: 4,
		daysAgo: 9,
		hour: 12,
		sportType: "GravelRide",
		distanceM: 48_000,
		elevationM: 420,
		movingMin: 120,
		elapsedMin: 135,
	},
	{
		id: 5,
		daysAgo: 13,
		hour: 15,
		sportType: "MountainBikeRide",
		distanceM: 28_000,
		elevationM: 650,
		movingMin: 110,
		elapsedMin: 130,
	},
	{
		id: 6,
		daysAgo: 17,
		hour: 6,
		sportType: "Ride",
		distanceM: 62_000,
		elevationM: 610,
		movingMin: 135,
		elapsedMin: 150,
	},
];

const EVENTS: readonly { id: number; kind: TeamEventKind; daysAgo: number }[] =
	[
		{ id: 1, kind: "team_training", daysAgo: 4 },
		{ id: 2, kind: "technique_training", daysAgo: 11 },
	];

const DAY_MS = 86_400_000;

/** `date` moved back by `days`, both `YYYY-MM-DD`. */
function daysBefore(date: string, days: number): string {
	return new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS)
		.toISOString()
		.slice(0, 10);
}

/**
 * The example's dates: counted back from today, held inside the counting
 * window, so every example counts by the window rule (research R4).
 */
function dateFor(daysAgo: number, today: string, window: CountingWindow) {
	const anchor =
		today < window.seasonStart
			? window.seasonStart
			: today > window.deadline
				? window.deadline
				: today;
	const date = daysBefore(anchor, daysAgo);
	return date < window.seasonStart ? window.seasonStart : date;
}

/** The example as the pages read a rider, with `rules` (the rules in effect). */
export function exampleRiderView(
	window: CountingWindow,
	today: string,
	rules: RynkeRules = CURRENT_RULES,
): RiderViewRead {
	const rides = RIDES.map((ride) => {
		const at = `${dateFor(ride.daysAgo, today, window)}T${String(ride.hour).padStart(2, "0")}:00:00Z`;
		return { ride, at };
	});
	const inputs: Ride[] = rides.map(({ ride, at }) => ({
		activityId: ride.id,
		sportType: ride.sportType,
		startUtc: at,
		startLocal: at,
		distanceM: ride.distanceM,
		movingS: ride.movingMin * 60,
		elapsedS: ride.elapsedMin * 60,
		elevationM: ride.elevationM,
		manual: false,
		trainer: false,
		flagged: false,
		refreshedAt: 0,
	}));
	const evaluation = evaluateRides(inputs, rules, window);
	const attendance: AttendedEvent[] = EVENTS.map(({ id, kind, daysAgo }) => ({
		eventId: id,
		kind,
		date: dateFor(daysAgo, today, window),
		name: null,
	}));
	const extras = extrasFromAttendance(
		evaluateAttendance(attendance, rules, window),
	);
	const rows: RideRow[] = rides.map(({ ride, at }) => {
		const result = evaluation.results.find((r) => r.activityId === ride.id);
		return {
			activityId: ride.id,
			sportType: ride.sportType,
			startDate: at,
			startDateLocal: at,
			distanceM: ride.distanceM,
			movingS: ride.movingMin * 60,
			elapsedS: ride.elapsedMin * 60,
			elevationGainM: ride.elevationM,
			name: null,
			result: result ? { ...result, rulesVersion: rules.version } : null,
			countedInstead: null,
		};
	});
	// Newest first, as the list's order (feature 018 R1).
	rows.sort(
		(a, b) =>
			b.startDate.localeCompare(a.startDate) || b.activityId - a.activityId,
	);
	return {
		balance: {
			...tally(evaluation.riding, extras, rules),
			computedAt: 0,
		},
		rideCount: rows.length,
		virtualCount: evaluation.results.filter((r) => r.isVirtual).length,
		page: 1,
		rides: rows,
		attendance: [...attendance].sort((a, b) => b.date.localeCompare(a.date)),
	};
}
