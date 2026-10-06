import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seasonStartEpoch } from "../../src/config";
import { upsertActivity } from "../../src/db/activities";
import { getCurrentConsent } from "../../src/db/consents";
import { getCredentials, getRider } from "../../src/db/riders";
import { toActivityRecord } from "../../src/strava/activity";
import {
	approve,
	callback,
	SCOPES_ALL,
	SCOPES_NO_WRITE,
	SCOPES_SHARED,
	setCookies,
} from "../support/callback";
import {
	makeCtx,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	makeStravaActivity,
	NOW,
	OTHER_CLUB,
} from "../support/fixtures";

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => fake.restore());

const SEASON_START = seasonStartEpoch("2026-01-01");

async function seedExistingRider(
	options: Parameters<typeof seedRider>[1] = {},
) {
	fake.addAthlete({ id: ATHLETE_A });
	await seedRider(ctx, options);
	await upsertActivity(
		env.DB,
		toActivityRecord(makeStravaActivity(), ATHLETE_A, NOW) ?? fail(),
	);
}

function fail(): never {
	throw new Error("fixture is not a cycling activity");
}

async function expectNoRows() {
	const counts = await tableCounts();
	expect(counts).toMatchObject({
		riders: 0,
		strava_credentials: 0,
		activities: 0,
		consent_records: 0,
		failed_work: 0,
	});
}

function expectNotice(res: Response, id: string) {
	expect(res.status).toBe(303);
	expect(res.headers.get("Location")).toBe(`/notice/${id}`);
}

describe("GET /auth/callback refusals", () => {
	it("sends a missing state to /notice/expired", async () => {
		const res = await callback(ctx, {
			params: { code: "c", scope: SCOPES_ALL },
			cookieState: null,
		});
		expectNotice(res, "expired");
		await expectNoRows();
		expect(fake.calls).toEqual([]);
	});

	it("sends a mismatched state to /notice/expired", async () => {
		const res = await callback(ctx, {
			params: { code: "c", scope: SCOPES_ALL },
			cookieState: "another-state",
		});
		expectNotice(res, "expired");
		await expectNoRows();
	});

	it("sends access_denied to /notice/denied", async () => {
		const res = await callback(ctx, { params: { error: "access_denied" } });
		expectNotice(res, "denied");
		await expectNoRows();
		expect(fake.calls).toEqual([]);
	});

	it.each([
		["activity:read", "read"],
		["read", "activity:read"],
	])("revokes and refuses a grant without %s", async (_missing, granted) => {
		const res = await approve(ctx, fake, ATHLETE_A, granted);
		expectNotice(res, "denied");
		expect(fake.revocations).toEqual([
			expect.objectContaining({ kind: "access" }),
		]);
		await expectNoRows();
	});

	it("deletes an existing rider who signs in without activity:read", async () => {
		await seedExistingRider();
		const res = await approve(ctx, fake, ATHLETE_A, "read", {
			...(await sessionCookie(ctx, ATHLETE_A)),
		});
		expectNotice(res, "denied-deleted");
		expect(fake.revocations).toHaveLength(1);
		await expectNoRows();
		expect(setCookies(res).rp_session).toMatch(/^rp_session=; .*Max-Age=0/);
	});

	it("leaves an existing rider untouched on access_denied", async () => {
		await seedExistingRider();
		const before = await tableCounts();
		const res = await callback(ctx, { params: { error: "access_denied" } });
		expectNotice(res, "denied");
		expect(await tableCounts()).toEqual(before);
		expect(fake.revocations).toEqual([]);
	});
});

describe("GET /auth/callback token exchange", () => {
	it("sends a 403 to /notice/team-full", async () => {
		fake.failNext("token", { status: 403 });
		const res = await approve(ctx, fake, ATHLETE_A);
		expectNotice(res, "team-full");
		await expectNoRows();
	});

	it("sends a 500 to /notice/failed", async () => {
		fake.failNext("token", { status: 500 });
		const res = await approve(ctx, fake, ATHLETE_A);
		expectNotice(res, "failed");
		await expectNoRows();
	});

	it("sends an unknown code to /notice/failed", async () => {
		const res = await callback(ctx, {
			params: { code: "never-issued", scope: SCOPES_ALL },
		});
		expectNotice(res, "failed");
		await expectNoRows();
	});
});

