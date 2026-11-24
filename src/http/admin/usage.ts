import type { Ctx } from "../../ctx";
import { countActiveRiders, type RecheckDay } from "../../db/recheck";
import { type Rider, setAdminAlerts } from "../../db/riders";
import { readRoutingCounts } from "../../db/routing";
import { totalWaitingStatement } from "../../db/strava-work";
import {
	readCpuDays,
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
	type StravaEndpoint,
} from "../../strava/calls";
import {
	type AllowanceId,
	CLOUDFLARE_ALLOWANCES,
	CLOUDFLARE_LIMITS,
	type CloudflareAllowance,
	CRITICAL_LEVEL,
	daysBefore,
	earlyThreshold,
	historyStart,
	isRecordedAllowance,
	utcDay,
	WARNING_LEVEL,
} from "../../usage/allowances";
import {
	type AttentionItem,
	type AttentionLevel,
	isRecheckWarningDay,
	markCount,
} from "../../usage/attention";
import {
	CPU_LIMIT_MS,
	type CpuDay,
	type CpuLevel,
	type CpuRow,
	cpuLevel,
	cpuRows,
} from "../../usage/cpu";
import {
	drainEstimateSeconds,
	type Figure,
	percentOf,
} from "../../usage/figures";
import { type Peer, usagePeers } from "../../usage/peers";
import { recordUsage } from "../../usage/record";
import { SHARED } from "../../usage/split";
import { readUsageState } from "../../usage/state";
import { thresholdBars } from "../charts";
import { html, type SafeHtml } from "../html";
import {
	BELL_OFF,
	BOLT,
	CHECK_CIRCLE,
	CLOCK,
	CLOUD,
	CRITICAL,
	DATABASE,
	INFO,
	LIST,
	PEOPLE,
	WARNING,
} from "../icons";
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

// Usage at `/admin` (feature 025, laid out anew by feature 048): what needs a
// look across the top, then Strava's and Cloudflare's figures as rows that open
// to their details, beside the operations. The page only reads D1: never
// Strava or Cloudflare, so neither can slow it down or fail it, and viewing
// costs no request (feature 025 FR-027).

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
 * teams' 15-minute counts aren't exchanged, which the note under Strava says.
 */
