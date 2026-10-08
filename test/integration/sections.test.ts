import { beforeEach, describe, expect, it } from "vitest";
import { createSessionCookie } from "../../src/http/session";
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

const SECTIONS = [
	{ path: "/me", label: de["nav.overview"] },
	{ path: "/me/rides", label: de["nav.rides"] },
	{ path: "/team", label: de["nav.team"] },
	{ path: "/me/settings", label: de["nav.settings"] },
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
			expect(inner).toMatch(
				/^<span class="nav-icon"><svg [^>]*aria-hidden="true"[\s\S]*<\/svg><\/span>/,
			);
			expect(inner).toContain(
				`<span class="nav-label">${SECTIONS[i]?.label}</span>`,
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
		expect(header).toContain(
			'<span class="wordmark">Rynke<span>Points</span></span>',
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
