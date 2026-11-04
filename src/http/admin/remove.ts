import type { Ctx } from "../../ctx";
import { removeRider } from "../../db/blocked";
import { listedRiderName } from "../../db/riders";
import type { I18n } from "../../i18n/i18n";
import { revokeStoredToken } from "../../strava/tokens";
import { html } from "../html";
import { redirect } from "../redirect";
import { adminPage, adminSwitch, requireAdminPost } from "./access";

// Removing and blocking a rider (feature 025 US4, FR-021 to FR-024, research R6).
// Only a rider the overview lists, never oneself: leaving is `/me/disconnect`.

function back(param: "done" | "error", code: string): Response {
	return redirect(`/admin/riders?${param}=${code}`, 303);
}

export function handleRemoveConfirm(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	athleteId: number,
): Promise<Response> {
	const path = `/admin/riders/${athleteId}/remove`;
	return adminPage(request, ctx, i18n, path, async ({ rider }) => {
		if (athleteId === rider.athleteId) return back("error", "self");
		const name = await listedRiderName(ctx.env.DB, athleteId);
		if (name === null) return back("error", "unknown");
		return html`${adminSwitch(i18n, "riders")}<section class="card">
<h2>${i18n.t("admin.remove.title", { name })}</h2>
<p>${i18n.t("admin.remove.explain")}</p>
<form method="post" action="${path}"><button class="danger">${i18n.t("admin.remove.confirm")}</button></form>
<p><a class="button-outlined" href="/admin/riders">${i18n.t("admin.remove.cancel")}</a></p>
</section>
`;
	});
}

/**
 * Revokes at Strava (one retry on a transient failure), then blocks and deletes
 * whatever Strava answered, as when a rider leaves. The ID is checked first, so an
 * unknown or unlisted one changes nothing and costs no request (FR-004).
 */
export async function handleRemoveRider(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	athleteId: number,
): Promise<Response> {
	const path = `/admin/riders/${athleteId}/remove`;
	const administrator = await requireAdminPost(request, ctx, i18n, path);
	if (administrator instanceof Response) return administrator;
	if (athleteId === administrator.athleteId) return back("error", "self");
	const db = ctx.env.DB;
	if ((await listedRiderName(db, athleteId)) === null) {
		return back("error", "unknown");
	}
	let revoked = await revokeStoredToken(ctx, athleteId);
	if (revoked.kind === "transient") {
		revoked = await revokeStoredToken(ctx, athleteId);
	}
	await removeRider(db, athleteId, administrator.athleteId, ctx.now());
	return back(
		"done",
		revoked.kind === "ok" ? "removed" : "removed-revoke-failed",
	);
}
