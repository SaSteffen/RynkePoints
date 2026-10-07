import { berlinDate } from "../config";
import type { Ctx } from "../ctx";
import { getCurrentConsent } from "../db/consents";
import { readRiderView } from "../db/rider-view";
import { deleteRider, getRider, type Rider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { CURRENT_RULES, rulesForVersion } from "../rynke/rules";
import { revokeStoredToken } from "../strava/tokens";
import { forbidden } from "./errors";
import { html, htmlResponse, layout, type SafeHtml } from "./html";
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

// The rider's own pages (contracts/http-routes.md): `/me` with connection
// status, granted level and write access, import progress, the rider's Rynke
// with their gauges, where they come from and the rules behind them, and all
// their rides, 20 a page, with what each earns (feature 005, only ever their
// own and only read), the stored consent (feature 004 FR-014), disconnecting
// with deletion (FR-023), and signing out.

/**
 * The rider's current consent, what is read and who sees what, or that none is
 * stored.
 */
async function consent(
	ctx: Ctx,
	i18n: I18n,
	athleteId: number,
): Promise<SafeHtml> {
	const current = await getCurrentConsent(ctx.env.DB, athleteId);
	if (!current) return html`<p>${i18n.t("me.consent.none")}</p>`;
	// The team's calendar day, passed as UTC midnight like the season start.
	const date = i18n.formatDate(`${berlinDate(current.acceptedAt)}T00:00:00Z`);
	return html`<p>${i18n.t("me.consent.accepted", { version: String(current.version), date })}</p>
<p>${i18n.t("landing.dataRead")}</p>
<p>${i18n.t("consent.organisers")}</p>
<p>${i18n.t("consent.team")}</p>`;
}

async function signedInRider(
	request: Request,
	ctx: Ctx,
): Promise<Rider | null> {
	const athleteId = await readSession(request, ctx.env, ctx.now());
	return athleteId === null ? null : getRider(ctx.env.DB, athleteId);
}

export async function handleMe(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const rider = await signedInRider(request, ctx);
	if (!rider) return redirect("/", 302);

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
${renderRides(i18n, view.rides)}
<section>
<h2>${i18n.t("me.consent.heading")}</h2>
${await consent(ctx, i18n, rider.athleteId)}
</section>
<p><a href="/me/disconnect">${i18n.t("me.disconnect.button")}</a></p>
<form method="post" action="/logout"><button>${i18n.t("layout.logout")}</button></form>`,
		}),
	);
}

export async function handleDisconnectPage(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!(await signedInRider(request, ctx))) return redirect("/", 302);
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
	const rider = isSameOrigin(request)
		? await signedInRider(request, ctx)
		: null;
	if (!rider) return forbidden(i18n, "/me/disconnect");

	let revoked = await revokeStoredToken(ctx, rider.athleteId);
	if (revoked.kind === "transient") {
		revoked = await revokeStoredToken(ctx, rider.athleteId);
	}
	await deleteRider(ctx.env.DB, rider.athleteId);
	const notice =
		revoked.kind === "ok" ? "/notice/deleted" : "/notice/deleted-revoke-failed";
	return redirect(notice, 303, [clearSessionCookie()]);
}

export function handleLogout(request: Request, i18n: I18n): Response {
	if (!isSameOrigin(request)) return forbidden(i18n, "/me");
	return redirect("/", 302, [clearSessionCookie()]);
}
