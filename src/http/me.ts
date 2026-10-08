import type { Ctx } from "../ctx";
import {
	deleteSubscription,
	MAX_ENDPOINT_LENGTH,
} from "../db/push-subscriptions";
import { deleteRider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { revokeStoredToken } from "../strava/tokens";
import { forbidden } from "./errors";
import { html, htmlResponse, layout } from "./html";
import { redirect } from "./redirect";
import { clearSessionCookie, isSameOrigin, readSession } from "./session";
import { readViewer, requireRider } from "./viewer";

// Leaving and signing out (contracts/http-routes.md): disconnecting with
// deletion (FR-023) and its confirmation page, and signing out. The rider's
// own pages are the sections under `sections/` (feature 011).

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
