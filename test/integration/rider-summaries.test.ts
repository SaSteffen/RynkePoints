import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { RiderSummaryRow } from "../../src/db/rider-summaries";
import {
	applyAndEvaluate,
	applyCorrectionChange,
	applyTeamEventChange,
	evaluateChange,
} from "../../src/rynke/apply";
import { CURRENT_RULES, countingWindow } from "../../src/rynke/rules";
import { RIDER_SUMMARY_VERSION, summaryOf } from "../../src/rynke/summary";
import type { RunRecord, SwimRecord } from "../../src/strava/activity";
import { purgePreSeasonActivities } from "../../src/work/scheduled";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { countRows } from "../support/d1-rows";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import { activityRecord, attendRaw, insertEvent } from "../support/rynke";

// Feature 030 US3: every change leaves a rider's row matching their stored data,
// in the same batch. Synthetic riders only.

const ctx = makeCtx();
const window = countingWindow(env);

function runRecord(id: number, overrides: Partial<RunRecord> = {}): RunRecord {
	return {
		strava_activity_id: id,
		athlete_id: ATHLETE_A,
		start_date: "2026-05-02T17:10:00Z",
		start_date_local: "2026-05-02T19:10:00Z",
		distance_m: 5000.5,
		is_private: 0,
		refreshed_at: NOW,
		...overrides,
	};
}

function swimRecord(
	id: number,
	overrides: Partial<SwimRecord> = {},
): SwimRecord {
	return { ...runRecord(id, { distance_m: 1500 }), ...overrides };
}

async function storedRow(athleteId = ATHLETE_A) {
	return env.DB.prepare("SELECT * FROM rider_summaries WHERE athlete_id = ?")
		.bind(athleteId)
		.first<RiderSummaryRow>();
}

/** The row `summaryOf` gives from what is stored right now. */
async function fromScratch(athleteId = ATHLETE_A) {
	const rides = await env.DB.prepare(
		`SELECT a.start_date_local, a.distance_m, r.distance_rynke, r.elevation_dm
		FROM ride_results r JOIN activities a
			ON a.strava_activity_id = r.strava_activity_id
		WHERE r.counts = 1 AND r.athlete_id = ?`,
	)
		.bind(athleteId)
		.all<{
			start_date_local: string;
			distance_m: number;
			distance_rynke: number;
			elevation_dm: number;
		}>();
	const dated = async (table: string) =>
		(
			await env.DB.prepare(
				`SELECT start_date_local, distance_m FROM ${table} WHERE athlete_id = ?`,
			)
				.bind(athleteId)
				.all<{ start_date_local: string; distance_m: number }>()
		).results.map((row) => ({
			date: row.start_date_local.slice(0, 10),
			distanceM: row.distance_m,
			startTime: row.start_date_local.slice(11, 16),
		}));
	const attendance = await env.DB.prepare(
		"SELECT event_id FROM attendances WHERE athlete_id = ?",
	)
		.bind(athleteId)
		.all<{ event_id: number }>();
	const summary = summaryOf(
		{
			rides: rides.results.map((row) => ({
				date: row.start_date_local.slice(0, 10),
				distanceM: row.distance_m,
				distanceRynke: row.distance_rynke,
				elevationDm: row.elevation_dm,
				startTime: row.start_date_local.slice(11, 16),
			})),
			runs: await dated("runs"),
			swims: await dated("swims"),
		},
		attendance.results.map((row) => ({ eventId: row.event_id })),
	);
	return {
		athlete_id: athleteId,
		version: RIDER_SUMMARY_VERSION,
		days: summary.days,
		weeks: summary.weeks,
		run_days: summary.runDays,
		active: summary.active,
		attended: summary.attended,
	};
}

async function expectRowMatches(athleteId = ATHLETE_A) {
	expect(await storedRow(athleteId)).toEqual(await fromScratch(athleteId));
}

const eveningRide = (id: number, distance = 40123.45) =>
	activityRecord(id, {
		start_date: "2026-05-04T16:30:00Z",
		start_date_local: "2026-05-04T18:30:00Z",
		distance_m: distance,
	});

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

