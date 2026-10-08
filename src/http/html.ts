import type { I18n } from "../i18n/i18n";
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

export interface LayoutOptions {
	title: string;
	/** Current path, sent as `next` by the language switcher. */
	path: string;
	body: SafeHtml;
}

export function layout(
	i18n: I18n,
	{ title, path, body }: LayoutOptions,
): SafeHtml {
	const buttons = i18n.locales.map(({ locale, languageName }) =>
		locale === i18n.locale
			? html`<button name="lang" value="${locale}" lang="${locale}" aria-current="true">${languageName}</button>`
			: html`<button name="lang" value="${locale}" lang="${locale}">${languageName}</button>`,
	);
	return html`<!doctype html>
<html lang="${i18n.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="theme-color" content="#111111">
<script src="/app.js" defer></script>
<title>${title}</title>
<style>${new SafeHtml(STYLE)}</style>
</head>
<body>
<header><form method="post" action="/lang" aria-label="${i18n.t("layout.switcher.label")}"><input type="hidden" name="next" value="${path}">${buttons}</form></header>
<main>
${body}
</main>
<footer><img src="${i18n.t("brand.poweredByStrava.src")}" alt="${i18n.t("brand.poweredByStrava.alt")}"></footer>
</body>
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
