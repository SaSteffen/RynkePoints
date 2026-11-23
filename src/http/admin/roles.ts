import type { Ctx } from "../../ctx";
import { isRole, setRole } from "../../db/riders";
import type { I18n } from "../../i18n/i18n";
import { forbidden } from "../errors";
import { redirect } from "../redirect";
import { requireAdminPost } from "./access";

// Changing a role (feature 043 contracts/http-routes.md) from Admin › Rider und
// Rollen (feature 045): only own administrators, never their own (FR-011,
// FR-012). The page lives at `/admin/riders`; the old Rollen address forwards
// there (research R1, R2).

export const ROLES_PATH = "/admin/roles";

/** Rollen's error codes, renamed so they can't meet the removal's (R2). */
const OLD_ERRORS = new Map([
	["self", "roleSelf"],
	["unknown", "roleUnknown"],
]);

function back(query: string): Response {
	return redirect(`/admin/riders?${query}`, 303);
}

/** `GET /admin/roles`: an old link or bookmark, with its notice kept. */
export function handleOldRolesAddress(request: Request): Response {
	const query = new URL(request.url).searchParams;
	const renamed = OLD_ERRORS.get(query.get("error") ?? "");
	if (renamed !== undefined) query.set("error", renamed);
	const search = query.toString();
	return redirect(`/admin/riders${search === "" ? "" : `?${search}`}`, 301);
}

/** `POST /admin/roles`: sets a listed rider's role (FR-008 to FR-013). */
export async function handleSetRole(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const administrator = await requireAdminPost(request, ctx, i18n, ROLES_PATH);
	if (administrator instanceof Response) return administrator;
	if (administrator.guest) return forbidden(ctx, i18n, ROLES_PATH);
	const form = await request.formData();
	const athlete = form.get("athlete");
	const role = form.get("role");
	if (typeof athlete !== "string" || !isRole(role)) {
		return new Response("Bad request", { status: 400 });
	}
	if (athlete === administrator.athleteId) return back("error=roleSelf");
	const outcome = await setRole(
		ctx.env.DB,
		athlete,
		role,
		administrator,
		ctx.now(),
	);
	if (outcome.result === "unknown") return back("error=roleUnknown");
	return back(
		`done=${role}&athlete=${encodeURIComponent(athlete)}&from=${outcome.from}`,
	);
}
