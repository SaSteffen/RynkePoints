import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { createSessionCookie } from "../../src/http/session";
import { THEMES } from "../../src/http/themes";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	cookiePair,
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";

// The four sections of the signed-in area (feature 011 FR-001–FR-003, FR-007,
// FR-016, contracts/http-routes.md, contracts/pages.md "Layout").

const ctx = makeCtx();
const { de } = CATALOGS;
const DAY = 86400;

/** `short`: the navigation's label where the full one doesn't fit. */
const SECTIONS: { path: string; label: string; short?: string }[] = [
	{ path: "/team", label: de["nav.team"] },
	{ path: "/me", label: de["nav.you"] },
	{ path: "/me/rides", label: de["nav.rides"] },
	{ path: "/me/badges", label: de["nav.badges"] },
	// Feature 019: riders who aren't organisers have Termine where Orga is.
	{ path: "/events", label: de["nav.events"] },
	{
		path: "/me/settings",
		label: de["nav.settings"],
		short: de["nav.settings.short"],
	},
];

/** Each section's URL and the nav link it marks current. */
const PAGES = [
	...SECTIONS.map(({ path }) => ({ url: path, current: path })),
	{ url: "/me/rides?page=2", current: "/me/rides" },
];

async function get(url: string, cookies?: Record<string, string>) {
	const res = await handleFetch(
		request(url, { cookies: cookies ?? (await sessionCookie(ctx, ATHLETE_A)) }),
		ctx,
	);
	return { res, html: await res.text() };
}

/** The `<nav class="app-nav">` elements of a page. */
function navs(html: string): string[] {
	return html.match(/<nav class="app-nav"[\s\S]*?<\/nav>/g) ?? [];
}

beforeEach(resetDb);

