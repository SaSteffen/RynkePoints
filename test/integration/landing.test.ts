import { beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSION, CONSENT_VERSIONS } from "../../src/consent";
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

/** Strava's button in both variants; the scheme CSS shows one (011 R13). */
const connectButton = (c: typeof de) =>
	`<button><img class="cws cws-light" src="${c["brand.connectWithStrava.src"]}" alt="${escapeHtml(c["brand.connectWithStrava.alt"])}"><img class="cws cws-dark" src="${c["brand.connectWithStrava.srcDark"]}" alt="${escapeHtml(c["brand.connectWithStrava.alt"])}"></button>`;

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
			"consent.short.notRead",
			"consent.short.read",
			"consent.short.shown",
			"consent.details",
			"consent.organisers",
			"consent.team",
			"consent.required",
			"consent.write",
			"consent.agree",
		] as const) {
			expect(page).toContain(escapeHtml(de[id]));
		}
		expect(page).toContain(
			"Gelöschte Daten bleiben noch bis zu 7\u00a0Tage in den Sicherungen unseres Hosting-Anbieters",
		);
		expect(page).toContain(
			'<a href="https://www.strava.com/clubs/2372209">unseres Team-Clubs auf Strava</a>',
		);
		expect(page).toContain("Mitmachen können nur Mitglieder");
	});

	it("opens with the Rynke coin and the tagline (012 FR-003)", async () => {
		const { page } = await get();
		expect(page).toMatch(
			new RegExp(
				`<div class="landing-hero">\\n<svg class="coin coin-hero"[^>]*><use href="#coin-front"/></svg>\\n<h1>RynkePoints</h1>\\n<p class="tagline">${escapeHtml(de["landing.tagline"])}</p>\\n</div>`,
			),
		);
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

	it("says in short what is read and keeps every detail one tap away", async () => {
		const { page } = await get();
		const short = page.indexOf(
			`<p>${escapeHtml(de["consent.short.notRead"])}<br>${escapeHtml(de["consent.short.read"])}</p>`,
		);
		const details = page.indexOf(
			`<details class="more"><summary class="tap">${escapeHtml(de["consent.details"])}</summary>`,
		);
		const dataRead = page.indexOf(
			`<p>${escapeHtml(de["landing.dataRead"])}</p>`,
		);
		expect(short).toBeGreaterThan(0);
		expect(details).toBeGreaterThan(short);
		expect(dataRead).toBeGreaterThan(details);
		expect(page.indexOf("</details>")).toBeGreaterThan(dataRead);
	});

	it("names the ride name among the data read (008 FR-007)", async () => {
		const { page: german } = await get();
		expect(german).toContain("nur Namen, Sportart");
		expect(german).toContain("Deine einzelnen Fahrten und ihre Namen");
		const { page: english } = await get({ acceptLanguage: "en" });
		expect(english).toContain("only read its name, sport type");
		expect(english).toContain("your individual rides and their names");
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
			"Deine einzelnen Fahrten und ihre Namen siehst nur du.",
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
		expect(page).toContain(connectButton(de));
		expect(page).toContain('alt="Mit Strava verbinden"');
		expect(page).not.toContain('<a href="/connect">');
	});

	it("renders the shared consent form with the current version (004 R11)", async () => {
		const form = (version: number) =>
			`<form method="post" action="/connect">
<p><label><input type="checkbox" name="consent" value="${version}" required> ${escapeHtml(de["consent.agree"])}</label></p>
${connectButton(de)}
</form>`;
		expect((await get()).page).toContain(form(1));

		const v2Ctx = makeCtx({
			consentVersions: [
				...CONSENT_VERSIONS,
				{
					version: 2,
					published: "2026-11-01",
					requiredScopes: ["read", "activity:read"],
					changes: ["consent.team"],
				},
			],
		});
		const res = await handleFetch(request("/"), v2Ctx);
		expect(await res.text()).toContain(form(2));
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
		expect(page).toContain(connectButton(en));
		expect(page).toContain('alt="Connect with Strava"');
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
	it("redirects a connected rider to /team (#73)", async () => {
		await seedRider(ctx);
		const { res } = await get({ cookies: await sessionCookie(ctx, ATHLETE_A) });
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/team");
	});

	it("treats a session for a deleted rider as signed out", async () => {
		const { res } = await get({ cookies: await sessionCookie(ctx, ATHLETE_A) });
		expect(res.status).toBe(200);
	});
});

describe("GET /me/settings consent section (008 FR-007)", () => {
	it("shows a connected rider what is read, before who sees what", async () => {
		await seedRider(ctx, { consentVersion: CONSENT_VERSION });
		const res = await handleFetch(
			request("/me/settings", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
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
