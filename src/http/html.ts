import type { I18n } from "../i18n/i18n";
import { COIN_SPRITE, coin } from "./coin";
import { STYLE } from "./style";

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
 * Applies the device's colour scheme choice before the page paints (feature
 * 011 contracts/client.md, research R6, R12). It holds no text.
 */
export const SCHEME_SCRIPT = `try{const s=localStorage.getItem("rp-scheme");if(s==="light"||s==="dark"){document.documentElement.dataset.scheme=s;for(const m of document.querySelectorAll('meta[name="theme-color"]')){m.removeAttribute("media");m.content=s==="dark" ? "#12110c" : "#fffdf5";}}}catch{}`;

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
	{ title, path, body, shell }: LayoutOptions,
): SafeHtml {
	const header = shell
		? html`<body class="shell">
<header class="top-bar">${shell.header}</header>`
		: html`<body class="public">
<header class="top-bar">${WORDMARK}${languageForm(i18n, path)}</header>`;
	// Once per page, for every coin's `<use>` (feature 012).
	const sprite = new SafeHtml(COIN_SPRITE);
	return html`<!doctype html>
<html lang="${i18n.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#fffdf5">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#12110c">
<script>${new SafeHtml(SCHEME_SCRIPT)}</script>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<script src="/app.js" defer></script>
<title>${title}</title>
<style>${new SafeHtml(STYLE)}</style>
</head>
${header}
${sprite}
<main>
${body}
</main>
<footer><img class="pbs pbs-light" src="${i18n.t("brand.poweredByStrava.src")}" alt="${i18n.t("brand.poweredByStrava.alt")}"><img class="pbs pbs-dark" src="${i18n.t("brand.poweredByStrava.srcDark")}" alt="${i18n.t("brand.poweredByStrava.alt")}"></footer>
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
