import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import { readSeenQuotes, writeSeenQuote } from "../../db/quote-seen";
import { readTeam } from "../../db/team";
import type { I18n } from "../../i18n/i18n";
import {
	QUOTES_ON_TRACK,
	QUOTES_PUSH,
	SEASON_QUOTES_ON_TRACK,
	SEASON_QUOTES_PUSH,
	type Season,
} from "../../i18n/messages/quotes.de";
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
import { dayNumber, lastDay, riderWeeks, weekEnds } from "../../rynke/weeks";
import { artUrl } from "../art";
import { peloton, sparkline, weekBars } from "../charts";
import { amount, coinArt, miniCoin } from "../coin";
import { html, type SafeHtml } from "../html";
import { QUOTE_MONKEYS } from "../quote-monkeys";
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

/** One of the four views; each link keeps the other parameter (R5). */
function teamHref(kind: RynkeKind, all: boolean): string {
	const query = [kind === "team" ? "kind=team" : null, all ? "all=1" : null]
		.filter((part) => part !== null)
		.join("&");
	return query ? `/team?${query}` : "/team";
}

/** The kind's mini coin; its name only for screen readers, the coin says it. */
function coinOf(i18n: I18n, kind: RynkeKind): SafeHtml {
	return html`${miniCoin(kind)}<span class="visually-hidden">${i18n.t(`rynke.${kind}`)}</span>`;
}

function renderTeamTotal(
	i18n: I18n,
	kind: RynkeKind,
	totals: TeamTotals,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	return html`<section class="team-total card">
${coinArt(kind === "training" ? "front" : "back", "large")}<div class="team-total-text">
<p class="team-total-label">${i18n.t("team.total.label")}</p>
<p class="team-total-value${kind === "team" ? " hero-team" : ""}">${i18n.tHtml(kind === "training" ? "team.total.training" : "team.total.team", { n: amount(i18n, totals.total) })}</p>
<p class="team-total-kind">${i18n.t("team.total.kind")}</p>
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
}

/**
 * A random quote from the list for `status`, together with that list's quotes
 * for the season of `date` (FR-021, FR-022, FR-025), among those not in `seen`
 * while there are any (issue #96).
 */
export function pickQuote(
	status: RiderStatus,
	date: string,
	seen: ReadonlySet<string> = new Set(),
): QuotePick {
	const list = status === "push" ? "push" : "onTrack";
	const season = seasonOf(date);
	const quotes =
		list === "push"
			? [...QUOTES_PUSH, ...SEASON_QUOTES_PUSH[season]]
			: [...QUOTES_ON_TRACK, ...SEASON_QUOTES_ON_TRACK[season]];
	const ids = quotes.map(quoteId);
	const unseen = quotes.filter((_, i) => !seen.has(ids[i] ?? ""));
	const from = unseen.length > 0 ? unseen : quotes;
	const [random = 0] = crypto.getRandomValues(new Uint32Array(1));
	const text = from[random % from.length] ?? "";
	return {
		list,
		text,
		id: quoteId(text),
		restart: unseen.length <= 1 ? ids : null,
	};
}

/**
 * The picture of Rynke who says the quote: one of the quote monkeys
 * (`pnpm quote-build`), the same one for the same quote, or the rider-state
 * illustration while there are none yet.
 */
export function quoteArt(
	{ list, id }: Pick<QuotePick, "list" | "id">,
	monkeys: readonly string[] = QUOTE_MONKEYS,
): string {
	const monkey = monkeys[Number.parseInt(id, 16) % monkeys.length];
	if (monkey) return `/quotes/${monkey}.svg`;
	return `/illustrations/${list === "push" ? "status_push_fun" : "status_on_track_fun"}.svg`;
}

/**
 * Rynke says the quote in a speech bubble, standing on the team total (the
 * mock-up "RynkePoints Quote Monkey", option B). German in every language
 * (FR-023); the heading follows the page's. The picture is decorative.
 */
function renderQuote(i18n: I18n, quote: QuotePick): SafeHtml {
	const { list, text } = quote;
	return html`<div class="quote-monkey">
<img class="quote-monkey-art" src="${artUrl(quoteArt(quote))}" alt="" width="96" height="96">
<blockquote class="quote ${list === "push" ? "quote-push" : "quote-on-track"}" lang="de">
<p class="quote-heading" lang="${i18n.locale}">${i18n.t(`team.quote.${list}`)}</p>
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
	)}</span><span class="row-figures"><span class="row-total">${coinOf(i18n, kind)} ${whole(row.total)}</span><span class="row-other">${coinOf(i18n, other)} ${whole(row.other)}</span></span></li>
`;
}

function renderLeaderboard(
	i18n: I18n,
	kind: RynkeKind,
	all: boolean,
	shown: Neighbourhood,
	count: number,
	days: readonly number[],
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
${shown.rows.map((row) => renderRow(i18n, kind, row, days))}</ol>
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
			const window = countingWindow(ctx.env);
			// The seen quotes alongside the team, not after it (issue #184); they
			// only matter when the rider is on the leaderboard.
			const [team, seenQuotes] = await Promise.all([
				readTeam(ctx.env.DB),
				readSeenQuotes(ctx.env.DB, rider.athleteId),
			]);
			const today = berlinDate(ctx.now());
			const ends = weekEnds(
				window.seasonStart,
				lastDay(today, window.deadline),
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
				today,
			);
			const totals = teamTotals(
				riders.map((listed) => listed.weeks),
				kind,
			);
			const quote = viewer ? pickQuote(status, today, seenQuotes) : null;
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
			const head = html`${renderReconnect(i18n, rider)}${quote ? renderQuote(i18n, quote) : null}${renderTeamTotal(i18n, kind, totals)}${renderKindSwitch(i18n, kind, all)}`;
			const leaderboard = renderLeaderboard(
				i18n,
				kind,
				all,
				neighbourhood(rows, all),
				rows.length,
				ends.map(dayNumber),
			);
			// Team Rynke have no place card and no peloton and put the
			// leaderboard first (feature 019 FR-045, FR-046); Training keeps
			// feature 016's page.
			// On wide screens `.team-grid` moves the leaderboard into a column
			// of its own beside the other cards.
			if (kind === "team") {
				return html`${head}<div class="team-grid">${leaderboard}${renderTeamChart(i18n, kind, totals)}</div>`;
			}
			return html`${head}<div class="team-grid">${viewer ? renderPlace(i18n, viewer) : null}${viewer ? renderPeloton(i18n, kind, rows) : null}${renderTeamChart(i18n, kind, totals)}${leaderboard}</div>`;
		},
	);
}
