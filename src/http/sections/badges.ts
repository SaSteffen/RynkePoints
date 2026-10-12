// The Abzeichen section at `/me/badges`, its own tab: the rider's own badges,
// then the team's (feature 013 US1, US4, contracts/abzeichen-section.md),
// before the first data only the waiting state, as on Rides. The newest badge
// per category as cards with the milestone on the ribbon and the categories
// without a badge as dotted outlines, the closed gallery of every badge, and
// one popover per earned badge. Only earned
// badges are named or pictured, so the next one stays a surprise (SC-003); the
// gallery shows the ones still to earn as empty outlines (issue #109).

import {
	type Badge,
	type BadgeCategoryId,
	type BadgeGroup,
	type BadgeUnit,
	badgeById,
	categoryById,
	ONE_DECIMAL,
	surpriseName,
} from "../../badges/catalog";
import type { EarnedBadge } from "../../badges/evaluate";
import { BADGE_PICTURES } from "../../badges/pictures";
import { evaluateTeamBadges } from "../../badges/team";
import {
	type BadgeSection,
	buildBadgeSection,
	type Card,
	type NotYetRow,
	type ProgressView,
	personalProgress,
} from "../../badges/view";
import { berlinDate, readyPollSeconds } from "../../config";
import type { Ctx } from "../../ctx";
import { readRiderBadges, upsertRevealsStatement } from "../../db/badges";
import { type RiderViewRead, readRiderView } from "../../db/rider-view";
import type { Rider } from "../../db/riders";
import { readTeamBadgeSums } from "../../db/team";
import type { I18n } from "../../i18n/i18n";
import { BADGE_NAMES } from "../../i18n/messages/badges.de";
import {
	type CountingWindow,
	CURRENT_RULES,
	countingWindow,
} from "../../rynke/rules";
import { html, type SafeHtml } from "../html";
import { CLOSE } from "../icons";
import { renderWaiting } from "../rider-sections";
import { shellPage } from "../shell";

/** Units with a singular form, for "Noch 1 Termin". */
const SINGULAR = new Set<BadgeUnit>([
	"events",
	"trainings",
	"riders",
	"attendances",
	"days",
]);

function valueText(
	i18n: I18n,
	unit: BadgeUnit,
	n: number,
	fractionDigits = 0,
): string {
	const value = i18n.formatNumber(n, { fractionDigits });
	return n === 1 && SINGULAR.has(unit)
		? i18n.t(`badges.value.${unit as "events"}.one`, { n: value })
		: i18n.t(`badges.value.${unit}`, { n: value });
}

/** The surprise badges' rule names, as their catalog keys use them. */
type SurpriseName =
	| "new-year"
	| "christmas-eve"
	| "christmas"
	| "night-owl"
	| "early-bird"
	| "rest-day"
	| "day-off"
	| "all-out"
	| "round-the-clock"
	| "relay"
	| "new-years-eve"
	| "sunday-outing";

/**
 * The milestone on the ribbon: "1.000 km", "Halbmarathon", "1,9 km": a
 * decimal only where the threshold has one (research R28); a surprise
 * badge's own word, "Nachteule" (research R34).
 */
function milestone(i18n: I18n, badge: Badge): string {
	const surprise = surpriseName(badge) as SurpriseName | null;
	if (surprise) return i18n.t(`badges.surprise.${surprise}`);
	if (badge.id === "run-length-half") return i18n.t("badges.value.half");
	if (badge.id === "run-length-marathon")
		return i18n.t("badges.value.marathon");
	return valueText(
		i18n,
		categoryById(badge.category).unit,
		badge.threshold,
		Number.isInteger(badge.threshold) ? 0 : 1,
	);
}

function picture(badge: Badge, ribbon: boolean): string {
	const suffix = ribbon ? "-ribbon" : "";
	return BADGE_PICTURES.has(badge.id)
		? `/badges/${badge.id}${suffix}.svg`
		: `/badges/placeholder-${badge.group}${suffix}.svg`;
}

function badgeOf(earned: EarnedBadge): Badge {
	const badge = badgeById(earned.badgeId);
	if (!badge) throw new Error(`Unknown badge ${earned.badgeId}`);
	return badge;
}