describe("a rider's summary follows every change (US3)", () => {
	it("is written by a rider's first evaluation, with nothing in it", async () => {
		await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
		expect(await storedRow()).toEqual({
			athlete_id: ATHLETE_A,
			version: RIDER_SUMMARY_VERSION,
			days: "[]",
			weeks: "[]",
			run_days: "[]",
			active: "[]",
			attended: "[]",
		});
	});

	it("follows a ride added, edited and deleted", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [eveningRide(1), activityRecord(2)],
		});
		await expectRowMatches();
		const days = JSON.parse((await storedRow())?.days ?? "");
		expect(days).toHaveLength(2);

		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [eveningRide(1, 50000.5)],
		});
		await expectRowMatches();
		expect((await storedRow())?.days).toContain("50000.5");

		await evaluateChange(ctx, ATHLETE_A, { kind: "delete", activityIds: [1] });
		await expectRowMatches();
		expect(JSON.parse((await storedRow())?.days ?? "")).toHaveLength(1);
	});

	it("follows a run and a swim added, edited and deleted", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [],
			runs: [runRecord(3)],
			swims: [swimRecord(4)],
		});
		await expectRowMatches();
		expect(JSON.parse((await storedRow())?.run_days ?? "")).toEqual([
			["2026-05-02", 5000.5],
		]);
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [],
			runs: [
				runRecord(3, {
					start_date_local: "2026-05-02T06:10:00Z",
					distance_m: 6000,
				}),
			],
		});
		await expectRowMatches();
		expect((await storedRow())?.active).toContain('["2026-05-02",6,0]');
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "delete",
			activityIds: [3, 4],
		});
		await expectRowMatches();
		expect((await storedRow())?.active).toBe("[]");
	});

	it("follows an activity moved between ride, run and swim", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [eveningRide(5)],
		});
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [],
			runs: [runRecord(5)],
		});
		await expectRowMatches();
		expect((await storedRow())?.days).toBe("[]");
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [],
			swims: [swimRecord(5)],
		});
		await expectRowMatches();
		expect((await storedRow())?.run_days).toBe("[]");
	});

	it("follows private rides being withdrawn", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [
				activityRecord(6),
				activityRecord(7, {
					start_date: "2026-05-08T08:00:00Z",
					is_private: 1,
				}),
			],
			runs: [runRecord(8, { is_private: 1 })],
			swims: [swimRecord(9, { is_private: 1 })],
		});
		await evaluateChange(ctx, ATHLETE_A, { kind: "delete-private" });
		await expectRowMatches();
		const row = await storedRow();
		expect(JSON.parse(row?.days ?? "")).toHaveLength(1);
		expect(row?.run_days).toBe("[]");
		expect(row?.active).not.toContain("2026-05-08");
	});

	it("follows attendance added and removed, and an event deleted", async () => {
		const rules = CURRENT_RULES;
		const eventId = await insertEvent("team_training", "2026-05-10");
		await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
		await applyTeamEventChange(
			env.DB,
			{ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] },
			rules,
			window,
			NOW,
		);
		await expectRowMatches();
		expect((await storedRow())?.attended).toBe(`[${eventId}]`);
		await applyTeamEventChange(
			env.DB,
			{ kind: "remove-attendance", eventId, athleteIds: [ATHLETE_A] },
			rules,
			window,
			NOW,
		);
		await expectRowMatches();
		expect((await storedRow())?.attended).toBe("[]");
		await applyTeamEventChange(
			env.DB,
			{ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] },
			rules,
			window,
			NOW,
		);
		await applyTeamEventChange(
			env.DB,
			{ kind: "delete-event", eventId },
			rules,
			window,
			NOW,
		);
		await expectRowMatches();
		expect((await storedRow())?.attended).toBe("[]");
	});

	it("doesn't change when an event moves, since reads use the event's own date", async () => {
		const eventId = await insertEvent("team_training", "2026-05-10");
		await attendRaw(eventId, [ATHLETE_A]);
		await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
		const before = await storedRow();
		await applyTeamEventChange(
			env.DB,
			{
				kind: "update-event",
				eventId,
				event: { kind: "team_training", date: "2026-06-10", name: null },
			},
			CURRENT_RULES,
			window,
			NOW,
		);
		expect(await storedRow()).toEqual(before);
	});

	it("doesn't change with a correction, which is read live", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [activityRecord(10)],
		});
		const before = await storedRow();
		await applyCorrectionChange(
			env.DB,
			{
				kind: "add-correction",
				athleteId: ATHLETE_A,
				correction: {
					training: 3,
					team: 0,
					reason: "Synthetic",
					date: "2026-05-12",
				},
				by: ATHLETE_B,
			},
			CURRENT_RULES,
			window,
			NOW,
		);
		expect(await storedRow()).toEqual(before);
	});

	it("follows a change of rules", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [activityRecord(11)],
		});
		const before = await storedRow();
		const rules = {
			...CURRENT_RULES,
			version: CURRENT_RULES.version + 1,
			distanceStepKm: CURRENT_RULES.distanceStepKm * 2,
		};
		await applyAndEvaluate(
			env.DB,
			ATHLETE_A,
			{ kind: "none" },
			rules,
			window,
			NOW,
		);
		await expectRowMatches();
		expect((await storedRow())?.days).not.toBe(before?.days);
	});

	it("follows older rides being purged", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [
				activityRecord(12),
				activityRecord(13, { start_date: "2025-05-01T08:00:00Z" }),
			],
			runs: [
				runRecord(14, {
					start_date: "2025-05-02T08:00:00Z",
					start_date_local: "2025-05-02T10:00:00Z",
				}),
			],
		});
		expect((await storedRow())?.active).toContain("2025-05-02");
		await purgePreSeasonActivities(ctx);
		await expectRowMatches();
		expect((await storedRow())?.active).not.toContain("2025-05-02");
	});

	it("replaces a row of another version", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [activityRecord(15)],
		});
		await env.DB.prepare(
			"UPDATE rider_summaries SET version = version - 1 WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.run();
		await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
		await expectRowMatches();
	});
});

describe("an evaluation that changes nothing (FR-004)", () => {
	const seed = () =>
		evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [eveningRide(20, 0.1), eveningRide(21, 0.2), activityRecord(22)],
			runs: [runRecord(23), runRecord(24, { distance_m: 0.7 })],
			swims: [swimRecord(25)],
		});

	it("writes no row at all", async () => {
		await seed();
		const rows = countRows(ctx);
		rows.counter.reset();
		await evaluateChange(rows.ctx, ATHLETE_A, { kind: "none" });
		expect(rows.counter.written()).toBe(0);
	});

	it("writes no row after an activity change made in a different order", async () => {
		await seed();
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "delete",
			activityIds: [20, 23],
		});
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [eveningRide(20, 0.1)],
			runs: [runRecord(23)],
		});
		await expectRowMatches();
		const rows = countRows(ctx);
		rows.counter.reset();
		await evaluateChange(rows.ctx, ATHLETE_A, { kind: "none" });
		expect(rows.counter.written()).toBe(0);
	});
});
