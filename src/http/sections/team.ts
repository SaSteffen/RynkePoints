import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import { readTeam } from "../../db/team";
import type { I18n } from "../../i18n/i18n";
import { QUOTES_ON_TRACK, QUOTES_PUSH } from "../../i18n/messages/quotes.de";
import { formatPlace } from "../../i18n/ordinal";
import { breakawayFence } from "../../rynke/breakaway";
import {
	type LeaderboardRow,
	leaderboardRows,
	type Neighbourhood,
	neighbourhood,
	type RynkeKind,
	type TeamTotals,
	teamTotals,
	type Viewer,
} from "../../rynke/leaderboard";
import { type RiderStatus, riderStatus } from "../../rynke/pace";
import { CURRENT_RULES, countingWindow } from "../../rynke/rules";
import { lastDay, riderWeeks, weekEnds } from "../../rynke/weeks";
import { peloton, sparkline, weekBars } from "../charts";
import { coin, miniCoin } from "../coin";
import { html, type SafeHtml } from "../html";
import { shellPage } from "../shell";

// Team at `/team` (feature 011 FR-013, feature 016 US1–US3): how the team is
// doing and where the viewer stands among 014's listed riders, in Training or
// Team Rynke, around their own row or for everyone, with a German quote that
// fits the viewer (contracts/pages.md, contracts/http-routes.md). The page only reads (FR-003); nothing on it
// carries a name or an athlete ID (FR-010).
// Organisers also get the way to the team overview and their pages (FR-002).

/** Places 1–3, by place, so a shared 2nd gives two 🥈 (research R6). */
export const MEDALS = ["🥇", "🥈", "🥉"];

const OTHER_KIND: Record<RynkeKind, RynkeKind> = {
	training: "team",
	team: "training",
};

/** One of the four views; each link keeps the other parameter (R5). */
function teamHref(kind: RynkeKind, all: boolean): string {
	const query = [kind === "team" ? "kind=team" : null, all ? "all=1" : null]
		.filter((part) => part !== null)
		.join("&");
	return query ? `/team?${query}` : "/team";
}

function renderTeamTotal(
	i18n: I18n,
	kind: RynkeKind,
	totals: TeamTotals,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	return html`<section class="team-total card">
${coin(kind === "training" ? "front" : "back", "large")}<div class="team-total-text">
<p class="team-total-label">${i18n.t("team.total.label")}</p>
<p class="team-total-value">${i18n.t("team.total.value", { n: whole(totals.total) })}</p>
<p class="team-total-kind">${i18n.t("team.total.kind", { kind: i18n.t(`team.kind.${kind}`) })}</p>
${
	totals.thisWeek > 0
		? html`<p class="team-total-week">${i18n.t("team.total.thisWeek", { n: whole(totals.thisWeek) })}</p>
`
		: null
}</div>
</section>
`;
}

/** Every listed rider on the road; only with the viewer among them. */
function renderPeloton(
	i18n: I18n,
	kind: RynkeKind,
	rows: readonly LeaderboardRow[],
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const totals = rows.map((row) => row.total);
	const own = rows.findIndex((row) => row.you);
	const fence = breakawayFence(totals);
	const figures = {
		count: whole(rows.length),
		min: whole(Math.min(...totals)),
		max: whole(Math.max(...totals)),
		own: whole(rows[own]?.total ?? 0),
	};
	const label =
		fence === null
			? i18n.t("team.peloton.label", figures)
			: i18n.t("team.peloton.label.breakaway", {
					...figures,
					away: whole(totals.filter((total) => total > fence).length),
				});
	return html`<figure class="peloton card">
<figcaption>${i18n.t("team.peloton.heading")}</figcaption>
<p class="team-hint">${i18n.t(fence === null ? "team.peloton.hint" : "team.peloton.hint.breakaway")}</p>
${peloton(totals, own, fence, { label, you: i18n.t("team.peloton.you") }, kind)}
<p class="chart-axis"><span>${i18n.t("team.peloton.back")}</span><span>${i18n.t(fence === null ? "team.peloton.front" : "team.peloton.breakaway")}</span></p>
</figure>
`;
}

