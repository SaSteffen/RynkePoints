import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readRateLimitState } from "../../src/db/rate-limit";
import { getCredentials } from "../../src/db/riders";
import {
	getActivity,
	getAthleteClubs,
	isClubMember,
} from "../../src/strava/client";
import {
	exchangeCode,
	getAccessToken,
	revokeStoredToken,
	revokeToken,
} from "../../src/strava/tokens";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	makeStravaActivity,
	NOW,
	OTHER_CLUB,
	TEAM_CLUB,
} from "../support/fixtures";

let fake: FakeStrava;
const ctx = makeCtx();
const asRider = { athleteId: ATHLETE_A };

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	fake.addAthlete({ id: ATHLETE_A });
	await seedRider(ctx);
});

afterEach(() => fake.restore());

describe("rate-limit headers", () => {
	it("persists usage and limits from every API response", async () => {
		fake.rateHeaders = {
			usage: "12,340",
			limit: "300,3000",
			readUsage: "7,120",
			readLimit: "150,1500",
		};
		await getAthleteClubs(ctx, asRider, 1);
		expect(await readRateLimitState(env.DB)).toEqual({
			observedAt: NOW,
			read15m: 7,
			readDaily: 120,
			all15m: 12,
			allDaily: 340,
			limitRead15m: 150,
			limitReadDaily: 1500,
			limitAll15m: 300,
			limitAllDaily: 3000,
		});
	});

	it("refuses to call Strava when the budget is exhausted", async () => {
		await env.DB.prepare(
			"UPDATE strava_rate_limit SET observed_at = ?, read_15m = 95 WHERE id = 1",
		)
			.bind(NOW)
			.run();
		expect(await getActivity(ctx, asRider, 1)).toEqual({
			kind: "budget",
			delaySeconds: 900,
		});
		expect(fake.calls).toHaveLength(0);
	});
});

describe("response mapping", () => {
	it("returns the activity on success", async () => {
		const activity = makeStravaActivity({ id: 7001 });
		fake.addActivity(ATHLETE_A, activity);
		const result = await getActivity(ctx, asRider, 7001);
		expect(result).toMatchObject({ kind: "ok", value: { id: 7001 } });
		expect(fake.calls[0]?.headers.get("Authorization")).toBe(
			"Bearer access-900001-0",
		);
	});

	it("maps 429 to a budget deferral until the next window", async () => {
		fake.failNext("activity", { status: 429 });
		expect(await getActivity(ctx, asRider, 1)).toEqual({
			kind: "budget",
			delaySeconds: 900,
		});
	});

	it("maps 5xx and network errors to transient", async () => {
		fake.failNext("activity", { status: 503 });
		expect(await getActivity(ctx, asRider, 1)).toMatchObject({
			kind: "transient",
		});
		fake.failNext("activity", "network");
		expect(await getActivity(ctx, asRider, 1)).toMatchObject({
			kind: "transient",
		});
	});

	it("maps 404 to not-found and 403 to forbidden", async () => {
		expect(await getActivity(ctx, asRider, 424242)).toEqual({
			kind: "not-found",
		});
		fake.failNext("activity", { status: 403 });
		expect(await getActivity(ctx, asRider, 1)).toEqual({ kind: "forbidden" });
	});
});

describe("getAccessToken", () => {
	it("uses the stored token while it is valid for more than 5 minutes", async () => {
		await resetDb();
		await seedRider(ctx, { expiresAt: NOW + 301 });
		expect(await getAccessToken(ctx, ATHLETE_A)).toEqual({
			kind: "ok",
			value: "access-900001-0",
		});
		expect(fake.callsTo("token")).toHaveLength(0);
	});

	it("refreshes and persists the rotated tokens encrypted", async () => {
		await resetDb();
		await seedRider(ctx, { expiresAt: NOW + 299 });
		expect(await getAccessToken(ctx, ATHLETE_A)).toEqual({
			kind: "ok",
			value: "access-900001-1",
		});
		const call = fake.callsTo("token")[0];
		expect(call?.form.get("grant_type")).toBe("refresh_token");
		expect(call?.form.get("refresh_token")).toBe("refresh-900001-0");

		expect(await getCredentials(env, ATHLETE_A)).toEqual({
			accessToken: "access-900001-1",
			refreshToken: "refresh-900001-1",
			expiresAt: NOW + 6 * 3600,
		});
		const raw = JSON.stringify(
			await env.DB.prepare("SELECT * FROM strava_credentials").all(),
		);
		expect(raw).not.toContain("refresh-900001-1");
		expect(raw).not.toContain("access-900001-1");
	});

	it.each([400, 401])("reports refresh-refused on %i", async (status) => {
		await resetDb();
		await seedRider(ctx, { expiresAt: NOW - 1 });
		fake.failNext("token", { status });
		expect(await getAccessToken(ctx, ATHLETE_A)).toEqual({
			kind: "refresh-refused",
		});
	});

	it("reports transient when the refresh hits a 5xx", async () => {
		await resetDb();
		await seedRider(ctx, { expiresAt: NOW - 1 });
		fake.failNext("token", { status: 502 });
		expect(await getAccessToken(ctx, ATHLETE_A)).toMatchObject({
			kind: "transient",
		});
	});
});

