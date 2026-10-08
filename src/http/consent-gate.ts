import type { I18n } from "../i18n/i18n";
import { consentForm } from "./consent-form";
import { html, htmlResponse, layout, type SafeHtml } from "./html";

// The consent gate (feature 004 contracts/re-consent.md, research R14): shown
// on `/me` instead of the rest of the page until the rider agrees to the
// current consent version. It says why, shows the current consent texts and a
// form to agree, and how to leave instead.

/** Why the rider meets the gate: no consent record yet (US1). */
export type GateState = { state: "missing" };

function intro(i18n: I18n, gate: GateState): SafeHtml {
	switch (gate.state) {
		case "missing":
			return html`<p>${i18n.t("me.consent.none")}</p>`;
	}
}

export function consentGate(
	i18n: I18n,
	current: number,
	gate: GateState,
): Response {
	return htmlResponse(
		i18n,
		layout(i18n, {
			title: i18n.t("me.title"),
			path: "/me",
			body: html`<h1>${i18n.t("me.consent.renew.heading")}</h1>
${intro(i18n, gate)}
<h2>${i18n.t("consent.heading")}</h2>
<p>${i18n.t("landing.dataRead")}</p>
<p>${i18n.t("landing.private")}</p>
<p>${i18n.t("landing.purpose")}</p>
<p>${i18n.t("landing.leave")}</p>
<p>${i18n.t("consent.organisers")}</p>
<p>${i18n.t("consent.team")}</p>
<p>${i18n.t("consent.required")}</p>
<p>${i18n.t("consent.write")}</p>
${consentForm(i18n, current)}
<p>${i18n.t("me.consent.renew.leave")}</p>
<p><a href="/me/disconnect">${i18n.t("me.disconnect.button")}</a></p>
<form method="post" action="/logout"><input type="hidden" name="push_endpoint" value=""><button>${i18n.t("layout.logout")}</button></form>`,
		}),
	);
}
