import type { Ctx } from "../../ctx";
import { subscriptionIdsOfRiders } from "../../db/push-subscriptions";
import { readStravaUsage } from "../../db/rate-limit";
import {
	connectedCountStatement,
	type Rider,
	setAdminAlerts,
} from "../../db/riders";
import { totalWaitingStatement } from "../../db/strava-work";
import {
	readCloudflareFigures,
	usageHistoryStatement,
	usageRecords,
} from "../../db/usage";
import type { I18n } from "../../i18n/i18n";
import {
	CLOUDFLARE_ALLOWANCES,
	CLOUDFLARE_LIMITS,
	historyStart,
	isRecordedAllowance,
	utcDay,
} from "../../usage/allowances";
import {
	connectedFigure,
	drainEstimateSeconds,
	type Figure,
	makeFigure,
	stravaFigures,
} from "../../usage/figures";
import { recordUsage } from "../../usage/record";
import { thresholdBars } from "../charts";
import { html, type SafeHtml } from "../html";
import { redirect } from "../redirect";
import {
	adminPage,
	adminSwitch,
	amount,
	moment,
	requireAdminPost,
	whole,
} from "./access";
import { type DailyHistory, dailyHistory } from "./history";

// Usage at `/admin` (feature 025 US1, US2, FR-005 to FR-015, FR-020, FR-027,
// FR-039): each allowance's current figure above its history, all at once. The
// page only reads D1: never Strava or Cloudflare, so neither can slow it down or
// fail it, and viewing costs no request.

/** The mark holds text, so it doesn't rely on colour alone (FR-009). */
function mark(i18n: I18n, figure: Figure): SafeHtml | null {
	return figure.level === "ok"
		? null
		: html`<span class="usage-mark usage-mark-${figure.level}">${i18n.t(`admin.level.${figure.level}`)}</span>`;
}

function figureItem(
	i18n: I18n,
	figure: Figure,
	history: DailyHistory,
): SafeHtml {
	const numbers = i18n.t("admin.figure.numbers", {
		used: amount(i18n, figure.id, figure.used),
		limit: amount(i18n, figure.id, figure.limit),
		percent: whole(i18n, figure.percent),
	});
	const split =
		figure.team === null
			? null
			: html`<p class="usage-detail">${i18n.t("admin.figure.split", {
					team: whole(i18n, figure.team),
					rest: whole(i18n, figure.notAttributed ?? 0),
				})}</p>`;
	const seen =
		figure.observedAt === null
			? i18n.t("admin.figure.notSeen")
			: i18n.t("admin.figure.seen", {
					time: moment(i18n, figure.observedAt),
				});
	return html`<li class="usage-figure usage-${figure.level}" id="${figure.id}">
<p class="usage-head"><span class="usage-name">${i18n.t(`admin.allowance.${figure.id}`)}</span>${mark(i18n, figure)}</p>
<p class="usage-numbers">${numbers}</p>
${thresholdBars(figure.used, figure.limit, null)}${split}<p class="usage-detail">${seen}</p>
${isRecordedAllowance(figure.id) ? history(figure.id) : null}</li>
`;
}

/** How many figures need a look, so nobody has to read them all (SC-001). */
function summary(i18n: I18n, figures: readonly Figure[]): SafeHtml {
	const marked = figures.filter((f) => f.level !== "ok").length;
	return marked === 0
		? html`<p class="notice" role="status">${i18n.t("admin.summary.ok")}</p>
`
		: html`<p class="notice notice-error" role="status">${i18n.t("admin.summary.attention", { n: whole(i18n, marked) })}</p>
`;
}

/** "About" a duration in the largest unit that reads well (R11). */
function aboutDuration(i18n: I18n, seconds: number): string {
	const minutes = Math.max(1, Math.ceil(seconds / 60));
	if (minutes < 90) {
		return i18n.t("admin.waiting.minutes", { n: minutes });
	}
	const hours = Math.ceil(minutes / 60);
	if (hours < 48) return i18n.t("admin.waiting.hours", { n: hours });
	return i18n.t("admin.waiting.days", { n: Math.ceil(hours / 24) });
}

function alertsSwitch(i18n: I18n, rider: Rider): SafeHtml {
	const on = rider.adminAlerts;
	return html`<section class="settings-group">
<h2>${i18n.t("admin.alerts.heading")}</h2>
<p>${i18n.t(on ? "admin.alerts.on" : "admin.alerts.off")}</p>
<form method="post" action="/admin/alerts"><input type="hidden" name="admin_alerts" value="${on ? "off" : "on"}"><button class="button-outlined">${i18n.t(on ? "admin.alerts.turnOff" : "admin.alerts.turnOn")}</button></form>
</section>
`;
}

