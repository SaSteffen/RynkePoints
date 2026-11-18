import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { handleFetch } from "../../src/index";
import { hamburg } from "../../src/teams/hamburg";
import { approve, SCOPES_ALL } from "../support/callback";
import {
	listGuest,
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, OTHER_CLUB, TEAM_CLUB } from "../support/fixtures";

// Feature 041 US1 (FR-003, FR-004, FR-008): a person on the team's guest list
// signs in through Strava without being in the club, and is an organiser and
// an administrator there. Synthetic IDs only.

const GUEST = ATHLETE_A;

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx({ team: { ...hamburg, otherClubIds: [OTHER_CLUB.id] } });
});

afterEach(() => fake.restore());

async function get(path: string) {
	return handleFetch(
		request(path, { cookies: await sessionCookie(ctx, GUEST) }),
		ctx,
	);
}

describe("a listed person's sign-in", () => {
	it("lets them in without the club and without a club request", async () => {
		fake.addAthlete({ id: GUEST, clubs: [OTHER_CLUB.id] });
		await listGuest(ctx, GUEST);
		const res = await approve(ctx, fake, GUEST);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).not.toMatch(/\/notice\//);
		expect(fake.callsTo("clubs")).toEqual([]);
		const rider = await getRider(env.DB, GUEST);
		expect(rider).toMatchObject({
			guest: true,
			organiser: true,
			administrator: true,
		});
	});

	it("opens the organiser and admin views, linked from the navigation", async () => {
		fake.addAthlete({ id: GUEST, clubs: [] });
		await listGuest(ctx, GUEST);
		await approve(ctx, fake, GUEST);
		const me = await (await get("/me")).text();
		expect(me).toContain('href="/organiser/riders"');
		expect(me).toContain('href="/admin"');
		expect((await get("/organiser/riders")).status).toBe(200);
		expect((await get("/admin")).status).toBe(200);
		expect((await get("/admin/riders")).status).toBe(200);
	});

	it("never shows the one-team notice", async () => {
		fake.addAthlete({ id: GUEST, clubs: [OTHER_CLUB.id] });
		await listGuest(ctx, GUEST);
		const res = await approve(ctx, fake, GUEST);
		expect(res.headers.get("Location")).not.toBe("/notice/one-team");
	});

	it("keeps a listed person in the club a guest", async () => {
		fake.addAthlete({ id: GUEST, clubs: [TEAM_CLUB.id] });
		await listGuest(ctx, GUEST);
		await approve(ctx, fake, GUEST);
		expect((await getRider(env.DB, GUEST))?.guest).toBe(true);
	});

	it("still turns a blocked listed person away", async () => {
		fake.addAthlete({ id: GUEST, clubs: [] });
		await listGuest(ctx, GUEST);
		await env.DB.prepare("INSERT INTO blocked_athletes (athlete_id) VALUES (?)")
			.bind(GUEST)
			.run();
		const res = await approve(ctx, fake, GUEST);
		expect(res.headers.get("Location")).toBe("/notice/blocked");
		expect(await getRider(env.DB, GUEST)).toBeNull();
	});

	it("still asks a new listed person for the current consent", async () => {
		fake.addAthlete({ id: GUEST, clubs: [] });
		await listGuest(ctx, GUEST);
		const res = await approve(
			ctx,
			fake,
			GUEST,
			SCOPES_ALL,
			{},
			{
				consentVersion: 0,
			},
		);
		expect(res.headers.get("Location")).toBe("/notice/consent-required");
		expect(await getRider(env.DB, GUEST)).toBeNull();
	});
});

describe("a person not on the list", () => {
	it("is turned away when not in the club", async () => {
		fake.addAthlete({ id: GUEST, clubs: [OTHER_CLUB.id] });
		const res = await approve(ctx, fake, GUEST);
		expect(res.headers.get("Location")).toBe("/notice/not-member");
	});

	it("becomes a rider of the team when a former guest is now in the club", async () => {
		fake.addAthlete({ id: GUEST, clubs: [TEAM_CLUB.id] });
		await seedRider(ctx, { athleteId: GUEST, guest: true, onGuestList: false });
		await approve(ctx, fake, GUEST);
		expect(await getRider(env.DB, GUEST)).toMatchObject({
			guest: false,
			organiser: false,
			administrator: false,
		});
	});

	it("loses a former guest's data when not in the club", async () => {
		fake.addAthlete({ id: GUEST, clubs: [OTHER_CLUB.id] });
		await seedRider(ctx, { athleteId: GUEST, guest: true, onGuestList: false });
		const res = await approve(ctx, fake, GUEST);
		expect(res.headers.get("Location")).toBe("/notice/not-member-deleted");
		expect(await getRider(env.DB, GUEST)).toBeNull();
	});
});
