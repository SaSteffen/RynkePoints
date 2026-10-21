// The milestone ribbon on an earned sticker: the app's ribbon (src/badges/
// outline.ts) with its milestone, "1.000 km", in the group's colours, and on
// the ribbon alone a gloss and glitter, as on a shiny sticker. All vector
// shapes and gradients, no `filter` and no image, so the PDF keeps them sharp
// (FR-054). Units are the badge's (viewBox 0 0 100 100), over the picture.

import type { BadgeGroup } from "../src/badges/catalog";
import {
	BADGE_RIBBON_BAND,
	BADGE_RIBBON_FILL,
	BADGE_RIBBON_TAILS,
} from "../src/badges/outline";
import { BADGE_RIBBON } from "../src/badges/ribbon";
import { html, SafeHtml } from "../src/http/html";
import { seededRandom } from "./layout";

const { x, y, width, height } = BADGE_RIBBON.box;
/** The ribbon with its tails, which reach 3 units further down. */
const AREA = { left: 3, right: 97, top: y, bottom: y + height + 2 };

/** The milestone's size, smaller for a long one; never under 7 pt. */
const TEXT_SIZE = 7.6;
const TEXT_MIN = 6.2;
const TEXT_ROOM = width - 8;
/** About Nunito Black's average letter, in em. */
const LETTER = 0.6;

const GLITTER = {
	personal: ["#fbe122", "#fff7c2", "#ffffff", "#e0b84a"],
	team: ["#ffffff", "#e8f3fb", "#fffdf5", "#fbe122"],
} as const;

/** Once per document: the ribbon's outline to clip to, and the gloss. */
export const RIBBON_DEFS = new SafeHtml(
	`<svg class="ribbon-defs" width="0" height="0" aria-hidden="true"><defs>` +
		`<clipPath id="ribbon-clip-tails" clipPathUnits="userSpaceOnUse">${BADGE_RIBBON_TAILS}</clipPath>` +
		`<clipPath id="ribbon-clip-band" clipPathUnits="userSpaceOnUse">${BADGE_RIBBON_BAND}</clipPath>` +
		`<linearGradient id="ribbon-gloss" gradientUnits="userSpaceOnUse" x1="0" y1="${y}" x2="0" y2="${y + height}">` +
		`<stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>` +
		`<stop offset="0.4" stop-color="#ffffff" stop-opacity="0.16"/>` +
		`<stop offset="0.52" stop-color="#ffffff" stop-opacity="0"/>` +
		`<stop offset="1" stop-color="#1c1b13" stop-opacity="0.18"/>` +
		`</linearGradient></defs></svg>`,
);

const round = (value: number) => Math.round(value * 100) / 100;

/** A four-pointed sparkle around (cx, cy). */
function sparkle(cx: number, cy: number, arm: number): string {
	const w = arm * 0.22;
	return `M${round(cx)},${round(cy - arm)} L${round(cx + w)},${round(cy - w)} L${round(cx + arm)},${round(cy)} L${round(cx + w)},${round(cy + w)} L${round(cx)},${round(cy + arm)} L${round(cx - w)},${round(cy + w)} L${round(cx - arm)},${round(cy)} L${round(cx - w)},${round(cy - w)} Z`;
}

/**
 * The glitter: fine specks and a few sparkles, the same on every copy of a
 * badge, as printed on the sticker sheet (from the badge alone).
 */
export function glitter(badgeId: string, group: BadgeGroup): string {
	const rnd = seededRandom(`glitter:${badgeId}`);
	const colours = GLITTER[group];
	const at = () => ({
		cx: AREA.left + rnd() * (AREA.right - AREA.left),
		cy: AREA.top + rnd() * (AREA.bottom - AREA.top),
		fill: colours[Math.floor(rnd() * colours.length)],
		opacity: round(0.45 + rnd() * 0.5),
	});
	const specks = Array.from({ length: 110 }, () => {
		const { cx, cy, fill, opacity } = at();
		return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(0.22 + rnd() * 0.35)}" fill="${fill}" fill-opacity="${opacity}"/>`;
	});
	const sparkles = Array.from({ length: 7 }, () => {
		const { cx, cy, fill } = at();
		return `<path d="${sparkle(cx, cy, 1.1 + rnd() * 1.1)}" fill="${fill}"/>`;
	});
	return specks.join("") + sparkles.join("");
}

/** The milestone's font size: as large as fits on the band. */
export function textSize(text: string): number {
	return round(
		Math.max(TEXT_MIN, Math.min(TEXT_SIZE, TEXT_ROOM / (text.length * LETTER))),
	);
}

/**
 * One part of the ribbon, the tails or the band: filled and outlined, the
 * glitter and gloss clipped to it, its ink edge again on top. The band comes
 * second and covers the tails' inner ends, edges and all.
 */
function part(
	shapes: string,
	clip: "tails" | "band",
	fill: string,
	shine: string,
): string {
	return `<g stroke="#1c1b13" fill="${fill}">${shapes}</g><g clip-path="url(#ribbon-clip-${clip})">${shine}</g><g stroke="#1c1b13" fill="none">${shapes}</g>`;
}

/** The ribbon over a sticker's picture, with its milestone on it. */
export function ribbon(
	badgeId: string,
	group: BadgeGroup,
	text: string,
): SafeHtml {
	const fill = BADGE_RIBBON_FILL[group];
	const size = textSize(text);
	// A long word on the smallest size is squeezed to fit, not cut.
	const squeeze =
		text.length * LETTER * size > TEXT_ROOM
			? ` textLength="${TEXT_ROOM}" lengthAdjust="spacingAndGlyphs"`
			: "";
	const shine = `${glitter(badgeId, group)}<rect x="${AREA.left}" y="${y}" width="${AREA.right - AREA.left}" height="${AREA.bottom - y}" fill="url(#ribbon-gloss)"/>`;
	const highlight = `<rect x="${x + 2}" y="${y + 1}" width="${width - 4}" height="1.2" rx="0.6" fill="#ffffff" fill-opacity="0.45"/>`;
	const shapes = new SafeHtml(
		part(BADGE_RIBBON_TAILS, "tails", fill, shine) +
			part(BADGE_RIBBON_BAND, "band", fill, shine + highlight),
	);
	return html`<svg class="ribbon" viewBox="0 0 100 100" aria-hidden="true">${shapes}<text x="50" y="${y + height / 2}" text-anchor="middle" dominant-baseline="central" font-size="${size}" fill="${BADGE_RIBBON.text[group]}" stroke="${fill}" stroke-width="1.3" stroke-linejoin="round" paint-order="stroke"${new SafeHtml(squeeze)}>${text}</text></svg>`;
}
