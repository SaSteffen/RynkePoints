import type { I18n } from "../i18n/i18n";
import { html, type SafeHtml } from "./html";

// The consent form with the Connect with Strava button, shared by the start
// page and the consent gate on `/me` (feature 004 contracts/rider-pages.md).
// Ticking the box agrees to `version`, the current one (research R11).

export function consentForm(i18n: I18n, version: number): SafeHtml {
	return html`<form method="post" action="/connect">
<p><label><input type="checkbox" name="consent" value="${version}" required> ${i18n.t("consent.agree")}</label></p>
<button><img src="${i18n.t("brand.connectWithStrava.src")}" alt="${i18n.t("brand.connectWithStrava.alt")}"></button>
</form>`;
}
