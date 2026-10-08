import { beforeEach, describe, expect, it } from "vitest";
import { makeCtx, resetDb } from "../support/ctx";
import { RIDER_PAGES, seedPageRiders } from "../support/pages";

// Every rider-facing page fits a 360 px phone by its markup, and the public
// pages keep the language switcher in the header without the navigation
// (feature 011 FR-016, FR-020, research R15). Pixels are checked on devices.

const ctx = makeCtx();
const PHONE = 360;

/** Every fixed width the markup sets: `style` widths and `width` attributes. */
function widths(page: string): number[] {
	const inline = [
		...page.matchAll(/style="[^"]*?\b(?:min-)?width:\s*(\d+)px/g),
	].map(([, px]) => Number(px));
	const attrs = [
		...page.matchAll(/<(?:img|svg|table|div)\b[^>]*\swidth="(\d+)"/g),
	].map(([, px]) => Number(px));
	return [...inline, ...attrs];
}

beforeEach(async () => {
	await resetDb();
	await seedPageRiders(ctx);
});

describe.each(RIDER_PAGES)("$name", (page) => {
	// Signed in, the switcher is only in Settings; everywhere else it's public.
	const shell = page.next === null || page.next === "/me/settings";

	it(`sets nothing wider than ${PHONE} px`, async () => {
		const res = await page.fetch(ctx, {});
		expect(res.status).toBe(page.status);
		const html = await res.text();
		expect(widths(html).filter((px) => px > PHONE)).toEqual([]);
	});

	it("carries the coin sprite once for every coin on it (012 FR-005)", async () => {
		const html = await (await page.fetch(ctx, {})).text();
		expect(html.match(/<svg class="sprite"/g)).toHaveLength(1);
		const symbols = [...html.matchAll(/<symbol id="([^"]+)"/g)].map(
			([, id]) => id,
		);
		for (const [, id] of html.matchAll(/<use href="#([^"]+)"/g)) {
			expect(symbols).toContain(id);
		}
	});

	it(
		shell
			? "is a shell page with the navigation"
			: "is public: switcher in the header, no navigation",
		async () => {
			const html = await (await page.fetch(ctx, {})).text();
			const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
			if (shell) {
				expect(html).toContain('<body class="shell">');
				expect(html).toContain('<nav class="app-nav"');
				expect(header).not.toContain('action="/lang"');
			} else {
				expect(html).toContain('<body class="public">');
				expect(html).not.toContain('class="app-nav"');
				expect(header).toContain('<form method="post" action="/lang"');
			}
		},
	);
});
