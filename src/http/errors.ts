import type { I18n } from "../i18n/i18n";
import { html, htmlResponse, layout } from "./html";

// The rider-facing 404 and 403 pages.

export function notFound(i18n: I18n, path: string): Response {
	const title = i18n.t("error.notFound.title");
	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path,
			body: html`<h1>${title}</h1>
<p>${i18n.t("error.notFound.body")}</p>
<p><a href="/">${i18n.t("notice.backToStart")}</a></p>`,
		}),
		404,
	);
}

export function forbidden(i18n: I18n, path: string): Response {
	const title = i18n.t("error.forbidden.title");
	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path,
			body: html`<h1>${title}</h1>
<p>${i18n.t("error.forbidden.body")}</p>
<p><a href="/">${i18n.t("notice.backToStart")}</a></p>`,
		}),
		403,
	);
}
