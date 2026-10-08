import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { riderPage } from "../support/rider-view";

// Settings at `/me/settings` in the seven groups of feature 011 FR-014
// (contracts/pages.md "Settings", contracts/client.md; US4-AS1, US4-AS5).

const ctx = makeCtx();
const { de } = CATALOGS;

const GROUPS = [
	["settings-language", "settings.language"],
	["settings-appearance", "settings.appearance"],
	["notifications", "notifications.heading"],
	["settings-app", "settings.app"],
	["settings-strava", "settings.strava"],
	["settings-consent", "me.consent.heading"],
	["settings-account", "settings.account"],
] as const;

/** Each `section.settings-group` of the page by id, in page order. */
function groups(page: string): [string, string][] {
	return [
		...page.matchAll(
			/<section id="([\w-]+)" class="settings-group"[^>]*>([\s\S]*?)<\/section>/g,
		),
	].map((m) => [m[1] as string, m[0]]);
}

async function settings(options: { needsReconnect?: boolean } = {}) {
	await seedRider(ctx, {
		athleteId: ATHLETE_A,
		status: options.needsReconnect ? "needs_reconnect" : "connected",
	});
	const { status, html } = await riderPage(ctx, ATHLETE_A, "/me/settings");
	expect(status).toBe(200);
	return { page: html, group: Object.fromEntries(groups(html)) };
}

beforeEach(resetDb);

describe("GET /me/settings (011 FR-014)", () => {
	it("has the seven groups in order, each with its heading", async () => {
		const { page, group } = await settings();
		expect(groups(page).map(([id]) => id)).toEqual(GROUPS.map(([id]) => id));
		for (const [id, key] of GROUPS) {
			expect(group[id]).toContain(`<h2>${escapeHtml(de[key])}</h2>`);
		}
	});

	it("switches the language and comes back to Settings (US4-AS2)", async () => {
		const { group } = await settings();
		const language = group["settings-language"];
		expect(language).toContain('<form method="post" action="/lang"');
		expect(language).toContain(
			'<input type="hidden" name="next" value="/me/settings">',
		);
		expect(language).toContain(
			'<button class="segmented" name="lang" value="de" lang="de" aria-current="true">Deutsch</button>',
		);
		expect(language).toContain(
			'<button class="segmented" name="lang" value="en" lang="en">English</button>',
		);
	});

	it("offers System, Light and Dark for this device (FR-032a)", async () => {
		const { group } = await settings();
		const appearance = group["settings-appearance"] ?? "";
		expect(appearance).toContain('<fieldset class="segmented-group">');
		const radios = [
			...appearance.matchAll(
				/<label><input type="radio" name="scheme" value="(\w+)">([^<]*)<\/label>/g,
			),
		].map((m) => [m[1], m[2]]);
		expect(radios).toEqual([
			["system", de["settings.scheme.system"]],
			["light", de["settings.scheme.light"]],
			["dark", de["settings.scheme.dark"]],
		]);
		expect(appearance).toContain(
			`<p>${escapeHtml(de["settings.appearance.hint"])}</p>`,
		);
	});

	it("has one notifications switch and starts hidden (contracts/client.md)", async () => {
		const { page, group } = await settings();
		expect(page).toMatch(/<section id="notifications" [^>]*\bhidden>/);
		const section = group.notifications ?? "";
		const switches = section.match(/<button [^>]*role="switch"[^>]*>/g) ?? [];
		expect(switches).toHaveLength(1);
		const [button] = switches as [string];
		expect(button).toContain('data-action="toggle"');
		expect(button).toContain('aria-checked="false"');
		expect(button).toContain(
			`aria-label="${escapeHtml(de["notifications.switch"])}"`,
		);
		expect(section).not.toContain('data-action="on"');
		expect(section).not.toContain('data-action="off"');
	});

	it("holds the hidden install hint in a hidden App group (US4-AS5)", async () => {
		const { page, group } = await settings();
		expect(page).toMatch(
			/<section id="settings-app" class="settings-group" hidden>/,
		);
		expect(group["settings-app"]).toContain(
			'<aside id="install" class="notice" hidden>',
		);
	});

	it("only offers Reconnect when the connection needs it", async () => {
		const reconnect = `<a class="button" href="/connect?next=/me/settings">${escapeHtml(de["me.reconnect"])}</a>`;
		const change = `<a class="button-outlined" href="/connect?next=/me/settings">${escapeHtml(de["me.changePermissions"])}</a>`;
		const connected = (await settings()).group["settings-strava"];
		expect(connected).toContain(change);
		expect(connected).not.toContain(reconnect);
		await resetDb();
		const needs = (await settings({ needsReconnect: true })).group[
			"settings-strava"
		];
		expect(needs).toContain(reconnect);
		expect(needs).toContain(change);
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

	it("signs out with this device's endpoint and links to disconnecting", async () => {
		const { group } = await settings();
		const account = group["settings-account"];
		expect(account).toContain(
			`<form method="post" action="/logout"><input type="hidden" name="push_endpoint" value=""><button class="button-outlined">${escapeHtml(de["layout.logout"])}</button></form>`,
		);
		expect(account).toContain(
			`<a class="danger" href="/me/disconnect">${escapeHtml(de["me.disconnect.button"])}</a>`,
		);
	});
});
