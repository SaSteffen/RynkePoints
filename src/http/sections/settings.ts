import { APP_VERSION } from "../../changelog";
import { consentLabel } from "../../consent";
import type { Ctx } from "../../ctx";
import { orgaNames, type Rider } from "../../db/riders";
import { type BalanceRow, readBalanceStatement } from "../../db/rynke";
import type { I18n } from "../../i18n/i18n";
import { vapidPublicKey } from "../../push/vapid";
import {
	countingWindow,
	currentRules,
	rulesForVersion,
} from "../../rynke/rules";
import { consentSummary } from "../consent-form";
import { html, languageForm, type SafeHtml } from "../html";
import {
	BOOK,
	COMPASS,
	DEVICES,
	HISTORY,
	INSTALL,
	LANGUAGE,
	PALETTE,
	PEOPLE,
	SHIELD,
	SIGN_OUT,
	SPARKLE,
	TRASH,
} from "../icons";
import { renderInstallHint, renderNotifications } from "../pwa";
import { renderRules, rulesVersion } from "../rider-sections";
import { rulesInfo } from "../rider-view";
import { acceptedOn, shellPage, tourSwitches } from "../shell";
import { stepHref } from "../tour";

// Settings at `/me/settings` (feature 011 FR-014, the settings redesign
// canvas): the Strava connection as the card on top, then rows in groups. This
// device: installing the app, the notifications, the language, the colour
// scheme (it opens the header's theme menu, feature 022 FR-016) and the
// page-switch shows, which `public/app.js` shows. Rynke and your data: the
// rules (moved here from the Overview, issue #92), the stored consent (feature
// 004 FR-014) and the tours (#90). Then the app's version with its changelog,
// signing out, and leaving, set apart. For a signed-in rider the language
// switcher is only here (FR-016). Long content opens under its row.

/** A group of rows under a small heading. */
function group(
	id: string,
	heading: string,
	rows: SafeHtml,
	note?: string,
): SafeHtml {
	return html`<section class="settings-section" aria-labelledby="${id}-heading">
<h2 id="${id}-heading">${heading}</h2>
<ul class="settings-list">
${rows}
</ul>${
		note === undefined
			? null
			: html`
<p class="settings-note">${note}</p>`
	}
</section>`;
}

/**
 * A row's icon, title and the line under it; `id` names the title, and
 * `${id}-sub` the line, for a control labelled by them.
 */
function rowText(
	icon: SafeHtml,
	title: string,
	sub?: string,
	id?: string,
): SafeHtml {
	const titleId = id === undefined ? null : html` id="${id}"`;
	const subId = id === undefined ? null : html` id="${id}-sub"`;
	return html`<span class="settings-icon">${icon}</span>
<span class="settings-text"><span class="settings-title"${titleId}>${title}</span>${sub === undefined ? null : html`<span class="settings-sub"${subId}>${sub}</span>`}</span>`;
}

/** A row that opens `panel` under it. */
function opens(
	id: string,
	head: SafeHtml,
	panel: SafeHtml,
	wide = false,
): SafeHtml {
	return html`<li id="${id}"><details>
<summary class="settings-row">${head}</summary>
<div class="settings-panel${wide ? " is-wide" : ""}">
${panel}
</div>
</details></li>`;
}

/** A sign-out form as a row; the title alone names its button. */
function signOutRow(
	id: string,
	action: string,
	icon: SafeHtml,
	title: string,
	sub: string,
	fields: SafeHtml | null,
): SafeHtml {
	return html`<li><form method="post" action="${action}">${fields}<button class="settings-row" aria-labelledby="${id}" aria-describedby="${id}-sub">
${rowText(icon, title, sub, id)}
</button></form></li>`;
}

/** Who is signed in and how Strava is connected. */
function strava(i18n: I18n, rider: Rider): SafeHtml {
	const connected = rider.status === "connected";
	const initial = [...rider.firstName][0]?.toLocaleUpperCase(i18n.locale) ?? "";
	return html`<section id="settings-strava" class="settings-profile" aria-labelledby="settings-name">
<span class="settings-avatar" aria-hidden="true">${initial}</span>
<div>
<h2 class="settings-name" id="settings-name">${rider.firstName}</h2>
${
	connected
		? html`<span class="settings-chip">${i18n.t("me.status.connected")}</span>`
		: html`<span class="settings-chip is-warn">${i18n.t("settings.strava.broken")}</span>`
}
</div>
<p class="settings-profile-text">${connected ? i18n.t(rider.scopeReadAll ? "me.scope.readAll" : "me.scope.sharedOnly") : i18n.t("me.status.needsReconnect")}</p>
<p class="settings-profile-actions">${
		connected
			? html`<a class="button-outlined" href="/connect?next=/me/settings">${i18n.t("me.changePermissions")}</a>`
			: html`<a class="button" href="/connect?next=/me/settings">${i18n.t("me.reconnect")}</a>`
	}</p>
</section>`;
}