/** A badge as a button that opens its large view. */
function badgeButton(
	i18n: I18n,
	earned: EarnedBadge,
	size: 200 | 96,
): SafeHtml {
	const badge = badgeOf(earned);
	const label = i18n.t("badges.label", {
		name: BADGE_NAMES[badge.id] ?? "",
		value: milestone(i18n, badge),
	});
	const ribbon = size === 200;
	return html`<button class="badge" popovertarget="badge-${badge.id}" aria-label="${label}"><img src="${picture(badge, ribbon)}" alt="" loading="lazy" width="${size}" height="${size}">${ribbon ? html`<span class="badge-ribbon-text">${milestone(i18n, badge)}</span>` : null}</button>`;
}

function progressBar(
	i18n: I18n,
	category: BadgeCategoryId,
	progress: ProgressView,
): SafeHtml {
	// The width is a number the view model computed, never user input.
	const missing = valueText(
		i18n,
		progress.unit,
		progress.missing,
		ONE_DECIMAL.has(category) ? 1 : 0,
	);
	return html`<span class="bar" aria-hidden="true"><span style="width:${progress.percent}%"></span></span><span class="badge-missing">${i18n.t("badges.missing", { value: missing })}</span>`;
}

/** The category's name in bold with the sentence on how it counts below. */
function categoryHeading(i18n: I18n, category: BadgeCategoryId): SafeHtml {
	return html`<h4>${i18n.t(`badges.category.${category}`)}</h4>
<p class="badge-about">${i18n.t(`badges.about.${category}`)}</p>`;
}

function card(i18n: I18n, card: Card): SafeHtml {
	return html`<li class="badge-card" data-category="${card.category}">
${categoryHeading(i18n, card.category)}
${badgeButton(i18n, card.badge, 200)}
${card.progress ? html`<div class="badge-progress">${progressBar(i18n, card.category, card.progress)}</div>` : null}
</li>`;
}

/**
 * A category without a badge: a dotted outline, its sentence on phones too;
 * no bar once its winter month is over (FR-004a).
 */
function emptyCard(i18n: I18n, row: NotYetRow): SafeHtml {
	return html`<li class="badge-card badge-card-empty" data-category="${row.category}">
${categoryHeading(i18n, row.category)}
<span class="badge-slot" aria-hidden="true"></span>
${row.progress ? html`<div class="badge-progress">${progressBar(i18n, row.category, row.progress)}</div>` : null}
</li>`;
}

function group(
	i18n: I18n,
	kind: BadgeGroup,
	view: BadgeSection["personal"] | null,
	notYet: readonly NotYetRow[],
): SafeHtml | null {
	if (!view) return null;
	const empty = notYet.filter((row) => row.group === kind);
	const gallery = view.gallery.map(
		(g) => html`${categoryHeading(i18n, g.category)}
<ul>${g.badges.map(
			(b) =>
				html`<li>${badgeButton(i18n, b, 96)}<span class="badge-value">${milestone(i18n, badgeOf(b))}</span></li>`,
		)}${Array.from(
			{ length: g.unearned },
			() => html`<li class="badge-slot" aria-hidden="true"></li>`,
		)}</ul>
`,
	);
	return html`<section class="badge-group badge-group-${kind}" aria-labelledby="badges-${kind}-heading">
<h3 id="badges-${kind}-heading">${i18n.t(`badges.${kind}.newest`)}</h3>
${kind === "personal" && view.count === 0 ? html`<p class="badges-empty">${i18n.t("badges.empty")}</p>` : null}
<ul class="badge-cards">
${view.cards.map((c) => card(i18n, c))}${empty.map((row) => emptyCard(i18n, row))}
</ul>
${
	view.count > 0
		? html`<details class="badge-gallery">
<summary>${i18n.t(`badges.${kind}.all`, { n: i18n.formatNumber(view.count, { fractionDigits: 0 }) })}</summary>
${gallery}</details>`
		: null
}
</section>
`;
}

/**
 * The large view: the badge at 280 px with its name, what it was for and the
 * date, and a close button for phones, where there's little outside to tap
 * (hidden while hover holds it open).
 */
/** What the badge was for; a surprise badge says why it was earned. */
function forText(i18n: I18n, badge: Badge, value: string): string {
	const surprise = surpriseName(badge) as SurpriseName | null;
	if (surprise) return i18n.t(`badges.surprise.${surprise}.for`);
	return i18n.t(
		`badges.for.${badge.category as Exclude<BadgeCategoryId, "surprise" | "team_surprise">}`,
		{ value },
	);
}

