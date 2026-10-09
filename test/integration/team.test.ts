import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { makeCtx, resetDb } from "../support/ctx";
import {
	ATHLETE_A,
	ATHLETE_B,
	ATHLETE_C,
	firstNameFor,
} from "../support/fixtures";
import { RIDE_NAMES, seedPageRiders } from "../support/pages";
import { riderPage } from "../support/rider-view";

// Team at `/team`: the leaderboard for riders and organisers alike, with no
// other rider's name or rides (feature 011 FR-013, feature 016 FR-010), and the
// way to the organiser pages for organisers (016 FR-002, research R8).

const ctx = makeCtx();
const { de } = CATALOGS;
const RIDERS = [ATHLETE_A, ATHLETE_B, ATHLETE_C];

/** The `main` element of a page. */
function mainOf(page: string): string {
	return page.match(/<main[^>]*>[\s\S]*<\/main>/)?.[0] ?? "";
}

beforeEach(async () => {
	await resetDb();
	await seedPageRiders(ctx);
	await env.DB.prepare("UPDATE riders SET organiser = 1 WHERE athlete_id = ?")
		.bind(ATHLETE_C)
		.run();
});

describe.each([
	["a rider", ATHLETE_A],
	["an organiser", ATHLETE_C],
])("GET /team for %s", (_name, viewer) => {
	it("shows the leaderboard with Team marked current (011 US5-AS1, US5-AS2)", async () => {
		const { status, html } = await riderPage(ctx, viewer, "/team");
		expect(status).toBe(200);
		expect(mainOf(html)).toContain('<section class="leaderboard card">');
		expect(html).toMatch(/<a href="\/team" aria-current="page">/);
	});

	it("shows no other rider's name or rides, though the team has some", async () => {
		const { html } = await riderPage(ctx, viewer, "/team");
		for (const name of Object.values(RIDE_NAMES).flat()) {
			expect(html).not.toContain(escapeHtml(name));
		}
		for (const other of RIDERS.filter((id) => id !== viewer)) {
			expect(html).not.toContain(firstNameFor(other));
		}
	});
});

// Feature 014 FR-002, 016 FR-002, research R8: the way to the team overview
// and the organiser pages, for organisers only.
describe("the organiser entry on /team", () => {
	it("links the overview and the organiser pages for a rider with the organiser flag", async () => {
		const { html } = await riderPage(ctx, ATHLETE_C, "/team");
		const main = mainOf(html);
		expect(main).toContain('<p class="organiser-entry">');
		expect(main).toContain(
			`<a class="button-outlined" href="/organiser/riders">${escapeHtml(de["team.organiser.overview"])}</a>`,
		);
		expect(main).toContain(
			`<a class="button-outlined" href="/organiser">${escapeHtml(de["organiser.link"])}</a>`,
		);
	});

	it("is not there for a rider without it", async () => {
		const { html } = await riderPage(ctx, ATHLETE_A, "/team");
		expect(mainOf(html)).not.toContain("organiser-entry");
		expect(html).not.toContain('href="/organiser');
	});
});
