// Maps Strava activities to the stored record (research R5, FR-013–FR-016).
// The mapping is an explicit allow-list: the figures, and the ride's name for
// its rider's own ride table (feature 008 FR-001). Nothing else Strava sends
// (GPS, polylines, descriptions, heart rate, power, photos, ...) can reach
// storage.

export const CYCLING_SPORT_TYPES = [
	"Ride",
	"MountainBikeRide",
	"GravelRide",
	"EBikeRide",
	"EMountainBikeRide",
	"VirtualRide",
] as const;

export type CyclingSportType = (typeof CYCLING_SPORT_TYPES)[number];

/**
 * Version of the FR-013 field set. Goes up whenever the mapping gains a field,
 * so the daily cron re-reads riders stored with an older one (research R20).
 * Version 1 added elapsed time and the manual and trainer flags, version 2
 * Strava's `flagged`, version 3 the ride's name (feature 008).
 */
export const ACTIVITY_FIGURES_VERSION = 3;

/** The fields we read from a Strava summary or detailed activity. */
export interface StravaActivity {
	id: number;
	sport_type: string;
	start_date: string;
	start_date_local: string;
	timezone: string;
	distance: number;
	moving_time: number;
	elapsed_time?: number;
	total_elevation_gain: number;
	manual?: boolean;
	trainer?: boolean;
	flagged?: boolean;
	private?: boolean;
	name?: string;
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
	/** `null` = unknown: Strava didn't send it, or the row predates it. */
	elapsed_time_s: number | null;
	elevation_gain_m: number;
	is_manual: 0 | 1 | null;
	is_trainer: 0 | 1 | null;
	is_flagged: 0 | 1 | null;
	is_private: 0 | 1;
	refreshed_at: number;
	/** `null` = unknown: not read yet, or empty or blank on Strava (008 FR-005). */
	name: string | null;
}

/**
 * What every reader gets except the rider's own ride table: the shared column
 * list leaves the name out, so no other page can show it (008 research R7).
 */
export type ActivityRow = Omit<ActivityRecord, "name">;

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
		elapsed_time_s: activity.elapsed_time ?? null,
		elevation_gain_m: activity.total_elevation_gain,
		is_manual: flag(activity.manual),
		is_trainer: flag(activity.trainer),
		is_flagged: flag(activity.flagged),
		is_private: activity.private ? 1 : 0,
		refreshed_at: now,
		name: rideName(activity.name),
	};
}

/** A missing flag stays unknown, never "false" (spec edge case). */
function flag(value: boolean | undefined): 0 | 1 | null {
	return value === undefined ? null : value ? 1 : 0;
}

/**
 * A missing or blank name is unknown, never invented (008 FR-005). Anything
 * else is the rider's own wording, kept untrimmed (008 research R1).
 */
function rideName(value: string | undefined): string | null {
	return value === undefined || value.trim() === "" ? null : value;
}
