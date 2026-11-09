import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { upsertBadgeRiseStatement } from "../../src/db/badges";
import { STYLESHEET_PATH } from "../../src/http/stylesheet";
import { handleFetch } from "../../src/index";
import { TEAMS, teamFor } from "../../src/teams";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_C, NOW } from "../support/fixtures";
import { RIDER_PAGES, seedPageRiders } from "../support/pages";

// Nothing of another team on a team's site (feature 026 SC-001, US4): every
// rider, organiser and admin page, the tour's example pages, the manifest,
// the stylesheet, the notification texts and the offline page name no other
// team, link no file under another team's public/teams/<id>/, and show none
// of the shared badge pictures that carry another team's motifs.

const team = teamFor(env);
const others = TEAMS.filter((t) => t.id !== team.id);
const ADMIN = 900009;

let ctx: TestCtx;

/** What a page must not contain: each other team's name, art folder and motifs. */
const FORBIDDEN = others.flatMap((other) => [
	other.name,
	`/teams/${other.id}/`,
	...other.art.teamSpecificBadges.map((id) => `/badges/${id}.svg`),
]);

async function fetchAs(path: string, athleteId?: number): Promise<Response> {
	const cookies = athleteId ? await sessionCookie(ctx, athleteId) : {};
	return handleFetch(request(path, { cookies }), ctx);
}

const EXTRA: { name: string; path: string; as?: number }[] = [
	{ name: "/me/badges", path: "/me/badges", as: ATHLETE_A },
	{ name: "/me tour example", path: "/me?tour=rider&step=4", as: ATHLETE_A },
	{
		name: "/organiser/riders tour example",
		path: "/organiser/riders?tour=organiser&step=1",
		as: ATHLETE_C,
	},
	{ name: "/admin", path: "/admin", as: ADMIN },
	{ name: "/admin/riders", path: "/admin/riders", as: ADMIN },
	{ name: "manifest", path: "/manifest.webmanifest" },
	{ name: "stylesheet", path: STYLESHEET_PATH },
	{ name: "/notification-text", path: "/notification-text" },
	{
		name: "/me/notification-text",
		path: "/me/notification-text",
		as: ATHLETE_A,
	},
];

beforeAll(async () => {
	await resetDb();
	ctx = makeCtx();
	await seedPageRiders(ctx);
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
	await upsertBadgeRiseStatement(
		env.DB,
		ATHLETE_A,
		["distance-100"],
		NOW,
	).run();
});

describe(`${team.id}'s site shows no other team (SC-001)`, () => {
	it("has other teams to look for", () => {
		expect(others.length).toBeGreaterThan(0);
		for (const text of FORBIDDEN) expect(text).not.toBe("");
	});

	it.each(RIDER_PAGES)("$name", async (page) => {
		const body = await (await page.fetch(ctx, {})).text();
		for (const text of FORBIDDEN) expect(body).not.toContain(text);
	});

	it.each(EXTRA)("$name", async ({ path, as }) => {
		const response = await fetchAs(path, as);
		expect(response.status).toBeLessThan(400);
		const body = await response.text();
		for (const text of FORBIDDEN) expect(body).not.toContain(text);
	});

	it("names its own team where a page names one", async () => {
		const landing = await (await fetchAs("/")).text();
		expect(landing).toContain(team.name);
	});
});
