import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import { blockedCountStatement } from "../../db/blocked";
import { type OverviewRider, readRiderOverview } from "../../db/riders";
import type { I18n } from "../../i18n/i18n";
import { html, type SafeHtml } from "../html";
import { adminPage, adminSwitch, whole } from "./access";

// The rider overview at `/admin/riders` (feature 025 US3, FR-018, FR-019, FR-031,
// FR-038): the first name, connection and import state of riders who agreed to the
// version that covers it, and only counts of everyone else. No rides, Rynke or
// tokens, and the athlete ID only in the remove link's address (research R6).

const DONE_CODES = ["removed", "removed-revoke-failed"] as const;
const ERROR_CODES = ["self", "unknown"] as const;

function resultNotice(url: URL, i18n: I18n): SafeHtml | null {
	const done = url.searchParams.get("done");
	if ((DONE_CODES as readonly (string | null)[]).includes(done)) {
		return html`<p class="notice" role="status">${i18n.t(`admin.remove.done.${done as (typeof DONE_CODES)[number]}`)}</p>
`;
	}
	const error = url.searchParams.get("error");
	if ((ERROR_CODES as readonly (string | null)[]).includes(error)) {
		return html`<p class="notice notice-error" role="alert">${i18n.tHtml(`admin.remove.error.${error as (typeof ERROR_CODES)[number]}`, { leave: html`<a href="/me/disconnect">${i18n.t("admin.remove.leaveLink")}</a>` })}</p>
`;
	}
	return null;
}

function dateOf(i18n: I18n, epochSeconds: number): string {
	return i18n.formatDate(`${berlinDate(epochSeconds)}T00:00:00Z`);
}

function riderCard(
	i18n: I18n,
	rider: OverviewRider,
	viewerId: number,
): SafeHtml {
	return html`<li class="card admin-rider">
<h3>${rider.firstName}</h3>
<dl>
<div><dt>${i18n.t("admin.riders.status")}</dt><dd>${i18n.t(`admin.riders.status.${rider.status}`)}</dd></div>
<div><dt>${i18n.t("admin.riders.connected")}</dt><dd>${dateOf(i18n, rider.connectedAt)}</dd></div>
<div><dt>${i18n.t("admin.riders.checked")}</dt><dd>${dateOf(i18n, rider.membershipCheckedAt)}</dd></div>
<div><dt>${i18n.t("admin.riders.import")}</dt><dd>${i18n.t(`admin.riders.import.${rider.importStatus}`)}</dd></div>
</dl>
${rider.athleteId === viewerId ? null : html`<p><a class="danger" href="/admin/riders/${rider.athleteId}/remove">${i18n.t("admin.riders.remove")}</a></p>`}
</li>
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
		async ({ rider: viewer }) => {
			const db = ctx.env.DB;
			const [{ riders, unlisted }, blocked] = await Promise.all([
				readRiderOverview(db),
				blockedCountStatement(db).first<number>("n"),
			]);
			return html`${adminSwitch(i18n, "riders")}${resultNotice(url, i18n)}<p>${i18n.t(
				"admin.riders.counts",
				{
					listed: whole(i18n, riders.length),
					unlisted: whole(i18n, unlisted),
					blocked: whole(i18n, blocked ?? 0),
				},
			)}</p>
${
	riders.length === 0
		? html`<p class="notice">${i18n.t("admin.riders.none")}</p>
`
		: html`<ul class="admin-riders">
${riders.map((rider) => riderCard(i18n, rider, viewer.athleteId))}</ul>
`
}`;
		},
	);
}
