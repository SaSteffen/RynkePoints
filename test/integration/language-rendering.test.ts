import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS, type Catalog } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { cookiePair, makeCtx, request, resetDb } from "../support/ctx";
import { RIDER_PAGES, type RiderPage, seedPageRiders } from "../support/pages";

// Every rider-facing page renders wholly in the resolved language and offers
// the switcher back to itself (SC-010, SC-011, FR-029, FR-029a).

const ctx = makeCtx();

/**
 * Text that only `other` has: the parts of its messages around placeholders,
 * where they differ from `own`. Parts that also occur inside an `own` message
 * (English "Sport" in German "Sportart") can't tell the languages apart.
 */
function onlyIn(other: Catalog, own: Catalog): string[] {
	const ownText = Object.values(own);
	const parts = new Set<string>();
	for (const [id, value] of Object.entries(other)) {
		if (id.startsWith("meta.") || value === own[id as keyof Catalog]) continue;
		for (const part of value.split(/\{\w+\}/)) {
			const text = part.trim();
			if (text.length > 3 && !ownText.some((v) => v.includes(text))) {
				parts.add(escapeHtml(text));
			}
		}
	}
	return [...parts];
}

const ENGLISH_ONLY = onlyIn(CATALOGS.en, CATALOGS.de);
const GERMAN_ONLY = onlyIn(CATALOGS.de, CATALOGS.en);

async function render(
	page: RiderPage,
	headers: Parameters<RiderPage["fetch"]>[1],
) {
	const res = await page.fetch(ctx, headers);
	expect(res.status).toBe(page.status);
	return { res, html: await res.text() };
}

function expectLanguage(
	{ res, html }: { res: Response; html: string },
	locale: "de" | "en",
) {
	expect(html).toContain(`<html lang="${locale}">`);
	expect(res.headers.get("Content-Language")).toBe(locale);
	expect(res.headers.get("Vary")).toBe("Accept-Language, Cookie");
	for (const text of locale === "de" ? ENGLISH_ONLY : GERMAN_ONLY) {
		expect(html).not.toContain(text);
	}
}

beforeEach(async () => {
	await resetDb();
	await seedPageRiders(ctx);
});

describe.each(RIDER_PAGES)("$name", (page) => {
	it.each([undefined, "de-DE,en;q=0.5", "da,de;q=0.5"])(
		"is German for Accept-Language %j",
		async (acceptLanguage) => {
			expectLanguage(await render(page, { acceptLanguage }), "de");
		},
	);

	it.each(["en-US,en;q=0.9,de;q=0.8", "da", "fr-CH, fr;q=0.9"])(
		"is English for Accept-Language %j",
		async (acceptLanguage) => {
			expectLanguage(await render(page, { acceptLanguage }), "en");
		},
	);

	it.runIf(page.next === null)("has no switcher (011 FR-016)", async () => {
		const { html } = await render(page, {});
		expect(html).not.toContain('action="/lang"');
	});

	it.runIf(page.next !== null)(
		"has one switcher that returns to this page",
		async () => {
			const { html } = await render(page, {});
			expect(html.match(/<form method="post" action="\/lang"/g)).toHaveLength(
				1,
			);
			expect(html.match(/name="next"/g)).toHaveLength(1);
			expect(html).toContain(
				`<input type="hidden" name="next" value="${page.next}">`,
			);
			for (const [locale, catalog] of Object.entries(CATALOGS)) {
				expect(html).toContain(
					`value="${locale}" lang="${locale}"${locale === "de" ? ' aria-current="true"' : ""}>${catalog["meta.languageName"]}</button>`,
				);
			}
		},
	);

	it("stays English after picking it, whatever the browser prefers", async () => {
		const picked = await handleFetch(
			request("/lang", { form: { lang: "en", next: page.next ?? "/" } }),
			ctx,
		);
		const cookies = cookiePair(picked.headers.get("Set-Cookie") ?? "");
		expect(cookies).toEqual({ rp_lang: "en" });
		expectLanguage(await render(page, { acceptLanguage: "de", cookies }), "en");
	});
});
