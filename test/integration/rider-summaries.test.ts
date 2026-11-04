import { createScheduledController, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import type { RiderSummaryRow } from "../../src/db/rider-summaries";
import {
	deleteRider,
	insertRider,
	markNeedsReconnect,
} from "../../src/db/riders";
import { readTeam, readTeamBadgeSums } from "../../src/db/team";
import { handleScheduled } from "../../src/index";
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
import { makeCtx, resetDb, seedRider, tableCounts } from "../support/ctx";
import { countRows } from "../support/d1-rows";
import { countTrips } from "../support/d1-trips";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import { riderPage, seedEmptySummary } from "../support/rider-view";
import { activityRecord, attendRaw, insertEvent } from "../support/rynke";

// Feature 030 US3: every change leaves a rider's row matching their stored data,
// in the same batch. Synthetic riders only.

let ctx = makeCtx();
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
		`SELECT a.start_date_local, a.distance_m, r.distance_rynke, r.elevation_dm,
			r.is_virtual
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
			is_virtual: 0 | 1;
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
				virtual: row.is_virtual === 1,
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
		virtual_days: summary.virtualDays,
		own_days: summary.ownDays,
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
	ctx = makeCtx();
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
			virtual_days: "[]",
			own_days: "[]",
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

describe("leaving and withdrawing take effect at once (US4)", () => {
	const seedBoth = async () => {
		const eventId = await insertEvent("team_training", "2026-05-10");
		await attendRaw(eventId, [ATHLETE_A, ATHLETE_B]);
		for (const athleteId of [ATHLETE_A, ATHLETE_B]) {
			await evaluateChange(ctx, athleteId, {
				kind: "upsert",
				records: [
					activityRecord(athleteId, {
						athlete_id: athleteId,
						distance_m: 40000.5,
					}),
				],
				runs: [
					runRecord(athleteId + 1, {
						athlete_id: athleteId,
						distance_m: 5000,
					}),
				],
			});
		}
	};
	const expectOnlyA = async () => {
		expect((await readTeam(env.DB)).map((r) => r.athleteId)).toEqual([
			ATHLETE_A,
		]);
		const sums = await readTeamBadgeSums(env.DB);
		expect(sums.riders).toHaveLength(1);
		expect(sums.riders[0]?.rides[0]?.distanceM).toBe(40000.5);
		expect(sums.runs).toEqual([{ date: "2026-05-02", distanceM: 5000 }]);
		expect(sums.events[0]?.attendees).toBe(1);
		expect([...(sums.connectedOn?.keys() ?? [])]).toEqual([ATHLETE_A]);
		expect(new Set((sums.active ?? []).map((a) => a.athleteId))).toEqual(
			new Set([ATHLETE_A]),
		);
		const page = await riderPage(ctx, ATHLETE_A, "/team");
		expect(page.status).toBe(200);
		expect(page.html).not.toContain("Testrider B");
	};

	it("deletes the row with the rider, and the figures fall", async () => {
		await seedBoth();
		expect((await tableCounts()).rider_summaries).toBe(2);
		await deleteRider(env.DB, ATHLETE_B);
		expect((await tableCounts()).rider_summaries).toBe(1);
		await expectOnlyA();
	});

	it("keeps a rider who needs to reconnect out of the figures, then lets them back", async () => {
		await seedBoth();
		const all = await readTeamBadgeSums(env.DB);
		expect(all.riders).toHaveLength(2);
		await markNeedsReconnect(env.DB, ATHLETE_B, NOW);
		await expectOnlyA();
		expect(await storedRow(ATHLETE_B)).not.toBeNull();
		await env.DB.prepare(
			"UPDATE riders SET status = 'connected', reconnect_requested_at = NULL WHERE athlete_id = ?",
		)
			.bind(ATHLETE_B)
			.run();
		expect(await readTeamBadgeSums(env.DB)).toEqual(all);
	});

	it("keeps a rider without consent out of the figures, though their row stays", async () => {
		await seedBoth();
		await env.DB.prepare("DELETE FROM consent_records WHERE athlete_id = ?")
			.bind(ATHLETE_B)
			.run();
		await expectOnlyA();
		expect(await storedRow(ATHLETE_B)).not.toBeNull();
	});

	it("shows the same pages from rows as from adding up", async () => {
		await seedBoth();
		const pages = async () => ({
			// Without the quote, which changes with each view.
			team: (await riderPage(ctx, ATHLETE_A, "/team")).html.replace(
				/<div class="quote-monkey">[\s\S]*?<\/blockquote>/,
				"",
			),
			badges: (await riderPage(ctx, ATHLETE_A, "/me/badges")).html,
		});
		// A first view marks what it marks; compare the views after it.
		await pages();
		const fromRows = await pages();
		await env.DB.prepare("DELETE FROM rider_summaries").run();
		expect(await pages()).toEqual(fromRows);
	});
});

describe("the release is invisible (US5)", () => {
	const daily = () =>
		handleScheduled(
			createScheduledController({
				scheduledTime: new Date(NOW * 1000),
				cron: "17 3 * * *",
			}),
			ctx,
		);
	const evaluationsSent = () =>
		ctx.queue.sent
			.map((m) => m.body)
			.filter((b) => b.kind === "evaluate-rider");

	it("gives a rider through insertRider a current empty row, and no second round trip", async () => {
		const NEW = 900_010;
		await insertRider(
			env.DB,
			{
				athleteId: NEW,
				firstName: "Neu",
				scopes: "read,activity:read",
				scopeReadAll: false,
				scopeWrite: false,
				now: NOW,
			},
			{ version: 1, acceptedAt: NOW },
		);
		expect(await storedRow(NEW)).toEqual({
			athlete_id: NEW,
			version: RIDER_SUMMARY_VERSION,
			days: "[]",
			weeks: "[]",
			run_days: "[]",
			active: "[]",
			attended: "[]",
			virtual_days: "[]",
			own_days: "[]",
		});
		await seedEmptySummary(ATHLETE_A);
		await seedEmptySummary(ATHLETE_B);
		const { ctx: counted, counter } = countTrips(ctx);
		counter.reset();
		await readTeam(counted.env.DB);
		await readTeamBadgeSums(counted.env.DB);
		expect(counter.trips()).toBe(2);
	});

	it("fills rows through the daily job, with nothing else written and nothing sent", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [activityRecord(30)],
		});
		await evaluateChange(ctx, ATHLETE_B, { kind: "none" });
		// As after the release: everything stored except the rows.
		await env.DB.prepare("DELETE FROM rider_summaries").run();
		const before = await tableCounts();
		const rises = () =>
			env.DB.prepare("SELECT count(*) AS n FROM badge_rises").first<number>(
				"n",
			);
		const risesBefore = await rises();
		const balance = await env.DB.prepare(
			"SELECT * FROM rynke_balances WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.first();
		await daily();
		expect(evaluationsSent()).toEqual([
			{ kind: "evaluate-rider", athleteId: ATHLETE_A },
			{ kind: "evaluate-rider", athleteId: ATHLETE_B },
		]);
		const rows = countRows(ctx);
		rows.counter.reset();
		const result = await evaluateChange(rows.ctx, ATHLETE_A, { kind: "none" });
		expect(rows.counter.written()).toBe(1);
		expect(result).toEqual({
			rose: false,
			badges: [],
			figuresChanged: false,
		});
		await evaluateChange(ctx, ATHLETE_B, { kind: "none" });
		await expectRowMatches(ATHLETE_A);
		expect(
			await env.DB.prepare("SELECT * FROM rynke_balances WHERE athlete_id = ?")
				.bind(ATHLETE_A)
				.first(),
		).toEqual(balance);
		expect(await tableCounts()).toEqual({ ...before, rider_summaries: 2 });
		expect(await rises()).toBe(risesBefore);
		// A second run lists nobody.
		ctx.queue.sent.length = 0;
		await daily();
		expect(evaluationsSent()).toEqual([]);
	});
});

describe("a new format costs no costly day (organiser graphs, research R14)", () => {
	/** As after the migration: rows of version 1, without the new columns. */
	const toVersionOne = () =>
		env.DB.prepare(
			"UPDATE rider_summaries SET version = 1, virtual_days = '[]', own_days = '[]'",
		).run();

	beforeEach(async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [activityRecord(40)],
		});
		await evaluateChange(ctx, ATHLETE_B, { kind: "none" });
	});

	it("lets team reads use a version 1 row without adding up", async () => {
		const fromRows = await readTeam(env.DB);
		const sumsFromRows = await readTeamBadgeSums(env.DB);
		await toVersionOne();
		const { ctx: counted, counter } = countTrips(ctx);
		counter.reset();
		expect(await readTeam(counted.env.DB)).toEqual(fromRows);
		expect(await readTeamBadgeSums(counted.env.DB)).toEqual(sumsFromRows);
		expect(counter.trips()).toBe(2);
	});

	it("adds up a rider whose row is below the lowest version", async () => {
		const fromRows = await readTeam(env.DB);
		await env.DB.prepare(
			"UPDATE rider_summaries SET version = 0, weeks = '[]', attended = '[]' WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.run();
		const { ctx: counted, counter } = countTrips(ctx);
		counter.reset();
		expect(await readTeam(counted.env.DB)).toEqual(fromRows);
		expect(counter.trips()).toBe(2);
	});

	it("raises a version 1 row with one write, no rise and no notification", async () => {
		await toVersionOne();
		const sentBefore = ctx.queue.sent.length;
		const balance = () =>
			env.DB.prepare("SELECT * FROM rynke_balances WHERE athlete_id = ?")
				.bind(ATHLETE_A)
				.first();
		const before = await balance();
		const rows = countRows(ctx);
		rows.counter.reset();
		const result = await evaluateChange(rows.ctx, ATHLETE_A, { kind: "none" });
		expect(rows.counter.written()).toBe(1);
		expect(result).toEqual({
			rose: false,
			badges: [],
			figuresChanged: false,
		});
		await expectRowMatches();
		expect(await balance()).toEqual(before);
		expect(ctx.queue.sent.length).toBe(sentBefore);
		rows.counter.reset();
		await evaluateChange(rows.ctx, ATHLETE_A, { kind: "none" });
		expect(rows.counter.written()).toBe(0);
	});

	it("has the daily job find version 1 rows, and then none", async () => {
		await toVersionOne();
		const daily = () =>
			handleScheduled(
				createScheduledController({
					scheduledTime: new Date(NOW * 1000),
					cron: "17 3 * * *",
				}),
				ctx,
			);
		const sent = () =>
			ctx.queue.sent
				.map((m) => m.body)
				.filter((b) => b.kind === "evaluate-rider");
		ctx.queue.sent.length = 0;
		await daily();
		expect(sent()).toEqual([
			{ kind: "evaluate-rider", athleteId: ATHLETE_A },
			{ kind: "evaluate-rider", athleteId: ATHLETE_B },
		]);
		await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
		await evaluateChange(ctx, ATHLETE_B, { kind: "none" });
		ctx.queue.sent.length = 0;
		await daily();
		expect(sent()).toEqual([]);
	});
});
