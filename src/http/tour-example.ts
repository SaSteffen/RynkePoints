import type { ListedRiderRow } from "../db/organiser";
import type { OpenRequestRow } from "../db/participation";
import type { AttendedEvent, RideRow, RiderViewRead } from "../db/rider-view";
import type { TeamRider } from "../db/team";
import type { TeamEventListRow } from "../db/team-events";
import { evenPace } from "../rynke/pace";
import { evaluateRides, type Ride } from "../rynke/rides";
import {
	type CountingWindow,
	CURRENT_RULES,
	type RynkeRules,
} from "../rynke/rules";
import { type Extras, extrasFromAttendance, tally } from "../rynke/tally";
import {
	evaluateAttendance,
	TEAM_EVENT_KINDS,
	type TeamEventKind,
} from "../rynke/team-events";
import type { CurveRideSum } from "../rynke/weeks";
import type { CyclingSportType } from "../strava/activity";

// The example rider of the tour's Du and Fahrten steps (feature 020 FR-005 –
// FR-007, research R3): what those pages read for a rider, built from a few
// synthetic rides and team events instead of D1. Below it, the example team of
// the organiser tour's Orga steps (FR-013 – FR-015, research R8). Worked out by the same rules
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

/** The ride that doesn't count: a café stop longer than the riding. */
export const EXAMPLE_REJECTED_RIDE_ID = 7;

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
		id: EXAMPLE_REJECTED_RIDE_ID,
		daysAgo: 5,
		hour: 10,
		sportType: "Ride",
		distanceM: 42_000,
		elevationM: 180,
		movingMin: 100,
		elapsedMin: 230,
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
	// biome-ignore lint/complexity/useMathMinMax: ISO date strings, not numbers
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
	// The progress curve's input, summed per day and kind as the Overview's
	// read does (feature 009 FR-043).
	const daily = new Map<string, CurveRideSum>();
	for (const { ride, at } of rides) {
		const result = evaluation.results.find((r) => r.activityId === ride.id);
		if (!result?.counts) continue;
		const date = at.slice(0, 10);
		const key = `${date} ${result.isVirtual}`;
		const sum = daily.get(key) ?? {
			date,
			virtual: result.isVirtual,
			distanceRynke: 0,
			elevationDm: 0,
		};
		sum.distanceRynke += result.distanceRynke;
		sum.elevationDm += result.elevationDm;
		daily.set(key, sum);
	}
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
		progress: {
			rides: [...daily.values()].sort(
				(a, b) =>
					a.date.localeCompare(b.date) || Number(a.virtual) - Number(b.virtual),
			),
			attendance: attendance.map(({ eventId, kind, date }) => ({
				eventId,
				kind,
				date,
			})),
			corrections: [],
		},
	};
}

/**
 * A rider of the example team: Training and Team Rynke as shares of today's
 * even pace (so the groups hold at any day of the season, research R8), or
 * qualified.
 */
interface ExampleTeamRider {
	id: number;
	firstName: string;
	/** Training Rynke as a share of today's even pace, in percent. */
	trainingPace: number;
	/** Team Rynke as a share of today's even pace, in percent. */
	teamPace: number;
	/** Training Rynke from virtual rides, in percent. */
	virtualShare: number;
	qualified?: true;
}

const TEAM: readonly ExampleTeamRider[] = [
	{ id: 1, firstName: "Anna", trainingPace: 55, teamPace: 0, virtualShare: 0 },
	{
		id: 2,
		firstName: "Ben",
		trainingPace: 130,
		teamPace: 120,
		virtualShare: 10,
	},
	{
		id: 3,
		firstName: "Clara",
		trainingPace: 0,
		teamPace: 0,
		virtualShare: 5,
		qualified: true,
	},
	{
		id: 4,
		firstName: "Deniz",
		trainingPace: 110,
		teamPace: 40,
		virtualShare: 0,
	},
	{
		id: 5,
		firstName: "Emma",
		trainingPace: 160,
		teamPace: 150,
		virtualShare: 25,
	},
	{ id: 6, firstName: "Finn", trainingPace: 20, teamPace: 0, virtualShare: 60 },
];

/** The example team's events; `you`: the organiser was there. */
const TEAM_EVENTS: readonly {
	id: number;
	kind: TeamEventKind;
	/** Days from today; negative ones have taken place. */
	days: number;
	name: string | null;
	attendees: number;
	intents: number;
	you: boolean;
}[] = [
	{
		id: 1,
		kind: "team_training",
		days: 5,
		name: "Feierabendrunde",
		attendees: 0,
		intents: 4,
		you: false,
	},
	{
		id: 2,
		kind: "team_training",
		days: -3,
		name: null,
		attendees: 3,
		intents: 0,
		you: false,
	},
	{
		id: 3,
		kind: "technique_training",
		days: -10,
		name: "Kurventechnik",
		attendees: 5,
		intents: 0,
		you: true,
	},
];

