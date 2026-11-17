import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { answerStrava } from "../../dev/fake-strava/api";
import { samplesFor } from "../../dev/fake-strava/sample-sets";
import type { SampleRider } from "../../dev/fake-strava/samples";
import { SAMPLE_RIDERS } from "../../dev/fake-strava/samples.hamburg";
import { encodeAccess } from "../../dev/fake-strava/tokens";
import {
	type DevEnv,
	devFetch,
	removeStravaInterceptor,
} from "../../dev/worker";
import { getAthleteClubs } from "../../src/strava/client";
import { TEAMS } from "../../src/teams";
import { europe } from "../../src/teams/europe";
import { makeCtx, resetDb, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, NOW, TEAM_CLUB } from "../support/fixtures";

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

	// The app never writes to Strava (constitution Principle III), so a write
	// call fails whichever test makes it.
	it.each([
		["PUT", "https://www.strava.com/api/v3/activities/1"],
		["POST", "https://www.strava.com/api/v3/activities"],
	])("fails on a %s to %s", async (method, url) => {
		await expect(fetch(url, { method, body: "{}" })).rejects.toThrow(
			/Unknown Strava endpoint/,
		);
		expect(fake.unexpected).toEqual([`${method} ${url}`]);
		expect(() => fake.restore()).toThrow(/Unexpected outbound fetch/);
		fake = installFakeStrava();
	});
});

// The fake Strava of fake mode (dev/fake-strava/api.ts) lists a sample rider's
// clubs; one also in another team's club lists that club too (feature 039
// research R10), for the one-team-at-a-time notice.
describe("fake mode's club list", () => {
	async function clubIds(teamId: string, rider: SampleRider) {
		const token = encodeAccess({
			athleteId: rider.athleteId,
			scopes: rider.scopes.split(","),
			expiresAt: NOW + 3600,
		});
		const res = await answerStrava(
			new Request("https://www.strava.com/api/v3/athlete/clubs", {
				headers: { Authorization: `Bearer ${token}` },
			}),
			{ ...env, TEAM_ID: teamId },
			env.DB,
			NOW,
		);
		expect(res.status).toBe(200);
		return (await res.json()) as { id: number; name: string }[];
	}

	it("lists the team's club and the first other team's club for a rider in both", async () => {
		const inBoth = TEAMS.flatMap((team) =>
			samplesFor(team.id)
				.riders.filter((rider) => rider.otherClubMember)
				.map((rider) => ({ team, rider })),
		);
		expect(inBoth.length).toBeGreaterThan(0);
		for (const { team, rider } of inBoth) {
			expect(rider.clubMember).toBe(true);
			const ids = (await clubIds(team.id, rider)).map((club) => club.id);
			expect(ids).toEqual([Number(env.STRAVA_CLUB_ID), team.otherClubIds[0]]);
		}
	});

	it("lists every Hamburg sample's clubs as before", async () => {
		for (const rider of SAMPLE_RIDERS) {
			expect(await clubIds("hamburg", rider)).toEqual(
				rider.clubMember
					? [
							{
								id: Number(env.STRAVA_CLUB_ID),
								name: "Team Rynkeby Hamburg (fake)",
							},
						]
					: [],
			);
		}
	});
});

// Seeding connects every club member through the app; one in both clubs lands
// on the one-team-at-a-time notice instead of their own page (feature 039).
describe("seeding Europe's fake mode", { timeout: 20_000 }, () => {
	beforeEach(async () => {
		await resetDb();
		await env.DB.batch([
			env.DB.prepare("DROP TABLE IF EXISTS fake_strava_activities"),
			env.DB.prepare("DROP TABLE IF EXISTS fake_strava_seed"),
			env.DB.prepare("DROP TABLE IF EXISTS fake_dev_clock"),
		]);
	});

	afterEach(() => removeStravaInterceptor());

	it("connects the rider in both clubs too", async () => {
		const base = makeCtx({ team: europe });
		const devEnv: DevEnv = {
			...base.env,
			TEAM_ID: "europe",
			STRAVA_CLUB_ID: "2292744",
			STRAVA_EXTRA_CLUB_IDS: "",
			RYNKE_FAKE_STRAVA: "local-only",
		};
		const ctx: TestCtx = { ...base, env: devEnv };
		const index = await devFetch(
			new Request("http://localhost:8789/_dev/"),
			ctx,
		);
		expect(index.status).toBe(200);
		await index.text();
		const inBoth = samplesFor("europe").riders.filter((r) => r.otherClubMember);
		for (const rider of inBoth) {
			const stored = await env.DB.prepare(
				"SELECT status FROM riders WHERE athlete_id = ?",
			)
				.bind(rider.athleteId)
				.first<{ status: string }>();
			expect(stored?.status).toBe("connected");
		}
	});
});
