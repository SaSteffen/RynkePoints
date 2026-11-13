import type { Ctx } from "../../ctx";
import { subscriptionIdsOfRiders } from "../../db/push-subscriptions";
import { readStravaUsage } from "../../db/rate-limit";
import {
	countActiveRiders,
	type RecheckDay,
	readRecheckDays,
} from "../../db/recheck";
import {
	connectedCountStatement,
	type Rider,
	setAdminAlerts,
} from "../../db/riders";
import { totalWaitingStatement } from "../../db/strava-work";
import {
	readCloudflareFigures,
	readSourceStates,
	type SourceState,
	type TeamCountRecord,
	teamCountRecords,
	teamCountsStatement,
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
	percentOf,
	stravaFigures,
} from "../../usage/figures";
import { type Peer, usagePeers } from "../../usage/peers";
import { recordUsage } from "../../usage/record";
import { SHARED } from "../../usage/split";
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
import { type DailyHistory, dailyHistory, type HistoryTeams } from "./history";

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

/** The other teams' counts beside this team's (feature 026 FR-039, FR-040). */
interface Teams {
	own: string;
	/** The label of what the gateway uses for every team. */
	shared: string;
	peers: readonly { id: string; name: string }[];
	/**
	 * A team's (or `SHARED`'s) count of an allowance on the figure's day, or
	 * null when none came: today, or a Cloudflare figure's latest recorded day.
	 */
	today: (team: string, id: Figure["id"]) => number | null;
}

/**
 * Each team's count and share of the figure, then what no team counts. Other
 * teams' 15-minute counts aren't exchanged, so those figures say so.
 */
function teamsLine(i18n: I18n, figure: Figure, teams: Teams): SafeHtml {
	const own = figure.team ?? 0;
	if (figure.id === "strava_read_15m" || figure.id === "strava_all_15m") {
		return html`<p class="usage-detail">${i18n.t("admin.figure.split", {
			team: whole(i18n, own),
			rest: whole(i18n, figure.notAttributed ?? 0),
		})}</p><p class="usage-detail">${i18n.t("admin.figure.windowNote")}</p>`;
	}
	const piece = (team: string, n: number | null) =>
		n === null
			? i18n.t("admin.figure.teamNone", { team })
			: i18n.t("admin.figure.teamCount", {
					team,
					n: whole(i18n, n),
					percent: whole(i18n, percentOf(n, figure.used)),
				});
	const counts = teams.peers.map((peer) => teams.today(peer.id, figure.id));
	const pieces = [
		piece(teams.own, own),
		...teams.peers.map((peer, i) => piece(peer.name, counts[i] ?? null)),
	];
	// Cloudflare's figures also have the gateway's part, which serves everyone.
	if (figure.id.startsWith("cf_")) {
		const shared = teams.today(SHARED, figure.id) ?? 0;
		counts.push(shared);
		pieces.push(piece(teams.shared, shared));
	}
	if (figure.id !== "riders_connected") {
		const counted = counts.reduce<number>((sum, n) => sum + (n ?? 0), own);
		pieces.push(
			i18n.t("admin.figure.rest", {
				n: whole(i18n, Math.max(0, figure.used - counted)),
			}),
		);
	}
	return html`<p class="usage-detail">${pieces.join(" · ")}</p>`;
}

/** Teams that didn't answer at the last recording, or never did. */
function teamNotices(
	i18n: I18n,
	peers: Teams["peers"],
	states: ReadonlyMap<string, SourceState>,
): SafeHtml[] {
	return peers.flatMap((peer) => {
		const state = states.get(`team:${peer.id}`);
		const team = peer.name;
		const success = state?.lastSuccessAt ?? null;
		const failure = state?.lastFailureAt ?? null;
		if (success === null) {
			return [
				html`<p class="notice notice-error" role="status">${i18n.t("admin.teams.never", { team })}</p>
`,
			];
		}
		if (failure !== null && failure > success) {
			return [
				html`<p class="notice notice-error" role="status">${i18n.t("admin.teams.stale", { team, time: moment(i18n, success) })}</p>
`,
			];
		}
		return [];
	});
}

