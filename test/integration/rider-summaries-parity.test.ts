import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { evaluateTeamBadges, type TeamBadgeSums } from "../../src/badges/team";
import { readRiderBadges } from "../../src/db/badges";
import { insertCorrectionStatement } from "../../src/db/corrections";
import { readTeam, readTeamBadgeSums } from "../../src/db/team";
import { evaluateChange } from "../../src/rynke/apply";
import { countingWindow } from "../../src/rynke/rules";
import type { RunRecord } from "../../src/strava/activity";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { countRows } from "../support/d1-rows";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import { activityRecord, attendRaw, insertEvent } from "../support/rynke";
import { CURRENT_RULES } from "../support/team-rules";

// Feature 030 US2: figures from summaries equal those from adding up the rides.
// Earned badges, dates, Rynke, elevation and counts must be exactly equal;
// distances within 0.000001 m, the floating-point noise of adding in another
// order (research R10). Synthetic riders only.

const ctx = makeCtx();
const window = countingWindow(env);
const NEEDS_RECONNECT = 900_004;
const NO_CONSENT = 900_005;
const NOTHING_STORED = 900_006;
const RIDERS = [ATHLETE_A, ATHLETE_B, ATHLETE_C];
const TOLERANCE_M = 0.000001;

let nextId = 5_000_000;

function run(athleteId: number, date: string, distance: number): RunRecord {
	return {
		strava_activity_id: ++nextId,
		athlete_id: athleteId,
		start_date: `${date}T06:00:00Z`,
		start_date_local: `${date}T07:30:00Z`,
		distance_m: distance,
		is_private: 0,
		refreshed_at: NOW,
	};
}

/** Decimal distances that don't add up exactly in binary. */
async function seedSeason(athleteId: number, seed: number): Promise<void> {
	const records = [];
	for (let day = 1; day <= 40; day++) {
		const date = new Date(Date.UTC(2026, 3, day)).toISOString().slice(0, 10);
		records.push(
			activityRecord(++nextId, {
				athlete_id: athleteId,
				start_date: `${date}T06:00:00Z`,
				start_date_local: `${date}T08:15:00Z`,
				distance_m: 30000.1 + day * 13.37 + seed * 0.7,
				moving_time_s: 3600,
				elapsed_time_s: 3600,
				elevation_gain_m: 100.3 + day,
			}),
		);
		if (day % 3 === 0) {
			// A second ride on that day.
			records.push(
				activityRecord(++nextId, {
					athlete_id: athleteId,
					start_date: `${date}T14:00:00Z`,
					start_date_local: `${date}T16:15:00Z`,
					distance_m: 20000.3 + day * 0.1,
					moving_time_s: 3600,
					elapsed_time_s: 3600,
					elevation_gain_m: 40.7,
				}),
			);
		}
		if (day % 10 === 0) {
			// Too slow to count.
			records.push(
				activityRecord(++nextId, {
					athlete_id: athleteId,
					start_date: `${date}T18:00:00Z`,
					start_date_local: `${date}T20:15:00Z`,
					distance_m: 100.5,
					moving_time_s: 7200,
					elapsed_time_s: 7200,
					elevation_gain_m: 0,
				}),
			);
		}
	}
	const runs = [
		run(athleteId, "2026-04-02", 5000.1 + seed),
		run(athleteId, "2026-04-02", 3000.2),
		run(athleteId, "2026-04-05", 10000.7),
	];
	const swims = [run(athleteId, "2026-04-06", 1500.5)];
	await evaluateChange(ctx, athleteId, {
		kind: "upsert",
		records,
		runs,
		swims,
	});
}

async function deleteRows(athleteIds: number[] = []): Promise<void> {
	await env.DB.prepare(
		athleteIds.length > 0
			? "DELETE FROM rider_summaries WHERE athlete_id IN (SELECT value FROM json_each(?))"
			: "DELETE FROM rider_summaries",
	)
		.bind(...(athleteIds.length > 0 ? [JSON.stringify(athleteIds)] : []))
		.run();
}

