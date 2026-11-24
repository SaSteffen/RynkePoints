import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import {
	type AdminRiderRow,
	isRole,
	type Role,
	readRidersAndRoles,
	roleRiderName,
} from "../../db/riders";
import type { I18n } from "../../i18n/i18n";
import { hasEvents } from "../../teams";
import { html, type SafeHtml } from "../html";
import { adminPage, adminSwitch, usageMarks, whole } from "./access";
import { ROLES_PATH } from "./roles";

// Admin › Rider und Rollen (feature 045, contracts/pages.md): the team's listed
// riders by role, its guests, and only counts of everyone else. Each row's
// "Ändern" opens one dialog with the rider's connection facts, the role choice
// and "Entfernen"; `public/app.js` fills it from the button and the row's
// facts template (research R4). No rides, Rynke or tokens, and the athlete ID
// only in `data-` attributes and the removal address (025 FR-019).

const REMOVE_ERRORS = ["self", "unknown", "lastAdmin"] as const;
const ROLE_ERRORS = new Map<string | null, "self" | "unknown">([
	["roleSelf", "self"],
	["roleUnknown", "unknown"],
]);

function dateOf(i18n: I18n, epochSeconds: number): string {
	return i18n.formatDate(`${berlinDate(epochSeconds)}T00:00:00Z`);
}

function initial(i18n: I18n, name: string): string {
	return [...name][0]?.toLocaleUpperCase(i18n.locale) ?? "";
}

/**
 * The notice after a removal or a role change, or an error; an error wins
 * (research R2). After a role change it offers "Rückgängig" to whoever may
 * change roles (043 FR-005).
 */
async function notice(
	url: URL,
	i18n: I18n,
	ctx: Ctx,
	canChange: boolean,
): Promise<SafeHtml | null> {
	const error = url.searchParams.get("error");
	const roleError = ROLE_ERRORS.get(error);
	if (roleError !== undefined) {
		return html`<p class="notice notice-error" role="alert">${i18n.t(`admin.roles.error.${roleError}`)}</p>
`;
	}
	if ((REMOVE_ERRORS as readonly string[]).includes(error ?? "")) {
		return html`<p class="notice notice-error" role="alert">${i18n.tHtml(`admin.remove.error.${error as (typeof REMOVE_ERRORS)[number]}`, { leave: html`<a href="/me/disconnect">${i18n.t("admin.remove.leaveLink")}</a>` })}</p>
`;
	}
	const done = url.searchParams.get("done");
	if (done === "removed") {
		return html`<p class="notice" role="status">${i18n.t("admin.remove.done.removed")}</p>
`;
	}
	const from = url.searchParams.get("from");
	const athlete = url.searchParams.get("athlete") ?? "";
	if (!isRole(done) || !isRole(from) || done === from) return null;
	const name = await roleRiderName(ctx.env.DB, athlete);
	if (name === null) return null;
	const text = done === "orga" && from === "admin" ? "notAdmin" : done;
	return html`<div class="notice notice-undo" role="status"><p>${i18n.t(`admin.roles.done.${text}`, { name })}</p>${
		canChange
			? html`<form method="post" action="${ROLES_PATH}"><input type="hidden" name="athlete" value="${athlete}"><input type="hidden" name="role" value="${from}"><button class="button-outlined">${i18n.t("admin.roles.undo")}</button></form>`
			: null
	}</div>
`;
}

/** The red line: what needs attention, in words (research R9, FR-015). */
function attention(i18n: I18n, rider: AdminRiderRow): string | null {
	const parts = [
		rider.status === "needs_reconnect"
			? i18n.t("admin.riders.status.needs_reconnect")
			: null,
		rider.importStatus === "done"
			? null
			: i18n.t("admin.riders.attention.import"),
	].filter((part) => part !== null);
	return parts.length === 0 ? null : parts.join(" · ");
}

/** The dialog's facts for one row; a guest has no club check (041 FR-008). */
function facts(i18n: I18n, rider: AdminRiderRow, guest: boolean): SafeHtml {
	const fact = (label: string, value: string, warn = false) =>
		html`<div><dt>${label}</dt><dd${warn ? html` class="warn"` : null}>${value}</dd></div>`;
	return html`<template data-facts><dl class="rider-facts">${fact(
		i18n.t("admin.riders.status"),
		i18n.t(`admin.riders.status.${rider.status}`),
		rider.status === "needs_reconnect",
	)}${fact(i18n.t("admin.riders.connected"), dateOf(i18n, rider.connectedAt))}${
		guest
			? null
			: fact(
					i18n.t("admin.riders.checked"),
					dateOf(i18n, rider.membershipCheckedAt),
				)
	}${fact(
		i18n.t("admin.riders.import"),
		i18n.t(`admin.riders.import.${rider.importStatus}`),
		rider.importStatus !== "done",
	)}</dl></template>`;
}

/** "Ändern"; a guest's has no role (research R4). */
function changeButton(
	i18n: I18n,
	rider: AdminRiderRow,
	role: Role | null,
): SafeHtml {
	return html`<button type="button" class="button-outlined" data-role-open data-athlete="${rider.athleteId}"${role === null ? null : html` data-role="${role}"`} data-title="${rider.firstName}" data-note="${i18n.t("admin.roles.sheet.note", { name: rider.firstName })}" data-remove="/admin/riders/${rider.athleteId}/remove">${i18n.t("admin.roles.change")}</button>`;
}

