import { describe, expect, it } from "vitest";
import {
	type AlbumPage,
	CAPTION,
	CONTENT_HEIGHT,
	CONTENT_WIDTH,
	EVENT_ROW,
	EVENTS_ON_PAGE,
	EVENTS_ON_TEAM_PAGE,
	GUTTER,
	HEADING,
	layoutAlbum,
	MARGIN,
	PAGE_HEIGHT,
	PAGE_WIDTH,
	PICTURE,
	pose,
	RIBBON_REACH,
	SHADOW,
	SLOT_HEIGHT,
	SLOT_WIDTH,
	STICKER,
	STICKER_CENTRE_Y,
	safeArea,
} from "../../album/layout";
import type { AlbumData, AlbumEvent } from "../../album/load";
import { BADGES, categoryById } from "../../src/badges/catalog";

// The album's geometry (feature 021 research R13, contracts/album-layout.md):
// A4 pages with mirrored margins, the event table's pages, and the sticker
// pages' slots and stickers. Synthetic data only.

const ATHLETE = 101;
const MM_PER_PX = 25.4 / 96;

function event(i: number): AlbumEvent {
	const day = String((i % 28) + 1).padStart(2, "0");
	return {
		date: `2026-${String(9 + Math.floor(i / 28)).padStart(2, "0")}-${day}`,
		kind: "team_training",
		name: `Runde ${i + 1}`,
		attendees: 5,
		attendedByRider: i % 2 === 0,
	};
}

function album(
	options: { events?: number; earned?: (index: number) => boolean } = {},
): AlbumData {
	const earned = options.earned ?? ((i: number) => i % 2 === 0);
	return {
		season: { start: "2026-09-01", end: "2027-08-31", label: "2026/27" },
		cutoff: "2027-08-31",
		locale: "de",
		rider: {
			athleteId: ATHLETE,
			firstName: "Anna",
			trainingRynke: 300,
			teamRynke: 30,
			eventsAttended: 12,
		},
		team: {
			trainingRynke: 9000,
			events: Array.from({ length: options.events ?? 24 }, (_, i) => event(i)),
		},
		slots: BADGES.map((badge, i) => ({
			badgeId: badge.id,
			group: badge.group,
			category: badge.category,
			earnedOn: earned(i) ? "2027-01-15" : null,
			surprise: categoryById(badge.category).surprise === true,
		})),
	};
}

type StickerPage = Extract<AlbumPage, { kind: "stickers" }>;
const stickerPagesOf = (pages: AlbumPage[]) =>
	pages.filter((page): page is StickerPage => page.kind === "stickers");

describe("pages", () => {
	it("are A4 with a safe area of 12 mm and a 20 mm gutter", () => {
		expect([PAGE_WIDTH, PAGE_HEIGHT]).toEqual([210, 297]);
		expect([CONTENT_WIDTH, CONTENT_HEIGHT]).toEqual([178, 273]);
		expect(MARGIN).toBe(12);
		expect(GUTTER).toBe(20);
	});

	it("put the gutter on the inner side: left on odd pages, right on even", () => {
		expect(safeArea(1)).toEqual({ x: 20, y: 12, width: 178, height: 273 });
		expect(safeArea(2)).toEqual({ x: 12, y: 12, width: 178, height: 273 });
		expect(safeArea(3).x).toBe(20);
		for (const n of [1, 2, 7, 8]) {
			const safe = safeArea(n);
			const inner = n % 2 === 1 ? safe.x : PAGE_WIDTH - safe.x - safe.width;
			const outer = n % 2 === 1 ? PAGE_WIDTH - safe.x - safe.width : safe.x;
			expect(inner).toBe(20);
			expect(outer).toBe(12);
		}
	});

	it("are numbered in order, each with its own page's safe area", () => {
		const pages = layoutAlbum(album());
		pages.forEach((page, i) => {
			expect(page.number).toBe(i + 1);
			expect(page.safe).toEqual(safeArea(i + 1));
		});
	});

	it.each([0, 1, 24, 60])("are an even number with %i events", (events) => {
		for (const earned of [
			() => false,
			() => true,
			(i: number) => i % 3 === 0,
		]) {
			expect(layoutAlbum(album({ events, earned })).length % 2).toBe(0);
		}
	});
});