function renderTeamChart(
	i18n: I18n,
	kind: RynkeKind,
	totals: TeamTotals,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const label = i18n.t("team.chart.label", {
		kind: i18n.t(`team.kind.${kind}`),
		weeks: whole(totals.weeks.length),
		total: whole(totals.total),
	});
	const best = totals.bestWeek;
	const rows = totals.weeks.map(
		(week) =>
			html`<tr><td>${i18n.formatDate(week.weekEnd)}</td><td>${whole(week.total)}</td><td>${week.gain === null ? "" : whole(week.gain)}</td></tr>
`,
	);
	const first = totals.weeks[0];
	return html`<figure class="team-chart card">
<figcaption>${i18n.t("team.chart.heading")}<span class="team-chart-kind">${i18n.t(`team.kind.${kind}`)}</span></figcaption>
<p class="team-hint">${i18n.t("team.chart.hint", { kind: i18n.t(`team.kind.${kind}`) })}</p>
${weekBars(
	totals.weeks.map((week) => week.total),
	label,
)}
${
	first
		? html`<p class="chart-axis"><span>${i18n.formatDate(first.weekEnd)}</span><span>${i18n.t("team.chart.now")}</span></p>
`
		: null
}${
	best
		? html`<p class="chart-best">${i18n.t("team.chart.best", { date: i18n.formatDate(best.weekEnd), n: whole(best.gain) })}</p>
`
		: null
}<details class="chart-table"><summary class="tap">${i18n.t("team.chart.table")}</summary>
<table>
<thead><tr><th scope="col">${i18n.t("team.chart.week")}</th><th scope="col">${i18n.t("team.chart.total")}</th><th scope="col">${i18n.t("team.chart.gain")}</th></tr></thead>
<tbody>
${rows}</tbody>
</table>
</details>
</figure>
`;
}

/** A random quote from the list for `status` (FR-021, FR-022). */
export function pickQuote(status: RiderStatus): {
	list: "push" | "onTrack";
	text: string;
} {
	const list = status === "push" ? "push" : "onTrack";
	const quotes = list === "push" ? QUOTES_PUSH : QUOTES_ON_TRACK;
	const [random = 0] = crypto.getRandomValues(new Uint32Array(1));
	return { list, text: quotes[random % quotes.length] ?? "" };
}

/** German in every language (FR-023); the heading follows the page's. */
function renderQuote(i18n: I18n, status: RiderStatus): SafeHtml {
	const { list, text } = pickQuote(status);
	return html`<blockquote class="quote ${list === "push" ? "quote-push" : "quote-on-track"}" lang="de">
<p class="quote-heading" lang="${i18n.locale}">${i18n.t(`team.quote.${list}`)}</p>
<p>${text}</p>
</blockquote>
`;
}

function segment(
	href: string,
	current: boolean,
	label: string,
	icon: SafeHtml | null = null,
): SafeHtml {
	return html`<a class="segmented" href="${href}"${current ? html` aria-current="true"` : null}>${icon}${label}</a>`;
}

function renderKindSwitch(i18n: I18n, kind: RynkeKind, all: boolean): SafeHtml {
	return html`<nav class="kind-switch" aria-label="${i18n.t("team.kind.label")}">
${segment(teamHref("training", all), kind === "training", i18n.t("team.kind.training"), miniCoin("training"))}
${segment(teamHref("team", all), kind === "team", i18n.t("team.kind.team"), miniCoin("team"))}
</nav>
`;
}

function renderPlace(i18n: I18n, viewer: Viewer): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const place = {
		place: formatPlace(i18n, viewer.place),
		count: whole(viewer.count),
	};
	return html`<section class="my-place card">
<span class="place-badge" aria-hidden="true">${whole(viewer.place)}</span><div>
<p class="place">${i18n.t(viewer.joint ? "team.place.joint" : "team.place", place)}</p>
<p class="place-next">${
		viewer.toNext === null
			? i18n.t("team.place.lead")
			: i18n.t("team.place.next", { n: whole(viewer.toNext) })
	}</p>
</div>
</section>
`;
}

