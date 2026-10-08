import type { Ctx } from "../../ctx";
import type { Consent } from "../../db/consents";
import type { I18n } from "../../i18n/i18n";
import { vapidPublicKey } from "../../push/vapid";
import { html, languageForm, type SafeHtml } from "../html";
import { renderNotifications } from "../pwa";
import { acceptedOn, shellPage } from "../shell";

// Settings at `/me/settings` (feature 011 FR-014): the language, the
// notifications on this device, the connection to Strava with the granted
// permissions, the stored consent (feature 004 FR-014), and leaving or signing
// out. For a signed-in rider the language switcher is only here (FR-016).

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
			return html`${languageForm(i18n, "/me/settings")}
${renderNotifications(i18n, vapidPublicKey(ctx.env))}
${status}
<p>${i18n.t(rider.scopeReadAll ? "me.scope.readAll" : "me.scope.sharedOnly")}</p>
<p>${i18n.t(rider.scopeWrite ? "me.scope.write" : "me.scope.noWrite")}</p>
<p><a href="/connect">${i18n.t("me.changePermissions")}</a></p>
<section>
<h2>${i18n.t("me.consent.heading")}</h2>
${consent(i18n, accepted)}
</section>
<p><a href="/me/disconnect">${i18n.t("me.disconnect.button")}</a></p>
<form method="post" action="/logout"><input type="hidden" name="push_endpoint" value=""><button>${i18n.t("layout.logout")}</button></form>`;
		},
	);
}
