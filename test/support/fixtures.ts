// Synthetic data only (constitution Principle I). Nothing here describes a real
// rider, club member or ride.

/** Default test clock: 2026-10-06T10:00:00Z, in epoch seconds. */
export const NOW = Date.UTC(2026, 9, 6, 10, 0, 0) / 1000;

export const ATHLETE_A = 900001;
export const ATHLETE_B = 900002;
export const ATHLETE_C = 900003;

export function firstNameFor(athleteId: number): string {
	return `Testrider ${String.fromCharCode(65 + ((athleteId - 900001) % 26))}`;
}

export const TEAM_CLUB = { id: 2372209, name: "TRHH Rynke Coins" };
export const OTHER_CLUB = { id: 1111, name: "Synthetic Other Club" };

/** The full Strava `DetailedActivity` shape, including fields we must drop. */
export interface StravaActivityFixture {
	id: number;
	sport_type: string;
	start_date: string;
	start_date_local: string;
	timezone: string;
	distance: number;
	moving_time: number;
	total_elevation_gain: number;
	/** Optional so a test can delete them: Strava may omit a field. */
	elapsed_time?: number;
	manual?: boolean;
	trainer?: boolean;
	flagged?: boolean;
	private: boolean;
	[field: string]: unknown;
}

let nextActivityId = 7_000_001;

export function makeStravaActivity(
	overrides: Partial<StravaActivityFixture> = {},
): StravaActivityFixture {
	const id = overrides.id ?? nextActivityId++;
	return {
		id,
		resource_state: 3,
		athlete: { id: ATHLETE_A, resource_state: 1 },
		name: `Synthetic ride ${id}`,
		description: "Synthetic description",
		type: "Ride",
		sport_type: "Ride",
		start_date: "2026-10-05T07:30:00Z",
		start_date_local: "2026-10-05T09:30:00Z",
		timezone: "(GMT+01:00) Europe/Berlin",
		utc_offset: 7200,
		distance: 42195,
		moving_time: 5400,
		elapsed_time: 6000,
		total_elevation_gain: 312,
		manual: false,
		trainer: false,
		flagged: false,
		private: false,
		visibility: "everyone",
		start_latlng: [53.5, 10.0],
		end_latlng: [53.6, 10.1],
		map: {
			id: `a${id}`,
			summary_polyline: "synthetic_summary_polyline",
			polyline: "synthetic_polyline",
		},
		average_heartrate: 141,
		max_heartrate: 172,
		average_watts: 187,
		photos: { count: 0, primary: null },
		...overrides,
	};
}