describe("401 on an API call", () => {
	it("refreshes once and retries", async () => {
		const athlete = fake.athletes.get(ATHLETE_A);
		if (athlete) athlete.accessToken = "access-900001-elsewhere";
		const result = await getAthleteClubs(ctx, asRider, 1);
		expect(result).toMatchObject({ kind: "ok" });
		expect(fake.callsTo("token")).toHaveLength(1);
		expect(fake.callsTo("clubs")).toHaveLength(2);
	});

	it("gives up after one retry", async () => {
		fake.failNext("clubs", { status: 401 });
		fake.failNext("clubs", { status: 401 });
		expect(await getAthleteClubs(ctx, asRider, 1)).toEqual({
			kind: "unauthorized",
		});
		expect(fake.callsTo("token")).toHaveLength(1);
		expect(fake.callsTo("clubs")).toHaveLength(2);
	});
});

describe("isClubMember", () => {
	it("finds the team club across pages", async () => {
		const clubs = Array.from({ length: 200 }, (_, i) => 50_000 + i);
		const athlete = fake.athletes.get(ATHLETE_A);
		if (athlete) athlete.clubs = [...clubs, TEAM_CLUB.id];
		expect(await isClubMember(ctx, asRider, TEAM_CLUB.id)).toEqual({
			kind: "ok",
			value: true,
		});
		expect(
			fake.callsTo("clubs").map((c) => c.url.searchParams.get("page")),
		).toEqual(["1", "2"]);
		expect(fake.calls[0]?.url.searchParams.get("per_page")).toBe("200");
	});

	it("answers false once a short page lacks the club", async () => {
		const athlete = fake.athletes.get(ATHLETE_A);
		if (athlete) athlete.clubs = [OTHER_CLUB.id];
		expect(await isClubMember(ctx, asRider, TEAM_CLUB.id)).toEqual({
			kind: "ok",
			value: false,
		});
	});

	it("passes errors through as inconclusive", async () => {
		fake.failNext("clubs", { status: 503 });
		expect(await isClubMember(ctx, asRider, TEAM_CLUB.id)).toMatchObject({
			kind: "transient",
		});
	});

	it("works with a fresh access token before the rider is stored", async () => {
		expect(
			await isClubMember(ctx, { accessToken: "access-900001-0" }, TEAM_CLUB.id),
		).toEqual({ kind: "ok", value: true });
	});
});

describe("exchangeCode", () => {
	it("returns the tokens and the athlete's ID and first name", async () => {
		fake.codes.set("code-1", ATHLETE_A);
		expect(await exchangeCode(ctx, "code-1")).toEqual({
			kind: "ok",
			value: {
				accessToken: "access-900001-1",
				refreshToken: "refresh-900001-1",
				expiresAt: NOW + 6 * 3600,
				athleteId: ATHLETE_A,
				firstName: "Testrider A",
			},
		});
		expect(fake.callsTo("token")[0]?.form.get("grant_type")).toBe(
			"authorization_code",
		);
	});

	it("maps 403 to forbidden (capacity reached)", async () => {
		fake.failNext("token", { status: 403 });
		expect(await exchangeCode(ctx, "code-1")).toEqual({ kind: "forbidden" });
	});
});

describe("revoking", () => {
	it("sends HTTP Basic client credentials and the token", async () => {
		expect(await revokeToken(ctx, "access-900001-0")).toEqual({
			kind: "ok",
			value: null,
		});
		const call = fake.callsTo("revoke")[0];
		expect(call?.headers.get("Authorization")).toBe(
			`Basic ${btoa("10001:test-client-secret")}`,
		);
		expect(call?.form.get("token")).toBe("access-900001-0");
		expect(fake.revocations).toEqual([
			{ token: "access-900001-0", kind: "access" },
		]);
	});

	it("revokes the stored refresh token without refreshing", async () => {
		await resetDb();
		await seedRider(ctx, { expiresAt: NOW - 3600 });
		expect(await revokeStoredToken(ctx, ATHLETE_A)).toEqual({
			kind: "ok",
			value: null,
		});
		expect(fake.callsTo("token")).toHaveLength(0);
		expect(fake.revocations).toEqual([
			{ token: "refresh-900001-0", kind: "refresh" },
		]);
	});

	it("succeeds without a call when the rider has no credentials", async () => {
		await resetDb();
		expect(await revokeStoredToken(ctx, ATHLETE_A)).toEqual({
			kind: "ok",
			value: null,
		});
		expect(fake.calls).toHaveLength(0);
	});

	it("maps 5xx and network errors to transient", async () => {
		fake.failNext("revoke", { status: 503 });
		expect(await revokeStoredToken(ctx, ATHLETE_A)).toMatchObject({
			kind: "transient",
		});
		fake.failNext("revoke", "network");
		expect(await revokeStoredToken(ctx, ATHLETE_A)).toMatchObject({
			kind: "transient",
		});
	});

	it.each([400, 401, 404])(
		"treats %i as nothing left to revoke",
		async (status) => {
			fake.failNext("revoke", { status });
			expect(await revokeStoredToken(ctx, ATHLETE_A)).toEqual({
				kind: "ok",
				value: null,
			});
		},
	);
});
