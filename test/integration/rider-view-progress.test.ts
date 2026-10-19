import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRiderView } from "../../src/db/rider-view";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { EXAMPLE_INPUTS, seedExampleRider } from "../support/progress";
import { seedRide } from "../support/rider-view";

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