async function orgaRow(
	i18n: I18n,
	rider: Rider,
	db: D1Database,
): Promise<SafeHtml> {
	const names = (await orgaNames(db))
		.map(({ firstName, admin }) =>
			admin ? i18n.t("settings.orga.admin", { name: firstName }) : firstName,
		)
		.join(", ");
	const link =
		rider.administrator && !rider.guest
			? html`
<p><a href="/admin/riders">${i18n.t("settings.orga.link")}</a></p>`
			: null;
	return opens(
		"settings-orga",
		rowText(PEOPLE, i18n.t("settings.orga.title"), names),
		html`<p>${i18n.t("settings.orga.text")}</p>${link}`,
	);
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
		async ({ rider, consent }, balance) => {
			// The version the rider's Rynke were computed with (feature 005
			// FR-050), or the one in effect before their first evaluation.
			const inEffect = currentRules(ctx.team.rules);
			const version = balance?.rules_version ?? inEffect.version;
			const rules = rulesInfo(
				version,
				balance?.rules_effective_date ?? inEffect.effectiveDate,
				rulesForVersion(ctx.team.rules, version),
				countingWindow(ctx.env),
			);
			const switches = tourSwitches(ctx);
			// Who is in the Orga, for organisers and administrators (feature 043
			// FR-021, FR-022); own administrators get the way to change it.
			const orga = rider.organiser
				? await orgaRow(i18n, rider, ctx.env.DB)
				: null;
			const language =
				i18n.locales.find((l) => l.locale === i18n.locale)?.languageName ?? "";
			const tour = (kind: "rider" | "organiser") =>
				html`<li><a class="settings-row" href="${stepHref(kind, rider, 0, switches)}">${rowText(COMPASS, i18n.t(`settings.tour.${kind}`))}</a></li>`;
			const device = html`<li id="settings-app" hidden><details>
<summary class="settings-row">${rowText(INSTALL, i18n.t("install.button"))}</summary>
<div class="settings-panel">
${renderInstallHint(i18n)}
</div>
</details></li>
${renderNotifications(i18n, vapidPublicKey(ctx.env))}
${opens(
	"settings-language",
	html`${rowText(LANGUAGE, i18n.t("settings.language"))}<span class="settings-value">${language}</span>`,
	languageForm(i18n, "/me/settings"),
	true,
)}
<li><button type="button" class="settings-row" aria-haspopup="dialog" aria-controls="theme-menu">${rowText(PALETTE, i18n.t("theme.menu.title"))}<span class="settings-value" data-theme-value></span></button></li>
<li id="settings-shows" hidden><div class="settings-row is-static">${rowText(SPARKLE, i18n.t("settings.shows"), undefined, "settings-shows-on")}<button type="button" role="switch" aria-checked="true" aria-labelledby="settings-shows-on"></button></div></li>`;
			const data = html`${opens(
				"settings-rules",
				rowText(BOOK, i18n.t("rynke.rules.heading"), rulesVersion(i18n, rules)),
				renderRules(i18n, rules, ctx.team.rulesHandout),
			)}
${opens(
	"settings-consent",
	rowText(
		SHIELD,
		i18n.t("me.consent.heading"),
		i18n.t("me.consent.accepted", {
			version: consentLabel(consent),
			date: acceptedOn(i18n, consent),
		}),
	),
	consentSummary(i18n, "/me/settings", ctx.team),
)}
${orga}
${tour("rider")}
${rider.organiser ? tour("organiser") : null}`;
			return html`<div class="settings-page">
<div class="settings-col">
${strava(i18n, rider)}
${group("settings-device", i18n.t("settings.device"), device, i18n.t("theme.menu.note"))}
</div>
<div class="settings-col">
${group("settings-data", i18n.t("settings.data"), data)}
${group(
	"settings-about",
	i18n.t("settings.about"),
	html`<li><a class="settings-row" href="/changelog">${rowText(HISTORY, i18n.t("changelog.title"))}<span class="settings-value">${i18n.t("changelog.version", { version: APP_VERSION })}</span></a></li>`,
)}
${group(
	"settings-account",
	i18n.t("settings.account"),
	html`${signOutRow("settings-logout", "/logout", SIGN_OUT, i18n.t("layout.logout"), i18n.t("settings.logout.here"), html`<input type="hidden" name="push_endpoint" value="">`)}
${signOutRow("settings-logout-everywhere", "/logout/everywhere", DEVICES, i18n.t("settings.logoutEverywhere"), i18n.t("settings.logoutEverywhere.sub"), null)}`,
)}
<ul class="settings-list settings-danger">
<li><a class="settings-row" href="/me/disconnect">${rowText(TRASH, i18n.t("me.disconnect.button"))}</a></li>
</ul>
</div>
</div>`;
		},
		(athleteId: string) =>
			readBalanceStatement(ctx.env.DB, athleteId).first<BalanceRow>(),
	);
}
