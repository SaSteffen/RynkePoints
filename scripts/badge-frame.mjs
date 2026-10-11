// The badge frame (feature 013, specs/013-badges-achievements/): drawn in code
// after the project owner's sunflower design in art/badges/reference/, so every
// badge has the same exact frame and only the picture in its window comes from
// the image generator (research R1, R3). No `node:` imports: the tests load it
// in the Workers runtime; badge-build.mjs writes the files.
//
// Proportions measured from the reference (window, ring, petal tips, stars) and
// scaled to a 100-unit badge. Colours are the coin's (`--rp-coin-*`), the same
// in light and dark mode, so a badge is a plain self-contained SVG file; the
// one addition is the sunflower amber of the back petals, from the reference.

const C = {
	ink: "#1c1b13",
	cream: "#fffdf5",
	yellow: "#fbe122",
	gold: "#c99a2e",
	fur: "#c8641e",
	muzzle: "#f0a868",
	team: "#8cc4f0",
	amber: "#f0b400",
};

/** The round window the picture shows through. */
export const WINDOW = { cx: 50, cy: 50, r: 28.7 };
const RING = 36.6;
const PETALS = 22;
const OUTLINE = 0.9;

// Gemini draws the scene inside a 1800 px circle on a 2048 px canvas, traced
// into 100 units: radius 43.95 at (50, 50). This puts that circle on the window
// (research R4).
const GENERATED_R = (1800 / 2048) * 50;
const around = (s) =>
	`translate(50 50) scale(${Number(s.toFixed(5))}) translate(-50 -50)`;
export const PICTURE_TRANSFORM = around(WINDOW.r / GENERATED_R);

/** The coin's Rynke (src/http/coin.ts, front), drawn for its 31-unit face. */
export const RYNKE = `<path class="c-yellow" d="M33,77 Q50,64 67,77 Q60,80 50,80 Q40,80 33,77 Z" stroke-width="1.4"/><circle class="c-fur" cx="34.5" cy="54" r="4.5" stroke-width="1.2"/><circle class="c-fur" cx="65.5" cy="54" r="4.5" stroke-width="1.2"/><circle class="c-fur" cx="50" cy="55" r="15" stroke-width="1.4"/><ellipse class="c-muzzle" cx="50" cy="60" rx="10" ry="7.5"/><ellipse class="c-ink" cx="45" cy="52" rx="1.9" ry="2.2"/><ellipse class="c-ink" cx="55" cy="52" rx="1.9" ry="2.2"/><circle class="c-ink" cx="48.4" cy="58" r="0.9"/><circle class="c-ink" cx="51.6" cy="58" r="0.9"/><path class="c-line" d="M44.5,61.5 Q50,66.5 55.5,61.5" stroke-width="1.5" stroke-linecap="round"/><path class="c-yellow" d="M34,48 Q34,34 50,34 Q66,34 66,48 Z" stroke-width="1.4" stroke-linejoin="round"/><path class="c-line" d="M45,35 L46,41 M55,35 L54,41 M50,34.5 L50,41" stroke-width="1.1" stroke-linecap="round"/>`;
const RYNKE_TRANSFORM = around(WINDOW.r / 31);

/** The coin's classes (`.c-*` in src/http/style.ts) as plain attributes. */
const COIN_CLASSES = {
	"c-yellow": `fill="${C.yellow}" stroke="${C.ink}"`,
	"c-fur": `fill="${C.fur}" stroke="${C.ink}"`,
	"c-muzzle": `fill="${C.muzzle}"`,
	"c-ink": `fill="${C.ink}"`,
	"c-line": `fill="none" stroke="${C.ink}"`,
};
const inline = (markup) =>
	markup.replace(/class="(c-[a-z]+)"/g, (m, c) => COIN_CLASSES[c] ?? m);