describe("the summary pages", () => {
	it("open with the cover on page 1 and the team's season on page 2", () => {
		const [cover, team] = layoutAlbum(album());
		expect(cover?.kind).toBe("cover");
		expect(cover?.safe.x).toBe(20);
		expect(team?.kind).toBe("team");
		expect(team?.safe.x).toBe(12);
	});

	it("hold about 48 rows of 5 mm, fewer on page 2 below the team total", () => {
		expect(EVENT_ROW).toBe(5);
		expect(EVENTS_ON_PAGE).toBeGreaterThanOrEqual(45);
		expect(EVENTS_ON_PAGE).toBeLessThanOrEqual(49);
		expect(EVENTS_ON_TEAM_PAGE).toBeLessThan(EVENTS_ON_PAGE);
	});

	it("keep a season's events on page 2 when they fit", () => {
		const pages = layoutAlbum(album({ events: EVENTS_ON_TEAM_PAGE }));
		const team = pages[1];
		expect(team?.kind === "team" && team.events.length).toBe(
			EVENTS_ON_TEAM_PAGE,
		);
		expect(team?.kind === "team" && team.last).toBe(true);
		expect(pages[2]?.kind).toBe("stickers");
	});

	it("go on to page 3 with 49 events, the rest in date order", () => {
		const data = album({ events: 49 });
		const [, team, more, next] = layoutAlbum(data);
		if (team?.kind !== "team" || more?.kind !== "events") {
			throw new Error("expected the team page and a continued page");
		}
		expect(team.last).toBe(false);
		expect(more.last).toBe(true);
		expect(more.safe.x).toBe(20);
		expect([...team.events, ...more.events]).toEqual(data.team.events);
		expect(next?.kind).toBe("stickers");
	});

	it("list no events without any, on page 2 still", () => {
		const [, team] = layoutAlbum(album({ events: 0 }));
		expect(team?.kind === "team" && team.events).toEqual([]);
	});
});

describe("the sticker pages", () => {
	const data = album();
	const pages = layoutAlbum(data);
	const stickers = stickerPagesOf(pages);
	const placed = stickers.flatMap((page) =>
		page.slots.map((slot) => ({ page, ...slot })),
	);

	it("hold every catalog badge in exactly one slot, in gallery order", () => {
		expect(placed.map((p) => p.slot.badgeId)).toEqual(BADGES.map((b) => b.id));
	});

	it("start each group on its own page, personal first", () => {
		const groups = stickers.map((page) => page.group);
		expect(groups[0]).toBe("personal");
		expect(groups.at(-1)).toBe("team");
		const firstTeam = groups.indexOf("team");
		expect(groups.slice(firstTeam).every((g) => g === "team")).toBe(true);
		for (const page of stickers) {
			expect(page.slots.every((s) => s.slot.group === page.group)).toBe(true);
		}
	});

	it("keep every slot, heading and sticker inside the page's safe area", () => {
		const inside = (page: StickerPage, x: number, y: number) => {
			const { safe } = page;
			expect(x).toBeGreaterThanOrEqual(safe.x - 1e-9);
			expect(x).toBeLessThanOrEqual(safe.x + safe.width + 1e-9);
			expect(y).toBeGreaterThanOrEqual(safe.y - 1e-9);
			expect(y).toBeLessThanOrEqual(safe.y + safe.height + 1e-9);
		};
		for (const { page, x, y, pose: p } of placed) {
			inside(page, x, y);
			inside(page, x + SLOT_WIDTH, y + SLOT_HEIGHT);
			if (p) {
				const reach = STICKER / 2 + SHADOW;
				const cx = x + SLOT_WIDTH / 2 + p.dxMm;
				const cy = y + STICKER_CENTRE_Y + p.dyMm;
				// Inside its own slot too, clear of its neighbours and the caption.
				expect(cx - reach).toBeGreaterThan(x);
				expect(cx + reach).toBeLessThan(x + SLOT_WIDTH);
				expect(cy - reach).toBeGreaterThan(y);
				expect(cy + reach).toBeLessThan(y + SLOT_HEIGHT - CAPTION);
			}
		}
		for (const page of stickers) {
			for (const heading of page.headings) {
				inside(page, page.safe.x, heading.y);
				inside(page, page.safe.x, heading.y + HEADING);
			}
		}
	});

	it("never end a page with a heading", () => {
		for (const page of stickers) {
			for (const heading of page.headings) {
				expect(
					page.slots.some(
						(s) =>
							s.slot.category === heading.category &&
							s.y === heading.y + HEADING,
					),
				).toBe(true);
			}
		}
	});

	it("repeat a continued category's heading, marked as continued", () => {
		const long = album();
		const layout = stickerPagesOf(layoutAlbum(long));
		for (const [i, page] of layout.entries()) {
			const firstSlot = page.slots[0];
			const before = layout[i - 1]?.slots.at(-1);
			const continues =
				before !== undefined &&
				firstSlot !== undefined &&
				before.slot.category === firstSlot.slot.category &&
				before.slot.group === firstSlot.slot.group;
			expect(page.headings[0]?.continued).toBe(continues);
			expect(page.headings.slice(1).every((h) => !h.continued)).toBe(true);
		}
	});

	it("give a sticker only to an earned badge", () => {
		for (const { slot, pose: p } of placed) {
			expect(p !== null).toBe(slot.earnedOn !== null);
		}
	});

	it("give nothing a sticker earned after the cut-off", () => {
		const later = album({ earned: () => true });
		later.cutoff = "2027-01-14";
		const all = stickerPagesOf(layoutAlbum(later)).flatMap((p) => p.slots);
		expect(all.every((s) => s.pose === null)).toBe(true);
	});
});

