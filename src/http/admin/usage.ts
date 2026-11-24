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
import { readRoutingCounts } from "../../db/routing";
import { readCalls } from "../../db/strava-calls";
import { totalWaitingStatement } from "../../db/strava-work";
import {
	readCloudflareFigures,
	readCpuDays,
	readSourceStates,
	type SourceState,
	type TeamCountRecord,
	teamCountRecords,
	teamCountsStatement,
	usageHistoryStatement,
	usageRecords,
} from "../../db/usage";
import type { MessageId } from "../../i18n/catalogs";
import type { I18n } from "../../i18n/i18n";
import { firstRoutingDay } from "../../routing/figures";
import { exchangeRoutingCounts } from "../../routing/report";
import {
	isWarningDay,
	type RoutingDay,
	routingDays,
} from "../../routing/warning";
import {
	type CallBreakdown,
	type CallDayRow,
	callBreakdown,
	callDayRows,
	firstCallDay,
	ownCallDays,
	type PeerCallDay,
	type StravaEndpoint,
} from "../../strava/calls";
import {
	CLOUDFLARE_ALLOWANCES,
	CLOUDFLARE_LIMITS,
	daysBefore,
	historyStart,
	isRecordedAllowance,
	utcDay,
} from "../../usage/allowances";
import {
	CPU_LIMIT_MS,
	type CpuDay,
	type CpuLevel,
	cpuLevel,
	notifiesThisTeam,
} from "../../usage/cpu";
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
 * A figure split by owner: this team, each other team (null: none came), the
 * gateway for Cloudflare's, and what no team counts. Null where a part doesn't
 * apply: everything while the figure isn't split, other teams' 15-minute
 * counts (not exchanged), the gateway outside Cloudflare, the rest of riders.
 */
interface Breakdown {
	own: number | null;
	peers: (number | null)[];
	shared: number | null;
	rest: number | null;
}

const isWindow = (id: Figure["id"]) =>
	id === "strava_read_15m" || id === "strava_all_15m";

function breakdownOf(figure: Figure, teams: Teams): Breakdown {
	const none = teams.peers.map(() => null);
	if (figure.team === null) {
		return { own: null, peers: none, shared: null, rest: null };
	}
	const own = figure.team;
	if (isWindow(figure.id)) {
		return { own, peers: none, shared: null, rest: figure.notAttributed ?? 0 };
	}
	const peers = teams.peers.map((peer) => teams.today(peer.id, figure.id));
	// Cloudflare's figures also have the gateway's part, which serves everyone.
	const shared = figure.id.startsWith("cf_")
		? (teams.today(SHARED, figure.id) ?? 0)
		: null;
	const counted = [...peers, shared].reduce<number>(
		(sum, n) => sum + (n ?? 0),
		own,
	);
	return {
		own,
		peers,
		shared,
		rest:
			figure.id === "riders_connected"
				? null
				: Math.max(0, figure.used - counted),
	};
}

/**
 * Each team's count and share of the figure, then what no team counts. Other
 * teams' 15-minute counts aren't exchanged, so those figures say so.
 */
