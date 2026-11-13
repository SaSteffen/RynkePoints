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

/** The language whose consent and privacy text counts (constitution 2.5.0). */
export const REFERENCE_LOCALE = "en";

/**
 * In every other language: the English text counts, with a link to this page
 * in English (feature 026 contracts/locales.md › Reference note).
 */
export function referenceNote(i18n: I18n, path: string): SafeHtml | null {
	if (i18n.locale === REFERENCE_LOCALE) return null;
	const englishLink = html`<a href="${path}?lang=${REFERENCE_LOCALE}" hreflang="${REFERENCE_LOCALE}">${i18n.t("consent.referenceNote.link")}</a>`;
	return html`<p class="reference-note">${i18n.tHtml("consent.referenceNote", { englishLink })}</p>
`;
}

/**
 * What the rider allows, in three sentences, with every field read and who
 * sees what one tap away (constitution Principle I names them all).
 */
export function consentSummary(i18n: I18n, path: string): SafeHtml {
	return html`<p>${i18n.t("consent.short.notRead")}<br>${i18n.t("consent.short.read")}</p>
<p>${i18n.t("consent.short.shown")}</p>
${referenceNote(i18n, path)}<details class="more"><summary class="tap">${i18n.t("consent.details")}</summary>
<p>${i18n.t("landing.dataRead")}</p>
<p>${i18n.t("landing.private")}</p>
<p>${i18n.t("landing.purpose")}</p>
<p>${i18n.t("consent.organisers")}</p>
<p>${i18n.t("consent.dailyFigures")}</p>
<p>${i18n.t("consent.rideFigures")}</p>
<p>${i18n.t("consent.admins")}</p>
<p>${i18n.t("consent.team")}</p>
<p>${i18n.t("landing.leave")}</p>
<p>${i18n.t("landing.backups")}</p>
<p>${i18n.t("landing.cookies")}</p>
<p>${i18n.t("landing.notifications")}</p>
</details>
`;
}

/** The box agreeing to `version`; `className` styles the label. */
function agreeBox(i18n: I18n, version: number, className?: string): SafeHtml {
	return html`<label${className === undefined ? "" : html` class="${className}"`}><input type="checkbox" name="consent" value="${version}" required> ${i18n.t("consent.agree")}</label>`;
}

function connectButton(i18n: I18n): SafeHtml {
	return html`<button><img class="cws cws-light" src="${i18n.t("brand.connectWithStrava.src")}" alt="${i18n.t("brand.connectWithStrava.alt")}"><img class="cws cws-dark" src="${i18n.t("brand.connectWithStrava.srcDark")}" alt="${i18n.t("brand.connectWithStrava.alt")}"></button>`;
}

export function consentForm(
	i18n: I18n,
	version: number,
	next?: string,
): SafeHtml {
	return html`<form method="post" action="/connect">
${nextInput(next)}<p>${agreeBox(i18n, version)}</p>
${connectButton(i18n)}
</form>`;
}

/**
 * One numbered step of the start page: the number, a heading and its text,
 * then `action` across the full width.
 */
export function step(
	n: number,
	heading: SafeHtml,
	text: string,
	action: SafeHtml,
): SafeHtml {
	return html`<div class="step"><span class="step-no" aria-hidden="true">${n}</span><div>${heading}<p>${text}</p></div><div class="step-action">${action}</div></div>`;
}

/**
 * The start page's consent form, as its steps 2 and 3: tick the box, then
 * connect, each saying what it does.
 */
export function consentSteps(i18n: I18n, version: number): SafeHtml {
	return html`<form class="consent-steps" method="post" action="/connect">
${step(2, html`<h3>${i18n.t("landing.step.agree.heading")}</h3>`, i18n.t("landing.step.agree.text"), agreeBox(i18n, version, "consent-tick"))}
${step(3, html`<h3>${i18n.t("landing.step.connect.heading")}</h3>`, i18n.t("landing.step.connect.text"), connectButton(i18n))}
</form>`;
}
