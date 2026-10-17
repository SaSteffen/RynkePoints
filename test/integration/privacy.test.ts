import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { makeCtx, request } from "../support/ctx";

// The privacy notice (feature 017): public, in every language, with the
// controller and contact address from the settings (vitest.config.ts), and
// linked from every page's footer.

const ctx = makeCtx();

async function get(path: string, acceptLanguage?: string) {
	const res = await handleFetch(request(path, { acceptLanguage }), ctx);
	return { res, page: await res.text() };
}

const HEADINGS = [
	"privacy.title",
	"privacy.controller.heading",
	"privacy.purpose.heading",
	"privacy.strava.heading",
	"privacy.team.heading",
	"privacy.technical.heading",
	"privacy.visibility.heading",
	"privacy.legal.heading",
	"privacy.retention.heading",
	"privacy.recipients.heading",
	"privacy.links.heading",
	"privacy.rights.heading",
	"privacy.changes.heading",
] as const;

describe("GET /privacy", () => {
	it.each(["de", "en"] as const)(
		"is public and complete in %s",
		async (lang) => {
			const { res, page } = await get("/privacy", lang);
			expect(res.status).toBe(200);
			expect(res.headers.get("Content-Language")).toBe(lang);
			const catalog = CATALOGS[lang];
			for (const id of HEADINGS) {
				expect(page, id).toContain(escapeHtml(catalog[id]));
			}
			expect(page).toContain(escapeHtml(catalog["privacy.strava.never"]));
		},
	);

	it("says organisers see what riders report at team events (019 FR-052)", async () => {
		const { page } = await get("/privacy", "de");
		for (const id of [
			"privacy.team.body",
			"privacy.visibility.organisers",
		] as const) {
			expect(page, id).toContain(escapeHtml(CATALOGS.de[id]));
			expect(CATALOGS.de[id], id).toContain("Teamtermin");
		}
		expect(CATALOGS.de["privacy.visibility.organisers"]).toContain(
			"gemeldet hast, dass du dabei bist oder warst",
		);
		expect(CATALOGS.de["consent.organisers"]).toContain(
			"gemeldet hast, dass du dabei bist oder warst",
		);
	});

	it("names the controller and links the contact address", async () => {
		const { page } = await get("/privacy", "de");
		expect(page).toContain(
			'<p class="privacy-controller">Synthetic Controller<br>Teststraße 1<br>20095 Hamburg</p>',
		);
		expect(page).toContain(
			'<a href="mailto:privacy@example.org">privacy@example.org</a>',
		);
	});

	it("links Strava's privacy policy", async () => {
		const { page } = await get("/privacy", "en");
		expect(page).toContain(
			'<a href="https://www.strava.com/legal/privacy">Strava Privacy Policy</a>',
		);
	});

	it("is linked from the footer of every page", async () => {
		for (const path of ["/", "/privacy", "/notice/team-full"]) {
			const { page } = await get(path, "en");
			expect(page, path).toMatch(
				/<footer>[\s\S]*<a href="\/privacy">Privacy and contact<\/a>[\s\S]*<\/footer>/,
			);
		}
	});
});
