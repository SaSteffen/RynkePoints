import { BADGE_CATEGORIES, BADGES } from "../../src/badges/catalog";
import { progressOf } from "../../src/badges/evaluate";
import { buildBadgeSection } from "../../src/badges/view";
import { html, htmlResponse, layout } from "../../src/http/html";
import { renderBadges } from "../../src/http/sections/badges";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { dayBefore } from "./samples";

// `GET /_dev/badges` (feature 013): the app's Abzeichen section with every
// badge earned, personal and team, to look at every picture, ribbon and large
// view at once. The team's badges are shared by everyone, so the sample riders
// can't show them all; this page can. Earned a day apart, the last one newest.

export function badgesPage(lang: string | null, today: string): Response {
	const i18n = createI18n(lang ?? "de", CATALOGS);
	const evaluated = (group: "personal" | "team") => ({
		earned: BADGES.filter((b) => b.group === group).map((b) => ({
			badgeId: b.id,
			earnedOn: dayBefore(today, BADGES.length - BADGES.indexOf(b)),
		})),
		progress: BADGE_CATEGORIES.filter((c) => c.group === group).map((c) =>
			progressOf(c.id, c.ladder.at(-1) ?? 0),
		),
	});
	const section = buildBadgeSection({
		waiting: false,
		personal: evaluated("personal"),
		team: evaluated("team"),
	});
	const body = html`<div class="overview-grid">${section ? renderBadges(i18n, section) : null}</div>`;
	return htmlResponse(
		i18n,
		layout(i18n, { title: "Every badge", path: "/_dev/badges", body }),
	);
}
