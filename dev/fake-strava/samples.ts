import { easterSunday } from "../../src/badges/easter";
import type { EventKind } from "../../src/rynke/team-events";
import type { FakeActivity } from "./store";

// What the sample riders of fake mode are made of, one per state of the rider
// page (specs/006-local-frontend-dev data-model.md, research R6); each team's
// riders are in `samples.<team id>.ts` (feature 026 FR-050). Everything is
// invented (constitution Principle I): athlete IDs from 990001, names that name
// the state, rides without GPS, heart rate or power. A recipe only picks
// figures that fall clearly on one side of a rule; whether a ride counts is
// always decided by the app.

/** How the fake treats the rider's API calls (contracts/fake-strava.md). */
export type Behaviour = "normal" | "import-stuck" | "refused";

export interface RideRecipe {
	/** Days before the seeding day; before the season start moves to it. */
	daysAgo: number;
	/**
	 * `MM-DD` in the season instead of `daysAgo`: the months from the season
	 * start's month on fall in its year, the others in the year after. For the
	 * winter badges (feature 013 part C), which need a calendar month.
	 */
	onDate?: string;
	/**
	 * Days after the season's Easter Sunday (0 Easter Sunday, 1 Easter
	 * Monday) instead of `daysAgo`; for the Osterhase badge (013 part F).
	 */
	onEaster?: number;
	/** Local wall-clock time `HH:MM`, Europe/Berlin. */
	startTime: string;
	sportType: string;
	distanceKm: number;
	elevationM: number;
	movingMin: number;
	/** Left out: Strava sent no elapsed time ("unknown"). */
	elapsedMin?: number;
	manual?: boolean;
	trainer?: boolean;
	flagged?: boolean;
	private?: boolean;
}

/** A team event the rider attended, entered through the app on seeding. */
export interface EventRecipe {
	/** Days before the seeding day; `null` is the day before the season start. */
	daysAgo: number | null;
	/** `MM-DD` in the season instead of `daysAgo`, as for rides. */
	onDate?: string;
	kind: EventKind;
	name: string | null;
}

export interface SampleRider {
	athleteId: number;
	firstName: string;
	/** The state the rider shows, for the `/_dev/` list. */
	state: string;
	/** The scopes it connects with when seeded, comma-separated. */
	scopes: string;
	clubMember: boolean;
	behaviour: Behaviour;
	rides: readonly RideRecipe[];
	events?: readonly EventRecipe[];
	/** Set as the maintainer would, after connecting (feature 004 research R10). */
	organiser?: true;
	/** The same for the administrator flag (feature 025 research R12). */
	administrator?: true;
	/** Held back on this consent version, as a rider not asked yet (feature 029). */
	consentVersion?: number;
}

/** `count` rides from `recipe(i)`, i = 0 … count − 1. */
export function rides(
	count: number,
	recipe: (i: number) => RideRecipe,
): RideRecipe[] {
	return Array.from({ length: count }, (_, i) => recipe(i));
}

/** A ride at `kmh`, with a 15-minute stop. */
export function ride(
	daysAgo: number,
	startTime: string,
	distanceKm: number,
	elevationM: number,
	kmh: number,
	extra: Partial<RideRecipe> = {},
): RideRecipe {
	const movingMin = Math.round((distanceKm / kmh) * 60);
	return {
		daysAgo,
		startTime,
		sportType: "Ride",
		distanceKm,
		elevationM,
		movingMin,
		elapsedMin: movingMin + 15,
		...extra,
	};
}

/** One ride a day from yesterday back, mornings and evenings in turn. */
export function slot(i: number): [daysAgo: number, startTime: string] {
	return [1 + i, i % 2 === 0 ? "07:00" : "17:00"];
}

export const ALL_SCOPES = "read,activity:read,activity:read_all";

/** How many short trips an ordinary rider has (feature 032). */
function shortTrips(collector: boolean, n: number): number {
	if (collector) return 30;
	return n % 4 === 1 ? 3 : 0;
}

/**
 * About 25 riders with ordinary seasons, so crowded graphs and long lists can be
 * judged locally (feature 029 research R11): their rhythm, virtual share and
 * climbing differ, some start late or have stopped, every fifth is held back on
 * consent version 2. Nothing random, so the fingerprint stays the same.
 */
export function ordinaryRiders(
	names: readonly string[],
	firstId: number,
	collector: string,
): SampleRider[] {
	return names.map((firstName, n) => {
		const gap = 2 + (n % 6);
		const stoppedDaysAgo = n % 7 === 3 ? 40 : 1;
		const virtualEvery = 2 + (n % 5);
		const held = n % 5 === 2;
		return {
			athleteId: firstId + n,
			firstName,
			state: held
				? "Ordinary season, hasn't agreed to daily figures yet"
				: "Ordinary season",
			scopes: ALL_SCOPES,
			clubMember: true,
			behaviour: "normal",
			...(held ? { consentVersion: 2 } : {}),
			rides: [
				...rides(24 + (n % 12), (i) => {
					const km = 18 + ((n * 7 + i * 13) % 60);
					const daysAgo = stoppedDaysAgo + i * gap;
					const virtual = i % virtualEvery === 1;
					return ride(
						daysAgo,
						i % 2 === 0 ? "07:30" : "17:45",
						km,
						Math.round(km * (4 + (n % 9)) * (virtual ? 0.5 : 1)),
						24 + (n % 5),
						virtual ? { sportType: "VirtualRide", trainer: true } : {},
					);
				}),
				// Short trips of 5 to 8 km at midday, so the typical ride shows a
				// difference (feature 032 research R9): a few for every fourth
				// rider, and many for the `collector`.
				...rides(shortTrips(firstName === collector, n), (i) =>
					ride(stoppedDaysAgo + i * 3, "12:15", 5 + ((n + i) % 4), 20, 18),
				),
			],
		};
	});
}

