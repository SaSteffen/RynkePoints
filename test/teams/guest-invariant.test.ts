import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { samplesFor } from "../../dev/fake-strava/sample-sets";
import { countActiveRiders } from "../../src/db/recheck";
import { connectedCountStatement } from "../../src/db/riders";
import { NOW } from "../support/fixtures";
import {
	endSampleSeason,
	getPage,
	riderCookie,
	rows,
	seedSampleSeason,
} from "../support/sample-season";

// Feature 041 FR-007, FR-008, SC-002, research R9, on every team's sample
// season with its sample guest connected through the app. Hamburg's pinned
// pages (pages-snapshot, season-snapshot) prove its team figures byte-identical
// with the guest there; this file proves, for every team, that no team-facing
// page names the guest, that the admin figures leave them out, and that the
// admin riders list shows them only as a guest.

const { riders } = samplesFor(env.TEAM_ID);
const guest = riders.find((r) => r.guest);
const organiser = riders.find((r) => r.organiser && r.clubMember);
const admin = riders.find((r) => r.administrator && r.clubMember);
const rider = riders.find(
	(r) =>
		r.clubMember &&
		!r.organiser &&
		!r.administrator &&
		r.behaviour === "normal" &&
		r.consentVersion === undefined,
);

const TEAM_PAGES = ["/team", "/team?kind=team", "/me"];
const ORGANISER_PAGES = [
	"/organiser",
	"/organiser/riders",
	"/organiser/riders?view=graphs",
];
const ADMIN_PAGES = ["/admin"];

describe("a team's sample guest (feature 041)", () => {
	beforeAll(async () => {
		await seedSampleSeason();
	}, 120_000);

	afterAll(endSampleSeason);

	it("has a guest, an organiser, an administrator and a rider", () => {
		expect([guest, organiser, admin, rider]).not.toContain(undefined);
	});

	it("is connected as a guest", async () => {
		expect(
			await rows(
				"SELECT guest, organiser, administrator FROM riders WHERE athlete_id = ?",
				guest?.athleteId,
			),
		).toEqual([{ guest: 1, organiser: 0, administrator: 0 }]);
	});

	it("is named on no team-facing page", async () => {
		const name = guest?.firstName ?? "";
		const views: [string[], string | undefined][] = [
			[TEAM_PAGES, rider?.athleteId],
			[[...TEAM_PAGES, ...ORGANISER_PAGES], organiser?.athleteId],
			[[...ADMIN_PAGES], admin?.athleteId],
			[[...TEAM_PAGES, ...ORGANISER_PAGES, ...ADMIN_PAGES], guest?.athleteId],
		];
		for (const [paths, athleteId] of views) {
			const cookie = await riderCookie(athleteId ?? "0");
			for (const path of paths) {
				const { status, markup } = await getPage(path, "en", cookie);
				// A team without team events sends /organiser on to the riders.
				expect.soft([200, 302], path).toContain(status);
				if (path !== "/me" || athleteId !== guest?.athleteId) {
					expect.soft(markup, `${path} as ${athleteId}`).not.toContain(name);
				}
			}
		}
	}, 120_000);

	it("isn't among the admin view's connected or active riders", async () => {
		const connected = (await rows(
			"SELECT COUNT(*) AS n FROM riders WHERE status = 'connected' AND guest = 0",
		)) as { n: number }[];
		expect(await connectedCountStatement(env.DB).first<number>("n")).toBe(
			connected[0]?.n,
		);
		const withGuest = await countActiveRiders(env.DB, NOW);
		await env.DB.prepare("UPDATE riders SET guest = 0 WHERE athlete_id = ?")
			.bind(guest?.athleteId)
			.run();
		const asRider = await countActiveRiders(env.DB, NOW);
		await env.DB.prepare("UPDATE riders SET guest = 1 WHERE athlete_id = ?")
			.bind(guest?.athleteId)
			.run();
		expect(asRider).toBe(withGuest + 1);
	});

	it("is listed in the admin riders list only as a guest", async () => {
		const { markup } = await getPage(
			"/admin/riders",
			"en",
			await riderCookie(admin?.athleteId ?? "0"),
		);
		const [team, guests] = markup.split("<h2>Guests</h2>");
		expect(team).not.toContain(guest?.firstName);
		expect(guests).toContain(`<h3>${guest?.firstName}</h3>`);
	});
});
