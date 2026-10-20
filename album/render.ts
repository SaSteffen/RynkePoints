// The album as one HTML document, one `<section class="page">` per A4 page
// (feature 021 research R13, contracts/album-layout.md), drawn as the Claude
// Design mock-up "RynkePoints Saisonalbum" shows it. Every position comes from
// `layout.ts` in millimetres; every text from the catalogs (FR-039); badge
// names stay German (feature 013). Pictures are the app's own SVGs, so the
// PDF keeps them as vectors (FR-054).

import { type BadgeCategoryId, badgeById } from "../src/badges/catalog";
import { BADGE_OUTLINE_RADIUS } from "../src/badges/outline";
import { BADGE_PICTURES } from "../src/badges/pictures";
import { html, SafeHtml } from "../src/http/html";
import { forText, milestone } from "../src/http/sections/badges";
import { CATALOGS } from "../src/i18n/catalogs";
import { createI18n, type I18n } from "../src/i18n/i18n";
import { BADGE_NAMES } from "../src/i18n/messages/badges.de";
import {
	type AlbumPage,
	BAND,
	CAPTION,
	EVENT_HEADER,
	EVENT_ROW,
	GAP,
	layoutAlbum,
	PICTURE,
	type PlacedSlot,
	SLOT_HEIGHT,
	SLOT_WIDTH,
	STICKER,
	STICKER_CENTRE_Y,
	TEAM_TOTAL,
} from "./layout";
import { type AlbumData, type AlbumSlot, loadAlbum } from "./load";
import { RIBBON_DEFS, ribbon } from "./ribbon";
import type { AlbumEnv } from "./routes";

const mm = (value: number) => `${Math.round(value * 1000) / 1000}mm`;

/** The small coins of the mock-up's figure tiles: yellow, or team blue. */
function coin(face: "#fbe122" | "#8cc4f0", size: number): SafeHtml {
	return new SafeHtml(
		`<svg class="coin" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#c99a2e"/><circle cx="12" cy="12" r="9.2" fill="${face}" stroke="#1c1b13" stroke-width="1.2"/><circle cx="12" cy="12" r="5.6" fill="none" stroke="#1c1b13" stroke-width="1.1" stroke-dasharray="1.6 1.3"/></svg>`,
	);
}

const CALENDAR = new SafeHtml(
	'<svg class="coin" viewBox="0 0 24 24" fill="none" stroke="#1c1b13" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M8.5 14.5l2.2 2.2 4.8-4.8"/></svg>',
);

