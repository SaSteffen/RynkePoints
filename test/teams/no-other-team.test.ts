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
// team, link no file under another team's public/teams/<id>/ nor its coin and
// icons elsewhere (the founding team's are at the root: /icons/, /coin/), and
// show none of the shared badge pictures that carry another team's motifs.

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

/** A team's coin and icons. */
const artOf = (t: (typeof TEAMS)[number]) => [
	...Object.values(t.art.coin),
	...Object.values(t.art.icons),
];

/** Each other team's coin and icons, but those it shares with this team. */
const OTHER_ART = others.flatMap((other) =>
	artOf(other).filter((path) => !artOf(team).includes(path)),
);

/**
 * `path` linked by itself, not as the tail of a longer path: the founding
 * team's `/icons/icon-192.png` ends this team's `/teams/<id>/icons/icon-192.png`.
 */
function links(body: string, path: string): boolean {
	const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`(?<![\\w.-])${escaped}`).test(body);
}

/** What of another team `body` shows. */
const otherTeamIn = (body: string) => [
	...FORBIDDEN.filter((text) => body.includes(text)),
	...OTHER_ART.filter((path) => links(body, path)),
];

// The bracket keeps it a glob (test/unit/asset-cache.test.ts);
// `import.meta.glob` is declared in test/unit/dev-guard.test.ts.
const SERVICE_WORKER = import.meta.glob("../../public/sw.j[s]", {
	query: "?raw",
	import: "default",
	eager: true,
})["../../public/sw.js"];

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

	it("tells another team's root art from its own", () => {
		expect(links('href="/icons/icon-192.png"', "/icons/icon-192.png")).toBe(
			true,
		);
		expect(
			links('href="/teams/x/icons/icon-192.png"', "/icons/icon-192.png"),
		).toBe(false);
	});

	it.each(RIDER_PAGES)("$name", async (page) => {
		const body = await (await page.fetch(ctx, {})).text();
		expect(otherTeamIn(body)).toEqual([]);
	});

	it.each(EXTRA)("$name", async ({ path, as }) => {
		const response = await fetchAs(path, as);
		expect(response.status).toBeLessThan(400);
		const body = await response.text();
		expect(otherTeamIn(body)).toEqual([]);
	});

	it("gives push notifications its own icons", async () => {
		const text = await (await fetchAs("/notification-text")).json();
		expect(text).toMatchObject({
			icon: team.art.icons.icon192,
			badge: team.art.icons.notificationBadge,
		});
		// The service worker is every team's: it names no icon of its own.
		expect(SERVICE_WORKER).toBeDefined();
		for (const path of TEAMS.flatMap(artOf)) {
			expect(SERVICE_WORKER).not.toContain(path);
		}
	});

	it("names its own team where a page names one", async () => {
		const landing = await (await fetchAs("/")).text();
		expect(landing).toContain(team.name);
	});
});
