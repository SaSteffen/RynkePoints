import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import {
	isRole,
	type Role,
	type RoleEntry,
	readRoles,
	roleRiderName,
	setRole,
} from "../../db/riders";
import type { I18n } from "../../i18n/i18n";
import { forbidden } from "../errors";
import { html, type SafeHtml } from "../html";
import { redirect } from "../redirect";
import { adminPage, adminSwitch, requireAdminPost } from "./access";

// Admin › Rollen (feature 043, contracts/pages.md and http-routes.md): the
// team's own administrators and organisers, and its listed riders without a
// role. Every administrator sees it; only own administrators change roles,
// never their own (FR-011, FR-012). One dialog holds the choice; `public/app.js`
// fills it from the button that opens it (research R5).

const PATH = "/admin/roles";

function dateOf(i18n: I18n, epochSeconds: number): string {
	return i18n.formatDate(`${berlinDate(epochSeconds)}T00:00:00Z`);
}

function initial(i18n: I18n, name: string): string {
	return [...name][0]?.toLocaleUpperCase(i18n.locale) ?? "";
}

/** The button that opens the choice for a rider. */
function chooser(
	i18n: I18n,
	entry: RoleEntry,
	role: Role,
	label: string,
): SafeHtml {
	return html`<button type="button" class="button-outlined" data-role-open data-athlete="${entry.athleteId}" data-role="${role}" data-title="${i18n.t("admin.roles.sheet.title", { name: entry.firstName })}" data-note="${i18n.t("admin.roles.sheet.note", { name: entry.firstName })}">${label}</button>`;
}

function row(
	i18n: I18n,
	entry: RoleEntry,
	sub: string | null,
	tail: SafeHtml | null,
	you = false,
): SafeHtml {
	return html`<li data-name="${entry.firstName.toLocaleLowerCase(i18n.locale)}"><div class="settings-row is-static">
<span class="settings-avatar" aria-hidden="true">${initial(i18n, entry.firstName)}</span>
<span class="settings-text"><span class="settings-title">${entry.firstName}${you ? html`<span class="settings-chip">${i18n.t("admin.roles.you")}</span>` : null}</span>${sub === null ? null : html`<span class="settings-sub">${sub}</span>`}</span>
${tail}</div></li>
`;
}

function section(
	heading: string,
	rows: SafeHtml[],
	note: string | null,
	empty?: string,
): SafeHtml {
	return html`<section class="settings-section">
<h2>${heading}</h2>
${
	rows.length === 0 && empty !== undefined
		? html`<p class="settings-note">${empty}</p>`
		: html`<ul class="settings-list">
${rows}</ul>`
}
${note === null ? null : html`<p class="settings-note">${note}</p>`}
</section>
`;
}

/** The notice after a change, with "Rückgängig" (FR-005), or an error. */
async function notice(
	url: URL,
	i18n: I18n,
	ctx: Ctx,
	canChange: boolean,
): Promise<SafeHtml | null> {
	const error = url.searchParams.get("error");
	if (error === "self" || error === "unknown") {
		return html`<p class="notice notice-error" role="alert">${i18n.t(`admin.roles.error.${error}`)}</p>
`;
	}
	const done = url.searchParams.get("done");
	const from = url.searchParams.get("from");
	const athlete = url.searchParams.get("athlete") ?? "";
	if (!isRole(done) || !isRole(from) || done === from) return null;
	const name = await roleRiderName(ctx.env.DB, athlete);
	if (name === null) return null;
	const text =
		done === "orga" && from === "admin" ? "notAdmin" : (done as Role);
	return html`<div class="notice notice-undo" role="status"><p>${i18n.t(`admin.roles.done.${text}`, { name })}</p>${
		canChange
			? html`<form method="post" action="${PATH}"><input type="hidden" name="athlete" value="${athlete}"><input type="hidden" name="role" value="${from}"><button class="button-outlined">${i18n.t("admin.roles.undo")}</button></form>`
			: null
	}</div>
`;
}

function choice(i18n: I18n, role: Role, key: "none" | "orga" | "admin") {
	return html`<li><label><input type="radio" name="role" value="${role}" required><span><b>${i18n.t(`admin.roles.choice.${key}`)}</b><span>${i18n.t(`admin.roles.choice.${key}.text`)}</span></span></label></li>`;
}