describe("GET /auth/callback club check", () => {
	it("revokes and refuses a non-member", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [OTHER_CLUB.id] });
		const res = await approve(ctx, fake, ATHLETE_A);
		expectNotice(res, "not-member");
		expect(fake.revocations).toHaveLength(1);
		await expectNoRows();
	});

	it("revokes and turns a new rider away when Strava is busy", async () => {
		fake.failNext("clubs", { status: 503 });
		const res = await approve(ctx, fake, ATHLETE_A);
		expectNotice(res, "strava-busy");
		expect(fake.revocations).toHaveLength(1);
		await expectNoRows();
	});

	it("deletes an existing rider who left the club", async () => {
		await seedExistingRider();
		const athlete = fake.athletes.get(ATHLETE_A);
		if (athlete) athlete.clubs = [OTHER_CLUB.id];
		const res = await approve(ctx, fake, ATHLETE_A);
		expectNotice(res, "not-member-deleted");
		expect(fake.revocations).toHaveLength(1);
		await expectNoRows();
		expect(setCookies(res).rp_session).toMatch(/Max-Age=0/);
	});

	it("signs an existing rider in when the club check is inconclusive", async () => {
		await seedExistingRider();
		fake.failNext("clubs", { status: 503 });
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/me");
		expect(fake.revocations).toEqual([]);
		expect(await tableCounts()).toMatchObject({ riders: 1, activities: 1 });
		// The credentials now hold the token issued by this sign-in.
		expect((await getCredentials(env, ATHLETE_A))?.accessToken).toBe(
			fake.athletes.get(ATHLETE_A)?.accessToken,
		);
	});
});

describe("GET /auth/callback success", () => {
	it("connects a new member with both scopes", async () => {
		const res = await approve(ctx, fake, ATHLETE_A, SCOPES_ALL);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/me");
		expect(setCookies(res).rp_session).toMatch(
			new RegExp(`^rp_session=${ATHLETE_A}\\.`),
		);

		const rider = await getRider(env.DB, ATHLETE_A);
		expect(rider).toMatchObject({
			firstName: "Testrider A",
			status: "connected",
			scopeReadAll: true,
			scopes: SCOPES_ALL,
			importStatus: "pending",
			reconnectRequestedAt: null,
			connectedAt: NOW,
		});

		const creds = await env.DB.prepare(
			"SELECT * FROM strava_credentials WHERE athlete_id = ?",
		)
			.bind(ATHLETE_A)
			.first<Record<string, string>>();
		const athlete = fake.athletes.get(ATHLETE_A);
		expect(creds?.access_token_enc).toMatch(/^v1:/);
		expect(creds?.refresh_token_enc).toMatch(/^v1:/);
		expect(JSON.stringify(creds)).not.toContain(athlete?.accessToken);
		expect(JSON.stringify(creds)).not.toContain(athlete?.refreshToken);

		expect(ctx.queue.sent).toEqual([
			{
				body: {
					kind: "import-page",
					athleteId: ATHLETE_A,
					page: 1,
					after: SEASON_START,
				},
				delaySeconds: undefined,
			},
		]);
	});

	it("clears the OAuth state cookie", async () => {
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(setCookies(res).rp_oauth_state).toMatch(/Max-Age=0/);
	});

	it("connects a new member who unticked private activities", async () => {
		await approve(ctx, fake, ATHLETE_A, SCOPES_SHARED);
		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			scopeReadAll: false,
			scopes: SCOPES_SHARED,
		});
	});

	it("updates a reconnecting rider in place", async () => {
		await seedExistingRider({ scopeReadAll: false, scopes: "read" });
		const later = makeCtx({ now: NOW + 3600 });
		ctx = later;
		const res = await approve(later, fake, ATHLETE_A, SCOPES_SHARED);
		expect(res.status).toBe(302);
		expect(await tableCounts()).toMatchObject({ riders: 1, activities: 1 });
		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			scopes: SCOPES_SHARED,
			scopesUpdatedAt: NOW + 3600,
			connectedAt: NOW,
			membershipCheckedAt: NOW + 3600,
		});
	});

	it("reconnects a needs_reconnect rider and re-imports", async () => {
		await seedExistingRider({
			status: "needs_reconnect",
			reconnectRequestedAt: NOW - 3600,
			importStatus: "done",
		});
		const res = await approve(ctx, fake, ATHLETE_A, SCOPES_ALL);
		expect(res.status).toBe(302);
		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			status: "connected",
			reconnectRequestedAt: null,
			importStatus: "pending",
		});
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{
				kind: "import-page",
				athleteId: ATHLETE_A,
				page: 1,
				after: SEASON_START,
			},
		]);
	});
});

