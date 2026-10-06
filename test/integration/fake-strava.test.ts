import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getAthleteClubs } from "../../src/strava/client";
import { makeCtx, resetDb } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, TEAM_CLUB } from "../support/fixtures";

// Proves that spying on global fetch intercepts the Strava client's calls, so
// no test can reach the real Strava (research R12).
describe("fake Strava", () => {
	let fake: FakeStrava;

	beforeEach(async () => {
		await resetDb();
		fake = installFakeStrava();
	});

	afterEach(() => {
		fake.unexpected.length = 0;
		fake.restore();
	});

	it("intercepts the Strava client's fetch calls", async () => {
		const athlete = fake.addAthlete({ id: ATHLETE_A });
		const result = await getAthleteClubs(
			makeCtx(),
			{ accessToken: athlete.accessToken },
			1,
		);
		expect(result).toEqual({
			kind: "ok",
			value: [expect.objectContaining({ id: TEAM_CLUB.id })],
		});
		expect(fake.calls).toHaveLength(1);
		expect(fake.calls[0]?.url.pathname).toBe("/api/v3/athlete/clubs");
	});

	it("fails on any other host", async () => {
		await expect(fetch("https://example.org/")).rejects.toThrow(/example\.org/);
		expect(fake.unexpected).toEqual(["https://example.org/"]);
		// restore() is what fails the test in afterEach.
		expect(() => fake.restore()).toThrow(/example\.org/);
		fake = installFakeStrava();
	});
});
