import { describe, expect, it } from "vitest";
import {
	ACTIVITY_FIGURES_VERSION,
	CYCLING_SPORT_TYPES,
	isCycling,
	toActivityRecord,
	toRunRecord,
	toSwimRecord,
} from "../../src/strava/activity";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";

describe("isCycling", () => {
	it("knows exactly the six cycling sport types", () => {
		expect([...CYCLING_SPORT_TYPES].sort()).toEqual(
			[
				"EBikeRide",
				"EMountainBikeRide",
				"GravelRide",
				"MountainBikeRide",
				"Ride",
				"VirtualRide",
			].sort(),
		);
		for (const type of CYCLING_SPORT_TYPES) {
			expect(isCycling(type)).toBe(true);
		}
	});

	it("rejects other sports", () => {
		for (const type of ["Run", "Walk", "Velomobile", "Handcycle", ""]) {
			expect(isCycling(type)).toBe(false);
		}
	});
});

describe("toActivityRecord", () => {
	it("maps the allow-listed fields", () => {
		const activity = makeStravaActivity({
			id: 7001,
			sport_type: "GravelRide",
			start_date: "2026-10-05T07:30:00Z",
			start_date_local: "2026-10-05T09:30:00Z",
			timezone: "(GMT+01:00) Europe/Berlin",
			distance: 42195.4,
			moving_time: 5400,
			elapsed_time: 6000,
			total_elevation_gain: 312.5,
			manual: true,
			trainer: true,
			flagged: true,
			private: false,
		});
		expect(toActivityRecord(activity, ATHLETE_A, NOW)).toEqual({
			strava_activity_id: 7001,
			athlete_id: ATHLETE_A,
			sport_type: "GravelRide",
			start_date: "2026-10-05T07:30:00Z",
			start_date_local: "2026-10-05T09:30:00Z",
			timezone: "(GMT+01:00) Europe/Berlin",
			distance_m: 42195.4,
			moving_time_s: 5400,
			elapsed_time_s: 6000,
			elevation_gain_m: 312.5,
			is_manual: 1,
			is_trainer: 1,
			is_flagged: 1,
			is_private: 0,
			refreshed_at: NOW,
			name: "Synthetic ride 7001",
		});
	});

	it("returns null for non-cycling activities", () => {
		for (const sport_type of ["Run", "Walk", "Velomobile"]) {
			expect(
				toActivityRecord(makeStravaActivity({ sport_type }), ATHLETE_A, NOW),
			).toBeNull();
		}
	});

	it("outputs exactly the stored keys and leaks nothing else", () => {
		const activity = makeStravaActivity({
			name: "Synthetic morning ride",
			description: "synthetic description",
			average_heartrate: 140,
			average_watts: 210,
			photos: { count: 1 },
			start_latlng: [53.55, 9.99],
			end_latlng: [53.56, 10.0],
			map: { id: "a1", summary_polyline: "synthetic_polyline" },
		});
		const record = toActivityRecord(activity, ATHLETE_A, NOW);
		expect(Object.keys(record ?? {}).sort()).toEqual(
			[
				"strava_activity_id",
				"athlete_id",
				"sport_type",
				"start_date",
				"start_date_local",
				"timezone",
				"distance_m",
				"moving_time_s",
				"elapsed_time_s",
				"elevation_gain_m",
				"is_manual",
				"is_trainer",
				"is_flagged",
				"is_private",
				"name",
				"refreshed_at",
			].sort(),
		);
		const serialized = JSON.stringify(record);
		for (const leaked of [
			"synthetic_polyline",
			"synthetic description",
			"53.55",
			"140",
			"210",
		]) {
			expect(serialized).not.toContain(leaked);
		}
	});

	it("maps false flags to 0", () => {
		const record = toActivityRecord(
			makeStravaActivity({ manual: false, trainer: false, flagged: false }),
			ATHLETE_A,
			NOW,
		);
		expect(record).toMatchObject({
			is_manual: 0,
			is_trainer: 0,
			is_flagged: 0,
		});
	});

	it.each([
		["elapsed_time", "elapsed_time_s"],
		["manual", "is_manual"],
		["trainer", "is_trainer"],
		["flagged", "is_flagged"],
	] as const)("records a missing %s as unknown, never 0", (field, column) => {
		const activity = makeStravaActivity({
			manual: true,
			trainer: true,
			flagged: true,
		});
		delete activity[field];
		const record = toActivityRecord(activity, ATHLETE_A, NOW);
		expect(record?.[column]).toBeNull();
	});

	it("is at figures version 5, which added swims (feature 013 part C)", () => {
		expect(ACTIVITY_FIGURES_VERSION).toBe(5);
	});

	it("keeps the ride's name exactly as Strava sends it (008 FR-001)", () => {
		const name = " Rund um den Sorpesee <3 🚴 ";
		expect(
			toActivityRecord(makeStravaActivity({ name }), ATHLETE_A, NOW)?.name,
		).toBe(name);
	});

	it.each([
		["missing", undefined],
		["empty", ""],
		["blank", "   "],
		["whitespace", "\t\n"],
	])("records a %s name as unknown (008 FR-005)", (_, name) => {
		const activity = makeStravaActivity({ name });
		if (name === undefined) delete activity.name;
		expect(toActivityRecord(activity, ATHLETE_A, NOW)?.name).toBeNull();
	});

	it("marks private activities", () => {
		expect(
			toActivityRecord(makeStravaActivity({ private: true }), ATHLETE_A, NOW)
				?.is_private,
		).toBe(1);
	});
});

