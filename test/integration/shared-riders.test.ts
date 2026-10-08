import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
	consentVersionOf,
	listSharedRiderIds,
	SHARED_RIDER_IDS,
	sharedRiderIdsSince,
} from "../../src/db/consents";
import { deleteRider } from "../../src/db/riders";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C } from "../support/fixtures";
import { seedBalance } from "../support/rider-view";

// Riders whose consent includes the FR-020 sharing, filtered inside SQL
// (feature 004 US3, research R5, R6, R13). A rider without consent is in no
// row and no figure (FR-021).

const ctx = makeCtx();

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_C });
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B, consentVersion: null });
	await seedBalance(ATHLETE_A, { trainingRynke: 10 });
	await seedBalance(ATHLETE_B, { trainingRynke: 100 });
	await seedBalance(ATHLETE_C, { trainingRynke: 1 });
});

describe("listSharedRiderIds", () => {
	it("lists riders with a record by athlete ID and leaves out the one without", async () => {
		expect(await listSharedRiderIds(env.DB)).toEqual([ATHLETE_A, ATHLETE_C]);
		expect(await consentVersionOf(env.DB, ATHLETE_A)).toBe(1);
		expect(await consentVersionOf(env.DB, ATHLETE_B)).toBeNull();
	});

	it("lists a rider with several records once", async () => {
		await env.DB.prepare(
			"INSERT INTO consent_records (athlete_id, version, accepted_at) VALUES (?, 2, ?)",
		)
			.bind(ATHLETE_A, ctx.now())
			.run();
		expect(await listSharedRiderIds(env.DB)).toEqual([ATHLETE_A, ATHLETE_C]);
	});
});

describe("SHARED_RIDER_IDS", () => {
	it("keeps the rider without consent out of a count and a sum", async () => {
		const row = await env.DB.prepare(
			`SELECT COUNT(*) AS riders, SUM(training_rynke) AS training
			FROM rynke_balances WHERE athlete_id IN (${SHARED_RIDER_IDS})`,
		).first<{ riders: number; training: number }>();
		expect(row).toEqual({ riders: 2, training: 11 });
	});

	it("is the subquery from the first sharing version", () => {
		expect(SHARED_RIDER_IDS).toBe(sharedRiderIdsSince(1));
	});

	it("leaves out riders below a later version (FR-013)", async () => {
		await env.DB.prepare(
			"INSERT INTO consent_records (athlete_id, version, accepted_at) VALUES (?, 2, ?)",
		)
			.bind(ATHLETE_C, ctx.now())
			.run();
		const { results } = await env.DB.prepare(
			`SELECT athlete_id FROM riders WHERE athlete_id IN (${sharedRiderIdsSince(2)})`,
		).all<{ athlete_id: number }>();
		expect(results.map((r) => r.athlete_id)).toEqual([ATHLETE_C]);
	});
});

describe("a rider who leaves", () => {
	it("is no longer shared and has no version (FR-015, SC-001)", async () => {
		await deleteRider(env.DB, ATHLETE_A);
		expect(await listSharedRiderIds(env.DB)).toEqual([ATHLETE_C]);
		expect(await consentVersionOf(env.DB, ATHLETE_A)).toBeNull();
		const row = await env.DB.prepare(
			`SELECT COUNT(*) AS riders FROM rynke_balances
			WHERE athlete_id IN (${SHARED_RIDER_IDS})`,
		).first<{ riders: number }>();
		expect(row?.riders).toBe(1);
	});
});
