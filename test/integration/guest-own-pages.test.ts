import { beforeEach, describe, expect, it } from "vitest";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import {
	rideCards,
	riderPage,
	seedBalance,
	seedRides,
} from "../support/rider-view";

// Feature 041 US2 scenario 1 (FR-005): a guest's own rides, Rynke and badges
// show on their own pages as a rider of the team would see them.

const GUEST = ATHLETE_A;
const ctx = makeCtx();

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: GUEST, guest: true });
	await seedRides(GUEST, 3, "2026-10-05");
	await seedBalance(GUEST, { distanceRynke: 12, trainingRynke: 12 });
});

describe("a guest's own pages", () => {
	it("list their rides", async () => {
		const { status, html } = await riderPage(ctx, GUEST, "/me/rides");
		expect(status).toBe(200);
		expect(rideCards(html).map((c) => c.status)).toEqual([
			"ride-counting",
			"ride-counting",
			"ride-counting",
		]);
	});

	it.each(["/me", "/me/badges", "/team", "/organiser"])(
		"render %s",
		async (path) => {
			expect((await riderPage(ctx, GUEST, path)).status).toBe(200);
		},
	);
});
