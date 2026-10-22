import { describe, expect, it } from "vitest";
import {
	escapeHtml,
	html,
	htmlResponse,
	layout,
	THEME_SCRIPT,
} from "../../src/http/html";
import { STYLE } from "../../src/http/style";
import { STYLESHEET_PATH } from "../../src/http/stylesheet";
import { THEMES } from "../../src/http/themes";
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
			`<footer><img class="pbs pbs-light" src="${c["brand.poweredByStrava.src"]}" alt="${c["brand.poweredByStrava.alt"]}"><img class="pbs pbs-dark" src="${c["brand.poweredByStrava.srcDark"]}" alt="${c["brand.poweredByStrava.alt"]}"><p><a href="/privacy">${c["privacy.link"]}</a></p></footer>`,
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

	it("holds a hidden progress bar for a slow next page (issue #108)", () => {
		expect(page).toContain(
			'<div class="page-loading" role="progressbar" aria-label="Seite wird geladen" hidden></div>',
		);
	});

	it("ships the theme script and /app.js, no other script (011 R6, 022 R3)", () => {
		expect(page.match(/<script[^>]*>/gi)).toEqual([
			"<script>",
			'<script src="/app.js" defer>',
		]);
		expect(page).toContain('<script src="/app.js" defer></script>');
		expect(page).toContain(`<script>${THEME_SCRIPT}</script>`);
	});

	it("colours the browser for both schemes before the scheme script (011 R12)", () => {
		const head = page.slice(0, page.indexOf("</head>"));
		const metas = [
			'<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fffdf5">',
			'<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#12110c">',
		];
		const at = [...metas, "<script>", '<link rel="stylesheet"'].map((m) =>
			head.indexOf(m),
		);
		expect(at.every((i) => i >= 0)).toBe(true);
		expect([...at].sort((x, y) => x - y)).toEqual(at);
		expect(head.match(/<meta name="theme-color"/g)).toHaveLength(2);
	});
});

describe("layout's stylesheet (issue #183)", () => {
	const options = { title: "T", path: "/", body: html`<p>x</p>` };

	it("links the hashed stylesheet instead of carrying the rules", () => {
		const page = String(layout(de, options));
		expect(STYLESHEET_PATH).toMatch(/^\/style-[0-9a-f]{16}\.css$/);
		expect(page).toContain(
			`<link rel="stylesheet" href="${STYLESHEET_PATH}">\n</head>`,
		);
		expect(page).not.toContain("<style>");
		expect(page).not.toContain(STYLE);
	});

	it("carries the rules inline when asked, without the link", () => {
		const page = String(layout(de, { ...options, inlineStyle: true }));
		expect(page).toContain(`<style>${STYLE}</style>\n</head>`);
		expect(page).not.toContain('rel="stylesheet"');
	});
});

/** A device's storage for the head script, optionally refusing every call. */
function storage(items: Record<string, string>, throws = false) {
	const data = new Map(Object.entries(items));
	const guard = () => {
		if (throws) throw new Error("SecurityError");
	};
	return {
		data,
		getItem(key: string) {
			guard();
			return data.get(key) ?? null;
		},
		setItem(key: string, value: string) {
			guard();
			data.set(key, value);
		},
		removeItem(key: string) {
			guard();
			data.delete(key);
		},
	};
}

/** Runs THEME_SCRIPT on a stub page; returns `<html>`'s data and the metas. */
function runThemeScript(items: Record<string, string>, throws = false) {
	const local = storage(items, throws);
	const dataset: Record<string, string> = {};
	const metas = ["light", "dark"].map((s) => ({
		media: `(prefers-color-scheme: ${s})`,
		content: "",
		removeAttribute(name: string) {
			if (name === "media") this.media = "";
		},
	}));
	const document = {
		documentElement: { dataset },
		querySelectorAll: (selector: string) =>
			selector === 'meta[name="theme-color"]' ? metas : [],
	};
	new Function("localStorage", "document", THEME_SCRIPT)(local, document);
	return { dataset, metas, stored: Object.fromEntries(local.data) };
}

describe('THEME_SCRIPT (022 contracts/theme-menu.md "Head script")', () => {
	it.each(THEMES.map((t) => [t.id, t] as const))(
		"applies %s with its base scheme and surface colour",
		(id, theme) => {
			const { dataset, metas } = runThemeScript({ "rp-theme": id });
			expect(dataset).toEqual({ theme: id, scheme: theme.scheme });
			for (const m of metas) {
				expect(m.media).toBe("");
				expect(m.content).toBe(theme.preview.bg);
			}
		},
	);

	it.each([
		["light", "rynke-day"],
		["dark", "rynke-night"],
	])("carries an old rp-scheme=%s over as %s (FR-015)", (scheme, theme) => {
		const { dataset, stored } = runThemeScript({ "rp-scheme": scheme });
		expect(dataset.theme).toBe(theme);
		expect(stored).toEqual({ "rp-theme": theme });
	});

	it("prefers a stored theme to an old scheme", () => {
		const { dataset } = runThemeScript({
			"rp-theme": "forest",
			"rp-scheme": "light",
		});
		expect(dataset.theme).toBe("forest");
	});

	it.each([
		["nothing stored", {}],
		["an unknown id", { "rp-theme": "neon" }],
		["a prototype key", { "rp-theme": "constructor" }],
		["an old scheme of system", { "rp-scheme": "system" }],
	])("leaves the page on Automatisch with %s", (_name, items) => {
		const { dataset, metas } = runThemeScript(items);
		expect(dataset).toEqual({});
		expect(metas.map((m) => m.media)).toEqual([
			"(prefers-color-scheme: light)",
			"(prefers-color-scheme: dark)",
		]);
	});

	it("leaves the page on Automatisch when storage refuses", () => {
		expect(runThemeScript({ "rp-theme": "forest" }, true).dataset).toEqual({});
	});

	it("holds no catalog text", () => {
		for (const catalog of Object.values(CATALOGS)) {
			for (const text of Object.values(catalog)) {
				if (text.length >= 4) expect(THEME_SCRIPT).not.toContain(text);
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

describe("layout scripts (feature 009 research R6)", () => {
	const options = {
		title: "Seitentitel",
		path: "/me",
		body: html`<p>Inhalt</p>`,
	};

	it("emits each script deferred, in order, before app.js", () => {
		const page = String(
			layout(de, { ...options, scripts: ["/vendor/a.js", "/vendor/b.js"] }),
		);
		const a = page.indexOf('<script src="/vendor/a.js" defer></script>');
		const b = page.indexOf('<script src="/vendor/b.js" defer></script>');
		const app = page.indexOf('<script src="/app.js" defer></script>');
		expect(a).toBeGreaterThan(-1);
		expect(b).toBeGreaterThan(a);
		expect(app).toBeGreaterThan(b);
	});

	it("leaves a page without scripts as it was", () => {
		expect(String(layout(de, { ...options, scripts: [] }))).toBe(
			String(layout(de, options)),
		);
		expect(String(layout(de, options))).not.toContain("/vendor/");
	});
});