describe.each(PAGES)("GET $url", ({ url, current }) => {
	it("sends a visitor to the start page", async () => {
		const { res } = await get(url, {});
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it("sends a deleted rider to the start page", async () => {
		const { res } = await get(url);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it("shows the gate without navigation to a rider without consent, returning here", async () => {
		await seedRider(ctx, { consentVersion: null });
		const { res, html } = await get(url);
		expect(res.status).toBe(200);
		expect(html).toContain(de["me.consent.renew.heading"]);
		expect(navs(html)).toEqual([]);
		expect(html).toContain('<body class="public">');
		const forms = html.match(/<form method="post" action="\/connect">/g);
		expect(forms).toHaveLength(1);
		expect(html).toContain(
			`<form method="post" action="/connect">\n<input type="hidden" name="next" value="${url}">`,
		);
	});

	it("shows the shell with one navigation bar to an agreed rider", async () => {
		await seedRider(ctx);
		const { res, html } = await get(url);
		expect(res.status).toBe(200);
		expect(html).toContain('<body class="shell">');
		const [nav, ...more] = navs(html);
		expect(more).toEqual([]);
		expect(nav).toContain(`aria-label="${de["nav.label"]}"`);
		const links = [...(nav ?? "").matchAll(/<a ([^>]*)>([\s\S]*?)<\/a>/g)];
		expect(
			links.map(([, attrs]) => attrs?.match(/href="([^"]*)"/)?.[1]),
		).toEqual(SECTIONS.map(({ path }) => path));
		links.forEach(([, attrs = "", inner = ""], i) => {
			const section = SECTIONS[i];
			expect(inner).toMatch(
				/^<span class="nav-icon"><svg [^>]*aria-hidden="true"[\s\S]*<\/svg><\/span>/,
			);
			expect(inner).toContain(
				section?.short
					? `<span class="nav-label nav-label-short">${section.short}</span><span class="nav-label nav-label-full">${section.label}</span>`
					: `<span class="nav-label">${section?.label}</span>`,
			);
			// A short label keeps the full one as the link's name.
			expect(attrs.includes(`aria-label="${section?.label}"`)).toBe(
				section?.short !== undefined,
			);
			expect(attrs.includes('aria-current="page"')).toBe(
				SECTIONS[i]?.path === current,
			);
		});
		expect(html.match(/aria-current="page"/g)).toHaveLength(1);
	});

	it("has the refresh link, the nav after the footer and no header language form", async () => {
		await seedRider(ctx);
		const { html } = await get(url);
		expect(html).toContain(
			`<a class="icon-button refresh" href="${url}" aria-label="${de["shell.refresh"]}">`,
		);
		expect(html.indexOf("</footer>")).toBeGreaterThan(0);
		expect(html.indexOf('<nav class="app-nav"')).toBeGreaterThan(
			html.indexOf("</footer>"),
		);
		const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
		expect(header).toContain('<header class="top-bar">');
		expect(header).toMatch(
			/<span class="wordmark"><svg class="coin coin-mark"[^>]*><use href="#coin-front"\/><\/svg><span class="wordmark-name">Rynke<span>Points<\/span><\/span><\/span>/,
		);
		expect(header).not.toContain('action="/lang"');
		const lang = html.match(/<form method="post" action="\/lang"/g) ?? [];
		expect(lang).toHaveLength(current === "/me/settings" ? 1 : 0);
	});

	it("names the section in the top bar", async () => {
		await seedRider(ctx);
		const { html } = await get(url);
		const label = SECTIONS.find(({ path }) => path === current)?.label;
		expect(html).toContain(`<h1 class="section-title">${label}</h1>`);
	});

	it("answers HEAD like GET and renews a 10-day-old session", async () => {
		await seedRider(ctx);
		const old = cookiePair(
			await createSessionCookie(ATHLETE_A, NOW - 10 * DAY, ctx.env),
		);
		for (const method of ["GET", "HEAD"]) {
			const res = await handleFetch(
				request(url, { method, cookies: old }),
				ctx,
			);
			expect(res.status).toBe(200);
			const renewed = res.headers
				.getSetCookie()
				.filter((c) => c.startsWith("rp_session="));
			expect(renewed).toEqual([
				await createSessionCookie(ATHLETE_A, NOW, ctx.env),
			]);
		}
	});
});

// Feature 016: organisers get Orga before Settings, on every section, and
// no Termine (feature 019 research R8).
describe("the navigation of an organiser", () => {
	it.each(SECTIONS.filter(({ path }) => path !== "/events"))(
		"has Orga before Settings on $path",
		async ({ path }) => {
			await seedRider(ctx, { organiser: true });
			const { html } = await get(path);
			const [nav] = navs(html);
			const hrefs = [...(nav ?? "").matchAll(/<a href="([^"]*)"/g)].map(
				(m) => m[1],
			);
			expect(hrefs).toEqual([
				"/team",
				"/me",
				"/me/rides",
				"/me/badges",
				"/organiser/riders",
				"/me/settings",
			]);
			expect(nav).toContain(
				`<span class="nav-label">${de["nav.organiser"]}</span>`,
			);
		},
	);
});

/** Each element whose class list holds one of `classes`, with its content. */
function elements(html: string, classes: readonly string[]): string[] {
	const out: string[] = [];
	const open = /<(\w+)\b[^>]*\bclass="([^"]*)"[^>]*>/g;
	for (const m of html.matchAll(open)) {
		const [tag, name, list = ""] = m;
		if (!name || !list.split(" ").some((c) => classes.includes(c))) continue;
		const pair = new RegExp(`<${name}\\b|</${name}>`, "g");
		pair.lastIndex = (m.index ?? 0) + tag.length;
		let depth = 1;
		let end = html.length;
		for (const t of html.matchAll(pair)) {
			if ((t.index ?? 0) < pair.lastIndex) continue;
			depth += t[0].startsWith("</") ? -1 : 1;
			if (depth === 0) {
				end = (t.index ?? 0) + t[0].length;
				break;
			}
		}
		out.push(html.slice(m.index, end));
	}
	return out;
}

// Feature 022: one set of controls on every page (FR-005, FR-007,
// contracts/controls.md).
describe("the one set of controls", () => {
	const CARDS = [
		"card",
		"settings-group",
		"ride-card",
		"event-card",
		"badge-card",
		"rider-card",
		"organiser-event",
		"request-event",
	];
	const ORGA = ["/organiser", "/organiser/riders", "/organiser/events"];

	it.each([...SECTIONS.map(({ path }) => path), ...ORGA])(
		"has at most one filled button per card on %s",
		async (path) => {
			await seedRider(ctx, { organiser: ORGA.includes(path) });
			const { html } = await get(path);
			for (const card of elements(html, CARDS)) {
				expect(card.match(/class="button"/g)?.length ?? 0).toBeLessThan(2);
			}
		},
	);

	it.each([...SECTIONS.map(({ path }) => path), ...ORGA])(
		"draws chips that filter as filter chips and the rest as status chips on %s",
		async (path) => {
			await seedRider(ctx, { organiser: ORGA.includes(path) });
			const { html } = await get(path);
			for (const [, attrs] of html.matchAll(
				/<button ([^>]*class="chip[^>]*)>/g,
			)) {
				expect(attrs).toMatch(/aria-pressed="(true|false)"/);
			}
			expect(html).not.toMatch(
				/class="[^"]*\b(request-yes|request-no|request-all)\b/,
			);
		},
	);
});

// Feature 022: the palette button next to the refresh link and the theme menu
// on every section (FR-010–FR-013, FR-021, contracts/theme-menu.md).
describe.each(["de", "en"] as const)("the theme menu (%s)", (locale) => {
	const c = CATALOGS[locale];

	it.each(SECTIONS.map(({ path }) => path))(
		"sits in the header of %s with every theme",
		async (path) => {
			await seedRider(ctx);
			const cookies = {
				...(await sessionCookie(ctx, ATHLETE_A)),
				rp_lang: locale,
			};
			const { html } = await get(path, cookies);
			const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
			const order = [
				'<span class="wordmark">',
				'<h1 class="section-title">',
				`<button type="button" class="icon-button theme-button" aria-haspopup="dialog" aria-expanded="false" aria-controls="theme-menu" aria-label="${c["theme.button"]}">`,
				'<a class="icon-button refresh"',
			].map((part) => header.indexOf(part));
			expect(order.every((at) => at >= 0)).toBe(true);
			expect([...order].sort((a, b) => a - b)).toEqual(order);

			const menu =
				html.match(
					/<div id="theme-menu"[\s\S]*?<p class="theme-note">[^<]*<\/p>\s*<\/div>/,
				)?.[0] ?? "";
			expect(menu).toMatch(
				/^<div id="theme-menu" class="theme-menu" role="dialog" aria-labelledby="theme-menu-title" hidden>/,
			);
			expect(menu).toContain(
				`<h2 id="theme-menu-title">${c["theme.menu.title"]}</h2>`,
			);
			expect(menu).toContain(
				`<button type="button" class="icon-button" data-action="close" aria-label="${c["theme.menu.close"]}">`,
			);
			expect(menu.match(/<fieldset /g)).toHaveLength(1);
			const values = [
				...menu.matchAll(/<input type="radio" name="theme" value="([\w-]+)"/g),
			].map((m) => m[1]);
			expect(values).toEqual(["auto", ...THEMES.map((t) => t.id)]);
			expect(
				[...menu.matchAll(/<h3 class="theme-group">([^<]*)<\/h3>/g)].map(
					(m) => m[1],
				),
			).toEqual([
				c["theme.group.light"],
				c["theme.group.dark"],
				c["theme.group.contrast"],
			]);
			for (const t of THEMES) {
				const tile =
					menu.match(
						new RegExp(
							`<label class="theme-tile" data-theme-preview="${t.id}">[\\s\\S]*?</label>`,
						),
					)?.[0] ?? "";
				expect(tile).toContain(c[`theme.name.${t.id}`]);
				expect(tile).toContain(
					`value="${t.id}" data-scheme="${t.scheme}" data-color="${t.preview.bg}"`,
				);
				expect(tile.includes('class="theme-sparkle"')).toBe(t.fun !== null);
			}
			expect(menu).toContain(c["theme.auto"]);
			expect(menu).toContain(escapeHtml(c["theme.auto.hint"]));
			expect(menu).toContain(
				`<p class="theme-note">${escapeHtml(c["theme.menu.note"])}</p>`,
			);
		},
	);
});
