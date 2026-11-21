import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { listSharedRiderIds, sharedRiderExists } from "../../src/db/consents";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";

// Feature 041 research R3: the consent filter every team count goes through
// leaves a guest out, whatever consent they gave.

beforeEach(async () => {
	await resetDb();
	const ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B, guest: true });
});

describe("the shared filter and guests", () => {
	it("lists only the team's riders", async () => {
		expect(await listSharedRiderIds(env.DB)).toEqual([ATHLETE_A]);
	});

	it("leaves a guest out of the per-rider check", async () => {
		const { results } = await env.DB.prepare(
			`SELECT CAST(r.athlete_id AS TEXT) AS athlete_id FROM riders r WHERE ${sharedRiderExists("r", 1)}
			ORDER BY r.athlete_id`,
		).all<{ athlete_id: string }>();
		expect(results.map((r) => r.athlete_id)).toEqual([ATHLETE_A]);
	});

	it("leaves out a guest already taken off the list", async () => {
		await env.DB.prepare("DELETE FROM guests").run();
		expect(await listSharedRiderIds(env.DB)).toEqual([ATHLETE_A]);
	});
});
