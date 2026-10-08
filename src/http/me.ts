import { berlinDate } from "../config";
import { currentVersion, hasAgreed } from "../consent";
import type { Ctx } from "../ctx";
import { type Consent, getCurrentConsent } from "../db/consents";
import {
	deleteSubscription,
	MAX_ENDPOINT_LENGTH,
} from "../db/push-subscriptions";
import { readRiderView } from "../db/rider-view";
import { deleteRider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { vapidPublicKey } from "../push/vapid";
import { CURRENT_RULES, rulesForVersion } from "../rynke/rules";
import { revokeStoredToken } from "../strava/tokens";
import { consentGate } from "./consent-gate";
import { forbidden } from "./errors";
import { html, htmlResponse, layout, type SafeHtml } from "./html";
import { renderInstallHint, renderNotifications } from "./pwa";
import { redirect } from "./redirect";
import {
	renderBreakdown,
	renderGauges,
	renderNotice,
	renderRides,
	renderRules,
	renderSummary,
} from "./rider-sections";
import { buildRiderView, parsePage } from "./rider-view";
import { clearSessionCookie, isSameOrigin, readSession } from "./session";
import { readViewer, requireRider, riderConsentState } from "./viewer";

// The rider's own pages (contracts/http-routes.md): `/me` with connection
// status, granted level and write access, import progress, the rider's Rynke
// with their gauges, where they come from and the rules behind them, and all
// their rides, 20 a page, with what each earns (feature 005, only ever their
// own and only read), the stored consent (feature 004 FR-014), disconnecting
// with deletion (FR-023), and signing out.

/** The team's calendar day of an acceptance, passed as UTC midnight like the season start. */
function acceptedOn(i18n: I18n, consent: Consent): string {
	return i18n.formatDate(`${berlinDate(consent.acceptedAt)}T00:00:00Z`);
}

/** The rider's current consent, what is read and who sees what. */
function consent(i18n: I18n, current: Consent): SafeHtml {
	const date = acceptedOn(i18n, current);
	return html`<p>${i18n.t("me.consent.accepted", { version: String(current.version), date })}</p>
<p>${i18n.t("landing.dataRead")}</p>
<p>${i18n.t("consent.organisers")}</p>
<p>${i18n.t("consent.team")}</p>`;
}

export async function handleMe(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const viewer = await readViewer(request, ctx);
	if (viewer.kind === "visitor") return redirect("/", 302);
	// Nothing else of `/me` until the rider agrees (004 research R14).
	const state = riderConsentState(viewer, ctx);
	const accepted =
		viewer.consentVersion === null
			? null
			: await getCurrentConsent(ctx.env.DB, viewer.rider.athleteId);
	if (!hasAgreed(state) || !accepted) {
		const current = currentVersion(ctx.consentVersions).version;
		return consentGate(
			i18n,
			current,
			state.kind === "older" && accepted
				? {
						state: "older",
						accepted: state.accepted,
						date: acceptedOn(i18n, accepted),
						changes: state.changes,
						viaStrava: state.viaStrava,
					}
				: { state: accepted ? "scopes" : "missing" },
		);
	}
	const { rider } = viewer;

	const title = i18n.t("me.title");
	const status =
		rider.status === "connected"
			? html`<p>${i18n.t("me.status.connected")}</p>`
			: html`<p>${i18n.t("me.status.needsReconnect")}</p>
<p><a href="/connect">${i18n.t("me.reconnect")}</a></p>`;

	const read = await readRiderView(
		ctx.env.DB,
		rider.athleteId,
		parsePage(new URL(request.url)),
	);
	const view = buildRiderView(
		read,
		read.balance ? rulesForVersion(read.balance.rulesVersion) : null,
		CURRENT_RULES,
		{
			seasonStart: ctx.env.SEASON_START_DATE,
			importing: rider.importStatus !== "done",
			rulesFor: rulesForVersion,
		},
	);

	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			// The page shown, so the language switch keeps it (FR-046).
			path: read.page > 1 ? `/me?page=${read.page}` : "/me",
			body: html`<h1>${i18n.t("me.greeting", { firstName: rider.firstName })}</h1>
${renderInstallHint(i18n)}
${status}
<p>${i18n.t(rider.scopeReadAll ? "me.scope.readAll" : "me.scope.sharedOnly")}</p>
<p>${i18n.t(rider.scopeWrite ? "me.scope.write" : "me.scope.noWrite")}</p>
<p><a href="/connect">${i18n.t("me.changePermissions")}</a></p>
${rider.importStatus === "done" ? html`<p>${i18n.t("me.import.done")}</p>` : null}
${renderNotice(i18n, view, ctx.env.SEASON_START_DATE)}
${view.state === "ready" ? renderSummary(i18n, view.summary) : null}
${view.state === "ready" && view.gauges ? renderGauges(i18n, view.gauges) : null}
${view.state === "ready" ? renderBreakdown(i18n, view.breakdown) : null}
${view.state === "ready" ? renderRules(i18n, view.rules) : null}
${renderNotifications(i18n, vapidPublicKey(ctx.env))}
${renderRides(i18n, view.rides)}
<section>
<h2>${i18n.t("me.consent.heading")}</h2>
${consent(i18n, accepted)}
</section>
<p><a href="/me/disconnect">${i18n.t("me.disconnect.button")}</a></p>
<form method="post" action="/logout"><input type="hidden" name="push_endpoint" value=""><button>${i18n.t("layout.logout")}</button></form>`,
		}),
	);
}

export async function handleDisconnectPage(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const denied = requireRider(await readViewer(request, ctx));
	if (denied) return denied;
	const title = i18n.t("disconnect.title");
	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path: "/me/disconnect",
			body: html`<h1>${title}</h1>
<p>${i18n.t("disconnect.explain")}</p>
<form method="post" action="/me/disconnect"><button>${i18n.t("disconnect.confirm")}</button></form>
<p><a href="/me">${i18n.t("disconnect.cancel")}</a></p>`,
		}),
	);
}

/**
 * Revokes at Strava (one retry on a transient failure), then deletes the
 * rider whatever Strava answered: the rider asked for deletion (FR-023).
 */
export async function handleDisconnect(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const viewer = isSameOrigin(request) ? await readViewer(request, ctx) : null;
	if (viewer?.kind !== "rider") return forbidden(i18n, "/me/disconnect");
	const { rider } = viewer;

	let revoked = await revokeStoredToken(ctx, rider.athleteId);
	if (revoked.kind === "transient") {
		revoked = await revokeStoredToken(ctx, rider.athleteId);
	}
	await deleteRider(ctx.env.DB, rider.athleteId);
	const notice =
		revoked.kind === "ok" ? "/notice/deleted" : "/notice/deleted-revoke-failed";
	return redirect(notice, 303, [clearSessionCookie()]);
}

/**
 * Signs out. `app.js` puts this device's push endpoint into the form, so its
 * notifications end with the sign-in (feature 010 FR-013, research R9). The
 * delete is bound to the session's rider, so it can't touch another's device.
 */
export async function handleLogout(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!isSameOrigin(request)) return forbidden(i18n, "/me");
	const form = await request.formData().catch(() => null);
	const endpoint = form?.get("push_endpoint");
	if (
		typeof endpoint === "string" &&
		endpoint !== "" &&
		endpoint.length <= MAX_ENDPOINT_LENGTH
	) {
		const athleteId = await readSession(request, ctx.env, ctx.now());
		if (athleteId !== null) {
			await deleteSubscription(ctx.env.DB, endpoint, athleteId);
		}
	}
	return redirect("/", 302, [clearSessionCookie()]);
}
