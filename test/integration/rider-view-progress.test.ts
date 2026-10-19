import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	readRiderView,
	riderStandingStatements,
	toRiderStanding,
} from "../../src/db/rider-view";
import { readSeen, writeSeen } from "../../src/db/rynke-seen";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { EXAMPLE_INPUTS, seedExampleRider } from "../support/progress";
import { seedBalance, seedRide } from "../support/rider-view";

// What the Overview reads for the progress section (feature 009 data-model.md
// "What is read", research R3): the daily ride sums and the corrections, in
// the same batch as the rest.

const ctx = makeCtx();

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
	await seedExampleRider(ATHLETE_A);
	// Rider B: a virtual and an outdoor ride on one day, a non-counting one,
	// and a correction of its own.
	await seedRide(ATHLETE_B, {
		id: 7_200_001,
		start_date: "2026-09-10T07:00:00Z",
		start_date_local: "2026-09-10T09:00:00Z",
		result: { counts: true, distanceRynke: 3, elevationDm: 100 },
	});
	await seedRide(ATHLETE_B, {
		id: 7_200_002,
		start_date: "2026-09-10T17:00:00Z",
		start_date_local: "2026-09-10T19:00:00Z",
		result: {
			counts: true,
			distanceRynke: 4,
			elevationDm: 0,
			isVirtual: true,
		},
	});
	await seedRide(ATHLETE_B, {
		id: 7_200_003,
		start_date: "2026-09-11T07:00:00Z",
		start_date_local: "2026-09-11T09:00:00Z",
		result: { counts: false, reasons: ["too_slow"], distanceRynke: 0 },
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("readRiderView with progress (feature 009)", () => {
	it("reads the example rider's daily rides, attendance and correction", async () => {
		const read = await readRiderView(env.DB, ATHLETE_A, 1, { progress: true });
		expect(read.progress?.rides).toEqual(EXAMPLE_INPUTS.rides);
		expect(read.progress?.corrections).toEqual([
			{ date: "2026-10-04", training: 10, team: 0 },
		]);
		expect(
			read.progress?.attendance.map(({ kind, date }) => ({ kind, date })),
		).toEqual(
			[...EXAMPLE_INPUTS.attendance]
				.reverse()
				.map(({ kind, date }) => ({ kind, date })),
		);
	});

	it("sums each day by kind and reads only the rider's own rows", async () => {
		const read = await readRiderView(env.DB, ATHLETE_B, 1, { progress: true });
		expect(read.progress).toEqual({
			rides: [
				{
					date: "2026-09-10",
					virtual: false,
					distanceRynke: 3,
					elevationDm: 100,
				},
				{
					date: "2026-09-10",
					virtual: true,
					distanceRynke: 4,
					elevationDm: 0,
				},
			],
			attendance: [],
			corrections: [],
		});
	});

	it("reads nothing more without the option", async () => {
		const read = await readRiderView(env.DB, ATHLETE_A, 1);
		expect(read.progress).toBeUndefined();
	});

	it("runs everything in one batch", async () => {
		const batch = vi.spyOn(env.DB, "batch");
		await readRiderView(env.DB, ATHLETE_A, 1, { progress: true });
		expect(batch).toHaveBeenCalledTimes(1);
	});
});

describe("readRiderView with the seen Rynke (#184)", () => {
	it("reads them in the same batch, null before the first visit", async () => {
		const batch = vi.spyOn(env.DB, "batch");
		const first = await readRiderView(env.DB, ATHLETE_A, 1, {
			progress: true,
			seen: true,
		});
		expect(first.seen).toBeNull();
		await writeSeen(env.DB, ATHLETE_A, { training: 12, team: 3 });
		const read = await readRiderView(env.DB, ATHLETE_A, 1, {
			progress: true,
			seen: true,
		});
		expect(read.seen).toEqual(await readSeen(env.DB, ATHLETE_A));
		expect(read.seen).toEqual({ training: 12, team: 3 });
		expect(read.progress).toBeDefined();
		expect(batch).toHaveBeenCalledTimes(2);
	});

	it("reads nothing of them without the option", async () => {
		await writeSeen(env.DB, ATHLETE_A, { training: 12, team: 3 });
		const read = await readRiderView(env.DB, ATHLETE_A, 1, { seen: false });
		expect(read).not.toHaveProperty("seen");
	});
});

describe("riderStandingStatements (#185)", () => {
	it("reads the balance and the virtual ride count as the rider view does", async () => {
		for (const athleteId of [ATHLETE_A, ATHLETE_B]) {
			const view = await readRiderView(env.DB, athleteId, 1);
			const standing = toRiderStanding(
				await env.DB.batch(riderStandingStatements(env.DB, athleteId)),
			);
			expect(standing).toEqual({
				balance: view.balance,
				virtualCount: view.virtualCount,
			});
		}
		await seedBalance(ATHLETE_B);
		const standing = toRiderStanding(
			await env.DB.batch(riderStandingStatements(env.DB, ATHLETE_B)),
		);
		expect(standing.balance).not.toBeNull();
		expect(standing.virtualCount).toBe(1);
	});
});
