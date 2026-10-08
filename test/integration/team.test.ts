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

// Team at `/team`: a placeholder for riders and organisers alike, with no
// rider's data even when the team has some (feature 011 FR-013, US5-AS1–3),
// under the coin's Hamburg–Paris side (feature 012 FR-003).

const ctx = makeCtx();
const { de } = CATALOGS;
const RIDERS = [ATHLETE_A, ATHLETE_B, ATHLETE_C];

const PLACEHOLDER =
	/<section class="placeholder">\n<svg [^>]*aria-hidden="true"[^>]*><use href="#coin-back"\/><\/svg>\n<h2>([^<]*)<\/h2>\n<p>([^<]*)<\/p>\n<\/section>/;

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
	it("shows the placeholder with Team marked current (US5-AS1, US5-AS2)", async () => {
		const { status, html } = await riderPage(ctx, viewer, "/team");
		expect(status).toBe(200);
		const main = mainOf(html);
		const [, heading, body] = main.match(PLACEHOLDER) ?? [];
		expect(heading).toBe(escapeHtml(de["team.placeholder.heading"]));
		expect(body).toBe(escapeHtml(de["team.placeholder.body"]));
		expect(main.match(/<section[^>]*>/g)).toEqual([
			'<section class="placeholder">',
		]);
		expect(html).toMatch(/<a href="\/team" aria-current="page">/);
	});

	it("shows no rider's data, though the team has some (US5-AS3)", async () => {
		const { html } = await riderPage(ctx, viewer, "/team");
		for (const name of Object.values(RIDE_NAMES).flat()) {
			expect(html).not.toContain(escapeHtml(name));
		}
		for (const other of RIDERS.filter((id) => id !== viewer)) {
			expect(html).not.toContain(firstNameFor(other));
		}
		expect(mainOf(html).replace(/<[^>]*>/g, "")).not.toMatch(/\d/);
	});
});
