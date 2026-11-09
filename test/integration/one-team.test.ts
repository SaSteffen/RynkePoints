import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { hamburg } from "../../src/teams/hamburg";
import { approve, setCookies } from "../support/callback";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, OTHER_CLUB, TEAM_CLUB } from "../support/fixtures";

// FR-012: a rider who is also in another team's club learns, right after
// connecting, that one team at a time works. Other teams' clubs are team data.

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx({ team: { ...hamburg, otherClubIds: [OTHER_CLUB.id] } });
});

afterEach(() => fake.restore());

describe("GET /auth/callback for a rider in another team's club", () => {
	it("connects a new rider and shows the one-team notice", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [TEAM_CLUB.id, OTHER_CLUB.id] });
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/notice/one-team");
		expect(setCookies(res).rp_session).toMatch(/^rp_session=[^;]+;/);
		expect(fake.revocations).toEqual([]);
		expect(await getRider(env.DB, ATHLETE_A)).not.toBeNull();
	});

	it("finds the other club on a later page of the rider's clubs", async () => {
		const many = Array.from({ length: 200 }, (_, i) => 900_000 + i);
		fake.addAthlete({
			id: ATHLETE_A,
			clubs: [TEAM_CLUB.id, ...many, OTHER_CLUB.id],
		});
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(res.headers.get("Location")).toBe("/notice/one-team");
	});

	it("doesn't show it to a rider only in this team's club", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [TEAM_CLUB.id] });
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).not.toMatch(/\/notice\//);
	});

	it("doesn't show it again when a rider reconnects", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [TEAM_CLUB.id, OTHER_CLUB.id] });
		await seedRider(ctx);
		const res = await approve(ctx, fake, ATHLETE_A, undefined, {
			...(await sessionCookie(ctx, ATHLETE_A)),
		});
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).not.toMatch(/\/notice\//);
	});

	it("still turns away a rider only in the other team's club", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [OTHER_CLUB.id] });
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(res.headers.get("Location")).toBe("/notice/not-member");
	});
});

describe("GET /notice/one-team", () => {
	it("explains one team at a time and carries on to the rider's home", async () => {
		const res = await handleFetch(
			request("/notice/one-team", { acceptLanguage: "en" }),
			ctx,
		);
		const page = await res.text();
		expect(res.status).toBe(200);
		expect(page).toContain(
			`<h1>${escapeHtml(CATALOGS.en["notice.oneTeam.title"])}</h1>`,
		);
		expect(page).toContain(
			`<a class="button" href="/">${CATALOGS.en["notice.carryOn"]}</a>`,
		);
		expect(page).not.toContain(CATALOGS.en["notice.backToStart"]);
	});
});