function sheet(i18n: I18n): SafeHtml {
	return html`<dialog class="role-sheet" aria-labelledby="role-sheet-title"><form method="post" action="${PATH}">
<h2 id="role-sheet-title"></h2>
<input type="hidden" name="athlete" value="">
<ul class="role-choice">
${choice(i18n, "none", "none")}
${choice(i18n, "orga", "orga")}
${choice(i18n, "admin", "admin")}
</ul>
<p class="role-sheet-note" data-role-note></p>
<div class="actions"><button type="button" class="button-text" data-role-cancel>${i18n.t("admin.roles.cancel")}</button><button class="button">${i18n.t("admin.roles.save")}</button></div>
</form></dialog>
`;
}

export function handleAdminRoles(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const url = new URL(request.url);
	return adminPage(
		request,
		ctx,
		i18n,
		`${PATH}${url.search}`,
		async ({ rider: viewer }) => {
			const canChange = !viewer.guest;
			const { admins, orga, none } = await readRoles(ctx.env.DB);
			const change = i18n.t("admin.roles.change");
			const since = (key: "adminSince" | "orgaSince", entry: RoleEntry) =>
				entry.since === null
					? null
					: i18n.t(`admin.roles.${key}`, { date: dateOf(i18n, entry.since) });
			const adminRows = admins.map((entry) => {
				const you = entry.athleteId === viewer.athleteId;
				return row(
					i18n,
					entry,
					since("adminSince", entry),
					you || !canChange ? null : chooser(i18n, entry, "admin", change),
					you,
				);
			});
			const orgaRows = orga.map((entry) =>
				row(
					i18n,
					entry,
					since("orgaSince", entry),
					canChange ? chooser(i18n, entry, "orga", change) : null,
				),
			);
			const viewerIsOwnAdmin = admins.some(
				(entry) => entry.athleteId === viewer.athleteId,
			);
			const adminNote = !viewerIsOwnAdmin
				? null
				: i18n.t(
						admins.length === 1
							? "admin.roles.onlyAdmin"
							: "admin.roles.ownNote",
					);
			const give = canChange
				? html`<div class="settings-col">
<section class="settings-section roles-give">
<h2>${i18n.t("admin.roles.give.heading")}</h2>
${
	none.length === 0
		? html`<p class="settings-note">${i18n.t("admin.roles.give.none")}</p>`
		: html`<input type="search" class="rider-search" data-role-search aria-label="${i18n.t("admin.roles.search")}" placeholder="${i18n.t("admin.roles.search")}" autocomplete="off">
<p class="settings-note" data-role-search-none hidden>${i18n.t("admin.roles.searchNone")}</p>
<ul class="settings-list">
${none.map((entry) => row(i18n, entry, null, chooser(i18n, entry, "none", i18n.t("admin.roles.give.button"))))}</ul>`
}
<p class="settings-note">${i18n.t("admin.roles.give.note")}</p>
</section>
</div>
${sheet(i18n)}`
				: null;
			return html`${adminSwitch(i18n, "roles")}<div class="settings-page roles">
<div class="settings-col">
${await notice(url, i18n, ctx, canChange)}<p class="roles-hint">${i18n.t("admin.roles.hint")}</p>
${section(i18n.t("admin.roles.admins"), adminRows, adminNote)}${section(i18n.t("admin.roles.orga"), orgaRows, i18n.t("admin.roles.orgaNote"), i18n.t("admin.roles.orgaNone"))}</div>
${give}</div>
`;
		},
	);
}

function back(query: string): Response {
	return redirect(`${PATH}?${query}`, 303);
}

/** `POST /admin/roles`: sets a listed rider's role (FR-008 to FR-013). */
export async function handleSetRole(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const administrator = await requireAdminPost(request, ctx, i18n, PATH);
	if (administrator instanceof Response) return administrator;
	if (administrator.guest) return forbidden(ctx, i18n, PATH);
	const form = await request.formData();
	const athlete = form.get("athlete");
	const role = form.get("role");
	if (typeof athlete !== "string" || !isRole(role)) {
		return new Response("Bad request", { status: 400 });
	}
	if (athlete === administrator.athleteId) return back("error=self");
	const outcome = await setRole(
		ctx.env.DB,
		athlete,
		role,
		administrator,
		ctx.now(),
	);
	if (outcome.result === "unknown") return back("error=unknown");
	return back(
		`done=${role}&athlete=${encodeURIComponent(athlete)}&from=${outcome.from}`,
	);
}
