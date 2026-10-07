import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSION } from "../../src/consent";
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
			"consent.heading",
			"consent.organisers",
			"consent.team",
			"consent.required",
			"consent.write",
			"consent.agree",
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

	it("names the ride name among the data read (008 FR-007)", async () => {
		const { page: german } = await get();
		expect(german).toContain("nur Namen, Sportart");
		expect(german).toContain("Deine einzelnen Fahrten und ihre Namen");
		const { page: english } = await get({ acceptLanguage: "en" });
		expect(english).toContain("only read name, sport type");
		expect(english).toContain("your individual rides or their names");
		// Named, not a new consent: no new scope or request (clarification Q1).
		expect(CONSENT_VERSION).toBe(1);
	});

	it("explains notifications after the cookies (010 FR-030, research R14)", async () => {
		for (const [catalog, acceptLanguage] of [
			[de, "de"],
			[en, "en"],
		] as const) {
			const { page } = await get({ acceptLanguage });
			const cookies = page.indexOf(escapeHtml(catalog["landing.cookies"]));
			const notifications = page.indexOf(
				`<p>${escapeHtml(catalog["landing.notifications"])}</p>`,
			);
			expect(cookies).toBeGreaterThan(0);
			expect(notifications).toBeGreaterThan(cookies);
		}
		expect(de["landing.notifications"]).toContain("Google, Apple, Mozilla");
		// Named, not a new consent: no Strava scope or request (R14).
		expect(CONSENT_VERSION).toBe(1);
	});

	it("names who sees what and that write access is optional", async () => {
		const { page } = await get();
		expect(page).toContain("<h2>Was du mit dem Verbinden erlaubst</h2>");
		expect(page).toContain(
			"Deine einzelnen Fahrten und ihre Namen sieht niemand außer dir.",
		);
		expect(page).toContain("ohne deinen Namen");
		expect(page).toContain("Ohne diese Erlaubnis machst du genauso mit");
	});

	it("shows the consent form with the Connect with Strava button", async () => {
		const { page } = await get();
		expect(page).toContain('<form method="post" action="/connect">');
		expect(page).toContain(
			'<input type="checkbox" name="consent" value="1" required>',
		);
		expect(page).toContain(
			`<button><img src="${de["brand.connectWithStrava.src"]}" alt="Mit Strava verbinden"></button>`,
		);
		expect(page).not.toContain('<a href="/connect">');
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
		expect(page).toContain(escapeHtml(en["consent.agree"]));
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

describe("GET /me consent section (008 FR-007)", () => {
	it("shows a connected rider what is read, before who sees what", async () => {
		await seedRider(ctx, { consentVersion: CONSENT_VERSION });
		const res = await handleFetch(
			request("/me", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
			ctx,
		);
		const page = await res.text();
		const section = page.match(
			/<h2>Deine Zustimmung<\/h2>([\s\S]*?)<\/section>/,
		)?.[1];
		expect(section).toBeDefined();
		const dataRead = section?.indexOf(escapeHtml(de["landing.dataRead"])) ?? -1;
		expect(dataRead).toBeGreaterThan(-1);
		expect(dataRead).toBeLessThan(
			section?.indexOf(escapeHtml(de["consent.organisers"])) ?? -1,
		);
	});
});
