import type { I18n } from "../i18n/i18n";
import { COIN_SPRITE, coin } from "./coin";
import { STYLE } from "./style";
import { STYLESHEET_PATH } from "./stylesheet";
import { THEMES } from "./themes";

// Server-rendered HTML (research R13). Templates hold markup only; every piece
// of rider-facing text comes from the catalogs through `I18n`.

/** Markup that is already escaped and can be inserted as is. */
export class SafeHtml {
	constructor(readonly value: string) {}

	toString(): string {
		return this.value;
	}
}

const ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

function render(value: unknown): string {
	if (value instanceof SafeHtml) return value.value;
	if (Array.isArray(value)) return value.map(render).join("");
	if (value === null || value === undefined || value === false) return "";
	return escapeHtml(String(value));
}

/** Tagged template that escapes every interpolated value except `SafeHtml`. */
export function html(
	strings: TemplateStringsArray,
	...values: unknown[]
): SafeHtml {
	let out = strings[0] ?? "";
	values.forEach((value, i) => {
		out += render(value) + (strings[i + 1] ?? "");
	});
	return new SafeHtml(out);
}

/**
 * Applies the device's theme before the page paints (feature 022 research R2,
 * R3, contracts/theme-menu.md "Head script"): a known `rp-theme` sets
 * `data-theme`, its base `data-scheme` and the browser's colour; an old
 * `rp-scheme` (011) becomes Rynke Tag or Nacht once. Anything else, or storage
 * that refuses, is Automatisch. The id → [scheme, surface] table comes from
 * the theme list; the script holds no text.
 */
export const THEME_SCRIPT = `try{const T=new Map(${JSON.stringify(THEMES.map((t) => [t.id, [t.scheme, t.preview.bg]]))}),S=localStorage;let t=S.getItem("rp-theme");if(t===null){const s=S.getItem("rp-scheme");if(s==="light"||s==="dark"){t=s==="dark"?"rynke-night":"rynke-day";S.setItem("rp-theme",t);S.removeItem("rp-scheme")}}const e=T.get(t);if(e){const d=document.documentElement.dataset;d.theme=t;d.scheme=e[0];for(const m of document.querySelectorAll('meta[name="theme-color"]')){m.removeAttribute("media");m.content=e[1]}}}catch{}`;

/**
 * The brand name, the same in every language (011 contracts/pages.md), behind
 * the Rynke coin (feature 012).
 */
export const WORDMARK = new SafeHtml(
	`<span class="wordmark">${coin("front", "mark")}<span class="wordmark-name">Rynke<span>Points</span></span></span>`,
);

/** The top bar and navigation of a signed-in section, from `shell.ts`. */
export interface ShellParts {
	header: SafeHtml;
	/** The theme menu, hidden until the header's palette button opens it. */
	menu: SafeHtml;
	nav: SafeHtml;
}

export interface LayoutOptions {
	title: string;
	/** Current path, sent as `next` by the language switcher. */
	path: string;
	body: SafeHtml;
	/**
	 * A signed-in section (feature 011 research R3): its top bar replaces the
	 * language form, and the navigation follows the footer. Without it the page
	 * is public.
	 */
	shell?: ShellParts;
	/**
	 * Scripts the page needs before `app.js`, such as the chart library on the
	 * Overview (feature 009 research R6), deferred and run in this order.
	 */
	scripts?: readonly string[];
	/**
	 * Carries the rules in the page instead of linking the stylesheet: the
	 * offline notice, which the service worker shows without a network.
	 */
	inlineStyle?: boolean;
}

/** The language switcher, returning to `path` (FR-046). */
export function languageForm(i18n: I18n, path: string): SafeHtml {
	const buttons = i18n.locales.map(({ locale, languageName }) =>
		locale === i18n.locale
			? html`<button class="segmented" name="lang" value="${locale}" lang="${locale}" aria-current="true">${languageName}</button>`
			: html`<button class="segmented" name="lang" value="${locale}" lang="${locale}">${languageName}</button>`,
	);
	return html`<form method="post" action="/lang" aria-label="${i18n.t("layout.switcher.label")}"><input type="hidden" name="next" value="${path}">${buttons}</form>`;
}

export function layout(
	i18n: I18n,
	{
		title,
		path,
		body,
		shell,
		scripts = [],
		inlineStyle = false,
	}: LayoutOptions,
): SafeHtml {
	const header = shell
		? html`<body class="shell">
<header class="top-bar">${shell.header}</header>
${shell.menu}`
		: html`<body class="public">
<header class="top-bar">${WORDMARK}${languageForm(i18n, path)}</header>`;
	// Once per page, for every coin's `<use>` (feature 012).
	const sprite = new SafeHtml(COIN_SPRITE);
	const style = inlineStyle
		? html`<style>${new SafeHtml(STYLE)}</style>`
		: html`<link rel="stylesheet" href="${STYLESHEET_PATH}">`;
	return html`<!doctype html>
<html lang="${i18n.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fffdf5">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#12110c">
<script>${new SafeHtml(THEME_SCRIPT)}</script>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
${scripts.map(
	(src) => html`<script src="${src}" defer></script>
`,
)}<script src="/app.js" defer></script>
<title>${title}</title>
${style}
</head>
${header}
<div class="page-loading" role="progressbar" aria-label="${i18n.t("layout.loading")}" hidden></div>
${sprite}
<main>
${body}
</main>
<footer><img class="pbs pbs-light" src="${i18n.t("brand.poweredByStrava.src")}" alt="${i18n.t("brand.poweredByStrava.alt")}"><img class="pbs pbs-dark" src="${i18n.t("brand.poweredByStrava.srcDark")}" alt="${i18n.t("brand.poweredByStrava.alt")}"><p><a href="/privacy">${i18n.t("privacy.link")}</a></p></footer>
${shell?.nav ?? null}</body>
</html>
`;
}

export function htmlResponse(
	i18n: I18n,
	body: SafeHtml,
	status = 200,
	headers?: HeadersInit,
): Response {
	const h = new Headers(headers);
	h.set("Content-Type", "text/html; charset=utf-8");
	h.set("Content-Language", i18n.locale);
	h.set("Vary", "Accept-Language, Cookie");
	return new Response(body.value, { status, headers: h });
}