describe("the sticker", () => {
	it("holds the picture and the ribbon's tails with a white edge round them", () => {
		expect(RIBBON_REACH).toBeGreaterThan(PICTURE / 2);
		expect(STICKER / 2 - RIBBON_REACH).toBeGreaterThanOrEqual(1.2);
	});
});

describe("pose", () => {
	it("follows the mock-up's Slot.dc.html for sample badges", () => {
		// In the mock-up's px (96 per inch), rounded as it rounds them.
		const px = (mm: number) => Math.round(mm / MM_PER_PX) + 0;
		const shown = (badgeId: string) => {
			const p = pose(101, badgeId);
			return [px(p.dxMm), px(p.dyMm), Math.round(p.rotateDeg * 10) / 10 + 0];
		};
		expect(shown("distance-1000")).toEqual([4, 9, 0]);
		expect(shown("elevation-5000")).toEqual([-7, 9, 5.1]);
		expect(shown("tour-de-paris-3")).toEqual([-2, 0, -0.7]);
	});

	it("is the same on every call", () => {
		expect(pose(ATHLETE, "distance-100")).toEqual(
			pose(ATHLETE, "distance-100"),
		);
	});

	it("differs between riders and between neighbouring slots", () => {
		expect(pose(101, "distance-100")).not.toEqual(pose(102, "distance-100"));
		expect(pose(101, "distance-100")).not.toEqual(pose(101, "distance-500"));
	});

	it("stays within ±7° and 3.8 mm, y within ±2.5 mm, a miss in about a third", () => {
		const poses = BADGES.flatMap((badge) =>
			[101, 202, 303, 404].map((id) => pose(id, badge.id)),
		);
		let misses = 0;
		for (const p of poses) {
			expect(Math.abs(p.rotateDeg)).toBeLessThanOrEqual(7);
			expect(Math.abs(p.dyMm)).toBeLessThanOrEqual(2.5);
			const dist = Math.hypot(p.dxMm, p.dyMm);
			expect(dist).toBeLessThanOrEqual(3.8);
			if (Math.abs(p.dxMm) > 1.4 || Math.abs(p.dyMm) > 1.4) misses++;
		}
		expect(misses / poses.length).toBeGreaterThan(0.2);
		expect(misses / poses.length).toBeLessThan(0.45);
	});
});
