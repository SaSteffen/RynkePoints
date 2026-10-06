import { berlinDate } from "../config";
import type { Ctx } from "../ctx";
import { listRecentActivities } from "../db/activities";
import { getCurrentConsent } from "../db/consents";
import { deleteRider, getRider, type Rider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { revokeStoredToken } from "../strava/tokens";
import { forbidden } from "./errors";
import { html, htmlResponse, layout, type SafeHtml } from "./html";
import { redirect } from "./redirect";
import { clearSessionCookie, isSameOrigin, readSession } from "./session";

// The rider's own pages (contracts/http-routes.md): `/me` with connection
// status, granted level and write access, import progress, the 20 newest rides
// (US4) and the stored consent (feature 004 FR-014), disconnecting with
// deletion (FR-023), and signing out.

const RECENT_LIMIT = 20;

/** The rider's newest rides, only ever their own (FR-025, FR-026). */
async function recentRides(
	ctx: Ctx,
	i18n: I18n,
	athleteId: number,
): Promise<SafeHtml> {
	const activities = await listRecentActivities(
		ctx.env.DB,
		athleteId,
		RECENT_LIMIT,
	);
	if (activities.length === 0) {
		return html`<p>${i18n.t("me.recent.empty")}</p>`;
	}
	const rows = activities.map((a) => {
		// The rider's local date: Strava writes local wall-clock time with a `Z`.
		const date = i18n.formatDate(a.start_date_local);
		const sport = i18n.t(`sport.${a.sport_type}`);
		const km = i18n.formatNumber(a.distance_m / 1000, { fractionDigits: 1 });
		const m = i18n.formatNumber(a.elevation_gain_m, { fractionDigits: 0 });
		return html`<tr><td>${date}</td><td>${sport}</td><td>${i18n.t("units.km", { value: km })}</td><td>${i18n.t("units.m", { value: m })}</td></tr>
`;
	});
	return html`<table>
<thead><tr><th>${i18n.t("me.recent.col.date")}</th><th>${i18n.t("me.recent.col.sport")}</th><th>${i18n.t("me.recent.col.distance")}</th><th>${i18n.t("me.recent.col.elevation")}</th></tr></thead>
<tbody>
${rows}</tbody>
</table>`;
}

/** The rider's current consent and who sees what, or that none is stored. */
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
	// The configured date, not the Berlin-midnight epoch: that is the day before
	// in UTC.
	const seasonStart = i18n.formatDate(`${ctx.env.SEASON_START_DATE}T00:00:00Z`);
	const importStatus =
		rider.importStatus === "done"
			? i18n.t("me.import.done")
			: i18n.t("me.import.running", { date: seasonStart });

	return htmlResponse(
		i18n,
		layout(i18n, {
			title,
			path: "/me",
			body: html`<h1>${i18n.t("me.greeting", { firstName: rider.firstName })}</h1>
${status}
<p>${i18n.t(rider.scopeReadAll ? "me.scope.readAll" : "me.scope.sharedOnly")}</p>
<p>${i18n.t(rider.scopeWrite ? "me.scope.write" : "me.scope.noWrite")}</p>
<p><a href="/connect">${i18n.t("me.changePermissions")}</a></p>
<p>${importStatus}</p>
<section>
<h2>${i18n.t("me.recent.heading")}</h2>
${await recentRides(ctx, i18n, rider.athleteId)}
</section>
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