/** `a` and `b` are equal apart from noise in the distances. */
function expectSameSums(a: TeamBadgeSums, b: TeamBadgeSums): void {
	const withoutDistances = (sums: TeamBadgeSums) => ({
		...sums,
		riders: sums.riders.map((rider) => ({
			...rider,
			rides: rider.rides.map(({ distanceM: _, ...rest }) => rest),
		})),
		runs: sums.runs.map(({ date }) => date),
	});
	expect(withoutDistances(a)).toEqual(withoutDistances(b));
	a.riders.forEach((rider, i) => {
		rider.rides.forEach((ride, j) => {
			const other = b.riders[i]?.rides[j]?.distanceM ?? Number.NaN;
			expect(Math.abs(ride.distanceM - other)).toBeLessThan(TOLERANCE_M);
		});
	});
	a.runs.forEach((one, i) => {
		const other = b.runs[i]?.distanceM ?? Number.NaN;
		expect(Math.abs(one.distanceM - other)).toBeLessThan(TOLERANCE_M);
	});
}

function expectSameBadges(a: TeamBadgeSums, b: TeamBadgeSums): void {
	const one = evaluateTeamBadges(a, CURRENT_RULES, window);
	const two = evaluateTeamBadges(b, CURRENT_RULES, window);
	expect(one.earned).toEqual(two.earned);
	expect(one.progress.length).toBe(two.progress.length);
	one.progress.forEach((progress, i) => {
		const other = two.progress[i];
		expect(progress.category).toBe(other?.category);
		const { value, missing, ...rest } = progress;
		const {
			value: otherValue,
			missing: otherMissing,
			...others
		} = other ?? {
			value: Number.NaN,
			missing: null,
		};
		expect(rest).toEqual(others);
		expect(Math.abs(value - otherValue)).toBeLessThan(TOLERANCE_M);
		expect(Math.abs((missing ?? 0) - (otherMissing ?? 0))).toBeLessThan(
			TOLERANCE_M,
		);
	});
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A, firstName: "Cora" });
	await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "anna" });
	await seedRider(ctx, { athleteId: ATHLETE_C, firstName: "Bea" });
	await seedRider(ctx, { athleteId: NOTHING_STORED, firstName: "Dora" });
	await seedRider(ctx, {
		athleteId: NEEDS_RECONNECT,
		firstName: "Gone",
		status: "needs_reconnect",
	});
	await seedRider(ctx, {
		athleteId: NO_CONSENT,
		firstName: "Private",
		consentVersion: null,
	});
	const training = await insertEvent("team_training", "2026-04-11");
	const late = await insertEvent("team_training", "2026-04-20");
	const tour = await insertEvent("tour_de_paris", "2027-07-04");
	await attendRaw(training, [...RIDERS, NEEDS_RECONNECT, NO_CONSENT]);
	await attendRaw(late, [ATHLETE_A]);
	await attendRaw(tour, [ATHLETE_B, ATHLETE_C]);
	await insertCorrectionStatement(
		env.DB,
		ATHLETE_A,
		{ training: 7, team: -1, reason: "Synthetic", date: "2026-04-15" },
		ATHLETE_B,
		NOW,
	).run();
	await insertCorrectionStatement(
		env.DB,
		ATHLETE_A,
		{ training: 2, team: 0, reason: "Synthetic", date: "2026-04-03" },
		ATHLETE_B,
		NOW,
	).run();
	for (const [i, id] of [...RIDERS, NEEDS_RECONNECT, NO_CONSENT].entries()) {
		await seedSeason(id, i);
	}
	await evaluateChange(ctx, NOTHING_STORED, { kind: "none" });
});

