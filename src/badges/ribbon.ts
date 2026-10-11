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
