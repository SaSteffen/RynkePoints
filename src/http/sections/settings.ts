import type { Ctx } from "../../ctx";
import type { Consent } from "../../db/consents";
import type { I18n } from "../../i18n/i18n";
import { vapidPublicKey } from "../../push/vapid";
import { html, languageForm, type SafeHtml } from "../html";
import { renderInstallHint, renderNotifications } from "../pwa";
import { acceptedOn, shellPage } from "../shell";

// Settings at `/me/settings` in the seven groups of feature 011 FR-014: the
// language, this device's scheme, the notifications on this device, installing
// the app, the connection to Strava with the granted permissions, the stored
// consent (feature 004 FR-014), and signing out or leaving. For a signed-in rider the language switcher is only here (FR-016).

/** One group of the page, in contracts/pages.md "Settings" order. */
function group(id: string, heading: string, body: SafeHtml): SafeHtml {
	return html`<section id="${id}" class="settings-group">
<h2>${heading}</h2>
${body}
</section>`;
}

/** System, Light or Dark for this device; `public/app.js` stores it (FR-032a). */
function appearance(i18n: I18n): SafeHtml {
	const option = (value: "system" | "light" | "dark") =>
		html`<label><input type="radio" name="scheme" value="${value}">${i18n.t(`settings.scheme.${value}`)}</label>`;
	return html`<fieldset class="segmented-group">${option("system")}${option("light")}${option("dark")}</fieldset>
<p>${i18n.t("settings.appearance.hint")}</p>`;
}

/** The rider's current consent, what is read and who sees what. */
function consent(i18n: I18n, current: Consent): SafeHtml {
	const date = acceptedOn(i18n, current);
	return html`<p>${i18n.t("me.consent.accepted", { version: String(current.version), date })}</p>
<p>${i18n.t("landing.dataRead")}</p>
<p>${i18n.t("consent.organisers")}</p>
<p>${i18n.t("consent.team")}</p>`;
}

export function handleSettings(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return shellPage(
		request,
		ctx,
		i18n,
		"settings",
		"/me/settings",
		({ rider, consent: accepted }) => {
			const status =
				rider.status === "connected"
					? html`<p>${i18n.t("me.status.connected")}</p>`
					: html`<p>${i18n.t("me.status.needsReconnect")}</p>
<p><a class="button" href="/connect">${i18n.t("me.reconnect")}</a></p>`;
			return html`${group("settings-language", i18n.t("settings.language"), languageForm(i18n, "/me/settings"))}
${group("settings-appearance", i18n.t("settings.appearance"), appearance(i18n))}
${renderNotifications(i18n, vapidPublicKey(ctx.env))}
<section id="settings-app" class="settings-group" hidden>
<h2>${i18n.t("settings.app")}</h2>
${renderInstallHint(i18n)}
</section>
${group(
	"settings-strava",
	i18n.t("settings.strava"),
	html`${status}
<p>${i18n.t(rider.scopeReadAll ? "me.scope.readAll" : "me.scope.sharedOnly")}</p>
<p>${i18n.t(rider.scopeWrite ? "me.scope.write" : "me.scope.noWrite")}</p>
<p><a class="button-outlined" href="/connect">${i18n.t("me.changePermissions")}</a></p>`,
)}
${group("settings-consent", i18n.t("me.consent.heading"), consent(i18n, accepted))}
${group(
	"settings-account",
	i18n.t("settings.account"),
	html`<form method="post" action="/logout"><input type="hidden" name="push_endpoint" value=""><button class="button-outlined">${i18n.t("layout.logout")}</button></form>
<p><a class="danger" href="/me/disconnect">${i18n.t("me.disconnect.button")}</a></p>`,
)}`;
		},
	);
}