function renderRow(i18n: I18n, kind: RynkeKind, row: LeaderboardRow): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const other = OTHER_KIND[kind];
	return html`<li class="row${row.you ? " you" : ""}"><span class="row-place">${MEDALS[row.place - 1] ?? whole(row.place)}</span><span class="row-line">${
		row.you
			? html`<span class="row-you">${i18n.t("team.list.you")}</span>`
			: null
	}${sparkline(
		row.weeks,
		i18n.t("team.list.weeks", { values: row.weeks.map(whole).join(", ") }),
	)}</span><span class="row-figures"><span class="row-total">${miniCoin(kind)} ${whole(row.total)}</span><span class="row-other">${i18n.t(
		"team.list.other",
		{ n: whole(row.other), kind: i18n.t(`team.kind.${other}`) },
	)}</span></span></li>
`;
}

function renderLeaderboard(
	i18n: I18n,
	kind: RynkeKind,
	all: boolean,
	shown: Neighbourhood,
	count: number,
): SafeHtml {
	const hidden = (id: "team.list.ahead" | "team.list.behind", n: number) =>
		n > 0
			? html`<p class="list-hidden">${i18n.t(id, { n: i18n.formatNumber(n, { fractionDigits: 0 }) })}</p>
`
			: null;
	return html`<section class="leaderboard card">
<div class="leaderboard-head"><h2>${i18n.t("team.list.heading")}</h2><span>${i18n.t("team.list.count", { n: i18n.formatNumber(count, { fractionDigits: 0 }) })}</span></div>
<p class="team-hint">${i18n.t("team.list.hint")}</p>
${
	shown.toggle
		? html`<nav class="list-scope" aria-label="${i18n.t("team.list.scope")}">
${segment(teamHref(kind, false), !all, i18n.t("team.list.around"))}
${segment(teamHref(kind, true), all, i18n.t("team.list.everyone"))}
</nav>
`
		: null
}${hidden("team.list.ahead", shown.hiddenAhead)}<ol start="${shown.rows[0]?.place ?? 1}">
${shown.rows.map((row) => renderRow(i18n, kind, row))}</ol>
${hidden("team.list.behind", shown.hiddenBehind)}</section>
`;
}

export function handleTeam(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	// Anything but these values is the default; nothing answers 400.
	const query = new URL(request.url).searchParams;
	const kind: RynkeKind = query.get("kind") === "team" ? "team" : "training";
	const all = query.get("all") === "1";
	return shellPage(
		request,
		ctx,
		i18n,
		"team",
		teamHref(kind, all),
		async ({ rider }) => {
			const team = await readTeam(ctx.env.DB);
			const window = countingWindow(ctx.env);
			const ends = weekEnds(
				window.seasonStart,
				lastDay(berlinDate(ctx.now()), window.deadline),
			);
			const riders = team.map((listed) => ({
				athleteId: listed.athleteId,
				balance: listed.balance,
				weeks: riderWeeks(listed, window, ends, listed.balance),
			}));
			const { rows, viewer } = leaderboardRows(riders, rider.athleteId, kind);
			const status = riderStatus(
				team.find((listed) => listed.athleteId === rider.athleteId)?.balance ??
					null,
				CURRENT_RULES,
				window,
				berlinDate(ctx.now()),
			);
			const totals = teamTotals(
				riders.map((listed) => listed.weeks),
				kind,
			);
			return html`${renderTeamTotal(i18n, kind, totals)}${renderKindSwitch(i18n, kind, all)}${
				viewer ? renderPlace(i18n, viewer) : null
			}${viewer ? renderQuote(i18n, status) : null}${viewer ? renderPeloton(i18n, kind, rows) : null}${renderTeamChart(i18n, kind, totals)}${renderLeaderboard(
				i18n,
				kind,
				all,
				neighbourhood(rows, all),
				rows.length,
			)}`;
		},
	);
}
