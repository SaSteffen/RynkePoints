import {
	berlinDate,
	phrases as phrasesOn,
	rideFigures,
	rynkeViews,
	trainingLeaderboard,
} from "../../config";
import { phraseSet } from "../../content";
import type { Phrases, Season } from "../../content/types";
import type { Ctx } from "../../ctx";
import { readSeenQuotes, writeSeenQuote } from "../../db/quote-seen";
import { readTeam, readTeamAndRides, readTeamRides } from "../../db/team";
import type { I18n } from "../../i18n/i18n";
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
import {
	type DateRange,
	type Figures,
	PERIODS,
	type Period,
	periodOf,
	type RankBy,
	RIDE_FIGURES,
	type RideFigure,
	type RideRider,
	type RideRow,
	type RideViewer,
	rideRows,
	shownElevationM,
	shownKm,
	teamRideTotals,
	teamWeeksKm,
} from "../../rynke/ride-figures";
import { countingWindow, currentRules } from "../../rynke/rules";
import { dayNumber, lastDay, riderWeeks, weekEnds } from "../../rynke/weeks";
import type { TeamData } from "../../teams/types";
import { artUrl } from "../art";
import { peloton, sparkline, weekBars } from "../charts";
import { amount, coinArt, miniCoin } from "../coin";
import { FUN_SPARKLES } from "../fun";
import { type Holiday, holidayOn } from "../holidays";
import { html, type SafeHtml } from "../html";
import { QUOTE_MONKEYS, SEASONAL_MONKEYS } from "../quote-monkeys";
import { renderReconnect } from "../rider-sections";
import { shellPage } from "../shell";

// Team at `/team` (feature 011 FR-013, feature 016 US1–US3): how the team is
// doing and where the viewer stands among 014's listed riders, in Training or
// Team Rynke, around their own row or for everyone, with a German quote that
// fits the viewer (contracts/pages.md, contracts/http-routes.md). The page only
// reads (FR-003), except that it marks the shown quote as seen, so the next
// ones are new to the viewer (issue #96); nothing on it carries a name or an
// athlete ID (FR-010).
// Organisers also get the way to the team overview and their pages (FR-002).
// It's where the app opens, so a rider who must reconnect learns it here too
// (issue #73).

/** Places 1–3, by place, so a shared 2nd gives two 🥈 (research R6). */
export const MEDALS = ["🥇", "🥈", "🥉"];

const OTHER_KIND: Record<RynkeKind, RynkeKind> = {
	training: "team",
	team: "training",
};

/**
 * What `/team` shows (016 R5, 032 R7). `by` and `period` only apply to the
 * Training view; `defaultBy` is Rynke, or km for a team without Rynke views.
 */
interface TeamView {
	kind: RynkeKind;
	all: boolean;
	by: RankBy;
	period: Period;
	defaultBy: RankBy;
}

/**
 * One view; each link keeps the other parameters and leaves out default
 * values, so the default is plain `/team` (R5, 032 R7).
 */
function teamHref(view: TeamView): string {
	const training = view.kind === "training";
	const query = [
		training ? null : "kind=team",
		training && view.by !== view.defaultBy ? `by=${view.by}` : null,
		training && view.by !== "rynke" && view.period !== "season"
			? `period=${view.period}`
			: null,
		view.all ? "all=1" : null,
	]
		.filter((part) => part !== null)
		.join("&");
	return query ? `/team?${query}` : "/team";
}

/** The view a request asks for; anything unknown is the default (no 400). */
function teamViewOf(query: URLSearchParams, env: Ctx["env"]): TeamView {
	const rides = rideFigures(env);
	const rynke = rynkeViews(env);
	// Without Rynke views there is one view, the Training one (FR-012).
	const kind: RynkeKind =
		rynke && query.get("kind") === "team" ? "team" : "training";
	const defaultBy: RankBy = rynke ? "rynke" : "km";
	const asked = RIDE_FIGURES.find((figure) => figure === query.get("by"));
	const by: RankBy = kind === "training" && rides && asked ? asked : defaultBy;
	const period =
		by === "rynke"
			? "season"
			: (PERIODS.find((p) => p === query.get("period")) ?? "season");
	return { kind, all: query.get("all") === "1", by, period, defaultBy };
}

