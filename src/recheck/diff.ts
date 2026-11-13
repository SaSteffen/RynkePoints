import type { ActivityRecord, RunRecord, SwimRecord } from "../strava/activity";

// Which listed activities a ride edit re-check takes over (feature 036 research
// R7): those not stored as the same kind, and those that differ in a stored
// figure. The refresh time is no figure. Where the list lacks a figure the
// stored activity has, the stored one stays and is no difference (FR-006).
// Stored activities missing from the list are not looked at.

/** A rider's listed activities after the import's scope rule. */
export interface KeptActivities {
	records: ActivityRecord[];
	runs: RunRecord[];
	swims: SwimRecord[];
}

/** A rider's stored rides, runs and swims by activity id. */
export interface StoredActivities {
	rides: ReadonlyMap<number, ActivityRecord>;
	runs: ReadonlyMap<number, RunRecord>;
	swims: ReadonlyMap<number, SwimRecord>;
}

/** The ride fields Strava may leave out, read as unknown (`null`). */
const MAY_LACK = [
	"elapsed_time_s",
	"is_manual",
	"is_trainer",
	"is_flagged",
	"name",
] as const;

const RIDE_FIGURES = [
	"sport_type",
	"start_date",
	"start_date_local",
	"timezone",
	"distance_m",
	"moving_time_s",
	"elevation_gain_m",
	"is_private",
	...MAY_LACK,
] as const;

const RUN_FIGURES = [
	"start_date",
	"start_date_local",
	"distance_m",
	"is_private",
] as const;

/** The listed ride with the stored figures it lacks filled in. */
function filled(
	listed: ActivityRecord,
	stored: ActivityRecord,
): ActivityRecord {
	const record = { ...listed };
	for (const field of MAY_LACK) {
		if (record[field] === null) {
			(record as Record<string, unknown>)[field] = stored[field];
		}
	}
	return record;
}

function differs<T>(a: T, b: T, fields: readonly (keyof T)[]): boolean {
	return fields.some((field) => a[field] !== b[field]);
}

export function differences(
	listed: KeptActivities,
	stored: StoredActivities,
): KeptActivities {
	const records: ActivityRecord[] = [];
	for (const record of listed.records) {
		const before = stored.rides.get(record.strava_activity_id);
		if (!before) {
			records.push(record);
			continue;
		}
		const after = filled(record, before);
		if (differs(after, before, RIDE_FIGURES)) records.push(after);
	}
	const changed = <T extends RunRecord>(
		rows: readonly T[],
		before: ReadonlyMap<number, T>,
	) =>
		rows.filter((row) => {
			const was = before.get(row.strava_activity_id);
			return !was || differs(row, was, RUN_FIGURES);
		});
	return {
		records,
		runs: changed(listed.runs, stored.runs),
		swims: changed(listed.swims, stored.swims),
	};
}
