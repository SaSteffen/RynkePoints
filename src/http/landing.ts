import { clubId } from "../config";
import { CONSENT_VERSION } from "../consent";
import type { Ctx } from "../ctx";
import { getRider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { html, htmlResponse, layout } from "./html";
import { redirect } from "./redirect";
import { readSession } from "./session";

// The public start page: what RynkePoints reads and why, who can join, how to
// leave, who sees what, and the consent form with the Connect with Strava
// button (FR-001, FR-002, FR-022a; feature 004 FR-010, FR-011; research R21). Riders
// who already take part sign in below it without consenting or approving again
// (FR-009).

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
<h2>${i18n.t("consent.heading")}</h2>
<p>${i18n.t("consent.organisers")}</p>
<p>${i18n.t("consent.team")}</p>
<p>${i18n.t("consent.required")}</p>
<p>${i18n.t("consent.write")}</p>
<form method="post" action="/connect">
<p><label><input type="checkbox" name="consent" value="${CONSENT_VERSION}" required> ${i18n.t("consent.agree")}</label></p>
<button><img src="${i18n.t("brand.connectWithStrava.src")}" alt="${i18n.t("brand.connectWithStrava.alt")}"></button>
</form>
<h2>${i18n.t("landing.signIn.heading")}</h2>
<p>${i18n.t("landing.signIn.body")}</p>
<p><a href="/signin"><img src="${i18n.t("brand.connectWithStrava.src")}" alt="${i18n.t("brand.connectWithStrava.alt")}"></a></p>`,
		}),
	);
}