describe("toRunRecord (feature 013 FR-020, research R11)", () => {
	const run = (overrides: Parameters<typeof makeStravaActivity>[0] = {}) =>
		makeStravaActivity({
			sport_type: "Run",
			type: "Run",
			distance: 7800,
			...overrides,
		});

	it("keeps outdoor runs and trail runs with only the runs columns", () => {
		const activity = run({ id: 42 });
		expect(toRunRecord(activity, ATHLETE_A, NOW)).toEqual({
			strava_activity_id: 42,
			athlete_id: ATHLETE_A,
			start_date: activity.start_date,
			start_date_local: activity.start_date_local,
			distance_m: 7800,
			is_private: 0,
			refreshed_at: NOW,
		});
		expect(
			toRunRecord(run({ sport_type: "TrailRun" }), ATHLETE_A, NOW),
		).not.toBeNull();
	});

	it.each<[string, Parameters<typeof makeStravaActivity>[0]]>([
		["a virtual run", { sport_type: "VirtualRun" }],
		["a treadmill run", { trainer: true }],
		["a manual run", { manual: true }],
		["a ride", { sport_type: "Ride" }],
		["a walk", { sport_type: "Walk" }],
	])("returns null for %s", (_, overrides) => {
		expect(toRunRecord(run(overrides), ATHLETE_A, NOW)).toBeNull();
	});

	it("counts a flag Strava doesn't send as not set", () => {
		const activity = run();
		delete activity.trainer;
		delete activity.manual;
		expect(toRunRecord(activity, ATHLETE_A, NOW)).not.toBeNull();
	});

	it("marks private runs", () => {
		expect(
			toRunRecord(run({ private: true }), ATHLETE_A, NOW)?.is_private,
		).toBe(1);
	});

	it("is never a ride", () => {
		expect(toActivityRecord(run(), ATHLETE_A, NOW)).toBeNull();
	});
});

describe("toSwimRecord (feature 013 FR-024, research R26)", () => {
	const swim = (overrides: Parameters<typeof makeStravaActivity>[0] = {}) =>
		makeStravaActivity({
			sport_type: "Swim",
			type: "Swim",
			distance: 1200,
			...overrides,
		});

	it("keeps swims with only the swims columns", () => {
		const activity = swim({ id: 43 });
		expect(toSwimRecord(activity, ATHLETE_A, NOW)).toEqual({
			strava_activity_id: 43,
			athlete_id: ATHLETE_A,
			start_date: activity.start_date,
			start_date_local: activity.start_date_local,
			distance_m: 1200,
			is_private: 0,
			refreshed_at: NOW,
		});
	});

	it("keeps a pool swim Strava marks as on a trainer", () => {
		expect(
			toSwimRecord(swim({ trainer: true }), ATHLETE_A, NOW),
		).not.toBeNull();
	});

	it.each<[string, Parameters<typeof makeStravaActivity>[0]]>([
		["a manual swim", { manual: true }],
		["a run", { sport_type: "Run" }],
		["a ride", { sport_type: "Ride" }],
		["a walk", { sport_type: "Walk" }],
	])("returns null for %s", (_, overrides) => {
		expect(toSwimRecord(swim(overrides), ATHLETE_A, NOW)).toBeNull();
	});

	it("counts a flag Strava doesn't send as not set", () => {
		const activity = swim();
		delete activity.manual;
		expect(toSwimRecord(activity, ATHLETE_A, NOW)).not.toBeNull();
	});

	it("marks private swims", () => {
		expect(
			toSwimRecord(swim({ private: true }), ATHLETE_A, NOW)?.is_private,
		).toBe(1);
	});

	it("is never a ride or a run", () => {
		expect(toActivityRecord(swim(), ATHLETE_A, NOW)).toBeNull();
		expect(toRunRecord(swim(), ATHLETE_A, NOW)).toBeNull();
	});
});
