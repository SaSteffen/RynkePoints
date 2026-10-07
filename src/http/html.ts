import type { I18n } from "../i18n/i18n";

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

const STYLE = `body{font-family:system-ui,sans-serif;max-width:40rem;margin:0 auto;padding:1rem;line-height:1.5;color:#222}
header form{display:flex;gap:.5rem;justify-content:flex-end}
header button{background:none;border:1px solid #ccc;border-radius:.25rem;padding:.1rem .5rem;cursor:pointer}
header button[aria-current]{font-weight:bold;border-color:#fc5200}
a{color:#c43d00}
footer{margin-top:3rem}
footer img{height:1.5rem}
main{overflow-wrap:break-word}
section.notice{border-left:.25rem solid #fc5200;background:#fff4ec;padding:.25rem 1rem;margin:1rem 0}
.rynke-summary dd,.rynke-breakdown dd{margin:0 0 .5rem}
table.rides{width:100%;border-collapse:collapse}
table.rides th,table.rides td{padding:.25rem .5rem;text-align:left;vertical-align:top}
table.rides .num{white-space:nowrap;text-align:right}
tr.ride td{border-top:1px solid #ddd}
tr.ride-details td{padding-top:0;font-size:.875rem;color:#666}
tr.ride-details ul,tr.ride-details p{margin:.25rem 0}
.ride-reasons{padding-left:1.25rem}
.tap{display:inline-flex;align-items:center;min-height:44px;min-width:44px}
nav.pager{display:flex;flex-wrap:wrap;gap:.5rem 1rem;margin-top:.5rem}
:root{--rp-part-1:#fc5200;--rp-part-2:#1f6fb2;--rp-part-3:#2a9d8f;--rp-part-4:#8e44ad;--rp-part-5:#c9a227;--rp-part-6:#6b6b6b;--rp-reached:#2e7d32;--rp-track:#e6e6e6}
figure.gauge{display:block;width:100%;margin:0 0 1rem}
.gauge-bar{display:flex;height:1rem;background:var(--rp-track);border-radius:.25rem;overflow:hidden}
.gauge-part,.gauge-fill{display:block;height:100%;box-sizing:border-box}
.gauge-part+.gauge-part{border-left:2px solid #fff}
.gauge-fill,.gauge-part-1{background:var(--rp-part-1)}
.gauge-part-2{background:var(--rp-part-2)}
.gauge-part-3{background:var(--rp-part-3)}
.gauge-part-4{background:var(--rp-part-4)}
.gauge-part-5{background:var(--rp-part-5)}
.gauge-part-6{background:var(--rp-part-6)}
.gauge-reached .gauge-fill{background:var(--rp-reached)}
.gauge-legend{display:flex;flex-wrap:wrap;gap:0 1rem;list-style:none;margin:.25rem 0 0;padding:0;font-size:.875rem}
.gauge-key{display:inline-block;width:.75rem;height:.75rem;margin-right:.25rem;vertical-align:middle}
@media (max-width:36rem){table.rides th,table.rides td{padding:.2rem .25rem}nav.pager{gap:.25rem .5rem}}`;

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