function teamsLine(i18n: I18n, figure: Figure, teams: Teams): SafeHtml {
	const parts = breakdownOf(figure, teams);
	if (isWindow(figure.id)) {
		return html`<p class="usage-detail">${i18n.t("admin.figure.split", {
			team: whole(i18n, parts.own ?? 0),
			rest: whole(i18n, parts.rest ?? 0),
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
	const pieces = [
		piece(teams.own, parts.own ?? 0),
		...teams.peers.map((peer, i) => piece(peer.name, parts.peers[i] ?? null)),
		...(parts.shared === null ? [] : [piece(teams.shared, parts.shared)]),
		...(parts.rest === null
			? []
			: [i18n.t("admin.figure.rest", { n: whole(i18n, parts.rest) })]),
	];
	return html`<p class="usage-detail">${pieces.join(" · ")}</p>`;
}

/**
 * Every figure in one table: each team's part, the gateway's, what no team
 * counts, and the overall use of the allowance. Each row links to its figure.
 */
function overviewSection(
	i18n: I18n,
	figures: readonly Figure[],
	teams: Teams,
): SafeHtml {
	const rows = figures.map((figure) => ({
		figure,
		parts: breakdownOf(figure, teams),
	}));
	const hasShared = rows.some((row) => row.parts.shared !== null);
	const head = (label: string) => html`<th scope="col">${label}</th>`;
	const cell = (id: Figure["id"], n: number | null) =>
		html`<td>${n === null ? "" : amount(i18n, id, n)}</td>`;
	return html`<section class="card usage-source" id="overview">
<h2>${i18n.t("admin.overview.heading")}</h2>
<p class="usage-detail">${i18n.t("admin.overview.note")}</p>
<div class="usage-table"><div class="progress-table progress-table-scroll"><table>
<thead><tr>${head(i18n.t("admin.overview.figure"))}${head(teams.own)}${teams.peers.map((peer) => head(peer.name))}${hasShared ? head(teams.shared) : null}${head(i18n.t("admin.overview.rest"))}${head(i18n.t("admin.overview.total"))}</tr></thead>
<tbody>
${rows.map(
	({ figure, parts }) =>
		html`<tr><th scope="row"><a href="#${figure.id}">${i18n.t(`admin.allowance.${figure.id}`)}</a>${figure.level === "ok" ? null : html` ${mark(i18n, figure)}`}</th>${cell(figure.id, parts.own)}${parts.peers.map((n) => cell(figure.id, n))}${hasShared ? cell(figure.id, parts.shared) : null}${cell(figure.id, parts.rest)}<td>${i18n.t(
			"admin.figure.numbers",
			{
				used: amount(i18n, figure.id, figure.used),
				limit: amount(i18n, figure.id, figure.limit),
				percent: whole(i18n, figure.percent),
			},
		)}</td></tr>
`,
)}</tbody>
</table></div></div>
</section>
`;
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

/** Each endpoint's name in the breakdown. */
const ENDPOINT_NAMES: Record<StravaEndpoint, MessageId> = {
	"GET /athlete/clubs": "admin.calls.endpoint.clubs",
	"GET /activities/{id}": "admin.calls.endpoint.activity",
	"GET /athlete/activities": "admin.calls.endpoint.activities",
	"POST /oauth/token": "admin.calls.endpoint.token",
	"POST /oauth/revoke": "admin.calls.endpoint.revoke",
};

/**
 * This team's Strava calls (feature 047 contracts/usage-view.md): per UTC day
 * the calls, the other teams' together, all teams', Strava's count and the
 * calls held back, a day that doesn't add up marked; each day linked to its
 * breakdown below, `picked`'s, by action and endpoint. Counts only: no rider
 * and no other team is named.
 */
function callsSection(
	i18n: I18n,
	days: readonly CallDayRow[],
	/** How many other teams there are; without any, their columns are left out. */
	peers: number,
	picked: string,
	breakdown: CallBreakdown,
): SafeHtml {
	const date = (day: string) => i18n.formatDate(`${day}T00:00:00Z`);
	const head = (label: string) => html`<th scope="col">${label}</th>`;
	const cell = (n: number | null) =>
		html`<td>${n === null ? null : whole(i18n, n)}</td>`;
	const teams = (d: CallDayRow) =>
		peers === 0
			? null
			: html`<td>${d.others === "missing" ? i18n.t("admin.calls.missing") : d.others === null ? null : whole(i18n, d.others)}</td>${cell(d.all)}`;
	const row = (d: CallDayRow) =>
		html`<tr><th scope="row"><a href="?calls=${d.day}#strava-calls"${d.day === picked ? html` aria-current="date"` : null}>${date(d.day)}</a>${d.marked ? html` <span class="usage-mark usage-mark-warning">${i18n.t("admin.level.warning")}</span>` : null}</th><td>${whole(i18n, d.calls)}</td>${teams(d)}${cell(d.strava)}<td>${whole(i18n, d.heldBack)}</td></tr>
`;
	const parts =
		breakdown.rows.length === 0
			? html`<p class="usage-detail">${i18n.t("admin.calls.dayNone")}</p>`
			: html`<div class="usage-table"><div class="progress-table progress-table-scroll"><table>
<thead><tr>${head(i18n.t("admin.calls.for"))}${breakdown.endpoints.map((e) => head(i18n.t(ENDPOINT_NAMES[e])))}${head(i18n.t("admin.calls.heldBack"))}${head(i18n.t("admin.calls.total"))}</tr></thead>
<tbody>
${breakdown.rows.map(
	(r) =>
		html`<tr><th scope="row">${i18n.t(`admin.calls.action.${r.action}`)}</th>${r.calls.map((n) => html`<td>${whole(i18n, n)}</td>`)}<td>${whole(i18n, r.heldBack)}</td><td>${whole(i18n, r.total)}</td></tr>
`,
)}</tbody>
</table></div></div>`;
	return html`<section class="card usage-source" id="strava-calls">
<h2>${i18n.t("admin.calls.heading")}</h2>
<p class="usage-detail">${i18n.t("admin.calls.intro")}</p>
${
	days.length === 0
		? html`<p class="usage-detail">${i18n.t("admin.calls.none")}</p>`
		: html`<div class="usage-table"><div class="progress-table progress-table-scroll"><table>
<thead><tr>${head(i18n.t("admin.history.day"))}${head(i18n.t("admin.history.team"))}${
				peers === 0
					? null
					: html`${head(i18n.t(peers === 1 ? "admin.teams.other" : "admin.routing.others"))}${head(i18n.t("admin.calls.all"))}`
			}${head(i18n.t("admin.calls.strava"))}${head(i18n.t("admin.calls.heldBack"))}</tr></thead>
<tbody>
${days.map(row)}</tbody>
</table></div></div>
<h3>${i18n.t("admin.calls.day", { date: date(picked) })}</h3>
${parts}`
}</section>
`;
}

/** The days the CPU table shows, today included (FR-042). */
const CPU_DAYS = 30;

/** Per day: this team, the other teams together, the gateway. */
interface CpuRow {
	day: string;
	own: CpuDay | null;
	others: CpuDay | null;
	shared: CpuDay | null;
}

/** The days' records by owner, other teams added up, newest first. */
function cpuRows(days: readonly CpuDay[], self: string): CpuRow[] {
	const rows = new Map<string, CpuRow>();
	for (const record of days) {
		let row = rows.get(record.day);
		if (!row) {
			row = { day: record.day, own: null, others: null, shared: null };
			rows.set(record.day, row);
		}
		if (record.owner === self) row.own = record;
		else if (record.owner === SHARED) row.shared = record;
		else if (row.others === null) row.others = { ...record };
		else {
			row.others.runs += record.runs;
			row.others.cutOff += record.cutOff;
			row.others.p99Us = Math.max(row.others.p99Us, record.p99Us);
		}
	}
	return [...rows.values()].sort((a, b) => b.day.localeCompare(a.day));
}

function levelMark(i18n: I18n, level: CpuLevel): SafeHtml | null {
	return level === "ok"
		? null
		: html` <span class="usage-mark usage-mark-${level}">${i18n.t(`admin.level.${level}`)}</span>`;
}

/**
 * The Workers' CPU time (feature 025 User Story 6): per day and owner, the
 * slowest 1 in 100 runs' CPU time beside the limit, and the runs cut off out of
 * all runs, marked by FR-043. No other team is named (feature 026 FR-023).
 */
function cpuSection(
	i18n: I18n,
	rows: readonly CpuRow[],
	available: boolean,
): SafeHtml {
	const ms = (us: number) =>
		i18n.t("admin.cpu.ms", {
			n: i18n.formatNumber(us / 1000, { fractionDigits: 1 }),
		});
	const cell = (record: CpuDay | null) =>
		record === null
			? html`<td>–</td>`
			: html`<td>${i18n.t("admin.cpu.cell", {
					slowest: ms(record.p99Us),
					cut: whole(i18n, record.cutOff),
					runs: whole(i18n, record.runs),
				})}${levelMark(i18n, cpuLevel(record.runs, record.cutOff))}</td>`;
	return html`<section class="card usage-source" id="cpu">
<h2>${i18n.t("admin.cpu.heading")}</h2>
<p class="usage-detail">${i18n.t("admin.cpu.intro", { limit: i18n.t("admin.cpu.ms", { n: whole(i18n, CPU_LIMIT_MS) }) })}</p>
${available ? null : html`<p class="notice notice-error" role="alert">${i18n.t("admin.cpu.unavailable")}</p>`}${
	rows.length === 0
		? html`<p class="usage-detail">${i18n.t("admin.cpu.none")}</p>`
		: html`<div class="usage-table"><div class="progress-table progress-table-scroll"><table>
<thead><tr><th scope="col">${i18n.t("admin.history.day")}</th><th scope="col">${i18n.t("admin.history.team")}</th><th scope="col">${i18n.t("admin.teams.other")}</th><th scope="col">${i18n.t("admin.teams.shared")}</th></tr></thead>
<tbody>
${rows.map(
	(
		row,
	) => html`<tr><th scope="row">${i18n.formatDate(`${row.day}T00:00:00Z`)}</th>${cell(row.own)}${cell(row.others)}${cell(row.shared)}</tr>
`,
)}</tbody>
</table></div></div>`
}</section>
`;
}

/** The team figures of the routing table, each with this team's and the others' value. */
const ROUTING_COLUMNS: [MessageId, (side: RoutingDay["own"]) => number][] = [
	["admin.routing.missed", (side) => side.missed],
	["admin.routing.wasted", (side) => side.wasted],
	["admin.routing.dropped", (side) => side.dropped],
	["admin.routing.corrections", (side) => side.added + side.removed],
	["admin.routing.possible", (side) => side.possible],
	["admin.routing.found", (side) => side.found],
];

/**
 * Gateway routing's last 30 days (feature 046 contracts/usage-view.md): what
 * the gateway sent by the copy and to every team, then each figure for this
 * team and, summed, the other teams. A day with a would-be or possible miss, or
 * too many events to every team, carries the re-check table's warning mark.
 */
function routingSection(i18n: I18n, days: readonly RoutingDay[]): SafeHtml {
	const others = days.some((d) => d.hasOthers);
	const span = others ? html` colspan="2"` : null;
	const tall = others ? html` rowspan="2"` : null;
	const row = (d: RoutingDay) =>
		html`<tr><th scope="row">${i18n.formatDate(`${d.day}T00:00:00Z`)}${isWarningDay(d) ? html` <span class="usage-mark usage-mark-warning">${i18n.t("admin.level.warning")}</span>` : null}</th><td>${whole(i18n, d.copy)}</td><td>${whole(i18n, d.everyone)}</td>${ROUTING_COLUMNS.map(
			([, value]) =>
				html`<td>${whole(i18n, value(d.own))}</td>${others ? html`<td>${whole(i18n, value(d.others))}</td>` : null}`,
		)}</tr>
`;
	const sides = others
		? html`<tr>${ROUTING_COLUMNS.map(
				() =>
					html`<th scope="col">${i18n.t("admin.history.team")}</th><th scope="col">${i18n.t("admin.routing.others")}</th>`,
			)}</tr>
`
		: null;
	return html`<section class="card usage-source" id="routing">
<h2>${i18n.t("admin.routing.heading")}</h2>
<p class="usage-detail">${i18n.t("admin.routing.note")}</p>
${
	days.length === 0
		? html`<p class="usage-detail">${i18n.t("admin.routing.none")}</p>`
		: html`<div class="usage-table"><div class="progress-table progress-table-scroll"><table>
<thead><tr><th scope="col"${tall}>${i18n.t("admin.history.day")}</th><th scope="col"${tall}>${i18n.t("admin.routing.copy")}</th><th scope="col"${tall}>${i18n.t("admin.routing.everyone")}</th>${ROUTING_COLUMNS.map(
				([label]) => html`<th scope="colgroup"${span}>${i18n.t(label)}</th>`,
			)}</tr>
${sides}</thead>
<tbody>
${days.map(row)}</tbody>
</table></div></div>`
}</section>
`;
}

/**
 * How many figures need a look, so nobody has to read them all (SC-001), and
 * today's CPU marks of this team's Worker and the gateway (FR-044), and how
 * many days of gateway routing (feature 046 FR-025) and of Strava calls
 * (feature 047 FR-011) carry a warning.
 */
function summary(
	i18n: I18n,
	figures: readonly Figure[],
	cpuMarked: number,
	routingWarnings: number,
	callWarnings: number,
): SafeHtml {
	const marked = figures.filter((f) => f.level !== "ok").length + cpuMarked;
	const days = (key: MessageId, n: number) =>
		n === 0
			? null
			: html`<p class="notice notice-error" role="status">${i18n.t(key, { n: whole(i18n, n) })}</p>
`;
	const warnings = html`${days("admin.summary.routing", routingWarnings)}${days("admin.summary.calls", callWarnings)}`;
	return marked === 0
		? html`<p class="notice" role="status">${i18n.t("admin.summary.ok")}</p>
${warnings}`
		: html`<p class="notice notice-error" role="status">${i18n.t("admin.summary.attention", { n: whole(i18n, marked) })}</p>
${warnings}`;
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

/** Each other team's Strava call totals per day, as the exchange brought them. */
function peerCallDays(
	peers: readonly Peer[],
	records: readonly TeamCountRecord[],
): PeerCallDay[][] {
	return peers.map((peer) => {
		const theirs = records.filter((r) => r.team === peer.id);
		const seen = new Map(
			theirs
				.filter((r) => r.allowance === "strava_seen")
				.map((r) => [r.day, r.used]),
		);
		return theirs
			.filter((r) => r.allowance === "strava_calls")
			.map((r) => ({ day: r.day, calls: r.used, seen: seen.get(r.day) ?? 0 }));
	});
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
		const [
			usage,
			cloudflare,
			counts,
			devices,
			states,
			recheckDays,
			active,
			cpuDays,
			routingCounts,
			calls,
		] = await Promise.all([
			readStravaUsage(db),
			readCloudflareFigures(db),
			db.batch([
				connectedCountStatement(db),
				totalWaitingStatement(db),
				usageHistoryStatement(db, historyStart(today)),
				teamCountsStatement(db, historyStart(today)),
			]),
			subscriptionIdsOfRiders(db, [rider.athleteId]),
			readSourceStates(db),
			readRecheckDays(db),
			countActiveRiders(db, now),
			readCpuDays(db, daysBefore(today, CPU_DAYS - 1)),
			readRoutingCounts(db, firstRoutingDay(today)),
			readCalls(db, firstCallDay(today)),
		]);
		const routing = routingDays(routingCounts, ctx.team.id);
		const cpu = cpuRows(cpuDays, ctx.team.id);
		const cpuMarked = cpuDays.filter(
			(d) =>
				d.day === today &&
				notifiesThisTeam(d.owner, ctx.team.id) &&
				cpuLevel(d.runs, d.cutOff) !== "ok",
		).length;
		const cpuState = states.get("cloudflare-cpu");
		const cpuAvailable =
			cpuState?.lastFailureAt == null ||
			(cpuState.lastSuccessAt ?? 0) > cpuState.lastFailureAt;
		const count = (i: number) =>
			(counts[i]?.results[0] as { n: number } | undefined)?.n ?? 0;
		const teamRecords = teamCountRecords(counts[3]?.results ?? []);
		const callDays = callDayRows(
			today,
			ownCallDays(calls.counts, calls.seen),
			peerCallDays(peers, teamRecords),
		);
		// The day `?calls=` picks if it is one shown, else today.
		const askedDay = new URL(request.url).searchParams.get("calls");
		const picked = callDays.find((d) => d.day === askedDay)?.day ?? today;
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
		return html`${adminSwitch(i18n, "usage")}${summary(i18n, [...strava, ...account], cpuMarked, routing.filter(isWarningDay).length, callDays.filter((d) => d.marked).length)}${teamNotices(i18n, teams.peers, states)}${overviewSection(i18n, [...strava, ...account], teams)}${
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
${recheckSection(i18n, ctx.team.recheckAllowance, active, recheckDays)}${callsSection(i18n, callDays, peers.length, picked, callBreakdown(calls.counts, picked))}${routingSection(i18n, routing)}${
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
${cpuSection(i18n, cpu, cpuAvailable)}${alertsSwitch(i18n, rider)}`;
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
	// Gateway routing's figures come with it (feature 046 research R9).
	try {
		await exchangeRoutingCounts(ctx);
	} catch (err) {
		console.error(
			`Routing counts failed: ${err instanceof Error ? err.name : "unknown error"}`,
		);
	}
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
