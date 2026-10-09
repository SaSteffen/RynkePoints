import { env } from "cloudflare:test";
import { expect } from "vitest";
import { listRecentActivities } from "../../src/db/activities";
import { readRynke } from "../../src/db/rynke";
import {
	listRiderAttendanceStatement,
	type RiderAttendanceRow,
	toAttendance,
} from "../../src/db/team-events";
import {
	evaluateRides,
	type RideResult,
	type RidingSums,
	type RidingTotals,
	rideFromRow,
} from "../../src/rynke/rides";
import {
	type CountingWindow,
	CURRENT_RULES,
	countingWindow,
	type RynkeRules,
} from "../../src/rynke/rules";
import { extrasFrom, tally } from "../../src/rynke/tally";
import {
	type Attendance,
	evaluateAttendance,
	type TeamEventKind,
} from "../../src/rynke/team-events";
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
		name: null,
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

/** A `team_events` row written with plain SQL, as the maintainer does (R22). */
export async function insertEvent(
	kind: TeamEventKind,
	date: string,
	name: string | null = null,
): Promise<number> {
	const eventId = await env.DB.prepare(
		"INSERT INTO team_events (kind, event_date, name) VALUES (?, ?, ?) RETURNING event_id",
	)
		.bind(kind, date, name)
		.first<number>("event_id");
	if (eventId === null) throw new Error("no event_id returned");
	return eventId;
}

/** Attendance written with plain SQL, as the maintainer does (R22). */
export async function attendRaw(
	eventId: number,
	athleteIds: number[],
): Promise<void> {
	await env.DB.batch(
		athleteIds.map((athleteId) =>
			env.DB.prepare(
				"INSERT INTO attendances (event_id, athlete_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
			).bind(eventId, athleteId),
		),
	);
}

/** The rider's stored attendances, as the evaluation reads them. */
export async function storedAttendance(
	athleteId = ATHLETE_A,
): Promise<Attendance[]> {
	const { results } = await listRiderAttendanceStatement(
		env.DB,
		athleteId,
	).all<RiderAttendanceRow>();
	return results.map(toAttendance);
}

/** Every `attendances` row, for "no evaluation changes attendance" (FR-026). */
export async function attendanceRows() {
	const { results } = await env.DB.prepare(
		"SELECT event_id, athlete_id FROM attendances ORDER BY event_id, athlete_id",
	).all<{ event_id: number; athlete_id: number }>();
	return results;
}

/** The rider's stored corrections' amounts (feature 014 Story 3). */
export async function storedCorrections(athleteId = ATHLETE_A) {
	const { results } = await env.DB.prepare(
		"SELECT training, team FROM corrections WHERE athlete_id = ?",
	)
		.bind(athleteId)
		.all<{ training: number; team: number }>();
	return results;
}

/**
 * What a full evaluation of the rider's stored activities, attendance and
 * corrections gives.
 */
export async function expectedRynke(rules: RynkeRules, athleteId = ATHLETE_A) {
	const rows = await listRecentActivities(env.DB, athleteId, 10_000);
	const window = countingWindow(env);
	const evaluation = evaluateRides(rows.map(rideFromRow), rules, window);
	const attendance = evaluateAttendance(
		await storedAttendance(athleteId),
		rules,
		window,
	);
	return {
		results: evaluation.results,
		balance: tally(
			evaluation.riding,
			extrasFrom(attendance, await storedCorrections(athleteId)),
			rules,
		),
	};
}

/**
 * The invariants of data-model.md, checked against what is stored (FR-014b):
 * every activity has exactly one result and no result lacks its activity, no
 * two counting results overlap, the balance is `tally` of the stored counting
 * results, attendance and corrections, and every row carries one rules
 * version. The breakdown equals the evaluated attendance; Team Rynke are its
 * Team sum and Training Rynke the riding plus its Training sum (Story 3), each
 * plus the corrections and at least 0 (feature 014 Story 3).
 */
export async function expectConsistent(
	athleteId = ATHLETE_A,
	rules: RynkeRules = CURRENT_RULES,
	window: CountingWindow = countingWindow(env),
) {
	const { balance, results } = await readRynke(env.DB, athleteId);
	if (!balance) throw new Error(`no balance for ${athleteId}`);
	const rides = (await listRecentActivities(env.DB, athleteId, 10_000)).map(
		rideFromRow,
	);
	expect(results.map((r) => r.activityId)).toEqual(
		rides.map((r) => r.activityId).sort((a, b) => a - b),
	);

	const counting = results.filter((r) => r.counts);
	const intervals = counting.map((r) => {
		const ride = rides.find((x) => x.activityId === r.activityId);
		if (!ride) throw new Error(`no activity ${r.activityId}`);
		const start = Date.parse(ride.startUtc);
		return {
			id: r.activityId,
			start,
			end: start + (ride.elapsedS ?? ride.movingS) * 1000,
		};
	});
	for (const a of intervals) {
		for (const b of intervals) {
			if (a.id < b.id && a.start < b.end && b.start < a.end) {
				throw new Error(`counting rides ${a.id} and ${b.id} overlap`);
			}
		}
	}

	const { computedAt: _computedAt, ...fields } = balance;
	const riding: RidingTotals = {
		...sums(counting, rules),
		withoutVirtual: sums(
			counting.filter((r) => !r.isVirtual),
			rules,
		),
	};
	const attendance = evaluateAttendance(
		await storedAttendance(athleteId),
		rules,
		window,
	);
	expect(balance.teamEvents).toEqual(attendance.byKind);
	const corrections = await storedCorrections(athleteId);
	const corrected = (key: "training" | "team") =>
		corrections.reduce((n, c) => n + c[key], 0);
	expect(balance.teamRynke).toBe(
		Math.max(0, attendance.team + corrected("team")),
	);
	expect(balance.trainingRynke).toBe(
		Math.max(
			0,
			riding.distanceRynke +
				riding.elevationRynke +
				attendance.training +
				corrected("training"),
		),
	);
	expect(fields).toEqual(
		tally(riding, extrasFrom(attendance, corrections), rules),
	);
	expect(new Set(results.map((r) => r.rulesVersion))).toEqual(
		new Set(results.length > 0 ? [balance.rulesVersion] : []),
	);
}

/** Elevation Rynke from the summed total, as `evaluateRides` does (FR-004a). */
function sums(results: RideResult[], rules: RynkeRules): RidingSums {
	const distanceRynke = results.reduce((n, r) => n + r.distanceRynke, 0);
	const elevationDm = results.reduce((n, r) => n + r.elevationDm, 0);
	return {
		distanceRynke,
		elevationDm,
		elevationRynke:
			Math.floor(elevationDm / (rules.elevationStepM * 10)) *
			rules.elevationStepRynke,
	};
}
