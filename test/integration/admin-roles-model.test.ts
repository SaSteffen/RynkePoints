import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getRider, roleOf } from "../../src/db/riders";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";

// One role per rider, from the two flags (feature 043 FR-007, research R1): an
// administrator is always an organiser too. Synthetic riders only.

const ctx = makeCtx();

async function flags(organiser: number, administrator: number) {
	await env.DB.prepare(
		"UPDATE riders SET organiser = ?, administrator = ? WHERE athlete_id = ?",
	)
		.bind(organiser, administrator, ATHLETE_A)
		.run();
	return getRider(env.DB, ATHLETE_A);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
});

describe("the rider's role", () => {
	it.each([
		[0, 0, "none"],
		[1, 0, "orga"],
		[1, 1, "admin"],
		[0, 1, "admin"],
	] as const)("organiser %i, administrator %i is %s", async (o, a, role) => {
		const rider = await flags(o, a);
		expect(rider && roleOf(rider)).toBe(role);
	});

	it("reads an administrator without the organiser flag as an organiser", async () => {
		const rider = await flags(0, 1);
		expect(rider?.organiser).toBe(true);
		expect(rider?.administrator).toBe(true);
	});

	it("lets such an administrator open the organiser view", async () => {
		await flags(0, 1);
		const res = await handleFetch(
			request("/organiser/riders", {
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(res.status).toBe(200);
	});
});
