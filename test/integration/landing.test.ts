import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";

const ctx = makeCtx();
const { de, en } = CATALOGS;

async function get(options: Parameters<typeof request>[1] = {}) {
	const res = await handleFetch(request("/", options), ctx);
	return { res, page: await res.text() };
}

beforeEach(resetDb);

describe("GET / (signed out)", () => {
	it("explains the app in German by default", async () => {
		const { res, page } = await get();
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Language")).toBe("de");
		expect(page).toContain('<html lang="de">');
		for (const id of [
			"landing.intro",
			"landing.dataRead",
			"landing.private",
			"landing.purpose",
			"landing.leave",
			"landing.backups",
			"landing.cookies",
		] as const) {
			expect(page).toContain(escapeHtml(de[id]));
		}
		expect(page).toContain(
			"Gelöschte Daten bleiben bis zu 7 Tage in den Sicherungen unseres Hosting-Anbieters",
		);
		expect(page).toContain(
			'<a href="https://www.strava.com/clubs/2372209">unseres Team-Clubs auf Strava</a>',
		);
		expect(page).toContain("Mitmachen können nur Mitglieder");
	});

	it("names every activity figure that is read (FR-002)", async () => {
		const { page: german } = await get();
		for (const figure of [
			"Gesamtzeit mit Pausen",
			"manuell eingetragen",
			"Rollentrainer",
			"ob Strava sie markiert hat",
		]) {
			expect(german).toContain(figure);
		}
		const { page: english } = await get({ acceptLanguage: "en" });
		for (const figure of [
			"elapsed time including pauses",
			"entered manually",
			"indoor trainer",
			"whether Strava has flagged it",
		]) {
			expect(english).toContain(figure);
		}
	});

	it("shows the German Connect with Strava button", async () => {
		const { page } = await get();
		expect(page).toContain(
			`<a href="/connect"><img src="${de["brand.connectWithStrava.src"]}" alt="Mit Strava verbinden"></a>`,
		);
	});

	it("offers the language switcher before connecting", async () => {
		const { page } = await get();
		expect(page).toContain('<form method="post" action="/lang"');
		expect(page).toContain('<input type="hidden" name="next" value="/">');
	});

	it("renders English for an English browser", async () => {
		const { res, page } = await get({
			acceptLanguage: "en-US,en;q=0.9,de;q=0.8",
		});
		expect(res.headers.get("Content-Language")).toBe("en");
		expect(page).toContain('<html lang="en">');
		expect(page).toContain(escapeHtml(en["landing.backups"]));
		expect(page).toContain(
			`<img src="${en["brand.connectWithStrava.src"]}" alt="Connect with Strava">`,
		);
	});

	it("renders English when rp_lang=en beats a German browser", async () => {
		const { page } = await get({
			acceptLanguage: "de",
			cookies: { rp_lang: "en" },
		});
		expect(page).toContain('<html lang="en">');
		expect(page).toContain(escapeHtml(en["landing.dataRead"]));
	});
});

describe("GET / (signed in)", () => {
	it("redirects a connected rider to /me", async () => {
		await seedRider(ctx);
		const { res } = await get({ cookies: await sessionCookie(ctx, ATHLETE_A) });
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/me");
	});

	it("treats a session for a deleted rider as signed out", async () => {
		const { res } = await get({ cookies: await sessionCookie(ctx, ATHLETE_A) });
		expect(res.status).toBe(200);
	});
});