/** A team event several sample riders attended, entered by an organiser. */
export interface TeamEventRecipe extends EventRecipe {
	attendees: readonly number[];
	/**
	 * Riders who reported the event themselves (feature 019): "Bin dabei" for
	 * one still to come (a negative `daysAgo`), "Ich war dabei" for a past one.
	 */
	reports?: readonly number[];
}

/** One team's sample riders and team events. */
export interface SampleSet {
	riders: readonly SampleRider[];
	teamEvents: readonly TeamEventRecipe[];
	/** A club member of `riders` who records the team events. */
	organiser: number;
}

const TIME_ZONE = "Europe/Berlin";
const DAY_MS = 24 * 3600 * 1000;

/** `YYYY-MM-DD` `days` before `day`. */
export function dayBefore(day: string, days: number): string {
	return new Date(Date.parse(`${day}T00:00:00Z`) - days * DAY_MS)
		.toISOString()
		.slice(0, 10);
}

/**
 * The date of `recipe` on a seeding day `seedDay`; unlike a ride, never moved
 * to the season start.
 */
export function eventDay(
	recipe: EventRecipe,
	seedDay: string,
	seasonStart: string,
): string {
	if (recipe.onDate !== undefined) return seasonDay(recipe.onDate, seasonStart);
	return recipe.daysAgo === null
		? dayBefore(seasonStart, 1)
		: dayBefore(seedDay, recipe.daysAgo);
}

/** The `YYYY-MM-DD` of `monthDay` (`MM-DD`) in the season from `seasonStart`. */
export function seasonDay(monthDay: string, seasonStart: string): string {
	const startYear = Number(seasonStart.slice(0, 4));
	const year = monthDay >= seasonStart.slice(5, 10) ? startYear : startYear + 1;
	return `${year}-${monthDay}`;
}

/** The first Easter Sunday on or after the season start. */
export function seasonEaster(seasonStart: string): string {
	const year = Number(seasonStart.slice(0, 4));
	const easter = easterSunday(year);
	return easter >= seasonStart ? easter : easterSunday(year + 1);
}

/** Europe/Berlin's offset from UTC at `epochMs`, in milliseconds. */
function berlinOffsetMs(epochMs: number): number {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: TIME_ZONE,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(new Date(epochMs));
	const get = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	const wallClockAsUtc = Date.UTC(
		get("year"),
		get("month") - 1,
		get("day"),
		get("hour"),
		get("minute"),
		get("second"),
	);
	return wallClockAsUtc - epochMs;
}

/** The UTC instant of a Berlin wall-clock time, in milliseconds. */
function berlinToUtcMs(day: string, time: string): number {
	const wall = Date.parse(`${day}T${time}:00Z`);
	// Twice, so a time just after a DST switch gets the offset in force then.
	const guess = wall - berlinOffsetMs(wall);
	return wall - berlinOffsetMs(guess);
}

function iso(epochMs: number): string {
	return new Date(epochMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/**
 * The activity Strava would send for `recipe` on a seeding day `seedDay`
 * (`YYYY-MM-DD`, Europe/Berlin), never before `seasonStart` (`YYYY-MM-DD`).
 */
export function recipeToActivity(
	recipe: RideRecipe,
	seedDay: string,
	seasonStart: string,
	id: number,
): FakeActivity {
	const wanted =
		recipe.onEaster !== undefined
			? dayBefore(seasonEaster(seasonStart), -recipe.onEaster)
			: recipe.onDate
				? seasonDay(recipe.onDate, seasonStart)
				: dayBefore(seedDay, recipe.daysAgo);
	const day = wanted < seasonStart ? seasonStart : wanted;
	const startUtc = berlinToUtcMs(day, recipe.startTime);
	return {
		id,
		name: `${recipe.sportType} on ${day} at ${recipe.startTime}`,
		sport_type: recipe.sportType,
		// Strava writes the local wall-clock time with a `Z`.
		start_date: iso(startUtc),
		start_date_local: `${day}T${recipe.startTime}:00Z`,
		timezone: "(GMT+01:00) Europe/Berlin",
		distance: Math.round(recipe.distanceKm * 1000),
		moving_time: recipe.movingMin * 60,
		// The app's parser keeps a missing elapsed time as unknown.
		...(recipe.elapsedMin === undefined
			? {}
			: { elapsed_time: recipe.elapsedMin * 60 }),
		total_elevation_gain: recipe.elevationM,
		manual: recipe.manual ?? false,
		trainer: recipe.trainer ?? false,
		flagged: recipe.flagged ?? false,
		private: recipe.private ?? false,
	};
}
