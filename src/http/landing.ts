import { clubId } from "../config";
import type { Ctx } from "../ctx";
import { getRider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { html, htmlResponse, layout } from "./html";
import { redirect } from "./redirect";
import { readSession } from "./session";

// The public start page: what RynkePoints reads and why, who can join, how to
// leave, and the Connect with Strava button (FR-001, FR-002, FR-022a).

export async function handleLanding(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const athleteId = await readSession(request, ctx.env, ctx.now());
	// A session for a deleted rider counts as signed out (research R9).
	if (athleteId !== null && (await getRider(ctx.env.DB, athleteId))) {
		return redirect("/me", 302);
	}

	const title = i18n.t("landing.title");
	const clubLink = html`<a href="https://www.strava.com/clubs/${clubId(ctx.env)}">${i18n.t("club.linkText")}</a>`;
	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path: "/",
			body: html`<h1>${i18n.t("app.name")}</h1>
<p>${i18n.t("landing.intro")}</p>
<p>${i18n.tHtml("landing.who", { clubLink })}</p>
<p>${i18n.t("landing.dataRead")}</p>
<p>${i18n.t("landing.private")}</p>
<p>${i18n.t("landing.purpose")}</p>
<p>${i18n.t("landing.leave")}</p>
<p>${i18n.t("landing.backups")}</p>
<p>${i18n.t("landing.cookies")}</p>
<p><a href="/connect"><img src="${i18n.t("brand.connectWithStrava.src")}" alt="${i18n.t("brand.connectWithStrava.alt")}"></a></p>`,
		}),
	);
}