function figureItem(
	i18n: I18n,
	figure: Figure,
	history: DailyHistory,
	teams: Teams,
): SafeHtml {
	const numbers = i18n.t("admin.figure.numbers", {
		used: amount(i18n, figure.id, figure.used),
		limit: amount(i18n, figure.id, figure.limit),
		percent: whole(i18n, figure.percent),
	});
	const cloudflare = figure.id.startsWith("cf_");
	const split =
		figure.team === null
			? cloudflare
				? html`<p class="usage-detail">${i18n.t("admin.figure.notSplit")}</p>`
				: null
			: teams.peers.length > 0 || cloudflare
				? teamsLine(i18n, figure, teams)
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

/**
 * The ride edit re-check's last days (feature 036 contracts/usage-view.md): the
 * team's allowance and active riders, then a table of counts. No rider is named.
 * A day with riders waiting over 24 hours or a list in the wrong order is marked
 * in words, like a warning figure.
 */
function recheckSection(
	i18n: I18n,
	allowance: number,
	activeRiders: number,
	days: readonly RecheckDay[],
): SafeHtml {
	const row = (d: RecheckDay) => {
		const warn = d.over24h > 0 || d.unordered > 0;
		const stoodBack = [
			whole(i18n, d.skipped),
			...(d.runsHeld > 0
				? [i18n.t("admin.recheck.runsHeld", { n: d.runsHeld })]
				: []),
		].join(" · ");
		const failed = [
			whole(i18n, d.failed),
			...(d.unordered > 0 ? [i18n.t("admin.recheck.listOrder")] : []),
		].join(" · ");
		return html`<tr><th scope="row">${i18n.formatDate(`${d.day}T00:00:00Z`)}${warn ? html` <span class="usage-mark usage-mark-warning">${i18n.t("admin.level.warning")}</span>` : null}</th><td>${whole(i18n, d.sent - d.skipped - d.failed)}</td><td>${stoodBack}</td><td>${failed}</td><td>${whole(i18n, d.over24h)}</td></tr>
`;
	};
	return html`<section class="card usage-source" id="recheck">
<h2>${i18n.t("admin.recheck.heading")}</h2>
<p class="usage-detail">${i18n.t("admin.recheck.allowance", { allowance: whole(i18n, allowance), riders: whole(i18n, activeRiders) })}</p>
${
	days.length === 0
		? html`<p class="usage-detail">${i18n.t("admin.recheck.none")}</p>`
		: html`<div class="usage-table"><div class="progress-table progress-table-scroll"><table>
<thead><tr><th scope="col">${i18n.t("admin.history.day")}</th><th scope="col">${i18n.t("admin.recheck.made")}</th><th scope="col">${i18n.t("admin.recheck.skipped")}</th><th scope="col">${i18n.t("admin.recheck.failed")}</th><th scope="col">${i18n.t("admin.recheck.over24h")}</th></tr></thead>
<tbody>
${days.map(row)}</tbody>
</table></div></div>`
}</section>
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

/**
 * The other teams' stored counts, as the view and the history ask for them. No
 * page names another team (FR-023), so they are "Other team", numbered when
 * there are several, in the order of `USAGE_PEERS`.
 */
function teamsOf(
	i18n: I18n,
	peers: readonly Peer[],
	records: readonly TeamCountRecord[],
	today: string,
	/** The latest recorded day of each Cloudflare figure. */
	cloudflareDays: ReadonlyMap<string, string>,
): Teams & {
	latestConnected: (team: string) => number | null;
	history: HistoryTeams;
} {
	const byKey = new Map(
		records.map((r) => [`${r.team}|${r.allowance}|${r.day}`, r.used]),
	);
	const count = (team: string, id: string, day: string) =>
		byKey.get(`${team}|${id}|${day}`) ?? null;
	const own = i18n.t("admin.history.team");
	const shared = i18n.t("admin.teams.shared");
	const named = peers.map((peer, i) => ({
		id: peer.id,
		name:
			peers.length === 1
				? i18n.t("admin.teams.other")
				: i18n.t("admin.teams.otherN", { n: i + 1 }),
	}));
	return {
		own,
		shared,
		peers: named,
		today: (team, id) => count(team, id, cloudflareDays.get(id) ?? today),
		latestConnected: (team) => {
			let latest: TeamCountRecord | undefined;
			for (const r of records) {
				if (r.team === team && r.allowance === "riders_connected") latest = r;
			}
			return latest?.used ?? null;
		},
		history: { own, shared, peers: named, count },
	};
}

export function handleAdminUsage(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return adminPage(request, ctx, i18n, "/admin", async ({ rider }) => {
		const db = ctx.env.DB;
		const now = ctx.now();
		const today = utcDay(now);
		const peers = usagePeers(ctx.env);
		const [usage, cloudflare, counts, devices, states, recheckDays, active] =
			await Promise.all([
				readStravaUsage(db),
				readCloudflareFigures(db),
				db.batch([
					connectedCountStatement(db),
					totalWaitingStatement(db),
					usageHistoryStatement(db, historyStart(today)),
					teamCountsStatement(db, historyStart(today)),
				]),
				subscriptionIdsOfRiders(db, [rider.athleteId]),
				peers.length > 0 ? readSourceStates(db) : new Map(),
				readRecheckDays(db),
				countActiveRiders(db, now),
			]);
		const count = (i: number) =>
			(counts[i]?.results[0] as { n: number } | undefined)?.n ?? 0;
		const teamRecords = teamCountRecords(counts[3]?.results ?? []);
		const teams = teamsOf(
			i18n,
			peers,
			teamRecords,
			today,
			new Map([...cloudflare.latest].map(([id, record]) => [id, record.day])),
		);
		// Other teams' riders count against the same capacity (FR-039).
		const otherRiders = peers.reduce(
			(sum, peer) => sum + (teams.latestConnected(peer.id) ?? 0),
			0,
		);
		// The ones with a history first, so the graphs line up.
		const windows = stravaFigures(usage, now);
		const strava = [
			...windows.filter((figure) => isRecordedAllowance(figure.id)),
			connectedFigure(count(0) + otherRiders, now, count(0)),
			...windows.filter((figure) => !isRecordedAllowance(figure.id)),
		];
		// Each keeps the limit it was recorded with, and its own time (FR-011).
		const account = CLOUDFLARE_ALLOWANCES.flatMap((id) => {
			const record = cloudflare.latest.get(id);
			return record
				? [
						makeFigure(
							id,
							record.used,
							record.limit,
							record.teamUsed,
							record.recordedAt,
						),
					]
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
			today,
			isRecordedAllowance(asked) ? asked : null,
			teams.history,
		);
		const firstDay = records[0]?.day;
		const item = (figure: Figure) => figureItem(i18n, figure, history, teams);
		return html`${adminSwitch(i18n, "usage")}${summary(i18n, [...strava, ...account])}${teamNotices(i18n, teams.peers, states)}${
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
${recheckSection(i18n, ctx.team.recheckAllowance, active, recheckDays)}${
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
