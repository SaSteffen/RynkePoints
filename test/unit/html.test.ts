import { describe, expect, it } from "vitest";
import { escapeHtml, html, htmlResponse, layout } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";

const de = createI18n("de", CATALOGS);
const en = createI18n("en", CATALOGS);

describe("html", () => {
	it("escapes interpolated strings", () => {
		expect(String(html`<p>${`<>&"'`}</p>`)).toBe(
			"<p>&lt;&gt;&amp;&quot;&#39;</p>",
		);
		expect(escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
	});

	it("does not double-escape nested fragments", () => {
		const inner = html`<b>${"a&b"}</b>`;
		expect(String(html`<p>${inner}</p>`)).toBe("<p><b>a&amp;b</b></p>");
	});

	it("joins arrays of fragments", () => {
		const items = ["a", "<b>"].map((x) => html`<li>${x}</li>`);
		expect(String(html`<ul>${items}</ul>`)).toBe(
			"<ul><li>a</li><li>&lt;b&gt;</li></ul>",
		);
	});

	it("renders numbers and skips null/undefined", () => {
		expect(String(html`${1}|${null}|${undefined}`)).toBe("1||");
	});
});

describe("layout (de)", () => {
	const page = String(
		layout(de, {
			title: "Seitentitel",
			path: '/notice/"x"',
			body: html`<p>Inhalt</p>`,
		}),
	);

	it("is a German HTML document", () => {
		expect(page.startsWith("<!doctype html>")).toBe(true);
		expect(page).toContain('<html lang="de">');
		expect(page).toContain("<title>Seitentitel</title>");
		expect(page).toContain("<p>Inhalt</p>");
	});

	it("carries the Strava attribution from the catalog", () => {
		expect(page).toContain(
			`<img src="${CATALOGS.de["brand.poweredByStrava.src"]}" alt="${CATALOGS.de["brand.poweredByStrava.alt"]}">`,
		);
		expect(page).toContain(
			'<img src="/strava/en/powered-by-strava.svg" alt="Powered by Strava">',
		);
	});

	it("renders the language switcher", () => {
		expect(page).toMatch(
			/<form method="post" action="\/lang" aria-label="Sprache">/,
		);
		expect(page).toContain(
			'<input type="hidden" name="next" value="/notice/&quot;x&quot;">',
		);
		expect(page).toContain(
			'<button name="lang" value="de" lang="de" aria-current="true">Deutsch</button>',
		);
		expect(page).toContain(
			'<button name="lang" value="en" lang="en">English</button>',
		);
	});

	it("ships no script but the static /app.js (010 research R16)", () => {
		expect(page.match(/<script[^>]*>/gi)).toEqual([
			'<script src="/app.js" defer>',
		]);
		expect(page).toContain('<script src="/app.js" defer></script>');
	});
});

describe("layout (en)", () => {
	const page = String(layout(en, { title: "T", path: "/", body: html`` }));

	it("switches language attributes", () => {
		expect(page).toContain('<html lang="en">');
		expect(page).toContain('aria-label="Language"');
		expect(page).toContain(
			'<button name="lang" value="en" lang="en" aria-current="true">English</button>',
		);
		expect(page).toContain(
			'<button name="lang" value="de" lang="de">Deutsch</button>',
		);
	});
});

describe("htmlResponse", () => {
	it("sets the content and language headers", async () => {
		const res = htmlResponse(en, html`<p>x</p>`, 404);
		expect(res.status).toBe(404);
		expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
		expect(res.headers.get("Content-Language")).toBe("en");
		expect(res.headers.get("Vary")).toBe("Accept-Language, Cookie");
		expect(await res.text()).toBe("<p>x</p>");
	});

	it("defaults to 200 and merges extra headers", () => {
		const res = htmlResponse(de, html``, undefined, { "Set-Cookie": "a=b" });
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Language")).toBe("de");
		expect(res.headers.get("Set-Cookie")).toBe("a=b");
	});
});
