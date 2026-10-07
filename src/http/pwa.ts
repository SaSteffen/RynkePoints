import type { Ctx } from "../ctx";
import { createI18n, type I18n } from "../i18n/i18n";
import { resolveLocale } from "../i18n/resolve";
import { html, htmlResponse, layout, type SafeHtml } from "./html";

// The installable app's server side (feature 010 contracts/client.md and
// contracts/http-routes.md). `/offline` and `/notification-text` are the only
// responses the service worker caches, so they read neither the session nor D1
// and are the same for everyone in a language (FR-005, SC-007, SC-008).

/** The `lang` the service worker asks for, else the usual resolution. */
function textI18n(request: Request, ctx: Ctx): I18n {
	const lang = new URL(request.url).searchParams.get("lang");
	const locale =
		lang && Object.hasOwn(ctx.catalogs, lang)
			? lang
			: resolveLocale(request, ctx.catalogs);
	return createI18n(locale, ctx.catalogs);
}

export function handleOffline(request: Request, ctx: Ctx): Response {
	const i18n = textI18n(request, ctx);
	const title = i18n.t("offline.title");
	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path: "/me",
			body: html`<h1>${title}</h1>
<p>${i18n.t("offline.body")}</p>`,
		}),
		200,
		{ "Cache-Control": "no-cache" },
	);
}

/** What the service worker shows for a push (contracts/push-delivery.md). */
export function handleNotificationText(request: Request, ctx: Ctx): Response {
	const i18n = textI18n(request, ctx);
	return Response.json(
		{ title: i18n.t("app.name"), body: i18n.t("push.body") },
		{
			headers: {
				"Cache-Control": "no-cache",
				"Content-Language": i18n.locale,
				Vary: "Accept-Language, Cookie",
			},
		},
	);
}

/** Hidden; `public/app.js` shows it where installing helps (FR-004, R11). */
export function renderInstallHint(i18n: I18n): SafeHtml {
	return html`<aside id="install" class="notice" hidden>
<p data-install="prompt" hidden><button type="button" class="tap">${i18n.t("install.button")}</button></p>
<p data-install="ios" hidden>${i18n.t("install.ios")}</p>
<button type="button" data-install="dismiss" class="tap">${i18n.t("install.dismiss")}</button>
</aside>`;
}
