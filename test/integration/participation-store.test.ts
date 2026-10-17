import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
	countIntentsStatement,
	deleteReportsStatement,
	insertReportStatement,
	type IntentCountRow,
	listEventReportsStatement,
	listOpenRequestsStatement,
	listRiderEventsStatement,
	openRequestCountStatement,
	type OpenRequestRow,
	type RiderEventRow,
} from "../../src/db/participation";
import { countingWindow } from "../../src/rynke/rules";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import { attendRaw, insertEvent } from "../support/rynke";

// Participation reports in D1 (feature 019 data-model.md, research R1, R7).
// The clock says 2026-10-06; the test window runs 2026-01-01 to 2027-06-30.
// Synthetic riders and events only.

const db = env.DB;
const ctx = makeCtx();
const W = countingWindow(env);
const TODAY = "2026-10-06";
const RECONNECT = 900005;

async function report(eventId: number, athleteId: number, at = NOW) {
	await insertReportStatement(db, eventId, athleteId, at).run();
}

async function reports() {
	const { results } = await db
		.prepare(
			"SELECT event_id, athlete_id, reported_at FROM participation_reports ORDER BY event_id, athlete_id",
		)
		.all<{ event_id: number; athlete_id: number; reported_at: number }>();
	return results;
}

async function openCount(): Promise<number> {
	return (
		(await openRequestCountStatement(db, TODAY, W).first<number>("n")) ?? 0
	);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A, firstName: "Katrin" });
	await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Emil" });
	await seedRider(ctx, { athleteId: ATHLETE_C, firstName: "Nora" });
	await seedRider(ctx, {
		athleteId: RECONNECT,
		firstName: "Ida",
		status: "needs_reconnect",
	});
});

describe("participation_reports", () => {
	it("keeps one report per rider and event", async () => {
		const event = await insertEvent("team_training", "2026-10-01");
		await report(event, ATHLETE_A, NOW);
		await report(event, ATHLETE_A, NOW + 60);
		expect(await reports()).toEqual([
			{ event_id: event, athlete_id: ATHLETE_A, reported_at: NOW },
		]);
	});

	it("goes with its event and with its rider (FR-022)", async () => {
		const first = await insertEvent("team_training", "2026-10-01");
		const second = await insertEvent("team_training", "2026-10-03");
		await report(first, ATHLETE_A);
		await report(second, ATHLETE_A);
		await report(second, ATHLETE_B);
		await db
			.prepare("DELETE FROM team_events WHERE event_id = ?")
			.bind(first)
			.run();
		await db
			.prepare("DELETE FROM riders WHERE athlete_id = ?")
			.bind(ATHLETE_A)
			.run();
		expect(await reports()).toEqual([
			{ event_id: second, athlete_id: ATHLETE_B, reported_at: NOW },
		]);
	});

	it("deletes the reports of the given riders only", async () => {
		const event = await insertEvent("team_training", "2026-10-01");
		await report(event, ATHLETE_A);
		await report(event, ATHLETE_B);
		await deleteReportsStatement(db, event, [ATHLETE_A, ATHLETE_C]).run();
		expect((await reports()).map((r) => r.athlete_id)).toEqual([ATHLETE_B]);
	});
});

describe("open requests (research R7)", () => {
	it("count reports at events on or before today, of listed riders, without attendance", async () => {
		const today = await insertEvent("team_training", TODAY);
		const past = await insertEvent("technique_training", "2026-09-12");
		const future = await insertEvent("team_training", "2026-10-10");
		const outside = await insertEvent("team_training", "2025-12-31");
		await report(today, ATHLETE_A);
		await report(past, ATHLETE_A);
		await report(past, ATHLETE_B);
		await report(past, RECONNECT); // not listed
		await report(future, ATHLETE_C); // an intent
		await report(outside, ATHLETE_C); // outside the counting window
		await attendRaw(past, [ATHLETE_B]); // attended after all
		expect(await openCount()).toBe(2);
	});

	it("list event, rider and first name, newest event first, then by name", async () => {
		const older = await insertEvent(
			"team_training",
			"2026-09-05",
			"Hafenrunde",
		);
		const newer = await insertEvent("technique_training", "2026-09-12");
		await report(older, ATHLETE_C, NOW - 10);
		await report(newer, ATHLETE_C, NOW - 5);
		await report(newer, ATHLETE_A, NOW - 1);
		await report(newer, ATHLETE_B, NOW - 2);
		const { results } = await listOpenRequestsStatement(
			db,
			TODAY,
			W,
		).all<OpenRequestRow>();
		expect(
			results.map((r) => [r.event_id, r.first_name, r.reported_at]),
		).toEqual([
			[newer, "Emil", NOW - 2],
			[newer, "Katrin", NOW - 1],
			[newer, "Nora", NOW - 5],
			[older, "Nora", NOW - 10],
		]);
		expect(results.at(-1)).toMatchObject({
			kind: "team_training",
			event_date: "2026-09-05",
			name: "Hafenrunde",
			athlete_id: ATHLETE_C,
		});
	});

	it("leave intents out and count them per upcoming event (FR-033)", async () => {
		const soon = await insertEvent("team_training", "2026-10-10");
		const later = await insertEvent("team_training", "2026-10-17");
		const past = await insertEvent("team_training", "2026-10-01");
		await report(soon, ATHLETE_A);
		await report(soon, ATHLETE_B);
		await report(soon, RECONNECT);
		await report(later, ATHLETE_C);
		await report(past, ATHLETE_C);
		const { results } = await countIntentsStatement(
			db,
			TODAY,
			W,
		).all<IntentCountRow>();
		expect(
			results
				.map((r) => [r.event_id, r.intents])
				.sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0)),
		).toEqual([
			[soon, 2],
			[later, 1],
		]);
	});

	it("list one event's counted reports", async () => {
		const event = await insertEvent("team_training", "2026-10-01");
		await report(event, ATHLETE_A);
		await report(event, ATHLETE_B);
		await report(event, RECONNECT);
		await attendRaw(event, [ATHLETE_B]);
		const { results } = await listEventReportsStatement(db, event).all<{
			athlete_id: number;
		}>();
		expect(results.map((r) => r.athlete_id)).toEqual([ATHLETE_A]);
	});
});

describe("listRiderEventsStatement (FR-001–FR-006)", () => {
	it("lists the counting window's events, oldest first, with the rider's attendance and report", async () => {
		const outside = await insertEvent("team_training", "2025-12-31");
		const attended = await insertEvent("team_training", "2026-09-05");
		const reported = await insertEvent("technique_training", "2026-10-10");
		const other = await insertEvent("team_training", "2026-10-17");
		await attendRaw(attended, [ATHLETE_A]);
		await report(reported, ATHLETE_A);
		await report(other, ATHLETE_B);
		const { results } = await listRiderEventsStatement(
			db,
			ATHLETE_A,
			W,
		).all<RiderEventRow>();
		expect(results.map((r) => [r.event_id, r.attended, r.reported])).toEqual([
			[attended, 1, 0],
			[reported, 0, 1],
			[other, 0, 0],
		]);
		expect(results.map((r) => r.event_id)).not.toContain(outside);
	});
});
