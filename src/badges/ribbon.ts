// Where the milestone goes on a badge (feature 013 FR-040b, research R19): the
// ribbon's box in badge units (viewBox 0 0 100 100) and its text colour per
// group. The same as RIBBON in scripts/badge-frame.mjs, which draws the band;
// test/unit/badge-ribbon.test.ts keeps them equal.

const box = { x: 13, y: 70, width: 74, height: 14 };

export const BADGE_RIBBON = {
	box,
	text: { personal: "#fbe122", team: "#1c1b13" },
	/** The box as percentages of the badge, for the text placed over the image. */
	percent: { left: box.x, top: box.y, width: box.width, height: box.height },
} as const;

/**
 * The milestone's font size on the ribbon, in percent of the badge's width:
 * as large as fits, by the album's rule of thumb (album/ribbon.ts) of a
 * letter being 0.6 of the size wide, here a little more for the widest
 * system typefaces. Room is the band less its folds at both ends.
 * test/unit/badge-ribbon.test.ts checks every milestone in every language
 * fits at no less than `min`; a longer one needs a shorter word.
 */
export const RIBBON_TEXT = { size: 8.5, min: 5.5, room: 66, letter: 0.62 };

export function ribbonTextSize(text: string): number {
	const { size, min, room, letter } = RIBBON_TEXT;
	const fits = room / (text.length * letter);
	return Math.floor(Math.max(min, Math.min(size, fits)) * 10) / 10;
}