describe("GET /auth/callback consent and write access", () => {
	async function consentRows() {
		const { results } = await env.DB.prepare(
			"SELECT athlete_id, version, accepted_at FROM consent_records",
		).all();
		return results;
	}

	it("stores write access and the consent of a new member", async () => {
		await approve(ctx, fake, ATHLETE_A, SCOPES_ALL);
		expect((await getRider(env.DB, ATHLETE_A))?.scopeWrite).toBe(true);
		expect(await consentRows()).toEqual([
			{ athlete_id: ATHLETE_A, version: 1, accepted_at: NOW },
		]);
	});

	it("connects a new member who unticked write access", async () => {
		const res = await approve(ctx, fake, ATHLETE_A, SCOPES_NO_WRITE);
		expect(res.headers.get("Location")).toBe("/me");
		expect((await getRider(env.DB, ATHLETE_A))?.scopeWrite).toBe(false);
		expect(await getCurrentConsent(env.DB, ATHLETE_A)).toEqual({
			version: 1,
			acceptedAt: NOW,
		});
	});

	it.each([0, 2])(
		"revokes and refuses a new athlete with consent version %i",
		async (consentVersion) => {
			const res = await approve(
				ctx,
				fake,
				ATHLETE_A,
				SCOPES_ALL,
				{},
				{
					consentVersion,
				},
			);
			expectNotice(res, "consent-required");
			expect(setCookies(res).rp_oauth_state).toMatch(/Max-Age=0/);
			expect(fake.revocations).toEqual([
				expect.objectContaining({ kind: "access" }),
			]);
			await expectNoRows();
		},
	);

	it("checks the scopes before the consent", async () => {
		const res = await approve(
			ctx,
			fake,
			ATHLETE_A,
			"read",
			{},
			{
				consentVersion: 0,
			},
		);
		expectNotice(res, "denied");
		await expectNoRows();
	});

	it("checks the consent before the club", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [OTHER_CLUB.id] });
		const res = await approve(
			ctx,
			fake,
			ATHLETE_A,
			SCOPES_ALL,
			{},
			{
				consentVersion: 0,
			},
		);
		expectNotice(res, "consent-required");
		expect(fake.callsTo("clubs")).toEqual([]);
		await expectNoRows();
	});

	it("signs in an existing rider who came without a new agreement", async () => {
		await seedExistingRider();
		const res = await approve(
			ctx,
			fake,
			ATHLETE_A,
			SCOPES_ALL,
			{},
			{
				consentVersion: 0,
			},
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/me");
		expect(await consentRows()).toEqual([]);
	});

	it("records the consent of an existing rider without one", async () => {
		await seedExistingRider();
		await approve(ctx, fake, ATHLETE_A);
		expect(await consentRows()).toEqual([
			{ athlete_id: ATHLETE_A, version: 1, accepted_at: NOW },
		]);
	});

	it("keeps an existing rider's first acceptance", async () => {
		await seedExistingRider({ consentVersion: 1 });
		ctx = makeCtx({ now: NOW + 3600 });
		await approve(ctx, fake, ATHLETE_A);
		expect(await consentRows()).toEqual([
			{ athlete_id: ATHLETE_A, version: 1, accepted_at: NOW },
		]);
	});
});

describe("GET /auth/callback responses", () => {
	it("never answers with an HTML body", async () => {
		const responses = [
			await callback(ctx, { params: { code: "c" }, cookieState: null }),
			await callback(ctx, { params: { error: "access_denied" } }),
			await approve(ctx, fake, ATHLETE_A, "read"),
			await approve(ctx, fake, ATHLETE_A),
		];
		for (const res of responses) {
			expect([302, 303]).toContain(res.status);
			expect(res.headers.get("Content-Type")).toBeNull();
			expect(await res.text()).toBe("");
		}
	});
});
