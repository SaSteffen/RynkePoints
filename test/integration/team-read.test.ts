import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { insertCorrectionStatement } from "../../src/db/corrections";
import { readTeam, readTeamBadgeSums } from "../../src/db/team";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import { seedBalance, seedRide } from "../support/rider-view";
import { attendRaw, insertEvent } from "../support/rynke";

// The one read batch behind the Team page and the organiser overview (016
// data-model.md "Read per request", research R2, R7). Synthetic riders only.

const ctx = makeCtx();
const LISTED = ATHLETE_A;
const NO_CONSENT = ATHLETE_B;
const NEEDS_RECONNECT = ATHLETE_C;
const WITHOUT_BALANCE = 900004;

async function seedRiderRows(athleteId: number, firstRideId: number) {
	await seedBalance(athleteId, { trainingRynke: 9, teamRynke: 1 });
	// Monday and Sunday of one week, then the next Monday.
	await seedRide(athleteId, {
		id: firstRideId,
		start_date: "2026-09-07T08:00:00Z",
		result: { counts: true, distanceRynke: 4, elevationDm: 3000 },
	});
	await seedRide(athleteId, {
		id: firstRideId + 1,
		start_date: "2026-09-13T18:00:00Z",
		result: { counts: true, distanceRynke: 5, elevationDm: 4500 },
	});
	await seedRide(athleteId, {
		id: firstRideId + 2,
		start_date: "2026-09-14T08:00:00Z",
		result: { counts: true, distanceRynke: 2, elevationDm: 100 },
	});
	// Not counting: left out.
	await seedRide(athleteId, {
		id: firstRideId + 3,
		start_date: "2026-09-08T08:00:00Z",
		result: { counts: false, reasons: ["too_slow"] },
	});
	await insertCorrectionStatement(
		env.DB,
		athleteId,
		{ training: 3, team: -1, reason: "Synthetic fix", date: "2026-09-12" },
		athleteId,
		NOW,
	).run();
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: LISTED, firstName: "Anna" });
	await seedRider(ctx, { athleteId: WITHOUT_BALANCE, firstName: "Bea" });
	await seedRider(ctx, { athleteId: NO_CONSENT, consentVersion: null });
	await seedRider(ctx, {
		athleteId: NEEDS_RECONNECT,
		status: "needs_reconnect",
	});
	await seedRiderRows(LISTED, 8_100_001);
	await seedRiderRows(NO_CONSENT, 8_200_001);
	await seedRiderRows(NEEDS_RECONNECT, 8_300_001);
	await attendRaw(await insertEvent("team_training", "2026-09-10"), [
		LISTED,
		NO_CONSENT,
		NEEDS_RECONNECT,
	]);
});

describe("readTeam", () => {
	it("returns the listed riders only, by first name", async () => {
		const riders = await readTeam(env.DB);
		expect(riders.map((r) => [r.athleteId, r.firstName])).toEqual([
			[LISTED, "Anna"],
			[WITHOUT_BALANCE, "Bea"],
		]);
	});

	it("returns each listed rider's balance, or null without one", async () => {
		const [anna, bea] = await readTeam(env.DB);
		expect(anna?.balance).toMatchObject({ trainingRynke: 9, teamRynke: 1 });
		expect(bea?.balance).toBeNull();
	});

	it("sums counting rides per week ending on Sunday, elevation unfloored", async () => {
		const [anna, bea] = await readTeam(env.DB);
		expect(anna?.rides).toEqual([
			{ weekEnd: "2026-09-13", distanceRynke: 9, elevationDm: 7500 },
			{ weekEnd: "2026-09-20", distanceRynke: 2, elevationDm: 100 },
		]);
		expect(bea?.rides).toEqual([]);
	});

	it("returns attendance with the event's kind and date", async () => {
		const [anna] = await readTeam(env.DB);
		expect(anna?.attendance).toEqual([
			{
				eventId: expect.any(Number),
				kind: "team_training",
				date: "2026-09-10",
			},
		]);
	});

	it("returns corrections with their date", async () => {
		const [anna, bea] = await readTeam(env.DB);
		expect(anna?.corrections).toEqual([
			{ date: "2026-09-12", training: 3, team: -1 },
		]);
		expect(bea?.corrections).toEqual([]);
	});

	it("returns nothing when nobody is listed", async () => {
		await resetDb();
		expect(await readTeam(env.DB)).toEqual([]);
	});
});

describe("readTeamBadgeSums (feature 013 R15)", () => {
	it("sums the listed riders' counting rides per day, without ids", async () => {
		const { riders } = await readTeamBadgeSums(env.DB);
		expect(riders).toEqual([
			{
				rides: [
					{
						date: "2026-09-07",
						distanceM: 40000,
						distanceRynke: 4,
						elevationDm: 3000,
					},
					{
						date: "2026-09-13",
						distanceM: 40000,
						distanceRynke: 5,
						elevationDm: 4500,
					},
					{
						date: "2026-09-14",
						distanceM: 40000,
						distanceRynke: 2,
						elevationDm: 100,
					},
				],
				attendance: [
					{
						eventId: expect.any(Number),
						kind: "team_training",
						date: "2026-09-10",
					},
				],
				corrections: [{ date: "2026-09-12", training: 3, team: -1 }],
			},
		]);
	});

	it("counts only listed attendees per event (US4 scenario 4)", async () => {
		const { events } = await readTeamBadgeSums(env.DB);
		expect(events).toEqual([
			{ eventId: expect.any(Number), date: "2026-09-10", attendees: 1 },
		]);
	});

	it("sums the listed riders' runs per day", async () => {
		await env.DB.batch(
			[
				[8_500_001, LISTED, "2026-09-05T08:00:00Z", 7800],
				[8_500_002, WITHOUT_BALANCE, "2026-09-05T18:00:00Z", 4600],
				[8_500_003, NO_CONSENT, "2026-09-05T08:00:00Z", 21000],
			].map(([id, athleteId, start, distance]) =>
				env.DB.prepare(
					`INSERT INTO runs (strava_activity_id, athlete_id, start_date,
						start_date_local, distance_m, is_private, refreshed_at)
					VALUES (?1, ?2, ?3, ?3, ?4, 0, ?5)`,
				).bind(id, athleteId, start, distance, NOW),
			),
		);
		const { runs } = await readTeamBadgeSums(env.DB);
		expect(runs).toEqual([{ date: "2026-09-05", distanceM: 12400 }]);
	});

	it("returns nothing when nobody is listed", async () => {
		await resetDb();
		expect(await readTeamBadgeSums(env.DB)).toEqual({
			riders: [],
			runs: [],
			events: [],
		});
	});
});
