import { currentVersion } from "../consent";
import type { Ctx } from "../ctx";
import type { I18n } from "../i18n/i18n";
import { html, htmlResponse, layout, pageLook } from "./html";

// `GET /switch-team`: a person who rides for another team signed in here, and
// chooses (feature 044 research R3, contracts/one-team.md). Public like the
// notice pages: no session, no rider data, no other team named (feature 026
// FR-023). Switching goes through `/connect` and Strava again, with the
// consent the person agreed to on the start page a moment ago. A new person
// came from the start page, so there is no section to return to.

export function handleSwitchTeam(ctx: Ctx, i18n: I18n): Response {
	const version = currentVersion(ctx.consentVersions).version;
	const title = i18n.t("switchTeam.title");
	return htmlResponse(
		i18n,
		layout(i18n, {
			look: pageLook(ctx),
			title,
			path: "/switch-team",
			body: html`<h1>${title}</h1>
<p>${i18n.t("switchTeam.body")}</p>
<p>${i18n.t("switchTeam.cost")}</p>
<form method="post" action="/connect">
<input type="hidden" name="consent" value="${String(version)}">
<input type="hidden" name="switch" value="1">
<button>${i18n.t("switchTeam.switch")}</button>
</form>
<p><a class="button-outlined" href="/">${i18n.t("switchTeam.stay")}</a></p>`,
		}),
	);
}