function row(
	i18n: I18n,
	rider: AdminRiderRow,
	role: Role | null,
	viewerId: string,
): SafeHtml {
	const you = rider.athleteId === viewerId;
	const guest = role === null;
	const since =
		role === "admin" || role === "orga"
			? rider.since === null
				? null
				: i18n.t(
						role === "admin"
							? "admin.roles.adminSince"
							: "admin.roles.orgaSince",
						{ date: dateOf(i18n, rider.since) },
					)
			: guest
				? i18n.t("admin.riders.guest.since", {
						date: dateOf(i18n, rider.connectedAt),
					})
				: null;
	const warn = attention(i18n, rider);
	const chip = (text: string) =>
		html`<span class="settings-chip">${text}</span>`;
	return html`<li data-name="${rider.firstName.toLocaleLowerCase(i18n.locale)}"><div class="settings-row is-static">
<span class="settings-avatar" aria-hidden="true">${initial(i18n, rider.firstName)}</span>
<span class="settings-text"><span class="settings-title">${rider.firstName}${you ? chip(i18n.t("admin.roles.you")) : null}${guest ? chip(i18n.t("admin.riders.guest")) : null}</span>${
		since === null ? null : html`<span class="settings-sub">${since}</span>`
	}${warn === null ? null : html`<span class="settings-sub is-warn">${warn}</span>`}</span>
${you ? null : changeButton(i18n, rider, role)}</div>${facts(i18n, rider, guest)}</li>
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

function choice(i18n: I18n, role: Role, text: string): SafeHtml {
	return html`<li><label><input type="radio" name="role" value="${role}" required><span><b>${i18n.t(`admin.roles.choice.${role}`)}</b><span>${text}</span></span></label></li>`;
}

/**
 * The one dialog: the row's facts, the role choice for whoever may change
 * roles (hidden by `app.js` for a guest's row, research R5), and "Entfernen".
 */
function sheet(i18n: I18n, canChange: boolean, events: boolean): SafeHtml {
	return html`<dialog class="role-sheet" aria-labelledby="role-sheet-title"><form method="post" action="${ROLES_PATH}">
<h2 id="role-sheet-title"></h2>
<div data-facts></div>
${
	canChange
		? html`<div data-role-part>
<input type="hidden" name="athlete" value="">
<h3>${i18n.t("admin.roles.sheet.role")}</h3>
<ul class="role-choice">
${choice(i18n, "none", i18n.t("admin.roles.choice.none.text"))}
${choice(i18n, "orga", i18n.t(events ? "admin.roles.choice.orga.text.events" : "admin.roles.choice.orga.text"))}
${choice(i18n, "admin", i18n.t("admin.roles.choice.admin.text"))}
</ul>
<p class="role-sheet-note" data-role-note></p>
</div>
`
		: null
}<div class="actions"><a class="button-text sheet-remove" data-role-remove>${i18n.t("admin.riders.remove")}</a><button type="button" class="button-text" data-role-cancel>${i18n.t("admin.roles.cancel")}</button>${
		canChange
			? html`<button class="button" data-role-save>${i18n.t("admin.roles.save")}</button>`
			: null
	}</div>
</form></dialog>
`;
}

export function handleAdminRiders(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const url = new URL(request.url);
	return adminPage(
		request,
		ctx,
		i18n,
		`/admin/riders${url.search}`,
		async (shell) => {
			const viewer = shell.rider;
			const canChange = !viewer.guest;
			const events = hasEvents(ctx.team);
			const { admins, orga, none, guests, unlisted, blocked } =
				await readRidersAndRoles(ctx.env.DB);
			const rows = (list: AdminRiderRow[], role: Role | null) =>
				list.map((rider) => row(i18n, rider, role, viewer.athleteId));
			const viewerIsOwnAdmin = admins.some(
				(rider) => rider.athleteId === viewer.athleteId,
			);
			const adminNote = viewerIsOwnAdmin
				? i18n.t(
						admins.length === 1
							? "admin.roles.onlyAdmin"
							: "admin.roles.ownNote",
					)
				: null;
			const listed = admins.length + orga.length + none.length;
			const search = i18n.t("admin.roles.search");
			return html`${adminSwitch(i18n, "riders", await usageMarks(shell))}<div class="settings-page roles">
<div class="settings-col">
${await notice(url, i18n, ctx, canChange)}<p class="roles-hint">${i18n.t(events ? "admin.roles.hint.events" : "admin.roles.hint")}</p>
<input type="search" class="rider-search" data-role-search aria-label="${search}" placeholder="${search}" autocomplete="off">
<p class="settings-note" data-role-search-none hidden>${i18n.t("admin.roles.searchNone")}</p>
${section(i18n.t("admin.roles.admins"), rows(admins, "admin"), adminNote)}${section(
	i18n.t("admin.roles.orga"),
	rows(orga, "orga"),
	i18n.t("admin.roles.orgaNote"),
	i18n.t("admin.roles.orgaNone"),
)}${
	guests.length === 0
		? null
		: section(
				i18n.t("admin.riders.guests.heading"),
				rows(guests, null),
				i18n.t("admin.riders.guests.note"),
			)
}</div>
<div class="settings-col">
${section(
	i18n.t("admin.roles.without.heading"),
	rows(none, "none"),
	i18n.t("admin.roles.without.note", {
		listed: whole(i18n, listed),
		waiting: whole(i18n, unlisted),
		blocked: whole(i18n, blocked),
	}),
	i18n.t(listed === 0 ? "admin.riders.none" : "admin.roles.without.empty"),
)}</div>
</div>
${sheet(i18n, canChange, events)}`;
		},
	);
}
