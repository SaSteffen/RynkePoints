// The album's pages in millimetres (feature 021 research R13,
// contracts/album-layout.md): where every page's safe area, band, table row,
// heading, slot and sticker goes. Pure and deterministic, so the browser only
// draws what is computed here and never breaks pages on its own (FR-026,
// FR-050–FR-053).

import type { BadgeCategoryId, BadgeGroup } from "../src/badges/catalog";
import type { AlbumData, AlbumEvent, AlbumSlot } from "./load";

export const PAGE_WIDTH = 210;
export const PAGE_HEIGHT = 297;
/** Top, bottom and outer edge (FR-051). */
export const MARGIN = 12;
/** The inner edge, for the binding (FR-051). */
export const GUTTER = 20;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN - GUTTER;
export const CONTENT_HEIGHT = PAGE_HEIGHT - 2 * MARGIN;

/** The page band at the top of the safe area. */
export const BAND = 12;
/** Space below the band and between the team page's blocks. */
export const GAP = 5;
/** The team total's line on page 2. */
export const TEAM_TOTAL = 11;
export const EVENT_HEADER = 6;
export const EVENT_ROW = 5;
/** The line under the event table: how many, how many tour days, yours. */
export const EVENT_FOOTER = 8;

export const SLOT_WIDTH = CONTENT_WIDTH / 3;
export const SLOT_HEIGHT = 60;
export const HEADING = 9;
/** The die-cut sticker and the printed placeholder under it. */
export const STICKER = 44;
/** The picture inside the sticker's 2 mm white edge. */
export const PICTURE = 40;
/** From the slot's top to the placeholder's centre. */
export const STICKER_CENTRE_Y = 4 + STICKER / 2;
/** How far the sticker's shadow reaches past its edge. */
export const SHADOW = 0.4;
/** The caption at the slot's foot: name, date. */
export const CAPTION = 8;

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Odd pages are right-hand pages, with the gutter on the left. */
export function safeArea(page: number): Box {
	return {
		x: page % 2 === 1 ? GUTTER : MARGIN,
		y: MARGIN,
		width: CONTENT_WIDTH,
		height: CONTENT_HEIGHT,
	};
}

/** Rows of the event table on page 2, and on a continued page. */
export const EVENTS_ON_TEAM_PAGE = Math.floor(
	(CONTENT_HEIGHT -
		BAND -
		GAP -
		TEAM_TOTAL -
		GAP -
		EVENT_HEADER -
		EVENT_FOOTER) /
		EVENT_ROW,
);
export const EVENTS_ON_PAGE = Math.floor(
	(CONTENT_HEIGHT - BAND - GAP - EVENT_HEADER - EVENT_FOOTER) / EVENT_ROW,
);

export interface StickerPose {
	/** −7 … 7 */
	rotateDeg: number;
	/** Off the placeholder's centre; up to 3.8 mm, in one slot in three. */
	dxMm: number;
	/** Clamped to ±2.5 mm, so the sticker stays clear of its caption. */
	dyMm: number;
}

/**
 * Where a sticker sits on its placeholder, as if stuck in by hand: always a
 * little turned and off, about one in three further, so the placeholder's
 * edge shows on one side. From the rider and the badge only (FR-026), by the
 * mock-up's sequence (`Slot.dc.html`): FNV-1a, then xorshift32.
 */
export function pose(athleteId: number, badgeId: string): StickerPose {
	const seed = `${athleteId}:${badgeId}`;
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	let s = h || 1;
	const rnd = () => {
		s ^= s << 13;
		s >>>= 0;
		s ^= s >>> 17;
		s ^= s << 5;
		s >>>= 0;
		return s / 4294967296;
	};
	const miss = rnd() < 0.35;
	const angle = rnd() * Math.PI * 2;
	const distMm = miss ? 2.2 + rnd() * 1.6 : rnd() * 1.4;
	return {
		dxMm: Math.cos(angle) * distMm,
		dyMm: Math.max(-2.5, Math.min(2.5, Math.sin(angle) * distMm)),
		rotateDeg: rnd() * 14 - 7,
	};
}

export interface PlacedSlot {
	slot: AlbumSlot;
	/** The slot's top left corner. */
	x: number;
	y: number;
	/** Only for an earned badge: its sticker. */
	pose: StickerPose | null;
}

export interface PlacedHeading {
	category: BadgeCategoryId;
	/** The category goes on from the page before. */
	continued: boolean;
	y: number;
}

interface PageBase {
	/** 1-based; odd is a right-hand page. */
	number: number;
	safe: Box;
}

export type AlbumPage =
	| (PageBase & { kind: "cover" })
	| (PageBase & {
			kind: "team" | "events";
			events: AlbumEvent[];
			/** The table's last page: the line under it follows. */
			last: boolean;
	  })
	| (PageBase & {
			kind: "stickers";
			group: BadgeGroup;
			headings: PlacedHeading[];
			slots: PlacedSlot[];
	  })
	| (PageBase & { kind: "blank" });

function stickerPages(
	data: AlbumData,
	group: BadgeGroup,
	firstNumber: number,
): AlbumPage[] {
	type StickerPage = Extract<AlbumPage, { kind: "stickers" }>;
	const pages: StickerPage[] = [];
	let y = 0;
	const newPage = (): StickerPage => {
		const number = firstNumber + pages.length;
		const safe = safeArea(number);
		const page: StickerPage = {
			number,
			safe,
			kind: "stickers",
			group,
			headings: [],
			slots: [],
		};
		pages.push(page);
		y = safe.y + BAND;
		return page;
	};
	let current = newPage();
	const bottom = () => current.safe.y + current.safe.height;
	const slots = data.slots.filter((slot) => slot.group === group);
	const categories = [...new Set(slots.map((slot) => slot.category))];
	for (const category of categories) {
		const own = slots.filter((slot) => slot.category === category);
		// A heading never ends a page (FR-053): it goes with its first row.
		if (y + HEADING + SLOT_HEIGHT > bottom()) current = newPage();
		current.headings.push({ category, continued: false, y });
		y += HEADING;
		for (let i = 0; i < own.length; i += 3) {
			if (y + SLOT_HEIGHT > bottom()) {
				current = newPage();
				current.headings.push({ category, continued: true, y });
				y += HEADING;
			}
			own.slice(i, i + 3).forEach((slot, column) => {
				current.slots.push({
					slot,
					x: current.safe.x + column * SLOT_WIDTH,
					y,
					pose:
						slot.earnedOn !== null && slot.earnedOn <= data.cutoff
							? pose(data.rider.athleteId, slot.badgeId)
							: null,
				});
			});
			y += SLOT_HEIGHT;
		}
	}
	return pages;
}

/** Every page of the album, in order, an even number of them (FR-053). */
export function layoutAlbum(data: AlbumData): AlbumPage[] {
	const pages: AlbumPage[] = [{ number: 1, safe: safeArea(1), kind: "cover" }];
	const events = data.team.events;
	let start = 0;
	do {
		const number = pages.length + 1;
		const first = start === 0;
		const count = first ? EVENTS_ON_TEAM_PAGE : EVENTS_ON_PAGE;
		pages.push({
			number,
			safe: safeArea(number),
			kind: first ? "team" : "events",
			events: events.slice(start, start + count),
			last: start + count >= events.length,
		});
		start += count;
	} while (start < events.length);
	for (const group of ["personal", "team"] as const) {
		pages.push(...stickerPages(data, group, pages.length + 1));
	}
	if (pages.length % 2 === 1) {
		const number = pages.length + 1;
		pages.push({ number, safe: safeArea(number), kind: "blank" });
	}
	return pages;
}
