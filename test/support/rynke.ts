import { env } from "cloudflare:test";
import { expect } from "vitest";
import { listRecentActivities } from "../../src/db/activities";
import { readRynke } from "../../src/db/rynke";
import { evaluateRides, rideFromRow } from "../../src/rynke/rides";
import { countingWindow, type RynkeRules } from "../../src/rynke/rules";
import { NO_EXTRAS, tally } from "../../src/rynke/tally";
import type { ActivityRecord } from "../../src/strava/activity";
import { ATHLETE_A, NOW } from "./fixtures";

// Stored Rynke rows for the storage tests. Synthetic values only
// (constitution Principle I).

/** A stored activity in human units; a 2 h, 40 km ride on 2026-05-01. */
export function activityRecord(
	id: number,
	overrides: Partial<ActivityRecord> = {},
): ActivityRecord {
	const start = overrides.start_date ?? "2026-05-01T08:00:00Z";
	return {
		strava_activity_id: id,
		athlete_id: ATHLETE_A,
		sport_type: "Ride",
		start_date: start,
		start_date_local: start,
		timezone: "(GMT+01:00) Europe/Berlin",
		distance_m: 40000,
		moving_time_s: 7200,
		elapsed_time_s: 7200,
		elevation_gain_m: 300,
		is_manual: 0,
		is_trainer: 0,
		is_flagged: 0,
		is_private: 0,
		refreshed_at: NOW,
		...overrides,
	};
}

export async function resultRows(athleteId = ATHLETE_A) {
	const { results } = await env.DB.prepare(
		"SELECT * FROM ride_results WHERE athlete_id = ? ORDER BY strava_activity_id",
	)
		.bind(athleteId)
		.all<Record<string, unknown>>();
	return results;
}

export async function balanceRow(athleteId = ATHLETE_A) {
	return env.DB.prepare("SELECT * FROM rynke_balances WHERE athlete_id = ?")
		.bind(athleteId)
		.first<Record<string, unknown>>();
}

/** The rider's stored Rynke rows, for "writes nothing" comparisons. */
export async function snapshot(athleteId = ATHLETE_A) {
	return {
		results: await resultRows(athleteId),
		balance: await balanceRow(athleteId),
	};
}

/** What a full evaluation of the rider's stored activities gives. */
export async function expectedRynke(rules: RynkeRules, athleteId = ATHLETE_A) {
	const rows = await listRecentActivities(env.DB, athleteId, 10_000);
	const evaluation = evaluateRides(
		rows.map(rideFromRow),
		rules,
		countingWindow(env, rules),
	);
	return {
		results: evaluation.results,
		balance: tally(evaluation.riding, NO_EXTRAS, rules),
	};
}

/**
 * FR-014b: the balance's riding fields equal the sums over the counting
 * results, and every row carries one rules version.
 */
export async function expectConsistent(athleteId = ATHLETE_A) {
	const { balance, results } = await readRynke(env.DB, athleteId);
	if (!balance) throw new Error(`no balance for ${athleteId}`);
	const counting = results.filter((r) => r.counts);
	const distance = counting.reduce((n, r) => n + r.distanceRynke, 0);
	const elevationDm = counting.reduce((n, r) => n + r.elevationDm, 0);
	expect({
		distance: balance.distanceRynke,
		elevationDm: balance.elevationDm,
	}).toEqual({ distance, elevationDm });
	expect(
		new Set([balance.rulesVersion, ...results.map((r) => r.rulesVersion)]).size,
	).toEqual(1);
	expect(balance.rulesEffectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
}