export function handleAdminUsage(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return adminPage(request, ctx, i18n, "/admin", async ({ rider }) => {
		const db = ctx.env.DB;
		const now = ctx.now();
		const [usage, cloudflare, counts, devices] = await Promise.all([
			readStravaUsage(db),
			readCloudflareFigures(db),
			db.batch([
				connectedCountStatement(db),
				totalWaitingStatement(db),
				usageHistoryStatement(db, historyStart(utcDay(now))),
			]),
			subscriptionIdsOfRiders(db, [rider.athleteId]),
		]);
		const count = (i: number) =>
			(counts[i]?.results[0] as { n: number } | undefined)?.n ?? 0;
		// The ones with a history first, so the graphs line up.
		const windows = stravaFigures(usage, now);
		const strava = [
			...windows.filter((figure) => isRecordedAllowance(figure.id)),
			connectedFigure(count(0), now),
			...windows.filter((figure) => !isRecordedAllowance(figure.id)),
		];
		// Each keeps the limit it was recorded with, and its own time (FR-011).
		const account = CLOUDFLARE_ALLOWANCES.flatMap((id) => {
			const record = cloudflare.latest.get(id);
			return record
				? [makeFigure(id, record.used, record.limit, null, record.recordedAt)]
				: [];
		});
		const missing = CLOUDFLARE_ALLOWANCES.filter(
			(id) => !cloudflare.latest.has(id),
		);
		const waiting = count(1);
		const estimate = drainEstimateSeconds(waiting, usage, now);
		const records = usageRecords(counts[2]?.results ?? []);
		const asked = new URL(request.url).searchParams.get("days") ?? "";
		const history = dailyHistory(
			i18n,
			records,
			utcDay(now),
			isRecordedAllowance(asked) ? asked : null,
		);
		const firstDay = records[0]?.day;
		const item = (figure: Figure) => figureItem(i18n, figure, history);
		return html`${adminSwitch(i18n, "usage")}${summary(i18n, [...strava, ...account])}${
			devices.length === 0
				? html`<p class="notice">${i18n.tHtml("admin.alerts.noDevice", {
						settings: html`<a href="/me/settings">${i18n.t("nav.settings")}</a>`,
					})}</p>
`
				: null
		}<p class="usage-detail">${
			firstDay === undefined
				? i18n.t("admin.history.none")
				: i18n.t("admin.history.since", {
						date: i18n.formatDate(`${firstDay}T00:00:00Z`),
					})
		}</p>
<section class="card usage-source">
<h2>${i18n.t("admin.strava.heading")}</h2>
<ul class="usage-figures">
${strava.map(item)}</ul>
</section>
${
	estimate === null
		? null
		: html`<section class="card">
<h2>${i18n.t("admin.waiting.heading")}</h2>
<p>${i18n.t("admin.waiting.body", { n: waiting, time: aboutDuration(i18n, estimate) })}</p>
</section>
`
}<section class="card usage-source">
<h2>${i18n.t("admin.cloudflare.heading")}</h2>
<p class="usage-detail">${i18n.t("admin.cloudflare.note")}</p>
<form method="post" action="/admin/refresh"><button class="button-outlined">${i18n.t("admin.refresh")}</button></form>
${cloudflare.available ? null : html`<p class="notice notice-error" role="alert">${i18n.t("admin.cloudflare.unavailable")}</p>`}
<ul class="usage-figures">
${account.map(item)}${missing.map(
	(id) =>
		html`<li class="usage-figure"><p class="usage-head"><span class="usage-name">${i18n.t(`admin.allowance.${id}`)}</span></p><p class="usage-detail">${i18n.t("admin.figure.noValue", { limit: amount(i18n, id, CLOUDFLARE_LIMITS[id]) })}</p></li>
`,
)}</ul>
</section>
${alertsSwitch(i18n, rider)}`;
	});
}

/** `POST /admin/refresh`: the hourly recording, right now (FR-040). */
export async function handleAdminRefresh(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const rider = await requireAdminPost(request, ctx, i18n, "/admin/refresh");
	if (rider instanceof Response) return rider;
	await recordUsage(ctx);
	return redirect("/admin", 303);
}

/** `POST /admin/alerts`: only the viewer's own switch (FR-039). */
export async function handleAdminAlerts(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const rider = await requireAdminPost(request, ctx, i18n, "/admin/alerts");
	if (rider instanceof Response) return rider;
	const value = (await request.formData().catch(() => null))?.get(
		"admin_alerts",
	);
	if (value === "on" || value === "off") {
		await setAdminAlerts(ctx.env.DB, rider.athleteId, value === "on");
	}
	return redirect("/admin", 303);
}