function tick(label: string): SafeHtml {
	return html`<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="#1d6b35" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${label}"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
}

/** The printed placeholder every slot has: the gallery's dashed circle. */
const PLACEHOLDER = new SafeHtml(
	`<svg class="placeholder" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="${BADGE_OUTLINE_RADIUS}"/></svg>`,
);

function number(i18n: I18n, value: number): string {
	return i18n.formatNumber(value, { fractionDigits: 0 });
}

/** A page's own box, with the band's page number on the outer side. */
function pageSection(
	page: AlbumPage,
	content: SafeHtml | SafeHtml[],
): SafeHtml {
	const side = page.number % 2 === 1 ? "page-right" : "page-left";
	return html`<section class="page ${side}" data-page="${page.number}"><div class="safe" style="left:${mm(page.safe.x)};top:${mm(page.safe.y)};width:${mm(page.safe.width)};height:${mm(page.safe.height)}">${content}</div></section>`;
}

function band(
	page: AlbumPage,
	colour: "personal" | "team",
	title: string,
	count: string | null,
): SafeHtml {
	return html`<header class="band band-${colour}" style="height:${mm(BAND)}"><h1>${title}</h1>${count === null ? null : html`<span class="chip">${count}</span>`}<span class="page-number">${page.number}</span></header>`;
}

function cover(i18n: I18n, data: AlbumData, page: AlbumPage): SafeHtml {
	const { rider } = data;
	return pageSection(
		page,
		html`<div class="cover">
<section class="cover-band"><p class="cover-team">${i18n.t("album.team.name")}</p><h1>${i18n.t("album.title")}</h1><p class="cover-season">${i18n.t("album.season", { season: data.season.label })}</p><img src="/coin/rynke-coin-back.svg" alt="${i18n.t("album.coin")}"></section>
<section class="owner"><p class="owner-label">${i18n.t("album.owner")}</p><p class="owner-name">${rider.firstName}</p></section>
<section class="figures">${[
			[
				coin("#fbe122", 30),
				rider.trainingRynke,
				i18n.t("album.rider.training"),
			],
			[coin("#8cc4f0", 30), rider.teamRynke, i18n.t("album.rider.team")],
			[CALENDAR, rider.eventsAttended, i18n.t("album.rider.events")],
		].map(
			([icon, value, label]) =>
				html`<div class="figure"><div class="figure-value">${icon}<span>${number(i18n, value as number)}</span></div><span class="figure-label">${label}</span></div>`,
		)}</section>
<p class="cutoff">${i18n.t("album.cutoff", { date: i18n.formatDate(data.cutoff) })}</p>
</div>`,
	);
}

function eventTable(
	i18n: I18n,
	data: AlbumData,
	page: Extract<AlbumPage, { kind: "team" | "events" }>,
	top: number,
): SafeHtml {
	const all = data.team.events;
	const tourDays = all.filter((e) => e.kind === "tour_de_paris").length;
	const yours = all.filter((e) => e.attendedByRider).length;
	const attended = i18n.t("album.events.attended");
	const rows = page.events.map(
		(e) =>
			html`<tr class="${e.kind === "tour_de_paris" ? "tour" : null}" style="height:${mm(EVENT_ROW)}"><td>${i18n.formatDate(e.date)}</td><td class="kind">${i18n.t(`rynke.source.${e.kind}`)}</td><td class="name">${e.name ?? ""}</td><td class="riders">${e.attendees}</td><td class="you">${e.attendedByRider ? tick(attended) : null}</td></tr>`,
	);
	const footer = !page.last
		? null
		: all.length === 0
			? html`<p class="events-footer">${i18n.t("album.events.none")}</p>`
			: html`<p class="events-footer">${i18n.t(
					tourDays > 0 ? "album.events.count" : "album.events.noTour",
					{ count: all.length, tour: tourDays },
				)} · ${tick(attended)} ${i18n.t("album.events.yours", { count: yours })}</p>`;
	return html`<section class="events" style="top:${mm(top)}"><table><thead><tr style="height:${mm(EVENT_HEADER)}"><th scope="col" class="date">${i18n.t("album.events.date")}</th><th scope="col" class="kind">${i18n.t("album.events.kind")}</th><th scope="col" class="name">${i18n.t("album.events.name")}</th><th scope="col" class="riders">${i18n.t("album.events.riders")}</th><th scope="col" class="you">${i18n.t("album.events.you")}</th></tr></thead><tbody>${rows}</tbody></table>${footer}</section>`;
}

function teamPage(
	i18n: I18n,
	data: AlbumData,
	page: Extract<AlbumPage, { kind: "team" | "events" }>,
): SafeHtml {
	const heading = i18n.t("album.team.heading");
	if (page.kind === "events") {
		return pageSection(page, [
			band(page, "team", i18n.t("album.continued", { title: heading }), null),
			eventTable(i18n, data, page, BAND + GAP),
		]);
	}
	const total = html`<span class="team-total-value">${number(i18n, data.team.trainingRynke)}</span>`;
	return pageSection(page, [
		band(page, "team", heading, null),
		html`<p class="team-total" style="top:${mm(BAND + GAP)};height:${mm(TEAM_TOTAL)}">${coin("#fbe122", 40)}<span>${i18n.tHtml("album.team.training", { count: total })}</span></p>`,
		eventTable(i18n, data, page, BAND + GAP + TEAM_TOTAL + GAP),
	]);
}

function picture(slot: AlbumSlot): string {
	return BADGE_PICTURES.has(slot.badgeId)
		? `/badges/${slot.badgeId}.svg`
		: `/badges/placeholder-${slot.group}.svg`;
}

/**
 * A slot: the printed placeholder, the sticker on it when earned, with its
 * milestone ribbon, and the caption: name, what the badge was for and when;
 * for one still to earn the milestone instead. A surprise stays a "?".
 */
function slotHtml(i18n: I18n, placed: PlacedSlot, page: AlbumPage): SafeHtml {
	const { slot, pose } = placed;
	const badge = badgeById(slot.badgeId);
	if (!badge) throw new Error(`Unknown badge ${slot.badgeId}`);
	const left = (SLOT_WIDTH - STICKER) / 2;
	const top = STICKER_CENTRE_Y - STICKER / 2;
	const secret = slot.surprise && pose === null;
	const value = milestone(i18n, badge);
	const art = `left:${mm((STICKER - PICTURE) / 2)};top:${mm((STICKER - PICTURE) / 2)};width:${mm(PICTURE)};height:${mm(PICTURE)}`;
	const sticker =
		pose === null
			? null
			: html`<div class="sticker" style="left:${mm(left + pose.dxMm)};top:${mm(top + pose.dyMm)};width:${mm(STICKER)};height:${mm(STICKER)};transform:rotate(${Math.round(pose.rotateDeg * 10) / 10}deg)"><img src="${picture(slot)}" alt="" style="${art}"><div class="ribbon-box" style="${art}">${ribbon(slot.badgeId, slot.group, value)}</div></div>`;
	const caption = secret
		? html`<p class="caption-name">${i18n.t("album.stickers.secret")}</p>`
		: pose === null || !slot.earnedOn
			? html`<p class="caption-name">${BADGE_NAMES[slot.badgeId] ?? ""}</p><p class="caption-value">${value}</p>`
			: html`<p class="caption-name">${BADGE_NAMES[slot.badgeId] ?? ""}</p><p class="caption-for">${forText(i18n, badge, value)}</p><p class="caption-date">${i18n.formatDate(slot.earnedOn)}</p>`;
	return html`<div class="${pose === null ? "slot" : "slot slot-earned"}" data-badge="${slot.badgeId}" style="left:${mm(placed.x - page.safe.x)};top:${mm(placed.y - page.safe.y)};width:${mm(SLOT_WIDTH)};height:${mm(SLOT_HEIGHT)}"><div class="placeholder-box" style="left:${mm(left)};top:${mm(top)};width:${mm(STICKER)};height:${mm(STICKER)}">${PLACEHOLDER}${secret ? html`<p class="secret">?</p>` : null}</div>${sticker}<div class="caption" style="top:${mm(SLOT_HEIGHT - CAPTION)};height:${mm(CAPTION)}">${caption}</div></div>`;
}

function earnedOf(slots: readonly AlbumSlot[], cutoff: string): number {
	return slots.filter((s) => s.earnedOn !== null && s.earnedOn <= cutoff)
		.length;
}

function stickerPage(
	i18n: I18n,
	data: AlbumData,
	page: Extract<AlbumPage, { kind: "stickers" }>,
): SafeHtml {
	const group = data.slots.filter((s) => s.group === page.group);
	const count = i18n.t("album.stickers.count", {
		earned: earnedOf(group, data.cutoff),
		total: group.length,
	});
	const headings = page.headings.map((heading) => {
		const name = i18n.t(
			`badges.category.${heading.category}` as `badges.category.${BadgeCategoryId}`,
		);
		const own = group.filter((s) => s.category === heading.category);
		return html`<h2 class="heading" style="top:${mm(heading.y - page.safe.y)}"><span>${heading.continued ? i18n.t("album.continued", { title: name }) : name}</span><span class="heading-count">${i18n.t("album.stickers.count", { earned: earnedOf(own, data.cutoff), total: own.length })}</span><span class="heading-rule" aria-hidden="true"></span></h2>`;
	});
	return pageSection(page, [
		band(
			page,
			page.group,
			i18n.t(
				page.group === "personal"
					? "album.stickers.mine"
					: "album.stickers.team",
			),
			count,
		),
		...headings,
		...page.slots.map((placed) => slotHtml(i18n, placed, page)),
	]);
}

/** The album's whole document. */
export function renderAlbum(data: AlbumData): string {
	const i18n = createI18n(data.locale, CATALOGS);
	const pages = layoutAlbum(data).map((page) => {
		switch (page.kind) {
			case "cover":
				return cover(i18n, data, page);
			case "team":
			case "events":
				return teamPage(i18n, data, page);
			case "stickers":
				return stickerPage(i18n, data, page);
			default:
				return pageSection(page, []);
		}
	});
	const title = `${i18n.t("album.title")} · ${data.rider.firstName}`;
	return html`<!doctype html><html lang="${data.locale}"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="/album.css"></head><body>${RIBBON_DEFS}${pages}</body></html>`.toString();
}

/** One rider's album, read as of `cutoff`. */
export async function albumHtml(
	db: D1Database,
	env: AlbumEnv,
	rider: { athleteId: number; firstName: string },
	cutoff: string,
	now: number,
): Promise<string> {
	return renderAlbum(await loadAlbum(db, env, rider, cutoff, now));
}
