import type { Ctx } from "../ctx";
import {
	deleteSubscription,
	MAX_ENDPOINT_LENGTH,
} from "../db/push-subscriptions";
import { deleteRider, endSessions } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { queueReport } from "../routing/report";
import { withdrawStoredGrant } from "../strava/withdraw";
import { forbidden } from "./errors";
import { html, htmlResponse, layout, pageLook } from "./html";
import { redirect } from "./redirect";
import { clearSessionCookie, isSameOrigin, readSession } from "./session";
import { readViewer, requireRider } from "./viewer";

// Leaving and signing out (contracts/http-routes.md): disconnecting with
// deletion (FR-023) and its confirmation page, signing out, and signing out
// everywhere (issue #314). The rider's own pages are the sections under
// `sections/` (feature 011).

export async function handleDisconnectPage(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const viewer = await readViewer(request, ctx);
	const denied = requireRider(viewer);
	if (denied) return denied;
	const title = i18n.t("disconnect.title");
	// A guest's grant stays: their own team needs it (041 FR-009).
	const explain =
		viewer.kind === "rider" && viewer.rider.guest
			? "disconnect.explain.guest"
			: "disconnect.explain";
	return htmlResponse(
		i18n,
		layout(i18n, {
			look: pageLook(ctx),
			title,
			path: "/me/disconnect",
			body: html`<h1>${title}</h1>
<p>${i18n.t(explain)}</p>
<form method="post" action="/me/disconnect"><button class="danger">${i18n.t("disconnect.confirm")}</button></form>
<p><a class="button-outlined" href="/me/settings">${i18n.t("disconnect.cancel")}</a></p>`,
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
	if (viewer?.kind !== "rider") return forbidden(ctx, i18n, "/me/disconnect");
	const { rider } = viewer;

	// Unless another team holds them; a token not settled yet is kept and
	// withdrawn later (feature 041 R14).
	await withdrawStoredGrant(ctx, rider.athleteId);
	await deleteRider(ctx.env.DB, rider.athleteId);
	await queueReport(ctx, rider.athleteId);
	return redirect("/notice/deleted", 303, [clearSessionCookie()]);
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
	if (!isSameOrigin(request)) return forbidden(ctx, i18n, "/me");
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

/**
 * Signs out on every device, this one too, by raising the rider's session
 * epoch; every device's notifications end with it (issue #314).
 */
export async function handleLogoutEverywhere(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	if (!isSameOrigin(request)) return forbidden(ctx, i18n, "/me/settings");
	const viewer = await readViewer(request, ctx);
	if (viewer.kind === "rider") {
		await endSessions(ctx.env.DB, viewer.rider.athleteId, ctx.now());
	}
	return redirect("/", 302, [clearSessionCookie()]);
}
