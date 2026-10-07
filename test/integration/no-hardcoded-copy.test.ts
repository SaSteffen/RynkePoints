import { beforeEach, describe, expect, it } from "vitest";
import {
	CATALOGS,
	type Catalog,
	type MessageId,
} from "../../src/i18n/catalogs";
import { de } from "../../src/i18n/messages/de";
import { makeCtx, resetDb } from "../support/ctx";
import { RIDER_PAGES, seedPageRiders } from "../support/pages";

// Hard-coded copy guard (FR-028, FR-030, research R18). A pseudo-locale wraps
// every message in ⟦…⟧, so any visible text outside the markers did not come
// from a catalog. Registering it needs no code change, which also proves a new
// locale works by adding a catalog alone.

const qps = Object.fromEntries(
	Object.entries(de).map(([id, value]) => {
		if (id === "meta.intlLocale" || /^brand\.\w+\.src$/.test(id)) {
			return [id, value];
		}
		if (id === "meta.languageName") return [id, "⟦Pseudo⟧"];
		return [id, `⟦${value}⟧`];
	}),
) as Record<MessageId, string> satisfies Catalog;

const ctx = makeCtx({ catalogs: { ...CATALOGS, qps } });
const LANGUAGE_NAMES = new Set(
	Object.values(CATALOGS).map((c) => c["meta.languageName"]),
);
const NUMBERS_AND_PUNCTUATION = /^[\d.,:/\s·–-]+$/;

/** Visible text left once every (possibly nested) ⟦…⟧ is removed. */
function unmarkedText(page: string): string[] {
	let text = page
		.replace(/<style>[\s\S]*?<\/style>/g, "")
		.replace(/<[^>]*>/g, "\n");
	let previous: string;
	do {
		previous = text;
		text = text.replace(/⟦[^⟦⟧]*⟧/g, "");
	} while (text !== previous);
	return text
		.split("\n")
		.map((t) => t.trim())
		.filter((t) => t !== "");
}

beforeEach(async () => {
	await resetDb();
	await seedPageRiders(ctx);
});

describe.each(RIDER_PAGES)("$name in the pseudo-locale", (page) => {
	it("shows only catalog text", async () => {
		const res = await page.fetch(ctx, { cookies: { rp_lang: "qps" } });
		const html = await res.text();
		expect(html).toContain('<html lang="qps">');
		for (const text of unmarkedText(html)) {
			if (NUMBERS_AND_PUNCTUATION.test(text) || LANGUAGE_NAMES.has(text)) {
				continue;
			}
			expect.fail(`hard-coded text on ${page.name}: ${JSON.stringify(text)}`);
		}
		for (const [, attr, value] of html.matchAll(
			/\s(alt|title|aria-label)="([^"]*)"/g,
		)) {
			expect(value, `${attr} on ${page.name}`).toMatch(/^⟦[\s\S]*⟧$/);
		}
	});

	it("lists the pseudo-locale in the switcher", async () => {
		const res = await page.fetch(ctx, { cookies: { rp_lang: "qps" } });
		expect(await res.text()).toContain(
			'<button name="lang" value="qps" lang="qps" aria-current="true">⟦Pseudo⟧</button>',
		);
	});
});