/** The kind's mini coin; its name only for screen readers, the coin says it. */
function coinOf(i18n: I18n, kind: RynkeKind): SafeHtml {
	return html`${miniCoin(kind)}<span class="visually-hidden">${i18n.t(`rynke.${kind}`)}</span>`;
}

function renderTeamTotal(
	i18n: I18n,
	kind: RynkeKind,
	totals: TeamTotals,
	team: Pick<TeamData, "name" | "art">,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	return html`<section class="team-total card">
${coinArt(team.art.coin, kind === "training" ? "front" : "back", "large")}<div class="team-total-text">
<p class="team-total-label">${i18n.t("team.total.label", { team: team.name })}</p>
<p class="team-total-value${kind === "team" ? " hero-team" : ""}">${i18n.tHtml(kind === "training" ? "team.total.training" : "team.total.team", { n: amount(i18n, totals.total) })}</p>
<p class="team-total-kind">${i18n.t("team.total.kind")}</p>
${
	totals.thisWeek > 0
		? html`<p class="team-total-week">${i18n.t("team.total.thisWeek", { n: whole(totals.thisWeek) })}</p>
`
		: null
}</div>${FUN_SPARKLES}
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
	return html`<figure class="peloton card" id="tour-peloton">
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
		kind: i18n.t(`rynke.${kind}`),
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
<figcaption>${i18n.t("team.chart.heading")}<span class="team-chart-kind">${coinOf(i18n, kind)}</span></figcaption>
<p class="team-hint">${i18n.t("team.chart.hint")}</p>
${weekBars(
	totals.weeks.map((week) => week.gain ?? week.total),
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

/** The season of a Berlin date (`YYYY-MM-DD`), by whole months (FR-025). */
export function seasonOf(date: string): Season {
	const month = Number(date.slice(5, 7));
	if (month >= 3 && month <= 5) return "spring";
	if (month >= 6 && month <= 8) return "summer";
	if (month >= 9 && month <= 11) return "autumn";
	return "winter";
}

/**
 * A quote's id for `quote_seen` (issue #96): the 32-bit FNV-1a hash of its
 * UTF-8 text, as 8 hex digits. A quote whose text changes counts as unseen.
 */
export function quoteId(text: string): string {
	let hash = 0x811c9dc5;
	for (const byte of new TextEncoder().encode(text)) {
		hash = Math.imul(hash ^ byte, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

export interface QuotePick {
	list: "push" | "onTrack";
	text: string;
	/** The quote's `quoteId`, to mark it as seen. */
	id: string;
	/**
	 * With the last quote of the list the rider hadn't seen: the ids of all the
	 * list's quotes, to mark them unseen again for a new round; otherwise null.
	 */
	restart: string[] | null;
	/** The language the phrase is written in, for its `lang` attribute. */
	locale: string;
}

/** A uniform random index below `length`: draws past the last whole multiple
 * of `length` are thrown away, so no quote is favoured. */
function randomIndex(length: number): number {
	const limit = 2 ** 32 - (2 ** 32 % length);
	const draw = new Uint32Array(1);
	do crypto.getRandomValues(draw);
	while ((draw[0] ?? 0) >= limit);
	return (draw[0] ?? 0) % length;
}

/**
 * A random quote from the list for `status`, together with that list's quotes
 * for the season of `date` (FR-021, FR-022, FR-025), among those not in `seen`
 * while there are any (issue #96).
 */
export function pickQuote(
	phrases: Phrases,
	status: RiderStatus,
	date: string,
	seen: ReadonlySet<string> = new Set(),
): QuotePick {
	const list = status === "push" ? "push" : "onTrack";
	const season = seasonOf(date);
	const { set } = phrases;
	const quotes =
		list === "push"
			? [...set.push, ...set.seasonPush[season]]
			: [...set.onTrack, ...set.seasonOnTrack[season]];
	const ids = quotes.map(quoteId);
	const unseen = quotes.filter((_, i) => !seen.has(ids[i] ?? ""));
	const from = unseen.length > 0 ? unseen : quotes;
	const text = from[randomIndex(from.length)] ?? "";
	return {
		list,
		text,
		id: quoteId(text),
		restart: unseen.length <= 1 ? ids : null,
		locale: phrases.locale,
	};
}

/**
 * The picture of Rynke who says the quote: one of the quote monkeys
 * (`pnpm badge-build`), the same one for the same quote, or the rider-state
 * illustration while there are none yet. On a team holiday whose seasonal
 * monkey is built (feature 035 contracts/quote-art.md) it is that monkey: on
 * every quote of a short window, on the quotes whose id has bit 16 set in a
 * long one, so a quote keeps its picture all window long.
 */
export function quoteArt(
	{ list, id }: Pick<QuotePick, "list" | "id">,
	monkeys: readonly string[] = QUOTE_MONKEYS,
	holiday: Holiday | null = null,
	seasonal: readonly string[] = SEASONAL_MONKEYS,
): string {
	const n = Number.parseInt(id, 16);
	if (
		holiday &&
		seasonal.includes(holiday.monkey) &&
		(holiday.kind === "short" || ((n >>> 16) & 1) === 1)
	)
		return `/quotes/${holiday.monkey}.svg`;
	const monkey = monkeys[n % monkeys.length];
	if (monkey) return `/quotes/${monkey}.svg`;
	return `/illustrations/${list === "push" ? "status_push_fun" : "status_on_track_fun"}.svg`;
}

/**
 * Rynke says the quote in a speech bubble, standing on the team total (the
 * mock-up "RynkePoints Quote Monkey", option B), without a heading, in the
 * phrase's own language (feature 026 FR-025). The picture is decorative.
 */
function renderQuote(quote: QuotePick, holiday: Holiday | null): SafeHtml {
	const { list, text, locale } = quote;
	return html`<div class="quote-monkey">
<img class="quote-monkey-art" src="${artUrl(quoteArt(quote, QUOTE_MONKEYS, holiday))}" alt="" width="120" height="120">
<blockquote class="quote ${list === "push" ? "quote-push" : "quote-on-track"}" lang="${locale}">
<p>${text}</p>
</blockquote>
</div>
`;
}

function segment(
	href: string,
	current: boolean,
	label: string,
	icon: SafeHtml | null = null,
): SafeHtml {
	// The same page in another view: `public/app.js` swaps it in place, at the
	// same scroll position (issue #113).
	return html`<a class="segmented" href="${href}" data-swap${current ? html` aria-current="true"` : null}>${icon}${label}</a>`;
}

function renderKindSwitch(i18n: I18n, view: TeamView): SafeHtml {
	// A change of kind starts the Training view at its default ranking.
	const to = (kind: RynkeKind) =>
		teamHref({ ...view, kind, by: view.defaultBy, period: "season" });
	return html`<nav class="kind-switch" aria-label="${i18n.t("team.kind.label")}">
${segment(to("training"), view.kind === "training", i18n.t("team.kind.training"), miniCoin("training"))}
${segment(to("team"), view.kind === "team", i18n.t("team.kind.team"), miniCoin("team"))}
</nav>
`;
}

/**
 * "Rank by" and, with a ride figure, the period (032 contracts/pages.md);
 * without Rynke views there is no Rynke segment.
 */
function renderRankBy(i18n: I18n, view: TeamView): SafeHtml {
	const choices: RankBy[] =
		view.defaultBy === "rynke" ? ["rynke", ...RIDE_FIGURES] : [...RIDE_FIGURES];
	const byLinks = choices.map((by) =>
		segment(
			teamHref({ ...view, by }),
			view.by === by,
			i18n.t(`team.rankBy.${by}`),
			by === "rynke" ? miniCoin("training") : null,
		),
	);
	const periods =
		view.by === "rynke"
			? null
			: html`<p class="rank-label" id="rank-period-label">${i18n.t("team.period.label")}</p>
<nav class="list-scope rank-period" aria-labelledby="rank-period-label">
${PERIODS.map((period) => segment(teamHref({ ...view, period }), view.period === period, i18n.t(`team.period.${period}`)))}
</nav>
`;
	return html`<p class="rank-label" id="rank-by-label">${i18n.t("team.rankBy.label")}</p>
<nav class="list-scope rank-by" aria-labelledby="rank-by-label">
${byLinks}
</nav>
${periods}`;
}

function renderPlace(i18n: I18n, viewer: Viewer): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const place = {
		place: whole(viewer.place),
		count: whole(viewer.count),
	};
	return html`<section class="my-place card">
<span class="place-badge" aria-hidden="true">${whole(viewer.place)}</span><div>
<p class="place">${i18n.t("team.place", place)}</p>
<p class="place-next">${
		viewer.toNext === null
			? i18n.t("team.place.lead")
			: i18n.t("team.place.next", { n: whole(viewer.toNext) })
	}</p>
</div>
</section>
`;
}

function renderRow(
	i18n: I18n,
	kind: RynkeKind,
	row: LeaderboardRow,
	days: readonly number[],
	withOther: boolean,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const other = OTHER_KIND[kind];
	return html`<li class="row${row.you ? " you" : ""}"><span class="row-place">${MEDALS[row.place - 1] ?? whole(row.place)}</span><span class="row-line">${
		row.you
			? html`<span class="row-you">${i18n.t("team.list.you")}</span>`
			: null
	}${sparkline(
		row.weeks,
		i18n.t("team.list.weeks", { values: row.weeks.map(whole).join(", ") }),
		days,
		kind === "training",
	)}</span><span class="row-figures"><span class="row-total">${coinOf(i18n, kind)} ${whole(row.total)}</span>${
		withOther
			? html`<span class="row-other">${coinOf(i18n, other)} ${whole(row.other)}</span>`
			: null
	}</span></li>
`;
}

function renderLeaderboard(
	i18n: I18n,
	view: TeamView,
	rankBy: boolean,
	shown: Neighbourhood,
	count: number,
	days: readonly number[],
	withOther: boolean,
): SafeHtml {
	const { kind } = view;
	return html`<section class="leaderboard card">
<div class="leaderboard-head"><h2>${i18n.t("team.list.heading")}</h2><span>${i18n.t("team.list.count", { n: i18n.formatNumber(count, { fractionDigits: 0 }) })}</span></div>
<p class="team-hint">${i18n.t("team.list.hint")}</p>
${rankBy ? renderRankBy(i18n, view) : null}${renderScope(i18n, view, shown.toggle)}${hidden(i18n, "team.list.ahead", shown.hiddenAhead)}<ol start="${shown.rows[0]?.place ?? 1}">
${shown.rows.map((row) => renderRow(i18n, kind, row, days, withOther))}</ol>
${hidden(i18n, "team.list.behind", shown.hiddenBehind)}</section>
`;
}

/** "Around you / Everyone", keeping the rest of the view. */
function renderScope(i18n: I18n, view: TeamView, toggle: boolean): SafeHtml {
	if (!toggle) return html``;
	return html`<nav class="list-scope" aria-label="${i18n.t("team.list.scope")}">
${segment(teamHref({ ...view, all: false }), !view.all, i18n.t("team.list.around"))}
${segment(teamHref({ ...view, all: true }), view.all, i18n.t("team.list.everyone"))}
</nav>
`;
}

function hidden(
	i18n: I18n,
	id: "team.list.ahead" | "team.list.behind",
	n: number,
): SafeHtml | null {
	return n > 0
		? html`<p class="list-hidden">${i18n.t(id, { n: i18n.formatNumber(n, { fractionDigits: 0 }) })}</p>
`
		: null;
}

/** A ride figure as shown, with its unit. */
function rideValue(i18n: I18n, figure: RideFigure, value: number): string {
	if (figure === "km") {
		return i18n.t("team.ride.km", {
			n: i18n.formatNumber(value, { fractionDigits: 1 }),
		});
	}
	const n = i18n.formatNumber(value, { fractionDigits: 0 });
	if (figure === "elevation") return i18n.t("team.ride.elevation", { n });
	return i18n.t(value === 1 ? "team.ride.session" : "team.ride.sessions", {
		n,
	});
}

/** A row's or a sum's three figures, in shown units. */
function shown(figures: Figures): Record<RideFigure, number> {
	return {
		sessions: figures.sessions,
		km: shownKm(figures.distanceM),
		elevation: shownElevationM(figures.elevationDm),
	};
}

function rowValues(row: RideRow): Record<RideFigure, number> {
	return { sessions: row.sessions, km: row.km, elevation: row.elevationM };
}

function typicalKm(i18n: I18n, metres: number): string {
	return rideValue(i18n, "km", shownKm(metres));
}

/**
 * The place card for a ride figure (FR-010): the place among the ranked
 * riders, the gap to the next one, and the viewer's typical ride, which no row
 * shows.
 */
function renderRidePlace(
	i18n: I18n,
	view: TeamView,
	figure: RideFigure,
	viewer: RideViewer,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const by = i18n.t("team.ride.place.by", {
		figure: i18n.t(`team.ride.by.${figure}`),
		period: i18n.t(`team.period.${view.period}`),
	});
	const next =
		viewer.toNext === null
			? i18n.t("team.ride.place.lead")
			: i18n.t("team.ride.place.next", {
					n: rideValue(i18n, figure, viewer.toNext),
				});
	return html`<section class="my-place card">
<span class="place-badge" aria-hidden="true">${whole(viewer.place)}</span><div>
<p class="place">${i18n.t("team.place", { place: whole(viewer.place), count: whole(viewer.count) })}</p>
<p class="place-next">${by} · ${next}</p>
${renderTypical(i18n, viewer.figures.typicalM)}</div>
</section>
`;
}

function renderTypical(i18n: I18n, typicalM: number | null): SafeHtml | null {
	if (typicalM === null) return null;
	return html`<p class="place-typical">${i18n.t("team.ride.typical", { n: typicalKm(i18n, typicalM) })}</p>
<p class="place-next">${i18n.t("team.ride.typical.hint")}</p>
`;
}

/** A viewer who isn't ranked still sees their own figures (FR-020). */
function renderOwnRideFigures(
	i18n: I18n,
	view: TeamView,
	figures: Figures,
): SafeHtml {
	const values = shown(figures);
	return html`<section class="my-place card"><div>
<p class="place">${i18n.t("team.ride.yours", {
		period: i18n.t(`team.period.${view.period}`),
		sessions: rideValue(i18n, "sessions", values.sessions),
		km: rideValue(i18n, "km", values.km),
		elevation: rideValue(i18n, "elevation", values.elevation),
	})}</p>
${renderTypical(i18n, figures.typicalM)}</div>
</section>
`;
}

/** The team's figures over every ranked rider for the period (FR-011). */
function renderTeamLine(i18n: I18n, view: TeamView, team: Figures): SafeHtml {
	if (team.sessions === 0) {
		return html`<p class="ride-team-line">${i18n.t("team.ride.nobodyYet")}</p>
`;
	}
	const values = shown(team);
	return html`<p class="ride-team-line">${i18n.t("team.ride.teamLine", {
		period: i18n.t(`team.period.${view.period}`),
		km: rideValue(i18n, "km", values.km),
		sessions: rideValue(i18n, "sessions", values.sessions),
		elevation: rideValue(i18n, "elevation", values.elevation),
		typical: team.typicalM === null ? "" : typicalKm(i18n, team.typicalM),
	})}</p>
`;
}

/**
 * A ride row: the place, "You", the picked figure with a bar against the
 * leader's, and the other two small. No sparkline, no typical ride (FR-009).
 */
function renderRideRow(
	i18n: I18n,
	figure: RideFigure,
	row: RideRow,
	lead: number,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const values = rowValues(row);
	const value = values[figure];
	const width = lead > 0 ? (value / lead) * 100 : 0;
	// Sessions show the typical ride instead of the other figures.
	const others =
		figure === "sessions"
			? row.typicalM === null
				? []
				: [
						i18n.t("team.ride.row.typical", {
							n: rideValue(i18n, "km", shownKm(row.typicalM)),
						}),
					]
			: RIDE_FIGURES.filter((other) => other !== figure).map((other) =>
					rideValue(i18n, other, values[other]),
				);
	const bar = i18n.t("team.ride.bar", {
		value: rideValue(i18n, figure, value),
		lead: rideValue(i18n, figure, lead),
	});
	return html`<li class="row${row.you ? " you" : ""}"><span class="row-place">${MEDALS[row.place - 1] ?? whole(row.place)}</span><span class="row-line">${
		row.you
			? html`<span class="row-you">${i18n.t("team.list.you")}</span>`
			: null
	}<span class="ride-bar" role="img" aria-label="${bar}"><span style="width:${width.toFixed(1)}%"></span></span></span><span class="row-figures"><span class="row-total">${rideValue(i18n, figure, value)}</span><span class="row-other">${others.join(" · ")}</span></span></li>
`;
}

/** The ranking by a ride figure (032 contracts/pages.md). */
function renderRideLeaderboard(
	i18n: I18n,
	view: TeamView,
	figure: RideFigure,
	rows: readonly RideRow[],
	team: Figures,
): SafeHtml {
	const list = neighbourhood(rows, view.all);
	const lead = rows[0] ? rowValues(rows[0])[figure] : 0;
	return html`<section class="leaderboard card">
<div class="leaderboard-head"><h2>${i18n.t("team.list.heading")}</h2><span>${i18n.t("team.list.count", { n: i18n.formatNumber(rows.length, { fractionDigits: 0 }) })}</span></div>
<p class="team-hint">${i18n.t("team.ride.hint")}</p>
${renderRankBy(i18n, view)}${renderTeamLine(i18n, view, team)}${renderScope(i18n, view, list.toggle)}${hidden(i18n, "team.list.ahead", list.hiddenAhead)}<ol start="${list.rows[0]?.place ?? 1}">
${list.rows.map((row) => renderRideRow(i18n, figure, row, lead))}</ol>
${hidden(i18n, "team.list.behind", list.hiddenBehind)}</section>
`;
}

/** What a ride figure's ranking shows, worked out from the ranked riders. */
interface RideRanking {
	figure: RideFigure;
	rows: RideRow[];
	viewer: RideViewer | null;
	own: Figures;
	team: Figures;
}

function rideRanking(
	riders: readonly RideRider[],
	viewerId: number,
	figure: RideFigure,
	range: DateRange,
	ownRides: RideRider | undefined,
): RideRanking {
	const { rows, viewer } = rideRows(riders, viewerId, figure, range);
	return {
		figure,
		rows,
		viewer,
		own: viewer?.figures ?? teamRideTotals(ownRides ? [ownRides] : [], range),
		team: teamRideTotals(riders, range),
	};
}

function renderRidePlaceCard(
	i18n: I18n,
	view: TeamView,
	ranking: RideRanking,
): SafeHtml {
	return ranking.viewer
		? renderRidePlace(i18n, view, ranking.figure, ranking.viewer)
		: renderOwnRideFigures(i18n, view, ranking.own);
}

export function handleTeam(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const view = teamViewOf(new URL(request.url).searchParams, ctx.env);
	return shellPage(
		request,
		ctx,
		i18n,
		"team",
		teamHref(view),
		async ({ rider }) => {
			if (!rynkeViews(ctx.env)) return singleView(ctx, i18n, view, rider);
			const { kind, all } = view;
			const window = countingWindow(ctx.env);
			const ranksTraining = trainingLeaderboard(ctx.env);
			const rides = rideFigures(ctx.env);
			const figure = view.by === "rynke" ? null : view.by;
			// No quote at all while the team has switched phrases off (feature
			// 026 FR-018).
			const quoting = phrasesOn(ctx.env);
			// The seen quotes alongside the team, not after it (issue #184); they
			// only matter when the rider is on the leaderboard. The ride figures
			// are read only when one is picked (032 research R2).
			const [{ team, rides: rideRiders }, seenQuotes] = await Promise.all([
				figure
					? readTeamAndRides(ctx.env.DB)
					: readTeam(ctx.env.DB).then((listed) => ({
							team: listed,
							rides: [] as RideRider[],
						})),
				quoting
					? readSeenQuotes(ctx.env.DB, rider.athleteId)
					: new Set<string>(),
			]);
			const today = berlinDate(ctx.now());
			const ends = weekEnds(
				window.seasonStart,
				lastDay(today, window.deadline),
			);
			const riders = team.map((listed) => ({
				athleteId: listed.athleteId,
				balance: listed.balance,
				weeks: riderWeeks(listed, window, ends, listed.balance, ctx.team.rules),
			}));
			const { rows, viewer } = leaderboardRows(riders, rider.athleteId, kind);
			const status = riderStatus(
				team.find((listed) => listed.athleteId === rider.athleteId)?.balance ??
					null,
				currentRules(ctx.team.rules),
				window,
				today,
			);
			const totals = teamTotals(
				riders.map((listed) => listed.weeks),
				kind,
			);
			const phrases = quoting ? phraseSet(ctx.team) : null;
			const quote =
				viewer && phrases
					? pickQuote(phrases, status, today, seenQuotes)
					: null;
			// Only a GET marks the quote as seen, as with `rynke_seen`.
			if (quote && request.method === "GET") {
				await writeSeenQuote(
					ctx.env.DB,
					rider.athleteId,
					quote.id,
					quote.restart,
				);
			}
			// The quote's monkey stands on the team total, above everything else.
			const head = html`${renderReconnect(i18n, rider)}${quote ? renderQuote(quote, holidayOn(today, ctx.team.holidays)) : null}${renderTeamTotal(i18n, kind, totals, ctx.team)}${renderKindSwitch(i18n, view)}`;
			// Team Rynke have no place card and no peloton and put the
			// leaderboard first (feature 019 FR-045, FR-046); Training keeps
			// feature 016's page.
			// On wide screens `.team-grid` moves the leaderboard into a column
			// of its own beside the other cards.
			if (kind === "team") {
				const leaderboard = renderLeaderboard(
					i18n,
					view,
					false,
					neighbourhood(rows, all),
					rows.length,
					ends.map(dayNumber),
					// Team rows carry Training as their other figure.
					ranksTraining,
				);
				return html`${head}<div class="team-grid">${leaderboard}${renderTeamChart(i18n, kind, totals)}</div>`;
			}
			// Without the Training ranking (TRAINING_LEADERBOARD "off") only the
			// peloton and the team chart stay: no place, no list.
			if (!ranksTraining) {
				return html`${head}<div class="team-grid">${viewer ? renderPeloton(i18n, kind, rows) : null}${renderTeamChart(i18n, kind, totals)}</div>`;
			}
			const pelotonAndChart = html`${viewer ? renderPeloton(i18n, kind, rows) : null}${renderTeamChart(i18n, kind, totals)}`;
			// A ride figure: only the place card and the leaderboard follow it
			// (032 contracts/pages.md); the rest stays the Rynke page.
			if (figure) {
				const ranking = rideRanking(
					rideRiders,
					rider.athleteId,
					figure,
					periodOf(view.period, today, window),
					rideRiders.find((r) => r.athleteId === rider.athleteId),
				);
				return html`${head}<div class="team-grid">${renderRidePlaceCard(i18n, view, ranking)}${pelotonAndChart}${renderRideLeaderboard(i18n, view, figure, ranking.rows, ranking.team)}</div>`;
			}
			const leaderboard = renderLeaderboard(
				i18n,
				view,
				rides,
				neighbourhood(rows, all),
				rows.length,
				ends.map(dayNumber),
				true,
			);
			return html`${head}<div class="team-grid">${viewer ? renderPlace(i18n, viewer) : null}${pelotonAndChart}${leaderboard}</div>`;
		},
	);
}

/**
 * `/team` of a team without Rynke views (FR-012): the team card, the team's
 * km week by week, the place card and the ride ranking. No kind switch, Rynke
 * card, peloton, quote or coin.
 */
async function singleView(
	ctx: Ctx,
	i18n: I18n,
	view: TeamView,
	rider: Parameters<typeof renderReconnect>[1],
): Promise<SafeHtml> {
	const figure = view.by === "rynke" ? "km" : view.by;
	const window = countingWindow(ctx.env);
	const today = berlinDate(ctx.now());
	const ends = weekEnds(window.seasonStart, lastDay(today, window.deadline));
	const riders = rideFigures(ctx.env) ? await readTeamRides(ctx.env.DB) : [];
	const season = periodOf("season", today, window);
	const ranking = rideRanking(
		riders,
		rider.athleteId,
		figure,
		periodOf(view.period, today, window),
		riders.find((r) => r.athleteId === rider.athleteId),
	);
	const weeks = teamWeeksKm(riders, ends);
	return html`${renderReconnect(i18n, rider)}${renderRideTeamTotal(i18n, teamRideTotals(riders, season), weeks, ctx.team.name)}<div class="team-grid">${renderRidePlaceCard(i18n, view, ranking)}${renderKmChart(i18n, weeks)}${renderRideLeaderboard(i18n, view, figure, ranking.rows, ranking.team)}</div>`;
}

/** The team card without Rynke: season km, sessions, elevation, this week. */
function renderRideTeamTotal(
	i18n: I18n,
	season: Figures,
	weeks: TeamTotals,
	teamName: string,
): SafeHtml {
	const values = shown(season);
	return html`<section class="team-total card ride-team-total"><div class="team-total-text">
<p class="team-total-label">${i18n.t("team.total.label", { team: teamName })}</p>
<p class="team-total-value">${rideValue(i18n, "km", values.km)}</p>
<p class="team-total-kind">${i18n.t("team.ride.total.kind")}</p>
<p class="team-total-kind">${rideValue(i18n, "sessions", values.sessions)} · ${rideValue(i18n, "elevation", values.elevation)}</p>
${
	weeks.thisWeek > 0
		? html`<p class="team-total-week">${i18n.t("team.ride.total.thisWeek", { n: i18n.formatNumber(weeks.thisWeek, { fractionDigits: 1 }) })}</p>
`
		: null
}</div>${FUN_SPARKLES}
</section>
`;
}

/** The team's km week by week, drawn like the Rynke team chart. */
function renderKmChart(i18n: I18n, totals: TeamTotals): SafeHtml {
	const km = (n: number) => i18n.formatNumber(n, { fractionDigits: 1 });
	const label = i18n.t("team.ride.chart.label", {
		weeks: i18n.formatNumber(totals.weeks.length, { fractionDigits: 0 }),
		total: rideValue(i18n, "km", totals.total),
	});
	const first = totals.weeks[0];
	const rows = totals.weeks.map(
		(week) =>
			html`<tr><td>${i18n.formatDate(week.weekEnd)}</td><td>${km(week.total)}</td><td>${week.gain === null ? "" : km(week.gain)}</td></tr>
`,
	);
	return html`<figure class="team-chart card">
<figcaption>${i18n.t("team.ride.chart.heading")}</figcaption>
<p class="team-hint">${i18n.t("team.ride.chart.hint")}</p>
${weekBars(
	totals.weeks.map((week) => week.gain ?? week.total),
	totals.weeks.map((week) => week.total),
	label,
)}
${
	first
		? html`<p class="chart-axis"><span>${i18n.formatDate(first.weekEnd)}</span><span>${i18n.t("team.chart.now")}</span></p>
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
