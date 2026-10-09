import type { Ctx } from "../ctx";
import { readRiderView } from "../db/rider-view";
import { readRiseStatement } from "../db/rynke";
import { createI18n, type I18n } from "../i18n/i18n";
import { resolveLocale } from "../i18n/resolve";
import { CURRENT_RULES, rulesForVersion } from "../rynke/rules";
import { html, htmlResponse, layout, type SafeHtml } from "./html";
import { CLOSE } from "./icons";
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
 * How many Rynke the signed-in rider just gained and what they still need, for
 * the service worker to show instead of `push.body` (issue #45). The push
 * itself stays empty, so this only reaches the rider's own device. 204 when no
 * rise is stored; the device then shows the cached text.
 */
export async function handleRiderNotificationText(
	request: Request,
	ctx: Ctx,
): Promise<Response> {
	const headers = { "Cache-Control": "no-store" };
	const none = (status: number) => new Response(null, { status, headers });
	const athleteId = await readSession(request, ctx.env, ctx.now());
	if (athleteId === null) return none(401);

	const db = ctx.env.DB;
	const [rise, read] = await Promise.all([
		readRiseStatement(db, athleteId).first<{
			training_rynke: number;
			team_rynke: number;
		}>(),
		readRiderView(db, athleteId, 1),
	]);
	const view = buildRiderView(
		read,
		read.balance ? rulesForVersion(read.balance.rulesVersion) : null,
		CURRENT_RULES,
		{
			seasonStart: ctx.env.SEASON_START_DATE,
			rulesFor: rulesForVersion,
		},
	);
	if (!rise || view.state !== "ready") return none(204);

	const i18n = textI18n(request, ctx);
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const list = (items: string[]) =>
		new Intl.ListFormat(i18n.t("meta.intlLocale"), {
			type: "conjunction",
		}).format(items);
	const gained = [
		{ n: rise.training_rynke, id: "push.rise.training" },
		{ n: rise.team_rynke, id: "push.rise.team" },
	] as const;
	const { summary } = view;
	const unmet = [
		{ condition: summary.training, id: "rynke.missing.training" },
		{ condition: summary.team, id: "rynke.missing.team" },
		{ condition: summary.withoutVirtual, id: "rynke.missing.withoutVirtual" },
	] as const;
	const risen = list(
		gained.flatMap(({ n, id }) => (n > 0 ? [i18n.t(id, { n: whole(n) })] : [])),
	);
	const missing = unmet.flatMap(({ condition, id }) =>
		condition && !condition.reached
			? [i18n.t(id, { n: whole(condition.missing) })]
			: [],
	);
	const body =
		missing.length === 0
			? i18n.t("push.body.rise", { rise: risen })
			: i18n.t("push.body.riseMissing", {
					rise: risen,
					missing: list(missing),
				});
	return Response.json(
		{ title: i18n.t("app.name"), body },
		{ headers: { ...headers, "Content-Language": i18n.locale } },
	);
}

/**
 * Hidden; `public/app.js` shows it with one state and the switch
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
	return html`<section id="notifications" class="settings-group" data-push-key="${pushKey}" hidden>
<h2>${i18n.t("notifications.heading")}</h2>
<p>${i18n.t("notifications.explain")}</p>
${state("on")}
${state("off")}
${state("blocked")}
${state("needsHomeScreen")}
${state("unsupported")}
${state("failed")}
<button type="button" role="switch" data-action="toggle" aria-checked="false" aria-label="${i18n.t("notifications.switch")}" hidden></button>
</section>`;
}

/** The two ways to install: the browser's own prompt, or iPhone steps. */
function installWays(i18n: I18n): SafeHtml {
	return html`<p data-install="prompt" hidden><button type="button" class="tap">${i18n.t("install.button")}</button></p>
<p data-install="ios" hidden>${i18n.t("install.ios")}</p>`;
}

/**
 * Hidden; `public/app.js` shows it in Settings where installing helps
 * (FR-004, 015 FR-011, research R11).
 */
export function renderInstallHint(i18n: I18n): SafeHtml {
	return html`<aside id="install" class="notice" hidden>
${installWays(i18n)}
</aside>`;
}

/**
 * Hidden; `public/app.js` shows one panel at a time, once per device: first
 * installing, then turning on notifications (015 FR-012–FR-016, research R8).
 */
export function renderAppPrompt(i18n: I18n, pushKey: string): SafeHtml {
	return html`<aside id="app-prompt" class="app-prompt" aria-labelledby="app-prompt-title" data-push-key="${pushKey}" hidden>
<div data-panel="install" hidden>
<p id="app-prompt-title">${i18n.t("prompt.install.text")}</p>
${installWays(i18n)}
</div>
<div data-panel="notify" hidden>
<p>${i18n.t("prompt.notify.text")}</p>
<button type="button" class="tap" data-action="accept">${i18n.t("prompt.notify.accept")}</button>
<button type="button" class="tap" data-action="decline">${i18n.t("prompt.notify.decline")}</button>
</div>
<button type="button" class="icon-button" data-action="close" aria-label="${i18n.t("prompt.close")}">${CLOSE}</button>
</aside>`;
}
