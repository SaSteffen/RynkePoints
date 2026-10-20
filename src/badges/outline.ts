// The outline of a badge still to earn (feature 013 Part G): a round badge
// with the milestone ribbon across it, the band and both tails, without the
// picture or the petals. And the ribbon itself, which the page draws over an
// earned badge's picture (issue #180), so each badge is one file. The ribbon
// is RIBBON's in scripts/badge-frame.mjs; test/unit/badge-outline.test.ts
// keeps them equal.

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

function tail(dir: 1 | -1, attributes = ""): string {
	const { y } = BADGE_RIBBON.box;
	const { inner, outer, notch, top, bottom } = BADGE_RIBBON_TAIL;
	const x0 = 50 + dir * inner;
	const x1 = 50 + dir * outer;
	const xn = 50 + dir * notch;
	const middle = (top + bottom) / 2;
	return `<path d="M${x0},${y + top} L${x1},${y + top} L${xn},${y + middle} L${x1},${y + bottom} L${x0},${y + bottom} Z"${attributes}/>`;
}

const { x, y, width, height } = BADGE_RIBBON.box;

/** The band's colour: the ring's, black for personal and light blue for team. */
export const BADGE_RIBBON_FILL = {
	personal: "#1c1b13",
	team: "#8cc4f0",
} as const;

/**
 * The ribbon as the badge frame drew it into the picture: both tails, then
 * the band, outlined in ink. No fill of its own: each `<use>` gives it the
 * group's.
 */
export const BADGE_RIBBON_TAILS =
	tail(-1, ' stroke-width="0.9" stroke-linejoin="round"') +
	tail(1, ' stroke-width="0.9" stroke-linejoin="round"');
/** The band, which covers the tails' inner ends. */
export const BADGE_RIBBON_BAND = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="1.5" stroke-width="1"/>`;
export const BADGE_RIBBON_SHAPES = BADGE_RIBBON_TAILS + BADGE_RIBBON_BAND;

/** The ribbon over an earned badge's picture, in its group's colour. */
export function badgeRibbon(group: keyof typeof BADGE_RIBBON_FILL): string {
	return `<svg class="badge-ribbon" viewBox="0 0 100 100" aria-hidden="true"><use href="#badge-ribbon" fill="${BADGE_RIBBON_FILL[group]}"/></svg>`;
}

/**
 * The ribbon's silhouette as an image, for the shine's mask: with the
 * picture's, the shine sweeps over the ribbon too.
 */
export const BADGE_RIBBON_MASK = `url("data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g stroke="#000">${BADGE_RIBBON_SHAPES}</g></svg>`,
)}")`;

/**
 * The shapes once per page: for every outline the circle, the tails and the
 * band, with no colour of their own, so each `<use>` gives them their stroke
 * or fill; and the earned badges' ribbon.
 */
export const BADGE_SHAPE_DEFS =
	`<svg class="badge-shape-defs" width="0" height="0" aria-hidden="true"><defs>` +
	`<circle id="badge-circle" cx="50" cy="50" r="${BADGE_OUTLINE_RADIUS}"/>` +
	`<g id="badge-shape"><circle cx="50" cy="50" r="${BADGE_SHAPE_RADIUS}"/>` +
	`${tail(-1)}${tail(1)}<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="1.5"/></g>` +
	`<g id="badge-ribbon" stroke="#1c1b13">${BADGE_RIBBON_SHAPES}</g>` +
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