function teamsLine(i18n: I18n, figure: Figure, teams: Teams): SafeHtml {
	const parts = breakdownOf(figure, teams);
	if (isWindow(figure.id)) {
		return html`<p class="usage-detail">${i18n.t("admin.figure.split", {
			team: whole(i18n, parts.own ?? 0),
			rest: whole(i18n, parts.rest ?? 0),
		})}</p>`;
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

/** Each figure's icon in its row (the usage redesign canvas). */
const FIGURE_ICONS: Record<AllowanceId, SafeHtml> = {
	strava_read_daily: BOLT,
	strava_all_daily: BOLT,
	strava_read_15m: CLOCK,
	strava_all_15m: CLOCK,
	riders_connected: PEOPLE,
	cf_worker_requests: CLOUD,
	cf_queue_operations: LIST,
	cf_d1_rows_read: DATABASE,
	cf_d1_rows_written: DATABASE,
	cf_d1_storage_bytes: DATABASE,
};

const LEVEL_ICONS: Record<AttentionLevel, SafeHtml> = {
	critical: CRITICAL,
	warning: WARNING,
	early: INFO,
	hint: INFO,
};

/**
 * Whose figure it is, in one short line (feature 048 FR-014): each team's
 * count of Strava's daily figures and the riders, never naming another team;
 * this team's only for the 15-minute ones; the whole account for Cloudflare's.
 */
function whose(i18n: I18n, figure: Figure, teams: Teams): string {
	if (isWindow(figure.id)) return i18n.t("admin.figure.whose.window");
	if (figure.id.startsWith("cf_")) return i18n.t("admin.figure.whose.account");
	const piece = (team: string, n: number | null) =>
		n === null
			? i18n.t("admin.figure.whose.none", { team })
			: i18n.t("admin.figure.whose.team", { team, n: whole(i18n, n) });
	return [
		piece(teams.own, figure.team ?? 0),
		...teams.peers.map((peer) =>
			piece(peer.name, teams.today(peer.id, figure.id)),
		),
	].join(" · ");
}

/** A 15-minute figure at 0 %, hidden on a phone (FR-016). */
const isQuiet = (figure: Figure) => isWindow(figure.id) && figure.percent === 0;

/**
 * A figure as a row that opens (feature 048 contracts/usage-view.md "Figure
 * rows"): name, mark, a bar marked at each level, the numbers, whose it is and
 * the percentage; opened, its levels, how it splits between the teams, its time
 * and its history, as the figure's card had them.
 */
function figureRow(
	i18n: I18n,
	figure: Figure,
	history: DailyHistory,
	teams: Teams,
	open: boolean,
): SafeHtml {
	const early = earlyThreshold(figure.id);
	const levels =
		early === null
			? i18n.t("admin.figure.levelsNoEarly", {
					warning: WARNING_LEVEL,
					critical: CRITICAL_LEVEL,
				})
			: i18n.t("admin.figure.levels", {
					early,
					warning: WARNING_LEVEL,
					critical: CRITICAL_LEVEL,
				});
	const ticks =
		early === null
			? [WARNING_LEVEL, CRITICAL_LEVEL]
			: [early, WARNING_LEVEL, CRITICAL_LEVEL];
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
	const numbers = i18n.t("admin.figure.of", {
		used: amount(i18n, figure.id, figure.used),
		limit: amount(i18n, figure.id, figure.limit),
	});
	const level = figure.level === "ok" ? null : html` lvl-${figure.level}`;
	return html`<li id="${figure.id}"${isQuiet(figure) ? html` class="is-quiet"` : null}><details${open ? html` open` : null}>
<summary class="settings-row meter usage-${figure.level}"><span class="settings-icon${level}">${FIGURE_ICONS[figure.id]}</span><span class="settings-text"><span class="settings-title">${i18n.t(`admin.allowance.${figure.id}`)}${mark(i18n, figure)}</span>${thresholdBars(figure.used, figure.limit, null, ticks)}<span class="settings-sub">${numbers} · ${whose(i18n, figure, teams)}</span></span><span class="settings-value">${i18n.t("admin.history.percent", { n: whole(i18n, figure.percent) })}</span></summary>
<div class="settings-panel is-wide">
<p class="usage-levels">${levels}</p>
${split}<p class="usage-detail">${seen}</p>
${isRecordedAllowance(figure.id) ? history(figure.id) : null}</div>
</details></li>
`;
}

/** A Cloudflare figure without a value yet: never a zero, never a mark. */
function missingRow(i18n: I18n, id: CloudflareAllowance): SafeHtml {
	return html`<li id="${id}"><div class="settings-row is-static"><span class="settings-icon">${FIGURE_ICONS[id]}</span><span class="settings-text"><span class="settings-title">${i18n.t(`admin.allowance.${id}`)}</span><span class="settings-sub">${i18n.t("admin.figure.noValue", { limit: amount(i18n, id, CLOUDFLARE_LIMITS[id]) })}</span></span></div></li>
`;
}

/** A group of rows under its heading, the heading saying when its figures are from. */
function group(
	id: string,
	heading: string,
	when: string | null,
	rows: SafeHtml,
	notes: SafeHtml | null,
): SafeHtml {
	return html`<section class="settings-section" id="${id}" aria-labelledby="${id}-heading">
<h2 id="${id}-heading">${heading}${when === null ? null : html` <small>${when}</small>`}</h2>
<ul class="settings-list">
${rows}</ul>
${notes}</section>
`;
}

/** Strava's figures: today's, in the fixed order (feature 048 FR-013). */
function stravaGroup(
	i18n: I18n,
	figures: readonly Figure[],
	row: (figure: Figure) => SafeHtml,
	teams: Teams,
): SafeHtml {
	const quiet = figures.some(isQuiet) ? i18n.t("admin.strava.quiet") : null;
	const notes =
		teams.peers.length > 0
			? html`<p class="settings-note">${i18n.t("admin.strava.note")}${quiet === null ? null : html`<span class="phone-only"> ${quiet}</span>`}</p>
`
			: quiet === null
				? null
				: html`<p class="settings-note phone-only">${quiet}</p>
`;
	return group(
		"strava",
		i18n.t("admin.strava.heading"),
		i18n.t("admin.strava.when"),
		html`${figures.map(row)}`,
		notes,
	);
}

/**
 * Cloudflare's figures, each the latest recorded, in the fixed order with the
 * ones that have no value yet in their place.
 */
function cloudflareGroup(
	i18n: I18n,
	figures: ReadonlyMap<string, Figure>,
	row: (figure: Figure) => SafeHtml,
	available: boolean,
): SafeHtml {
	const newest = Math.max(
		0,
		...[...figures.values()].map((figure) => figure.observedAt ?? 0),
	);
	return group(
		"cloudflare",
		i18n.t("admin.cloudflare.heading"),
		newest === 0
			? null
			: i18n.t("admin.cloudflare.when", { time: moment(i18n, newest) }),
		html`${CLOUDFLARE_ALLOWANCES.map((id) => {
			const figure = figures.get(id);
			return figure ? row(figure) : missingRow(i18n, id);
		})}`,
		html`<p class="settings-note">${i18n.t("admin.cloudflare.note")}</p>
${available ? null : html`<p class="settings-note is-warn" role="alert">${i18n.t("admin.cloudflare.unavailable")}</p>`}`,
	);
}

/** The date of `epochSeconds`, as a table's day reads. */
const dateOf = (i18n: I18n, epochSeconds: number) =>
	i18n.formatDate(new Date(epochSeconds * 1000).toISOString());

/** A row of the list: what it is about, one line, and a value where there is one. */
function lageRow(i18n: I18n, item: AttentionItem, teams: Teams): SafeHtml {
	const row = (
		icon: SafeHtml,
		title: string,
		sub: string,
		value: string | null = null,
	) =>
		html`<li><a class="settings-row" href="${item.target}"><span class="settings-icon lvl-${item.level}">${icon}</span><span class="settings-text"><span class="settings-title">${title}</span><span class="settings-sub">${sub}</span></span>${value === null ? null : html`<span class="settings-value">${value}</span>`}</a></li>
`;
	const day = (heading: MessageId, d: string) =>
		i18n.t("admin.lage.day", {
			table: i18n.t(heading),
			date: i18n.formatDate(`${d}T00:00:00Z`),
		});
	switch (item.kind) {
		case "figure": {
			const { figure } = item;
			const numbers = i18n.t("admin.figure.of", {
				used: amount(i18n, figure.id, figure.used),
				limit: amount(i18n, figure.id, figure.limit),
			});
			const line =
				item.level === "early"
					? i18n.t("admin.lage.earlyLine", {
							n: earlyThreshold(figure.id) ?? 0,
						})
					: figure.id.startsWith("cf_")
						? i18n.t("admin.lage.cloudflare", {
								date: dateOf(i18n, figure.observedAt ?? 0),
							})
						: i18n.t("admin.lage.strava");
			return row(
				item.level === "early"
					? FIGURE_ICONS[figure.id]
					: LEVEL_ICONS[item.level],
				i18n.t(`admin.allowance.${figure.id}`),
				`${numbers} · ${line}`,
				i18n.t("admin.history.percent", { n: whole(i18n, figure.percent) }),
			);
		}
		case "cpu": {
			const owner =
				item.owner === "own"
					? teams.own
					: item.owner === "shared"
						? teams.shared
						: i18n.t(
								teams.peers.length > 1
									? "admin.routing.others"
									: "admin.teams.other",
							);
			return row(
				LEVEL_ICONS[item.level],
				i18n.t("admin.lage.cpu", { owner }),
				i18n.t("admin.lage.cpuLine", {
					cut: whole(i18n, item.cutOff),
					runs: whole(i18n, item.runs),
				}),
			);
		}
		case "recheck":
			return row(
				WARNING,
				day("admin.recheck.heading", item.day),
				[
					...(item.over24h ? [i18n.t("admin.lage.recheck.over24h")] : []),
					...(item.unordered ? [i18n.t("admin.lage.recheck.order")] : []),
				].join(" · "),
			);
		case "routing":
			return row(
				WARNING,
				day("admin.routing.heading", item.day),
				item.reasons
					.map((reason) => i18n.t(`admin.lage.routing.${reason}`))
					.join(" · "),
			);
		case "calls":
			return row(
				WARNING,
				day("admin.calls.heading", item.day),
				i18n.t("admin.lage.calls"),
			);
		case "team": {
			const team = teams.peers[item.peer]?.name ?? i18n.t("admin.teams.other");
			return item.lastSuccessAt === null
				? row(
						INFO,
						i18n.t("admin.lage.team.never", { team }),
						i18n.t("admin.lage.team.neverLine"),
					)
				: row(
						INFO,
						i18n.t("admin.lage.team.stale", { team }),
						i18n.t("admin.lage.team.staleLine", {
							time: moment(i18n, item.lastSuccessAt),
						}),
					);
		}
		case "device":
			return row(
				BELL_OFF,
				i18n.t("admin.lage.device"),
				i18n.t("admin.lage.deviceLine"),
				i18n.t("nav.settings"),
			);
	}
}

/**
 * "Das braucht deinen Blick" across the top (feature 048 User Story 1): every
 * mark and state hint, worst first, and the marks counted by level; or, with
 * nothing, "Alles im Rahmen" in one line. "Jetzt aktualisieren" sits in either
 * head (FR-006).
 */
function lageSection(
	i18n: I18n,
	items: readonly AttentionItem[],
	teams: Teams,
	calm: { time: number; waiting: boolean },
): SafeHtml {
	const refresh = html`<form method="post" action="/admin/refresh"><button class="button-outlined">${i18n.t("admin.refresh")}</button></form>`;
	const worst = items[0]?.level;
	if (worst === undefined) {
		return html`<section class="usage-lage" aria-labelledby="lage-heading">
<div class="lage-head"><span class="lage-badge is-ok">${CHECK_CIRCLE}</span><div class="lage-text"><h2 id="lage-heading">${i18n.t("admin.lage.calm")}</h2><p class="settings-sub">${i18n.t(
			calm.waiting ? "admin.lage.calmLineWaiting" : "admin.lage.calmLine",
			{ time: moment(i18n, calm.time) },
		)}</p></div>${refresh}</div>
</section>
`;
	}
	const count = markCount(items);
	const chip = (
		level: "critical" | "warning" | "early",
		key: MessageId,
		n: number,
	) =>
		n === 0
			? null
			: html`<span class="usage-mark usage-mark-${level}">${i18n.t(key, { n })}</span>`;
	const counts =
		count.total === 0
			? null
			: html`<p class="lage-counts">${chip("critical", "admin.lage.critical", count.critical)}${chip("warning", "admin.lage.warning", count.warning)}${chip("early", "admin.lage.early", count.early)}</p>`;
	return html`<section class="usage-lage" aria-labelledby="lage-heading">
<div class="lage-head"><span class="lage-badge is-${worst}">${LEVEL_ICONS[worst]}</span><div class="lage-text"><h2 id="lage-heading">${i18n.t("admin.lage.heading")}</h2>${counts}</div>${refresh}</div>
<ul class="settings-list">
${items.map((item) => lageRow(i18n, item, teams))}</ul>
</section>
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
		const warn = isRecheckWarningDay(d);
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
<p>${i18n.t("admin.alerts.title")}</p>
<p>${i18n.t(on ? "admin.alerts.levels" : "admin.alerts.off")}</p>
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
): Teams & { history: HistoryTeams } {
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
		// The list and its count come from the same reads as the Admin tab's
		// number (feature 048 research R5); the longer tables are read beside.
		const [state, counts, active, cpuDays, routingCounts] = await Promise.all([
			readUsageState(ctx, rider.athleteId),
			db.batch([
				totalWaitingStatement(db),
				usageHistoryStatement(db, historyStart(today)),
				teamCountsStatement(db, historyStart(today)),
			]),
			countActiveRiders(db, now),
			readCpuDays(db, daysBefore(today, CPU_DAYS - 1)),
			readRoutingCounts(db, firstRoutingDay(today)),
		]);
		const cpuState = state.states.get("cloudflare-cpu");
		const cpuAvailable =
			cpuState?.lastFailureAt == null ||
			(cpuState.lastSuccessAt ?? 0) > cpuState.lastFailureAt;
		const waiting =
			(counts[0]?.results[0] as { n: number } | undefined)?.n ?? 0;
		const records = usageRecords(counts[1]?.results ?? []);
		const teams = teamsOf(
			i18n,
			usagePeers(ctx.env),
			teamCountRecords(counts[2]?.results ?? []),
			today,
			new Map(
				[...state.cloudflare.latest].map(([id, record]) => [id, record.day]),
			),
		);
		const url = new URL(request.url);
		// The day `?calls=` picks if it is one shown, else today.
		const askedDay = url.searchParams.get("calls");
		const picked = state.callDays.find((d) => d.day === askedDay)?.day ?? today;
		// The figure `?days=` names opens with its table of days.
		const asked = url.searchParams.get("days") ?? "";
		const openDays = isRecordedAllowance(asked) ? asked : null;
		const history = dailyHistory(i18n, records, today, openDays, teams.history);
		const row = (figure: Figure) =>
			figureRow(i18n, figure, history, teams, figure.id === openDays);
		const estimate = drainEstimateSeconds(waiting, state.usage, now);
		const firstDay = records[0]?.day;
		// The figures' time: the newest seen or recorded, riders counting live.
		const asOf =
			Math.max(
				0,
				...state.figures
					.filter((figure) => figure.id !== "riders_connected")
					.map((figure) => figure.observedAt ?? 0),
			) || now;
		return html`${adminSwitch(i18n, "usage")}${lageSection(i18n, state.items, teams, { time: asOf, waiting: waiting > 0 })}<div class="settings-page usage-page">
<div class="settings-col">
${stravaGroup(
	i18n,
	state.figures.filter((figure) => !figure.id.startsWith("cf_")),
	row,
	teams,
)}${cloudflareGroup(
	i18n,
	new Map(
		state.figures
			.filter((figure) => figure.id.startsWith("cf_"))
			.map((figure) => [figure.id, figure]),
	),
	row,
	state.cloudflare.available,
)}</div>
<div class="settings-col">
${recheckSection(i18n, ctx.team.recheckAllowance, active, state.recheckDays)}${callsSection(i18n, state.callDays, teams.peers.length, picked, callBreakdown(state.calls.counts, picked))}${routingSection(i18n, routingDays(routingCounts, ctx.team.id))}${
	estimate === null
		? null
		: html`<section class="card">
<h2>${i18n.t("admin.waiting.heading")}</h2>
<p>${i18n.t("admin.waiting.body", { n: waiting, time: aboutDuration(i18n, estimate) })}</p>
</section>
`
}${cpuSection(i18n, cpuRows(cpuDays, ctx.team.id), cpuAvailable)}${alertsSwitch(i18n, rider)}<p class="settings-note">${
			firstDay === undefined
				? i18n.t("admin.history.none")
				: i18n.t("admin.history.since", {
						date: i18n.formatDate(`${firstDay}T00:00:00Z`),
					})
		}</p>
</div>
</div>
`;
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
