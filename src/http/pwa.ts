import type { Ctx } from "../ctx";
import { readRiderView } from "../db/rider-view";
import { createI18n, type I18n } from "../i18n/i18n";
import { resolveLocale } from "../i18n/resolve";
import { CURRENT_RULES, rulesForVersion } from "../rynke/rules";
import { html, htmlResponse, layout, type SafeHtml } from "./html";
import { buildRiderView } from "./rider-view";
import { readSession } from "./session";

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

/**
 * What the signed-in rider still needs, for the service worker to show instead
 * of `push.body` (issue #45). The push itself stays empty, so this only
 * reaches the rider's own device. 204 when there is nothing to add: no
 * balance yet, or nothing missing; the device then shows the cached text.
 */
export async function handleRiderNotificationText(
	request: Request,
	ctx: Ctx,
): Promise<Response> {
	const headers = { "Cache-Control": "no-store" };
	const athleteId = await readSession(request, ctx.env, ctx.now());
	if (athleteId === null) return new Response(null, { status: 401, headers });

	const read = await readRiderView(ctx.env.DB, athleteId, 1);
	const view = buildRiderView(
		read,
		read.balance ? rulesForVersion(read.balance.rulesVersion) : null,
		CURRENT_RULES,
		{
			seasonStart: ctx.env.SEASON_START_DATE,
			importing: false,
			rulesFor: rulesForVersion,
		},
	);
	if (view.state !== "ready")
		return new Response(null, { status: 204, headers });

	const i18n = textI18n(request, ctx);
	const { summary } = view;
	const unmet = [
		{ condition: summary.training, id: "rynke.missing.training" },
		{ condition: summary.team, id: "rynke.missing.team" },
		{ condition: summary.withoutVirtual, id: "rynke.missing.withoutVirtual" },
	] as const;
	const missing = unmet.flatMap(({ condition, id }) =>
		condition && !condition.reached
			? [
					i18n.t(id, {
						n: i18n.formatNumber(condition.missing, { fractionDigits: 0 }),
					}),
				]
			: [],
	);
	if (missing.length === 0) return new Response(null, { status: 204, headers });

	const list = new Intl.ListFormat(i18n.t("meta.intlLocale"), {
		type: "conjunction",
	}).format(missing);
	return Response.json(
		{
			title: i18n.t("app.name"),
			body: i18n.t("push.body.missing", { missing: list }),
		},
		{ headers: { ...headers, "Content-Language": i18n.locale } },
	);
}

/**
 * Hidden; `public/app.js` shows it with one state and at most one button
 * (FR-010, FR-011, research R8). Without JavaScript it stays hidden.
 */
export function renderNotifications(i18n: I18n, pushKey: string): SafeHtml {
	const state = (
		name:
			| "on"
			| "off"
			| "blocked"
			| "needsHomeScreen"
			| "unsupported"
			| "failed",
	) =>
		html`<p data-state="${name}" hidden>${i18n.t(`notifications.${name}`)}</p>`;
	return html`<section id="notifications" data-push-key="${pushKey}" hidden>
<h2>${i18n.t("notifications.heading")}</h2>
<p>${i18n.t("notifications.explain")}</p>
${state("on")}
${state("off")}
${state("blocked")}
${state("needsHomeScreen")}
${state("unsupported")}
${state("failed")}
<button type="button" data-action="on" class="tap" hidden>${i18n.t("notifications.turnOn")}</button>
<button type="button" data-action="off" class="tap" hidden>${i18n.t("notifications.turnOff")}</button>
</section>`;
}

/** Hidden; `public/app.js` shows it where installing helps (FR-004, R11). */
export function renderInstallHint(i18n: I18n): SafeHtml {
	return html`<aside id="install" class="notice" hidden>
<p data-install="prompt" hidden><button type="button" class="tap">${i18n.t("install.button")}</button></p>
<p data-install="ios" hidden>${i18n.t("install.ios")}</p>
<button type="button" data-install="dismiss" class="tap">${i18n.t("install.dismiss")}</button>
</aside>`;
}
