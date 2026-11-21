import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { APP_VERSION } from "../../src/changelog";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { riderPage } from "../support/rider-view";

// Settings at `/me/settings` (feature 011 FR-014, contracts/client.md; US4-AS1,
// US4-AS5) as the settings redesign canvas lays it out: the Strava card, then
// rows in groups.

const ctx = makeCtx();
const { de } = CATALOGS;

/** The page's group headings, in order. */
const GROUPS = [
	"settings.device",
	"settings.data",
	"settings.about",
	"settings.account",
] as const;

/** The rows of the page by id, in page order. */
const ROWS = [
	"settings-app",
	"notifications",
	"settings-language",
	"settings-shows",
	"settings-rules",
	"settings-consent",
] as const;

/** The element with `id` up to its closing tag, `<li>` rows nesting none. */
function part(page: string, id: string, tag = "li"): string {
	const start = page.indexOf(`<${tag} id="${id}"`);
	expect(start).toBeGreaterThan(-1);
	return page.slice(start, page.indexOf(`</${tag}>`, start));
}

async function settings(options: { needsReconnect?: boolean } = {}) {
	await seedRider(ctx, {
		athleteId: ATHLETE_A,
		status: options.needsReconnect ? "needs_reconnect" : "connected",
	});
	const { status, html } = await riderPage(ctx, ATHLETE_A, "/me/settings");
	expect(status).toBe(200);
	return html;
}

beforeEach(resetDb);

