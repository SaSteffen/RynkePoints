import type { I18n } from "../i18n/i18n";
import { html, type SafeHtml } from "./html";

// The consent form with the Connect with Strava button, shared by the start
// page and the consent gate on `/me` (feature 004 contracts/rider-pages.md).
// Ticking the box agrees to `version`, the current one (research R11). The
// gate also sends `next`, the section to return to (feature 011 research R9).
// The button holds both of Strava's images; the scheme CSS shows one (R13).

/** The hidden `next` input, or nothing without one. */
export function nextInput(next?: string): SafeHtml | null {
	return next === undefined
		? null
		: html`<input type="hidden" name="next" value="${next}">
`;
}

/**
 * What the rider allows, in three sentences, with every field read and who
 * sees what one tap away (constitution Principle I names them all).
 */
export function consentSummary(i18n: I18n): SafeHtml {
	return html`<p>${i18n.t("consent.short.notRead")}<br>${i18n.t("consent.short.read")}</p>
<p>${i18n.t("consent.short.shown")}</p>
<details class="more"><summary class="tap">${i18n.t("consent.details")}</summary>
<p>${i18n.t("landing.dataRead")}</p>
<p>${i18n.t("landing.private")}</p>
<p>${i18n.t("landing.purpose")}</p>
<p>${i18n.t("consent.organisers")}</p>
<p>${i18n.t("consent.team")}</p>
<p>${i18n.t("consent.write")}</p>
<p>${i18n.t("landing.leave")}</p>
<p>${i18n.t("landing.backups")}</p>
<p>${i18n.t("landing.cookies")}</p>
<p>${i18n.t("landing.notifications")}</p>
</details>
`;
}

export function consentForm(
	i18n: I18n,
	version: number,
	next?: string,
): SafeHtml {
	return html`<form method="post" action="/connect">
${nextInput(next)}<p><label><input type="checkbox" name="consent" value="${version}" required> ${i18n.t("consent.agree")}</label></p>
<button><img class="cws cws-light" src="${i18n.t("brand.connectWithStrava.src")}" alt="${i18n.t("brand.connectWithStrava.alt")}"><img class="cws cws-dark" src="${i18n.t("brand.connectWithStrava.srcDark")}" alt="${i18n.t("brand.connectWithStrava.alt")}"></button>
</form>`;
}
