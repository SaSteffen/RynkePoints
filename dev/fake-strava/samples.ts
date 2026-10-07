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

const ALL_SCOPES = "read,activity:read,activity:read_all,activity:write";

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
		state: "No rides",
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
		state: "Training target reached without virtual rides; Team Rynke missing",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
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
			"Rides that don't count, one per rule, and a run the app never imports",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Each ride breaks only its own rule (CURRENT_RULES).
		rides: [
			// 8 km/h, below 10.
			ride(1, "07:00", 20, 50, 8),
			// 60 km/h, above 45.
			ride(2, "07:00", 60, 100, 60),
			// 60 minutes' pause on 90 moving, more than half.
			{ ...ride(3, "07:00", 40, 200, 26.67), elapsedMin: 150 },
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
		state: "More rides than one page (45; 20 per page)",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Two a day, mornings and evenings.
		rides: rides(45, (i) =>
			ride(1 + Math.floor(i / 2), i % 2 === 0 ? "07:00" : "17:00", 20, 100, 20),
		),
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
	const wanted = dayBefore(seedDay, recipe.daysAgo);
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
