import { describe, expect, it } from "vitest";
import {
	differences,
	type KeptActivities,
	type StoredActivities,
} from "../../src/recheck/diff";
import type {
	ActivityRecord,
	RunRecord,
	SwimRecord,
} from "../../src/strava/activity";

// Which listed activities a re-check takes over (feature 036 research R7,
// FR-003 to FR-007): new ones and those that differ in a kept figure; the
// refresh time alone is no difference, a missing figure keeps the stored one,
// and an activity missing from the list is left alone.

const ATHLETE = 900001;
const LISTED_AT = 2_000_000_000;
const STORED_AT = 1_900_000_000;

function ride(id: number, o: Partial<ActivityRecord> = {}): ActivityRecord {
	return {
		strava_activity_id: id,
		athlete_id: ATHLETE,
		sport_type: "Ride",
		start_date: "2026-10-05T07:30:00Z",
		start_date_local: "2026-10-05T09:30:00Z",
		timezone: "(GMT+01:00) Europe/Berlin",
		distance_m: 42195,
		moving_time_s: 5400,
		elapsed_time_s: 6000,
		elevation_gain_m: 312,
		is_manual: 0,
		is_trainer: 0,
		is_flagged: 0,
		is_private: 0,
		refreshed_at: LISTED_AT,
		name: "Synthetic ride",
		...o,
	};
}

function run(id: number, o: Partial<RunRecord> = {}): RunRecord {
	return {
		strava_activity_id: id,
		athlete_id: ATHLETE,
		start_date: "2026-10-04T07:30:00Z",
		start_date_local: "2026-10-04T09:30:00Z",
		distance_m: 10000,
		is_private: 0,
		refreshed_at: LISTED_AT,
		...o,
	};
}

const swim = (id: number, o: Partial<SwimRecord> = {}): SwimRecord =>
	run(id, { distance_m: 1500, ...o });

function listed(o: Partial<KeptActivities> = {}): KeptActivities {
	return { records: [], runs: [], swims: [], ...o };
}

function stored(
	rides: ActivityRecord[] = [],
	runs: RunRecord[] = [],
	swims: SwimRecord[] = [],
): StoredActivities {
	const byId = <T extends { strava_activity_id: number }>(rows: T[]) =>
		new Map(
			rows.map((r) => [
				r.strava_activity_id,
				{ ...r, refreshed_at: STORED_AT },
			]),
		);
	return { rides: byId(rides), runs: byId(runs), swims: byId(swims) };
}

describe("differences", () => {
	it("is empty for identical lists, whatever the refresh times", () => {
		const result = differences(
			listed({ records: [ride(1)], runs: [run(2)], swims: [swim(3)] }),
			stored([ride(1)], [run(2)], [swim(3)]),
		);
		expect(result).toEqual(listed());
	});

	it.each<[string, Partial<ActivityRecord>]>([
		["distance", { distance_m: 30000 }],
		["moving time", { moving_time_s: 4000 }],
		["elapsed time", { elapsed_time_s: 5500 }],
		["start", { start_date: "2026-10-05T08:00:00Z" }],
		["local start", { start_date_local: "2026-10-05T10:00:00Z" }],
		["elevation", { elevation_gain_m: 100 }],
		["sport type", { sport_type: "GravelRide" }],
		["privacy", { is_private: 1 }],
		["manual flag", { is_manual: 1 }],
		["trainer flag", { is_trainer: 1 }],
		["Strava's flag", { is_flagged: 1 }],
		["name", { name: "Renamed" }],
	])("takes a ride whose %s changed", (_label, change) => {
		const changed = ride(1, change);
		expect(
			differences(listed({ records: [changed] }), stored([ride(1)])),
		).toEqual(listed({ records: [changed] }));
	});

	it("takes a run or swim whose distance changed", () => {
		const longer = run(2, { distance_m: 12000 });
		const shorter = swim(3, { distance_m: 1000 });
		expect(
			differences(
				listed({ runs: [longer], swims: [shorter] }),
				stored([], [run(2)], [swim(3)]),
			),
		).toEqual(listed({ runs: [longer], swims: [shorter] }));
	});

	it("takes an activity that isn't stored", () => {
		expect(
			differences(
				listed({ records: [ride(1)], runs: [run(2)], swims: [swim(3)] }),
				stored(),
			),
		).toEqual(listed({ records: [ride(1)], runs: [run(2)], swims: [swim(3)] }));
	});

	it("takes an activity that moved between ride, run and swim", () => {
		expect(
			differences(
				listed({ records: [ride(1)], runs: [run(2)], swims: [swim(3)] }),
				stored([ride(3)], [run(1)], [swim(2)]),
			),
		).toEqual(listed({ records: [ride(1)], runs: [run(2)], swims: [swim(3)] }));
	});

	it("keeps a stored figure the list lacks, and that alone is no difference", () => {
		const lacking = ride(1, {
			elapsed_time_s: null,
			is_manual: null,
			is_trainer: null,
			is_flagged: null,
			name: null,
		});
		expect(
			differences(listed({ records: [lacking] }), stored([ride(1)])),
		).toEqual(listed());
	});

	it("fills a stored figure the list lacks into a ride that changed", () => {
		const changed = ride(1, { distance_m: 30000, elapsed_time_s: null });
		expect(
			differences(listed({ records: [changed] }), stored([ride(1)])),
		).toEqual(listed({ records: [{ ...changed, elapsed_time_s: 6000 }] }));
	});

	it("leaves a stored activity missing from the list alone", () => {
		const result = differences(
			listed(),
			stored([ride(1)], [run(2)], [swim(3)]),
		);
		expect(result).toEqual(listed());
	});
});
