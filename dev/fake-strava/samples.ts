import { easterSunday } from "../../src/badges/easter";
import type { EventKind } from "../../src/rynke/team-events";
import type { FakeActivity } from "./store";

// The sample riders of fake mode, one per state of the rider page
// (specs/006-local-frontend-dev data-model.md, research R6). Everything here is
// invented (constitution Principle I): athlete IDs 990001–990099, names that
// name the state, rides without GPS, heart rate or power. A recipe only picks
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
}

/** `count` rides from `recipe(i)`, i = 0 … count − 1. */
function rides(count: number, recipe: (i: number) => RideRecipe): RideRecipe[] {
	return Array.from({ length: count }, (_, i) => recipe(i));
}

/** A ride at `kmh`, with a 15-minute stop. */
function ride(
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
function slot(i: number): [daysAgo: number, startTime: string] {
	return [1 + i, i % 2 === 0 ? "07:00" : "17:00"];
}

const ALL_SCOPES = "read,activity:read,activity:read_all";

export const SAMPLE_RIDERS: readonly SampleRider[] = [
	{
		athleteId: 990001,
		firstName: "Ida Importing",
		state: "Import still running: the fake answers her activity list with 429",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "import-stuck",
		rides: rides(3, (i) => ride(...slot(i), 50, 300, 25)),
	},
	{
		athleteId: 990002,
		firstName: "Nora NoRides",
		state: "No rides, so no badges yet",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [],
	},
	{
		athleteId: 990003,
		firstName: "Fiona FarAway",
		state: "Far from both targets",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: rides(3, (i) => ride(...slot(i), 25 + 5 * i, 150, 22)),
	},
	{
		athleteId: 990004,
		firstName: "Tina TrainingDone",
		state:
			"Training target reached without virtual rides; Team Rynke missing; organiser",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		organiser: true,
		// 24 rides of 100–110 km: 240 distance Rynke plus about 90 for climbing.
		rides: rides(24, (i) =>
			ride(...slot(i), 100 + (i % 11), 600 + ((i * 37) % 300), 25 + (i % 6)),
		),
	},
	{
		athleteId: 990005,
		firstName: "Vera Virtual",
		state: "Training target reached only thanks to virtual rides",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Outdoors: 140 distance Rynke and 1,400 m (5 Rynke), under 167. With
		// the virtual rides: over 250.
		rides: rides(27, (i) =>
			i < 14
				? ride(...slot(i), 100, 100, 25)
				: ride(...slot(i), 100, 200, 30, {
						sportType: "VirtualRide",
						trainer: true,
					}),
		),
	},
	{
		athleteId: 990006,
		firstName: "Rex Rejected",
		state:
			"Rides that don't count, one per rule, and a run that counts only for the running badges",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Each ride breaks only its own rule (CURRENT_RULES).
		rides: [
			// 8 km/h, below 10.
			ride(1, "07:00", 20, 50, 8),
			// 60 km/h, above 45.
			ride(2, "07:00", 60, 100, 60),
			// 110 minutes' pause on 90 moving, longer than moving.
			{ ...ride(3, "07:00", 40, 200, 26.67), elapsedMin: 200 },
			// 3,000 m in 90 minutes: 2,000 m/h, above 1,500.
			ride(4, "07:00", 30, 3000, 20),
			ride(5, "07:00", 40, 200, 25, { manual: true }),
			ride(6, "07:00", 40, 200, 25, { flagged: true }),
			ride(7, "07:00", 40, 200, 25, { sportType: "EBikeRide" }),
			// The same ride recorded twice: the shorter one overlaps.
			ride(8, "07:00", 50, 300, 25),
			ride(8, "07:05", 45, 250, 25),
			ride(9, "07:00", 10, 50, 10, { sportType: "Run" }),
		],
	},
	{
		athleteId: 990007,
		firstName: "Paula Paging",
		state:
			"More rides than one page (45; 20 per page) and team events, one before the season start",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Two a day, mornings and evenings.
		rides: rides(45, (i) =>
			ride(1 + Math.floor(i / 2), i % 2 === 0 ? "07:00" : "17:00", 20, 100, 20),
		),
		events: [
			{ daysAgo: 3, kind: "team_training", name: "Sample team training" },
			{ daysAgo: 10, kind: "training_weekend_day", name: null },
			{ daysAgo: 10, kind: "technique_training", name: "Sample cornering" },
			// Doesn't count: before the season start.
			{ daysAgo: null, kind: "team_training", name: null },
		],
	},
	{
		athleteId: 990008,
		firstName: "Olli OptionalDenied",
		state: "Optional permissions withheld; three private rides stay hidden",
		scopes: "read,activity:read",
		clubMember: true,
		behaviour: "normal",
		rides: rides(8, (i) =>
			ride(...slot(i), 40, 250, 25, { private: i % 3 === 1 }),
		),
	},
	{
		athleteId: 990009,
		firstName: "Remy Reconnect",
		state: "Must reconnect: the fake refuses his activity calls and refresh",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "refused",
		rides: rides(3, (i) => ride(...slot(i), 50, 300, 25)),
	},
	{
		athleteId: 990010,
		firstName: "Noah NotMember",
		state: "Not a club member: signing in shows the not-member notice",
		scopes: ALL_SCOPES,
		clubMember: false,
		behaviour: "normal",
		rides: rides(3, (i) => ride(...slot(i), 50, 300, 25)),
	},
	{
		athleteId: 990011,
		firstName: "Olga Organiser",
		state: "Organiser: manages team events and attendance at /organiser",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		organiser: true,
		rides: rides(5, (i) => ride(...slot(i), 60, 400, 25)),
	},
	{
		athleteId: 990012,
		firstName: "Bea Badges",
		state:
			"Badges (feature 013): earlier and later ones in a category, both technique trainings",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// 12 rides of 60 km and 500 m: 720 km and 6,000 m, so distance 100 and
		// 500 and elevation 1,000 and 5,000, each a few days apart.
		rides: rides(12, (i) => ride(...slot(i), 60, 500, 25)),
		events: [
			{ daysAgo: 9, kind: "technique_training", name: "Sample braking" },
			{ daysAgo: 2, kind: "technique_training", name: "Sample cornering" },
			{ daysAgo: 4, kind: "team_training", name: null },
		],
	},
	{
		athleteId: 990013,
		firstName: "Nick NearlyThere",
		state:
			"Badges (feature 013): just short of the first distance and elevation badges",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// 99.6 km and 990 m: "Noch 1 km" and "Noch 10 m". The 8 distance Rynke
		// already earn the first Training Rynke badge; neither ride is 50 km.
		rides: [ride(1, "07:00", 49.8, 495, 25), ride(3, "07:00", 49.8, 495, 25)],
	},
	{
		athleteId: 990014,
		firstName: "Carla Complete",
		state:
			"Badges (feature 013): every personal riding and team-event badge, no runs",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// 25 rides of 200 km and 1,000 m: 5,000 km, 25,000 m and 625 Training
		// Rynke, each category's last badge.
		rides: rides(25, (i) => ride(...slot(i), 200, 1000, 25)),
		// 20 team events, both technique trainings among them.
		events: Array.from({ length: 20 }, (_, i) => ({
			daysAgo: 1 + i,
			kind: i < 2 ? "technique_training" : "team_training",
			name: null,
		})),
	},
	{
		athleteId: 990015,
		firstName: "Rudi Runner",
		state:
			"Badges (feature 013): outdoor runs for the running badges; treadmill, virtual and manual runs that don't count",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [
			...rides(3, (i) => ride(...slot(i), 40, 200, 25)),
			// Outdoors: 7.8 + 4.6 = 12.4 km, the longest 7.8 km.
			ride(6, "07:00", 7.8, 40, 10, { sportType: "Run" }),
			ride(3, "18:00", 4.6, 120, 8, { sportType: "TrailRun" }),
			// None of these counts (FR-020, FR-020a).
			ride(2, "18:00", 12, 0, 11, { sportType: "Run", trainer: true }),
			ride(4, "18:00", 15, 0, 12, { sportType: "VirtualRun", trainer: true }),
			ride(5, "18:00", 21.1, 0, 10, { sportType: "Run", manual: true }),
		],
	},
	{
		athleteId: 990016,
		firstName: "Wanda Winter",
		state:
			"Badges (feature 013 parts C and D): a long ride, virtual rides, winter days, swims and surprise badges",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [
			// Ride length 50 and 100.
			ride(3, "08:00", 104, 600, 26),
			// Virtual: 30 + 25 km, so virtual 50; not winter days.
			ride(5, "18:00", 30, 0, 30, { sportType: "VirtualRide" }),
			ride(6, "18:00", 25, 0, 30, { trainer: true }),
			// Winter: a trainer ride on 5 December is no December day; two rides
			// on 10 January are one day; five days in February.
			ride(0, "10:00", 40, 200, 24, { onDate: "11-14" }),
			ride(0, "18:00", 30, 0, 30, { onDate: "12-05", trainer: true }),
			ride(0, "10:00", 40, 200, 24, { onDate: "12-06" }),
			ride(0, "09:00", 40, 200, 24, { onDate: "01-10" }),
			ride(0, "15:00", 30, 100, 24, { onDate: "01-10" }),
			ride(0, "10:00", 40, 200, 24, { onDate: "01-11" }),
			...rides(5, (i) =>
				ride(0, "10:00", 40, 200, 24, { onDate: `02-0${1 + i}` }),
			),
			// Surprises (part D): Christmas Eve and a night owl on its own day
			// (counting once the dates have passed); New Year and early bird.
			ride(0, "22:00", 30, 100, 24, { onDate: "12-24" }),
			ride(9, "22:00", 30, 100, 24),
			ride(0, "05:30", 30, 100, 24, { onDate: "01-01" }),
			// With the activities on days 2 to 6, a full week from day 8 on (the
			// manual swim on day 7 doesn't count); day 1 off and a ride on the
			// seeding day: the rest day.
			ride(7, "10:00", 30, 100, 24),
			ride(8, "10:00", 30, 100, 24),
			ride(0, "10:00", 30, 100, 24),
			// Swims: pool and open water count, the manual one doesn't.
			ride(2, "07:00", 1.2, 0, 2.4, { sportType: "Swim", trainer: true }),
			ride(4, "07:00", 0.8, 0, 2.4, { sportType: "Swim" }),
			ride(7, "07:00", 1.5, 0, 2.4, { sportType: "Swim", manual: true }),
		],
	},
	{
		athleteId: 990017,
		firstName: "Fritz Festtag",
		state:
			"Badges (feature 013 part F): surprise badges from cycling traditions",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [
			// Festive 500: 4 × 130 km between Christmas Eve and New Year's Eve,
			// two of them on Zwift.
			ride(0, "10:00", 130, 300, 26, { onDate: "12-24" }),
			ride(0, "10:00", 130, 300, 26, { onDate: "12-26" }),
			ride(0, "10:00", 130, 0, 30, {
				onDate: "12-28",
				sportType: "VirtualRide",
				trainer: true,
			}),
			ride(0, "10:00", 130, 0, 30, {
				onDate: "12-30",
				sportType: "VirtualRide",
				trainer: true,
			}),
			// Etappenfahrer: 100 km on three days in a row, the middle one in
			// two rides.
			ride(3, "08:00", 100, 500, 25),
			ride(4, "07:00", 60, 300, 25),
			ride(4, "15:00", 40, 200, 25),
			ride(5, "08:00", 100, 500, 25),
			// Dreikampf: a ride, a run and a swim on one day.
			ride(8, "07:00", 1.5, 0, 2.4, { sportType: "Swim" }),
			ride(8, "10:00", 30, 150, 25),
			ride(8, "18:00", 6, 30, 10, { sportType: "Run" }),
			// Kreiszahl: 32 km on 14 March.
			ride(0, "10:00", 32, 150, 24, { onDate: "03-14" }),
			// Sonnenwende: outdoors on both solstices.
			ride(0, "10:00", 25, 100, 24, { onDate: "12-21" }),
			ride(0, "10:00", 25, 100, 24, { onDate: "06-21" }),
			// Osterhase: a ride on Easter Monday.
			ride(0, "10:00", 30, 150, 24, { onEaster: 1 }),
			// Everesting: 9 × 1,000 m in May.
			...rides(9, (i) =>
				ride(0, "09:00", 50, 1000, 20, { onDate: `05-0${1 + i}` }),
			),
		],
	},
];

/** A team event several sample riders attended, entered by an organiser. */
export interface TeamEventRecipe extends EventRecipe {
	attendees: readonly number[];
	/**
	 * Riders who reported the event themselves (feature 019): "Bin dabei" for
	 * one still to come (a negative `daysAgo`), "Ich war dabei" for a past one.
	 */
	reports?: readonly number[];
}

/** Records the team events below (feature 014 FR-040). */
export const EVENT_ORGANISER = 990004;

// Tina TrainingDone stays without Team Rynke, as her state says.
export const SAMPLE_TEAM_EVENTS: readonly TeamEventRecipe[] = [
	{
		daysAgo: 5,
		kind: "team_training",
		name: "Sample team ride",
		attendees: [990003, 990005, 990008, 990011],
		reports: [990012, 990015],
	},
	{
		daysAgo: 12,
		kind: "training_weekend_day",
		name: "Sample training weekend",
		attendees: [990005, 990011],
		reports: [990012],
	},
	// Six listed riders at one event: the team's first big training (feature
	// 013 US4).
	{
		daysAgo: 7,
		kind: "team_training",
		name: "Sample big training",
		attendees: [990003, 990005, 990008, 990011, 990012, 990015],
	},
	// Feature 019: open requests at three events, one rider with three and one
	// with two, and intents for events still to come. Nobody attended them yet.
	{
		daysAgo: 20,
		kind: "team_training",
		name: "Sample early ride",
		attendees: [],
		reports: [990012, 990015],
	},
	{
		daysAgo: -4,
		kind: "team_training",
		name: "Sample ride ahead",
		attendees: [],
		reports: [990003, 990005, 990008],
	},
	{
		daysAgo: -18,
		kind: "technique_training",
		name: "Sample technique session",
		attendees: [],
		reports: [990012],
	},
	// Feature 021: the eight days of the Tour de Paris, after the qualification
	// deadline. Fiona rides all of them, Vera the first five, Olga the first
	// two; they earn no Rynke, and badges only once their day has come.
	...[
		"Hamburg – Bremen",
		"Bremen – Osnabrück",
		"Osnabrück – Arnheim",
		"Arnheim – Antwerpen",
		"Antwerpen – Lille",
		"Lille – Arras",
		"Arras – Compiègne",
		"Compiègne – Paris",
	].map(
		(name, i): TeamEventRecipe => ({
			daysAgo: null,
			onDate: `07-${String(4 + i).padStart(2, "0")}`,
			kind: "tour_de_paris",
			name,
			attendees: [
				990003,
				...(i < 5 ? [990005] : []),
				...(i < 2 ? [990011] : []),
			],
		}),
	),
];

export function sampleRider(athleteId: number): SampleRider | undefined {
	return SAMPLE_RIDERS.find((r) => r.athleteId === athleteId);
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
