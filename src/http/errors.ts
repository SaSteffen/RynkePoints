import type { Ctx } from "../ctx";
import type { I18n } from "../i18n/i18n";
import { html, htmlResponse, layout, pageLook } from "./html";

// The rider-facing 404 and 403 pages, in the team's look.

type LookCtx = Pick<Ctx, "env" | "team">;

export function notFound(ctx: LookCtx, i18n: I18n, path: string): Response {
	const title = i18n.t("error.notFound.title");
	return htmlResponse(
		i18n,
		layout(i18n, {
			look: pageLook(ctx),
			title,
			path,
			body: html`<h1>${title}</h1>
<p>${i18n.t("error.notFound.body")}</p>
<p><a class="button-outlined" href="/">${i18n.t("notice.backToStart")}</a></p>`,
		}),
		404,
	);
}

export function forbidden(ctx: LookCtx, i18n: I18n, path: string): Response {
	const title = i18n.t("error.forbidden.title");
	return htmlResponse(
		i18n,
		layout(i18n, {
			look: pageLook(ctx),
			title,
			path,
			body: html`<h1>${title}</h1>
<p>${i18n.t("error.forbidden.body")}</p>
<p><a class="button-outlined" href="/">${i18n.t("notice.backToStart")}</a></p>`,
		}),
		403,
	);
}
