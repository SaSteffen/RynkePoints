import { describe, expect, it } from "vitest";
import {
	escapeHtml,
	html,
	htmlResponse,
	layout,
	SCHEME_SCRIPT,
} from "../../src/http/html";
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

	it("carries the Strava attribution in both schemes (011 FR-034)", () => {
		const { de: c } = CATALOGS;
		expect(page).toContain(
			`<footer><img class="pbs pbs-light" src="${c["brand.poweredByStrava.src"]}" alt="${c["brand.poweredByStrava.alt"]}"><img class="pbs pbs-dark" src="${c["brand.poweredByStrava.srcDark"]}" alt="${c["brand.poweredByStrava.alt"]}"></footer>`,
		);
		expect(page).toContain(
			'<img class="pbs pbs-light" src="/strava/en/powered-by-strava.svg" alt="Powered by Strava">',
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
			'<button class="segmented" name="lang" value="de" lang="de" aria-current="true">Deutsch</button>',
		);
		expect(page).toContain(
			'<button class="segmented" name="lang" value="en" lang="en">English</button>',
		);
	});

	it("ships the scheme script and /app.js, no other script (011 R6)", () => {
		expect(page.match(/<script[^>]*>/gi)).toEqual([
			"<script>",
			'<script src="/app.js" defer>',
		]);
		expect(page).toContain('<script src="/app.js" defer></script>');
		expect(page).toContain(`<script>${SCHEME_SCRIPT}</script>`);
	});

	it("colours the browser for both schemes before the scheme script (011 R12)", () => {
		const head = page.slice(0, page.indexOf("</head>"));
		const metas = [
			'<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fffdf5">',
			'<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#12110c">',
		];
		const at = [...metas, "<script>", "<style>"].map((m) => head.indexOf(m));
		expect(at.every((i) => i >= 0)).toBe(true);
		expect([...at].sort((x, y) => x - y)).toEqual(at);
		expect(head.match(/<meta name="theme-color"/g)).toHaveLength(2);
	});
});

describe("SCHEME_SCRIPT (011 contracts/client.md)", () => {
	it("reads the device's choice and holds no catalog text", () => {
		expect(SCHEME_SCRIPT).toContain('localStorage.getItem("rp-scheme")');
		expect(SCHEME_SCRIPT).toContain("dataset.scheme");
		for (const catalog of Object.values(CATALOGS)) {
			for (const text of Object.values(catalog)) {
				if (text.length >= 4) expect(SCHEME_SCRIPT).not.toContain(text);
			}
		}
	});
});

describe("layout (en)", () => {
	const page = String(layout(en, { title: "T", path: "/", body: html`` }));

	it("switches language attributes", () => {
		expect(page).toContain('<html lang="en">');
		expect(page).toContain('aria-label="Language"');
		expect(page).toContain(
			'<button class="segmented" name="lang" value="en" lang="en" aria-current="true">English</button>',
		);
		expect(page).toContain(
			'<button class="segmented" name="lang" value="de" lang="de">Deutsch</button>',
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