describe("readTeam from summaries (US2, research R10)", () => {
	it("equals adding up, with all, some and no rows", async () => {
		const all = await readTeam(env.DB);
		expect(all.map((r) => r.firstName)).toEqual([
			"anna",
			"Bea",
			"Cora",
			"Dora",
		]);
		expect(all[2]?.rides.length).toBeGreaterThan(0);
		await deleteRows([ATHLETE_B]);
		expect(await readTeam(env.DB)).toEqual(all);
		await deleteRows();
		expect(await readTeam(env.DB)).toEqual(all);
	});

	it("counts a rider below the lowest version by adding up", async () => {
		const all = await readTeam(env.DB);
		await env.DB.prepare(
			"UPDATE rider_summaries SET version = 0, weeks = '[]', attended = '[]' WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.run();
		expect(await readTeam(env.DB)).toEqual(all);
	});

	it("never selects a rider's daily figures (FR-008)", async () => {
		const { ctx: counted, counter } = countRows(ctx);
		await readTeam(counted.env.DB);
		const sql = counter.statements().join("\n");
		expect(sql).toContain("s.weeks");
		expect(sql).not.toMatch(/\bs\.(days|run_days|active)\b/);
		expect(sql).not.toMatch(/\bs\.\*/);
	});

	it("makes one round trip with every row present, and two without", async () => {
		const trips = async () => {
			const { ctx: counted, counter } = countRows(ctx);
			await readTeam(counted.env.DB);
			return counter.statements().length;
		};
		expect(await trips()).toBe(2);
		await deleteRows([ATHLETE_B]);
		expect(await trips()).toBe(4);
	});
});

describe("team badges from summaries (US2, research R10)", () => {
	it("equal adding up, with all, some and no rows", async () => {
		const all = await readTeamBadgeSums(env.DB);
		expect(all.riders.length).toBe(3);
		expect(evaluateTeamBadges(all, CURRENT_RULES, window).earned).not.toEqual(
			[],
		);
		await deleteRows([ATHLETE_B]);
		const some = await readTeamBadgeSums(env.DB);
		expectSameSums(some, all);
		expectSameBadges(some, all);
		await deleteRows();
		const none = await readTeamBadgeSums(env.DB);
		expectSameSums(none, all);
		expectSameBadges(none, all);
	});

	it("count each rider once with some rows", async () => {
		await deleteRows([ATHLETE_C]);
		const { riders, connectedOn } = await readTeamBadgeSums(env.DB);
		expect(riders.length).toBe(3);
		expect(connectedOn?.size).toBe(4);
	});
});

describe("edge cases (US2)", () => {
	it("counts a deleted event named in a row for nothing", async () => {
		const { results } = await env.DB.prepare(
			"SELECT event_id FROM team_events WHERE event_date = '2026-04-20'",
		).all<{ event_id: number }>();
		const eventId = results[0]?.event_id as number;
		// Removed by hand, so the row still names it.
		await env.DB.prepare("DELETE FROM team_events WHERE event_id = ?")
			.bind(eventId)
			.run();
		const stored = await env.DB.prepare(
			"SELECT attended FROM rider_summaries WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.first<string>("attended");
		expect(JSON.parse(stored ?? "")).toContain(eventId);
		const team = await readTeam(env.DB);
		const cora = team.find((r) => r.athleteId === ATHLETE_A);
		expect(cora?.attendance.map((a) => a.eventId)).not.toContain(eventId);
		const sums = await readTeamBadgeSums(env.DB);
		expect(sums.events.map((e) => e.eventId)).not.toContain(eventId);
		for (const rider of sums.riders) {
			expect(rider.attendance.map((a) => a.eventId)).not.toContain(eventId);
		}
	});

	it("uses a moved event's current date and kind", async () => {
		await env.DB.prepare(
			"UPDATE team_events SET event_date = '2026-05-30', kind = 'tour_de_paris' WHERE event_date = '2026-04-20'",
		).run();
		const team = await readTeam(env.DB);
		const cora = team.find((r) => r.athleteId === ATHLETE_A);
		expect(cora?.attendance.at(-1)).toMatchObject({
			kind: "tour_de_paris",
			date: "2026-05-30",
		});
		const { events } = await readTeamBadgeSums(env.DB);
		expect(events.at(-2)).toMatchObject({
			kind: "tour_de_paris",
			date: "2026-05-30",
			attendees: 1,
		});
	});

	it("orders attendance by date then event, whatever the IDs' order", async () => {
		const early = await insertEvent("team_training", "2026-04-01");
		await attendRaw(early, [ATHLETE_A]);
		await evaluateChange(ctx, ATHLETE_A, { kind: "none" });
		const fromRows = await readTeamBadgeSums(env.DB);
		await deleteRows();
		const addedUp = await readTeamBadgeSums(env.DB);
		expect(fromRows.riders.map((r) => r.attendance)).toEqual(
			addedUp.riders.map((r) => r.attendance),
		);
		expect(fromRows.riders[0]?.attendance[0]?.eventId).toBe(early);
	});

	it("keeps riders without consent or a connection out, though they have rows", async () => {
		const stored = await env.DB.prepare(
			"SELECT count(*) AS n FROM rider_summaries",
		).first<number>("n");
		expect(stored).toBe(6);
		const team = await readTeam(env.DB);
		const ids = team.map((r) => r.athleteId);
		expect(ids).not.toContain(NEEDS_RECONNECT);
		expect(ids).not.toContain(NO_CONSENT);
		const sums = await readTeamBadgeSums(env.DB);
		expect([...(sums.connectedOn?.keys() ?? [])]).not.toContain(NO_CONSENT);
		expect([...(sums.connectedOn?.keys() ?? [])]).not.toContain(
			NEEDS_RECONNECT,
		);
		expect((sums.active ?? []).map((a) => a.athleteId)).not.toContain(
			NO_CONSENT,
		);
		// Three listed attendees, of five who attended.
		expect(sums.events[0]?.attendees).toBe(3);
	});

	it("leaves a rider with nothing stored out of riders, but not out of connectedOn", async () => {
		const sums = await readTeamBadgeSums(env.DB);
		expect(sums.riders.length).toBe(3);
		expect(sums.connectedOn?.has(NOTHING_STORED)).toBe(true);
	});
});

describe("the rider's own Badges figures from their row (organiser graphs)", () => {
	const figures = async () => {
		const read = await readRiderBadges(env.DB, ATHLETE_A, window);
		return {
			exact: {
				earned: read.earned,
				elevationDm: read.elevationDm,
				winterDays: read.winterDays,
				longestRunM: read.longestRunM,
				runDistanceM: read.runDistanceM,
				longestSwimM: read.longestSwimM,
				swimDistanceM: read.swimDistanceM,
			},
			distances: [
				read.distanceM,
				read.longestRideM,
				read.virtualDistanceM,
			] as const,
		};
	};
	/** At 25 km/h, so that it counts. */
	const ride = (
		date: string,
		distance: number,
		overrides: Record<string, unknown> = {},
	) => {
		const time = Math.round((distance / 25000) * 3600);
		return activityRecord(++nextId, {
			athlete_id: ATHLETE_A,
			start_date: `${date}T06:00:00Z`,
			start_date_local: `${date}T08:15:00Z`,
			distance_m: distance,
			moving_time_s: time,
			elapsed_time_s: time,
			elevation_gain_m: 90.3,
			...overrides,
		});
	};

	it("equal the statements on decimal distances, without rides after the deadline", async () => {
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [
				// Virtual only, in January: a virtual day, no outdoor day.
				ride("2026-01-10", 25000.7, { sport_type: "VirtualRide" }),
				// Virtual and outdoor on one day: one outdoor day, in February.
				ride("2026-02-14", 31000.3, { sport_type: "VirtualRide" }),
				ride("2026-02-14", 12000.9, {
					start_date: "2026-02-14T13:00:00Z",
					start_date_local: "2026-02-14T15:15:00Z",
				}),
				ride("2026-02-15", 80000.1),
				// After the deadline, the longest of all: the figures leave it out.
				ride("2027-07-02", 200000.5),
			],
		});
		const fromRow = await figures();
		expect(fromRow.distances[2]).toBeGreaterThan(0);
		expect(fromRow.exact.winterDays[1]).toBeUndefined();
		expect(fromRow.exact.winterDays[2]).toBe(2);
		await deleteRows();
		const fromStatements = await figures();
		expect(fromRow.exact).toEqual(fromStatements.exact);
		fromRow.distances.forEach((distance, i) => {
			const other = fromStatements.distances[i] ?? Number.NaN;
			expect(Math.abs(distance - other)).toBeLessThan(TOLERANCE_M);
		});
		expect(fromRow.distances[1]).toBe(80000.1);
	});

	it("read no ride with a current row, and add up without one or below it", async () => {
		const rideReads = async () => {
			const { ctx: counted, counter } = countRows(ctx);
			await readRiderBadges(counted.env.DB, ATHLETE_A, window);
			return counter.statements().filter((sql) => sql.includes("ride_results"));
		};
		expect(await rideReads()).toEqual([]);
		await env.DB.prepare("UPDATE rider_summaries SET version = 1").run();
		expect(await rideReads()).toHaveLength(2);
		await deleteRows();
		expect(await rideReads()).toHaveLength(2);
	});
});
