import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteRider } from "../../src/db/riders";
import { recordDeadlineResults } from "../../src/work/scheduled";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C } from "../support/fixtures";
import { seedBalance } from "../support/rider-view";

// The results kept when the qualification deadline had passed (review L-12,
// feature 016 data-model.md): the daily run takes them once. The test team's
// deadline is 2027-06-30 (test/support/pinned.json). Synthetic riders only.

const GUEST = 900007;
const UNLISTED = 900008;
const LATER = 900009;

/** The daily run's time on the given day, 03:17 UTC. */
const runOn = (day: string) =>
	makeCtx({ now: Date.parse(`${day}T03:17:00Z`) / 1000 });

interface Kept {
	athlete_id: number;
	deadline: string;
	qualified: number;
	training_rynke: number;
	team_rynke: number;
}

async function kept(): Promise<Kept[]> {
	const { results } = await env.DB.prepare(
		"SELECT * FROM deadline_results ORDER BY athlete_id",
	).all<Kept>();
	return results;
}

beforeEach(async () => {
	await resetDb();
	const ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A, firstName: "Anna" });
	await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Ben" });
	// Listed, but without a balance yet.
	await seedRider(ctx, { athleteId: ATHLETE_C, firstName: "Cara" });
	await seedRider(ctx, { athleteId: GUEST, guest: true });
	await seedRider(ctx, { athleteId: UNLISTED, consentVersion: null });
	await seedBalance(ATHLETE_A, {
		qualified: true,
		trainingRynke: 300,
		teamRynke: 30,
	});
	await seedBalance(ATHLETE_B, { trainingRynke: 240, teamRynke: 20 });
	await seedBalance(GUEST, { qualified: true, trainingRynke: 300 });
	await seedBalance(UNLISTED, { qualified: true, trainingRynke: 300 });
});

describe("recordDeadlineResults", () => {
	it("keeps nothing until the deadline has passed", async () => {
		await recordDeadlineResults(runOn("2027-06-30"));
		expect(await kept()).toEqual([]);
	});

	it("keeps every listed rider's result on the first run after it", async () => {
		await recordDeadlineResults(runOn("2027-07-01"));
		expect(await kept()).toEqual([
			{
				athlete_id: ATHLETE_A,
				deadline: "2027-06-30",
				qualified: 1,
				training_rynke: 300,
				team_rynke: 30,
			},
			{
				athlete_id: ATHLETE_B,
				deadline: "2027-06-30",
				qualified: 0,
				training_rynke: 240,
				team_rynke: 20,
			},
			// No balance: 0 and not qualified. No guest, no rider outside the
			// team's sharing.
			{
				athlete_id: ATHLETE_C,
				deadline: "2027-06-30",
				qualified: 0,
				training_rynke: 0,
				team_rynke: 0,
			},
		]);
	});

	it("keeps the day's results through later changes and later riders", async () => {
		await recordDeadlineResults(runOn("2027-07-01"));
		const first = await kept();
		await seedBalance(ATHLETE_A, { trainingRynke: 200 });
		await seedRider(makeCtx(), { athleteId: LATER });
		await seedBalance(LATER, { qualified: true, trainingRynke: 300 });
		await recordDeadlineResults(runOn("2027-07-02"));
		expect(await kept()).toEqual(first);
	});

	it("keeps the result of a rider who must reconnect that day", async () => {
		await seedRider(makeCtx(), {
			athleteId: LATER,
			status: "needs_reconnect",
		});
		await seedBalance(LATER, { qualified: true, trainingRynke: 300 });
		await recordDeadlineResults(runOn("2027-07-01"));
		expect(await kept()).toContainEqual({
			athlete_id: LATER,
			deadline: "2027-06-30",
			qualified: 1,
			training_rynke: 300,
			team_rynke: 0,
		});
	});

	it("goes with the rider", async () => {
		await recordDeadlineResults(runOn("2027-07-01"));
		await deleteRider(env.DB, ATHLETE_A);
		expect((await kept()).map((r) => r.athlete_id)).toEqual([
			ATHLETE_B,
			ATHLETE_C,
		]);
	});

	describe("an earlier season's deadline", () => {
		const keepOld = () =>
			env.DB.prepare(
				`INSERT INTO deadline_results
					(athlete_id, deadline, qualified, training_rynke, team_rynke)
				VALUES (?, '2026-06-30', 1, 300, 30)`,
			)
				.bind(ATHLETE_A)
				.run();

		it("is deleted once the new season's is set, before it has passed", async () => {
			await keepOld();
			await recordDeadlineResults(runOn("2027-03-01"));
			expect(await kept()).toEqual([]);
		});

		it("is replaced by the new deadline's results once it has passed", async () => {
			await keepOld();
			await recordDeadlineResults(runOn("2027-07-01"));
			expect(
				(await kept()).map((r) => [r.athlete_id, r.deadline, r.training_rynke]),
			).toEqual([
				[ATHLETE_A, "2027-06-30", 300],
				[ATHLETE_B, "2027-06-30", 240],
				[ATHLETE_C, "2027-06-30", 0],
			]);
		});
	});
});