function popover(i18n: I18n, earned: EarnedBadge): SafeHtml {
	const badge = badgeOf(earned);
	const value = milestone(i18n, badge);
	const team = badge.group === "team" ? " badge-large-team" : "";
	return html`<div popover id="badge-${badge.id}" class="badge-large${team}">
<button type="button" class="icon-button badge-large-close" popovertarget="badge-${badge.id}" popovertargetaction="hide" aria-label="${i18n.t("badges.close")}">${CLOSE}</button>
<span class="badge"><img src="${picture(badge, true)}" alt="" loading="lazy" width="280" height="280"><span class="badge-ribbon-text">${value}</span></span>
<h4>${BADGE_NAMES[badge.id] ?? ""}</h4>
<p>${forText(i18n, badge, value)}</p>
<p>${i18n.t("badges.earnedOn", { date: i18n.formatDate(earned.earnedOn) })}</p>
</div>
`;
}

/** At most this many pictures in the reveal; the text has the count. */
const REVEAL_PICTURES = 5;

/**
 * The badges new for the rider since their last visit, celebrated once
 * (FR-031, research R16), in the look of feature 012's coin celebration and
 * next to it at the top of the page.
 */
export function renderBadgeReveal(
	i18n: I18n,
	badges: readonly EarnedBadge[],
): SafeHtml | null {
	const first = badges[0];
	if (!first) return null;
	const text =
		badges.length === 1
			? i18n.t("badges.reveal.one", {
					name: BADGE_NAMES[first.badgeId] ?? "",
				})
			: i18n.t("badges.reveal.many", {
					n: i18n.formatNumber(badges.length, { fractionDigits: 0 }),
				});
	return html`<aside class="badges-reveal" role="status">
<span class="badges-reveal-pictures" aria-hidden="true">${badges
		.slice(0, REVEAL_PICTURES)
		.map(
			(b) =>
				html`<img src="${picture(badgeOf(b), false)}" alt="" width="48" height="48">`,
		)}</span>
<p>${text}</p>
</aside>
`;
}

export function renderBadges(i18n: I18n, section: BadgeSection): SafeHtml {
	const earned = [section.personal, section.team].flatMap(
		(view) => view?.gallery.flatMap((g) => g.badges) ?? [],
	);
	return html`<section class="badges" aria-labelledby="badges-heading">
<h2 id="badges-heading" class="visually-hidden">${i18n.t("badges.heading")}</h2>
${group(i18n, "personal", section.personal, section.notYet)}${group(i18n, "team", section.team, section.notYet)}${earned.map((b) => popover(i18n, b))}</section>`;
}

/**
 * The rider's stored badges and the team's, worked out from the listed
 * riders' sums on every request (research R15), with the ones new for the
 * rider: of the team's only those earned since they connected. Only a GET
 * marks them as revealed, as with `rynke_seen` (FR-032, research R16).
 */
async function badgesOf(
	request: Request,
	ctx: Ctx,
	rider: Rider,
	attendance: RiderViewRead["attendance"],
	trainingRynke: number,
	window: CountingWindow,
): Promise<BadgeSection | null> {
	const db = ctx.env.DB;
	const [badges, sums] = await Promise.all([
		readRiderBadges(db, rider.athleteId, window),
		readTeamBadgeSums(db),
	]);
	const section = buildBadgeSection({
		waiting: false,
		personal: {
			earned: badges.earned,
			progress: personalProgress(
				{ ...badges, attendance, trainingRynke },
				window,
			),
		},
		team: evaluateTeamBadges(sums, CURRENT_RULES, window),
		revealed: badges.revealed,
		connectedOn: berlinDate(rider.connectedAt),
		today: berlinDate(ctx.now()),
		seasonStart: window.seasonStart,
	});
	if (section && section.reveal.length > 0 && request.method === "GET") {
		await upsertRevealsStatement(db, rider.athleteId, section.reveal).run();
	}
	return section;
}

export function handleBadges(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return shellPage(
		request,
		ctx,
		i18n,
		"badges",
		"/me/badges",
		async ({ rider }) => {
			const read = await readRiderView(ctx.env.DB, rider.athleteId, 1);
			const window = countingWindow(ctx.env);
			if (!read.balance) {
				return renderWaiting(
					i18n,
					ctx.env.SEASON_START_DATE,
					readyPollSeconds(ctx.env),
				);
			}
			const section = await badgesOf(
				request,
				ctx,
				rider,
				read.attendance,
				read.balance.trainingRynke,
				window,
			);
			return section
				? html`${renderBadgeReveal(i18n, section.reveal)}${renderBadges(i18n, section)}`
				: html``;
		},
	);
}
