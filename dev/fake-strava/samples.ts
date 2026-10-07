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