const STAR =
	"M0,-4 L0.94,-1.29 L3.8,-1.24 L1.52,0.49 L2.35,3.24 L0,1.6 L-2.35,3.24 L-1.52,0.49 L-3.8,-1.24 L-0.94,-1.29 Z";

const n = (x) => Number(x.toFixed(2));

/** A pointed petal pointing up from radius `base` to radius `tip`, half width `w`. */
function petal(base, tip, w) {
	const y0 = 50 - base;
	const y1 = 50 - tip;
	const len = tip - base;
	return (
		`M50,${n(y0)} C${n(50 + w)},${n(y0 - 0.3 * len)} ${n(50 + 0.55 * w)},${n(y1 + 0.15 * len)} 50,${n(y1)} ` +
		`C${n(50 - 0.55 * w)},${n(y1 + 0.15 * len)} ${n(50 - w)},${n(y0 - 0.3 * len)} 50,${n(y0)} Z`
	);
}
const vein = (base, tip) => {
	const len = tip - base;
	return `M50,${n(50 - base - 0.3 * len)} L50,${n(50 - tip + 0.22 * len)}`;
};

/** One petal (with its vein) defined once; the layer reuses it all round. */
function petalLayer(cls, fill, veinColour, base, tip, w, offset) {
	const def =
		`<g id="${cls}"><path d="${petal(base, tip, w)}" fill="${fill}" stroke="${C.ink}" stroke-width="0.8" stroke-linejoin="round"/>` +
		`<path d="${vein(base, tip)}" fill="none" stroke="${veinColour}" stroke-width="0.6" stroke-linecap="round"/></g>`;
	let uses = "";
	for (let i = 0; i < PETALS; i++) {
		const a = n(offset + (360 / PETALS) * i);
		uses += `<use class="${cls}" href="#${cls}" transform="rotate(${a} 50 50)"/>`;
	}
	return { def, uses };
}

const BACK = petalLayer(
	"petal-back",
	C.amber,
	C.gold,
	33,
	48.3,
	6.4,
	180 / PETALS,
);
const FRONT = petalLayer("petal-front", C.yellow, C.amber, 33, 46.4, 6.2, 0);

/** Three stars in the middle of the ring, at the top. */
const STARS = [-26, 0, 26]
	.map(
		(a) =>
			`<path class="star" transform="rotate(${a} 50 50) translate(50 ${n(50 - (RING + WINDOW.r) / 2)}) scale(0.95)" d="${STAR}" fill="${C.yellow}" stroke="${C.ink}" stroke-width="0.55" stroke-linejoin="round"/>`,
	)
	.join("");

const escapeXml = (s) =>
	String(s).replace(
		/[&<>"]/g,
		(c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
	);

/**
 * The finished badge: petals, ring (black for personal, light blue for team),
 * window, the picture clipped to the window and placed by `transform`, the
 * window's outline and the stars on top.
 */
export function frameSvg(kind, picture, title, transform = PICTURE_TRANSFORM) {
	const ring = kind === "team" ? C.team : C.ink;
	const { cx, cy, r } = WINDOW;
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>${escapeXml(title)}</title>` +
		`<defs><clipPath id="window"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>${BACK.def}${FRONT.def}</defs>` +
		BACK.uses +
		FRONT.uses +
		`<circle class="ring" cx="${cx}" cy="${cy}" r="${RING}" fill="${ring}" stroke="${C.ink}" stroke-width="${OUTLINE}"/>` +
		`<circle class="window" cx="${cx}" cy="${cy}" r="${r}" fill="${C.cream}"/>` +
		`<g clip-path="url(#window)"><g transform="${transform}">${picture}</g></g>` +
		`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.ink}" stroke-width="${OUTLINE}"/>` +
		`${STARS}</svg>\n`
	);
}

/** The frame with the coin's Rynke: the badge until it has a picture (FR-040a). */
export function placeholderSvg(kind) {
	return frameSvg(kind, inline(RYNKE), `placeholder-${kind}`, RYNKE_TRANSFORM);
}