/** The upcoming event and the past one the organiser tour points at. */
export const EXAMPLE_UPCOMING_EVENT_ID = 1;
export const EXAMPLE_PAST_EVENT_ID = 2;

/** Who reported the past event without being ticked yet (019 FR-031). */
const REQUESTS: readonly { riderId: number; eventId: number }[] = [
	{ riderId: 1, eventId: EXAMPLE_PAST_EVENT_ID },
	{ riderId: 4, eventId: EXAMPLE_PAST_EVENT_ID },
];

/** What the Orga pages read for the organiser tour (FR-013). */
export interface ExampleTeam {
	riders: TeamRider[];
	listed: ListedRiderRow[];
	requests: OpenRequestRow[];
	events: TeamEventListRow[];
	/** Riders who said they come, per upcoming event. */
	intents: ReadonlyMap<number, number>;
	/** The events the organiser attended. */
	attended: ReadonlySet<number>;
}

/**
 * Team Rynke as team trainings and training-weekend days, with the Training
 * Rynke they bring, as the balance's breakdown stores them.
 */
function teamExtras(team: number, rules: RynkeRules): Extras {
	const day = rules.teamEvents.training_weekend_day;
	const training = rules.teamEvents.team_training;
	const days = Math.floor(team / day.team);
	const trainings = Math.ceil((team - days * day.team) / training.team);
	const teamEvents = TEAM_EVENT_KINDS.map((kind) => {
		const count =
			kind === "training_weekend_day"
				? days
				: kind === "team_training"
					? trainings
					: 0;
		return {
			kind,
			attended: count,
			team: count * rules.teamEvents[kind].team,
			training: count * rules.teamEvents[kind].training,
		};
	});
	return {
		training: teamEvents.reduce((sum, e) => sum + e.training, 0),
		team: teamEvents.reduce((sum, e) => sum + e.team, 0),
		teamEvents,
	};
}

/** The example team on `today`, with `rules` (the rules in effect). */
export function exampleTeam(
	window: CountingWindow,
	today: string,
	rules: RynkeRules = CURRENT_RULES,
): ExampleTeam {
	const pace = (amount: number) =>
		evenPace(amount, window.seasonStart, window.deadline, today);
	const riders = TEAM.map((rider): TeamRider => {
		const target = rider.qualified
			? { training: rules.trainingThreshold + 12, team: rules.teamThreshold }
			: {
					training: Math.min(
						rules.trainingThreshold - 1,
						Math.floor(
							(pace(rules.trainingThreshold) * rider.trainingPace) / 100,
						),
					),
					team: Math.min(
						rules.teamThreshold - 1,
						Math.floor((pace(rules.teamThreshold) * rider.teamPace) / 100),
					),
				};
		const extras = teamExtras(target.team, rules);
		// The rest from riding: a fifth of it from climbing, in whole steps.
		const riding = Math.max(0, target.training - extras.training);
		const steps = Math.floor(riding / 5 / rules.elevationStepRynke);
		const elevationRynke = steps * rules.elevationStepRynke;
		const elevationDm = (steps * rules.elevationStepM + 420) * 10;
		const distanceRynke = riding - elevationRynke;
		const virtual = Math.floor((distanceRynke * rider.virtualShare) / 100);
		const balance = tally(
			{
				distanceRynke,
				elevationDm,
				elevationRynke,
				withoutVirtual: {
					distanceRynke: distanceRynke - virtual,
					elevationDm,
					elevationRynke,
				},
			},
			extras,
			rules,
		);
		return {
			athleteId: rider.id,
			firstName: rider.firstName,
			balance: { ...balance, computedAt: 0 },
			rides: [],
			attendance: [],
			corrections: [],
		};
	});
	const events = TEAM_EVENTS.map(
		(event): TeamEventListRow => ({
			event_id: event.id,
			kind: event.kind,
			event_date: daysBefore(today, -event.days),
			name: event.name,
			attendees: event.attendees,
			changed_at: null,
			changed_by_name: null,
		}),
	).sort((a, b) => b.event_date.localeCompare(a.event_date));
	const requests = REQUESTS.map(({ riderId, eventId }): OpenRequestRow => {
		const event = events.find(
			(e) => e.event_id === eventId,
		) as TeamEventListRow;
		const rider = TEAM.find((r) => r.id === riderId) as ExampleTeamRider;
		return {
			event_id: event.event_id,
			kind: event.kind,
			event_date: event.event_date,
			name: event.name,
			athlete_id: rider.id,
			first_name: rider.firstName,
			reported_at: 0,
		};
	});
	return {
		riders,
		listed: TEAM.map((r) => ({ athlete_id: r.id, first_name: r.firstName })),
		requests,
		events,
		intents: new Map(TEAM_EVENTS.map((e) => [e.id, e.intents])),
		attended: new Set(TEAM_EVENTS.filter((e) => e.you).map((e) => e.id)),
	};
}
