import { describe, expect, it } from "vitest";
import {
	CYCLING_SPORT_TYPES,
	isCycling,
	toActivityRecord,
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
			is_private: 0,
			refreshed_at: NOW,
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
				"is_private",
				"refreshed_at",
			].sort(),
		);
		const serialized = JSON.stringify(record);
		for (const leaked of [
			"synthetic_polyline",
			"Synthetic morning ride",
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
			makeStravaActivity({ manual: false, trainer: false }),
			ATHLETE_A,
			NOW,
		);
		expect(record).toMatchObject({ is_manual: 0, is_trainer: 0 });
	});

	it.each([
		["elapsed_time", "elapsed_time_s"],
		["manual", "is_manual"],
		["trainer", "is_trainer"],
	] as const)("records a missing %s as unknown, never 0", (field, column) => {
		const activity = makeStravaActivity({ manual: true, trainer: true });
		delete activity[field];
		const record = toActivityRecord(activity, ATHLETE_A, NOW);
		expect(record?.[column]).toBeNull();
	});

	it("marks private activities", () => {
		expect(
			toActivityRecord(makeStravaActivity({ private: true }), ATHLETE_A, NOW)
				?.is_private,
		).toBe(1);
	});
});
