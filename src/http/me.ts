import type { Ctx } from "../ctx";
import { deleteRider, getRider, type Rider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { revokeStoredToken } from "../strava/tokens";
import { forbidden } from "./errors";
import { html, htmlResponse, layout } from "./html";
import { redirect } from "./redirect";
import { clearSessionCookie, isSameOrigin, readSession } from "./session";

// The rider's own pages (contracts/http-routes.md): `/me` with connection
// status, granted level and import progress (recent rides follow with US4),
// disconnecting with deletion (FR-023), and signing out.

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
<p>${importStatus}</p>
<section>
<h2>${i18n.t("me.recent.heading")}</h2>
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