describe("GET /me/settings (011 FR-014)", () => {
	it("has the Strava card first, then the groups and rows in order", async () => {
		const page = await settings();
		const headings = [
			...page.matchAll(
				/<section class="settings-section" [^>]*>\n<h2 [^>]*>([^<]*)<\/h2>/g,
			),
		].map((m) => m[1]);
		expect(headings).toEqual(GROUPS.map((key) => escapeHtml(de[key])));
		const at = (id: string) => page.indexOf(` id="${id}"`);
		expect(at("settings-strava")).toBeGreaterThan(-1);
		expect(at("settings-strava")).toBeLessThan(at(ROWS[0]));
		for (const [before, after] of ROWS.slice(1).map((id, i) => [ROWS[i], id])) {
			expect(at(before as string)).toBeLessThan(at(after as string));
		}
		expect(page).toContain(
			`<p class="settings-note">${escapeHtml(de["theme.menu.note"])}</p>`,
		);
	});

	it("switches the language and comes back to Settings (US4-AS2)", async () => {
		const language = part(await settings(), "settings-language");
		expect(language).toContain('<span class="settings-value">Deutsch</span>');
		expect(language).toContain('<form method="post" action="/lang"');
		expect(language).toContain(
			'<input type="hidden" name="next" value="/me/settings">',
		);
		expect(language).toContain(
			'<button class="lang-option" name="lang" value="de" lang="de" aria-current="true">Deutsch<svg',
		);
		expect(language).toContain(
			'<button class="lang-option" name="lang" value="en" lang="en">English</button>',
		);
	});

	it("opens the header's theme menu for the colour scheme (022 FR-016)", async () => {
		const page = await settings();
		const main = page.slice(page.indexOf("<main>"), page.indexOf("</main>"));
		expect(main).not.toContain('name="scheme"');
		expect(main).not.toContain('name="theme"');
		expect(main).toContain(
			'<button type="button" class="settings-row" aria-haspopup="dialog" aria-controls="theme-menu">',
		);
		expect(main).toContain(escapeHtml(de["theme.menu.title"]));
	});

	it("has one notifications switch and starts hidden (contracts/client.md)", async () => {
		const page = await settings();
		expect(page).toMatch(/<li id="notifications" [^>]*\bhidden>/);
		const row = part(page, "notifications");
		const switches = row.match(/<button [^>]*role="switch"[^>]*>/g) ?? [];
		expect(switches).toHaveLength(1);
		const [button] = switches as [string];
		expect(button).toContain('data-action="toggle"');
		expect(button).toContain('aria-checked="false"');
		expect(button).toContain(
			`aria-label="${escapeHtml(de["notifications.switch"])}"`,
		);
		expect(row).toContain(
			`<p class="settings-sub" data-state="on off" hidden>${escapeHtml(de["notifications.explain"])}</p>`,
		);
		expect(row).not.toContain('data-action="on"');
		expect(row).not.toContain('data-action="off"');
	});

	it("holds the hidden install hint in a hidden row (US4-AS5)", async () => {
		const page = await settings();
		expect(page).toContain('<li id="settings-app" hidden>');
		expect(part(page, "settings-app")).toContain(
			'<aside id="install" class="notice" hidden>',
		);
	});

	it("only offers Reconnect when the connection needs it", async () => {
		const reconnect = `<a class="button" href="/connect?next=/me/settings">${escapeHtml(de["me.reconnect"])}</a>`;
		const change = `<a class="button-outlined" href="/connect?next=/me/settings">${escapeHtml(de["me.changePermissions"])}</a>`;
		const connected = part(await settings(), "settings-strava", "section");
		expect(connected).toContain(change);
		expect(connected).toContain(escapeHtml(de["me.status.connected"]));
		expect(connected).not.toContain(reconnect);
		await resetDb();
		const needs = part(
			await settings({ needsReconnect: true }),
			"settings-strava",
			"section",
		);
		expect(needs).toContain(reconnect);
		expect(needs).toContain(escapeHtml(de["settings.strava.broken"]));
		expect(needs).not.toContain(change);
	});

	it("puts the rules version on the rules row", async () => {
		const rules = part(await settings(), "settings-rules");
		expect(rules).toMatch(
			/<summary class="settings-row">[\s\S]*Regel-Version\u00a0\d+, gültig seit dem [\s\S]*<\/summary>/,
		);
	});

	it.each([
		["/me", de["me.title"]],
		["/me/rides", `${de["nav.rides"]} – RynkePoints`],
		["/team", `${de["nav.team"]} – RynkePoints`],
		["/me/settings", `${de["nav.settings"]} – RynkePoints`],
	])("names %s in the page title", async (path, title) => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		const { html } = await riderPage(ctx, ATHLETE_A, path);
		expect(html).toContain(`<title>${escapeHtml(title)}</title>`);
	});

	it("shows the app's version and links to the changelog", async () => {
		const page = await settings();
		expect(page).toMatch(
			new RegExp(
				`<a class="settings-row" href="/changelog">[\\s\\S]*${escapeHtml(de["changelog.title"])}[\\s\\S]*<span class="settings-value">${escapeHtml(de["changelog.version"].replace("{version}", APP_VERSION)).replaceAll(".", "\\.")}</span></a>`,
			),
		);
	});

	it("signs out with this device's endpoint and links to disconnecting", async () => {
		const page = await settings();
		expect(page).toContain(
			'<form method="post" action="/logout"><input type="hidden" name="push_endpoint" value=""><button class="settings-row" aria-labelledby="settings-logout" aria-describedby="settings-logout-sub">',
		);
		expect(page).toContain(
			`<span class="settings-title" id="settings-logout">${escapeHtml(de["layout.logout"])}</span>`,
		);
		expect(page).toContain(
			'<form method="post" action="/logout/everywhere"><button class="settings-row"',
		);
		expect(page).toMatch(
			new RegExp(
				`<ul class="settings-list settings-danger">\\n<li><a class="settings-row" href="/me/disconnect">[\\s\\S]*${escapeHtml(de["me.disconnect.button"])}`,
			),
		);
	});
});

describe("the accepted consent's label (ride stats ranking)", () => {
	const label = async (revision: number) => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await env.DB.prepare("UPDATE consent_records SET revision = ?")
			.bind(revision)
			.run();
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/settings");
		return html;
	};

	it("shows 3.1 for a record of revision 1", async () => {
		expect(await label(1)).toMatch(/\(Version\s3\.1\)/);
	});

	it("shows 3 for a record of revision 0", async () => {
		const page = await label(0);
		expect(page).toMatch(/\(Version\s3\)/);
		expect(page).not.toMatch(/Version\s3\.1/);
	});
});
