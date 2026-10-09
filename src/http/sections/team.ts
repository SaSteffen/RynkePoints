import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import { readTeam } from "../../db/team";
import type { I18n } from "../../i18n/i18n";
import { formatPlace } from "../../i18n/ordinal";
import {
	type LeaderboardRow,
	leaderboardRows,
	type Neighbourhood,
	neighbourhood,
	type RynkeKind,
	type Viewer,
} from "../../rynke/leaderboard";
import { CURRENT_RULES } from "../../rynke/rules";
import { lastDay, riderWeeks, weekEnds } from "../../rynke/weeks";
import { sparkline } from "../charts";
import { miniCoin } from "../coin";
import { html, type SafeHtml } from "../html";
import { shellPage } from "../shell";

// Team at `/team` (feature 011 FR-013, feature 016 US1): where the viewer
// stands among 014's listed riders, in Training or Team Rynke, around their
// own row or for everyone (contracts/pages.md, contracts/http-routes.md). The
// page only reads (FR-003); no row carries a name or an athlete ID (FR-010).
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

function segment(href: string, current: boolean, label: string): SafeHtml {
	return html`<a class="segmented" href="${href}"${current ? html` aria-current="true"` : null}>${label}</a>`;
}

function renderKindSwitch(i18n: I18n, kind: RynkeKind, all: boolean): SafeHtml {
	return html`<nav class="kind-switch" aria-label="${i18n.t("team.kind.label")}">
${segment(teamHref("training", all), kind === "training", i18n.t("team.kind.training"))}
${segment(teamHref("team", all), kind === "team", i18n.t("team.kind.team"))}
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
<p class="place">${i18n.t(viewer.joint ? "team.place.joint" : "team.place", place)}</p>
<p class="place-next">${
		viewer.toNext === null
			? i18n.t("team.place.lead")
			: i18n.t("team.place.next", { n: whole(viewer.toNext) })
	}</p>
</section>
`;
}

function renderRow(i18n: I18n, kind: RynkeKind, row: LeaderboardRow): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const other = OTHER_KIND[kind];
	return html`<li class="row${row.you ? " you" : ""}"><span class="row-place">${MEDALS[row.place - 1] ?? whole(row.place)}</span>${
		row.you
			? html`<span class="row-you">${i18n.t("team.list.you")}</span>`
			: null
	}<span class="row-total">${miniCoin(kind)} ${whole(row.total)}</span><span class="row-other">${i18n.t(
		"team.list.other",
		{ n: whole(row.other), kind: i18n.t(`team.kind.${other}`) },
	)}</span>${sparkline(
		row.weeks,
		i18n.t("team.list.weeks", { values: row.weeks.map(whole).join(", ") }),
	)}</li>
`;
}

function renderLeaderboard(
	i18n: I18n,
	kind: RynkeKind,
	all: boolean,
	shown: Neighbourhood,
): SafeHtml {
	const hidden = (id: "team.list.ahead" | "team.list.behind", n: number) =>
		n > 0
			? html`<p class="list-hidden">${i18n.t(id, { n: i18n.formatNumber(n, { fractionDigits: 0 }) })}</p>
`
			: null;
	return html`<section class="leaderboard">
<h2>${i18n.t("team.list.heading")}</h2>
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
${hidden("team.list.behind", shown.hiddenBehind)}</section>`;
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
			const seasonStart = ctx.env.SEASON_START_DATE;
			const ends = weekEnds(
				seasonStart,
				lastDay(berlinDate(ctx.now()), CURRENT_RULES.qualificationDeadline),
			);
			const { rows, viewer } = leaderboardRows(
				team.map((listed) => ({
					athleteId: listed.athleteId,
					balance: listed.balance,
					weeks: riderWeeks(listed, seasonStart, ends, listed.balance),
				})),
				rider.athleteId,
				kind,
			);
			return html`${renderKindSwitch(i18n, kind, all)}${
				viewer ? renderPlace(i18n, viewer) : null
			}${renderLeaderboard(i18n, kind, all, neighbourhood(rows, all))}${
				rider.organiser
					? html`
<p class="organiser-entry"><a class="button-outlined" href="/organiser/riders">${i18n.t("team.organiser.overview")}</a> <a class="button-outlined" href="/organiser">${i18n.t("organiser.link")}</a></p>`
					: null
			}`;
		},
	);
}
