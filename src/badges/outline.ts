// The outline of a badge still to earn (feature 013 Part G): a round badge
// with the milestone ribbon across it, the band and both tails, without the
// picture or the petals. The ribbon is RIBBON's in scripts/badge-frame.mjs,
// which draws the badges; test/unit/badge-outline.test.ts keeps them equal.

import { BADGE_RIBBON } from "./ribbon";

/** The ribbon's tails, from the centre out and down from the band's top. */
export const BADGE_RIBBON_TAIL = {
	inner: 34,
	outer: 47,
	notch: 43,
	top: 3,
	bottom: 16,
} as const;

/** The gallery's round edge: as far out as the badge's petals reach. */
export const BADGE_OUTLINE_RADIUS = 47;

/**
 * The card outline's circle: a little smaller, so the ribbon's tails stand
 * out from it as on a badge, where the band crosses the petals.
 */
export const BADGE_SHAPE_RADIUS = 42;

function tail(dir: 1 | -1): string {
	const { y } = BADGE_RIBBON.box;
	const { inner, outer, notch, top, bottom } = BADGE_RIBBON_TAIL;
	const x0 = 50 + dir * inner;
	const x1 = 50 + dir * outer;
	const xn = 50 + dir * notch;
	const middle = (top + bottom) / 2;
	return `<path d="M${x0},${y + top} L${x1},${y + top} L${xn},${y + middle} L${x1},${y + bottom} L${x0},${y + bottom} Z"/>`;
}

const { x, y, width, height } = BADGE_RIBBON.box;

/**
 * The shape once per page, for every outline to use: the circle, the tails
 * and the band. No colour of its own, so each `<use>` gives it its stroke or
 * fill.
 */
export const BADGE_SHAPE_DEFS =
	`<svg class="badge-shape-defs" width="0" height="0" aria-hidden="true"><defs>` +
	`<circle id="badge-circle" cx="50" cy="50" r="${BADGE_OUTLINE_RADIUS}"/>` +
	`<g id="badge-shape"><circle cx="50" cy="50" r="${BADGE_SHAPE_RADIUS}"/>` +
	`${tail(-1)}${tail(1)}<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="1.5"/></g>` +
	`</defs></svg>`;

/**
 * One outline: only the shape's outer edge, the circle and ribbon as one
 * silhouette. The shape is drawn twice, a dashed stroke and over it a fill in
 * the ground's colour, which covers the inner half of every stroke, so the
 * band's own edges inside the circle don't show.
 */
export const BADGE_OUTLINE = `<svg class="badge-outline" viewBox="0 0 100 100" aria-hidden="true"><use href="#badge-shape" class="badge-outline-edge"/><use href="#badge-shape" class="badge-outline-fill"/></svg>`;

/**
 * The gallery's outline, where the badges have no ribbon: the dashed circle
 * alone.
 */
export const BADGE_OUTLINE_PLAIN = `<svg class="badge-outline badge-outline-plain" viewBox="0 0 100 100" aria-hidden="true"><use href="#badge-circle" class="badge-outline-edge"/></svg>`;
