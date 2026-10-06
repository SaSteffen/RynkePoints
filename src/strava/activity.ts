// Maps Strava activities to the stored record (research R5, FR-013–FR-016).
// The mapping is an explicit allow-list: nothing else Strava sends (GPS,
// polylines, titles, heart rate, power, photos, ...) can reach storage.

export const CYCLING_SPORT_TYPES = [
	"Ride",
	"MountainBikeRide",
	"GravelRide",
	"EBikeRide",
	"EMountainBikeRide",
	"VirtualRide",
] as const;

export type CyclingSportType = (typeof CYCLING_SPORT_TYPES)[number];

/** The fields we read from a Strava summary or detailed activity. */
export interface StravaActivity {
	id: number;
	sport_type: string;
	start_date: string;
	start_date_local: string;
	timezone: string;
	distance: number;
	moving_time: number;
	total_elevation_gain: number;
	private?: boolean;
}

export interface ActivityRecord {
	strava_activity_id: number;
	athlete_id: number;
	sport_type: CyclingSportType;
	start_date: string;
	start_date_local: string;
	timezone: string;
	distance_m: number;
	moving_time_s: number;
	elevation_gain_m: number;
	is_private: 0 | 1;
	refreshed_at: number;
}

export function isCycling(sportType: string): sportType is CyclingSportType {
	return (CYCLING_SPORT_TYPES as readonly string[]).includes(sportType);
}

/** Returns the record to store, or null if the activity isn't cycling. */
export function toActivityRecord(
	activity: StravaActivity,
	athleteId: number,
	now: number,
): ActivityRecord | null {
	if (!isCycling(activity.sport_type)) return null;
	return {
		strava_activity_id: activity.id,
		athlete_id: athleteId,
		sport_type: activity.sport_type,
		start_date: activity.start_date,
		start_date_local: activity.start_date_local,
		timezone: activity.timezone,
		distance_m: activity.distance,
		moving_time_s: activity.moving_time,
		elevation_gain_m: activity.total_elevation_gain,
		is_private: activity.private ? 1 : 0,
		refreshed_at: now,
	};
}
