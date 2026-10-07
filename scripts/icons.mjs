#!/usr/bin/env node
// Draws the Rynke-Coin badge as SVG (public/icons/icon.svg) and renders the
// app icons next to it with rsvg-convert (from librsvg), which isn't a project
// dependency: the outputs are committed and only change with the artwork.
// The lettering is drawn from stroked glyphs below, so no font is needed.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/icons/", import.meta.url));

const C = {
	ink: "#111111",
	gold: "#c8982f",
	yellow: "#fdcb0a",
	banana: "#fcdc3c",
	vent: "#d9a514",
	white: "#ffffff",
	orange: "#e96d2a",
	peach: "#f7a56e",
	brown: "#8a4a24",
};

const r1 = (n) => Math.round(n * 10) / 10;

// Glyph centrelines on a 100-high cap: [width, path].
const GLYPHS = {
	" ": [26, ""],
	"-": [30, "M0 55H30"],
	A: [74, "M0 100L37 0L74 100M15 64H59"],
	B: [55, "M0 50H30A25 25 0 0 1 30 100H0V0H26A25 25 0 0 1 26 50"],
	C: [80, "M80 18A45 50 0 1 0 80 82"],
	E: [52, "M52 0H0V100H52M0 50H44"],
	G: [90, "M80 18A45 50 0 1 0 90 50H56"],
	H: [62, "M0 0V100M62 0V100M0 50H62"],
	I: [0, "M0 0V100"],
	K: [60, "M0 0V100M58 0L6 56M24 38L60 100"],
	M: [84, "M0 100V0L42 64L84 0V100"],
	N: [62, "M0 100V0L62 100V0"],
	O: [90, "M45 0A45 50 0 1 0 45 100A45 50 0 1 0 45 0"],
	R: [60, "M0 100V0H30A25 25 0 0 1 30 50H0M30 50L60 100"],
	T: [64, "M0 0H64M32 0V100"],
	U: [62, "M0 0V69A31 31 0 0 0 62 69V0"],
	Y: [70, "M0 0L35 50L70 0M35 50V100"],
};

// Sets `text` along the circle of radius `radius` around (256, 256), centred
// on the top (letters upright, clockwise) or the bottom (counter-clockwise),
// spread over `span` degrees with caps `height` high.
function arcText(text, { radius, span, height, weight, color, bottom }) {
	const k = height / (100 + weight);
	const glyphs = [...text].map((ch) => {
		const [w, d] = GLYPHS[ch];
		return { w, d, box: d ? w + weight : w };
	});
	const boxes = glyphs.reduce((sum, g) => sum + g.box, 0);
	const room = (((span * Math.PI) / 180) * radius) / k - boxes;
	const tracking = Math.max(0, room / (glyphs.length - 1));
	let cursor = 0;
	const paths = [];
	for (const g of glyphs) {
		const along = ((cursor + g.box / 2) * k) / radius; // radians from start
		cursor += g.box + tracking;
		if (!g.d) continue;
		const start = (span / 2) * (bottom ? 1 : -1);
		const deg = start + ((along * 180) / Math.PI) * (bottom ? -1 : 1);
		const place = bottom
			? `rotate(${r1(deg)}) translate(0 ${radius})`
			: `rotate(${r1(deg)}) translate(0 ${-radius})`;
		paths.push(
			`<path transform="${place} scale(${r1(k * 1000) / 1000}) translate(${-g.w / 2} -50)" d="${g.d}"/>`,
		);
	}
	return `<g transform="translate(256 256)" fill="none" stroke="${color}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round">${paths.join("")}</g>`;
}

function star(cx, cy, outer, inner) {
	const points = [];
	for (let i = 0; i < 10; i++) {
		const a = -Math.PI / 2 + (i * Math.PI) / 5;
		const r = i % 2 ? inner : outer;
		points.push(`${r1(cx + r * Math.cos(a))},${r1(cy + r * Math.sin(a))}`);
	}
	return `<polygon points="${points.join(" ")}" fill="${C.gold}" stroke="${C.gold}" stroke-width="2" stroke-linejoin="round"/>`;
}

// An outlined tube: ink underneath, colour on top.
const tube = (d, color, outer, inner) =>
	`<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="${outer}" stroke-linecap="round" stroke-linejoin="round"/>` +
	`<path d="${d}" fill="none" stroke="${color}" stroke-width="${inner}" stroke-linecap="round" stroke-linejoin="round"/>`;

const shape = (d, color) =>
	`<path d="${d}" fill="${color}" stroke="${C.ink}" stroke-width="11" stroke-linejoin="round"/>`;

const ring = (cx, cy, r, color, outer, inner) =>
	`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.ink}" stroke-width="${outer}"/>` +
	`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${inner}"/>`;

const HELMET =
	"M238 128C232 70 280 28 345 28C410 28 455 70 450 128C380 118 310 118 238 128Z";
const HEAD =
	"M345 85C410 85 452 130 452 195C452 265 410 315 345 315C280 315 238 265 238 195C238 130 280 85 345 85Z";
const SMILE = "M310 228Q350 260 400 230";
const BODY =
	"M200 215C140 235 105 300 102 380C100 440 125 495 185 505L265 510C300 505 315 470 300 440L290 410L395 385L470 300L440 260Z";

// The helmeted head, on the rider's grid.
function head() {
	return [
		`<circle cx="243" cy="168" r="30" fill="${C.orange}" stroke="${C.ink}" stroke-width="11"/><circle cx="243" cy="168" r="14" fill="${C.peach}"/>`,
		`<circle cx="447" cy="168" r="30" fill="${C.orange}" stroke="${C.ink}" stroke-width="11"/><circle cx="447" cy="168" r="14" fill="${C.peach}"/>`,
		shape(HEAD, C.orange),
		`<path d="M345 135C372 125 410 130 418 160C424 185 420 205 425 232C430 275 395 300 345 300C295 300 260 275 265 232C270 205 266 185 272 160C280 130 318 125 345 135Z" fill="${C.peach}"/>`,
		`<circle cx="325" cy="158" r="10" fill="${C.ink}"/><circle cx="385" cy="158" r="10" fill="${C.ink}"/>`,
		`<ellipse cx="350" cy="192" rx="7" ry="5" fill="${C.brown}"/><ellipse cx="372" cy="192" rx="7" ry="5" fill="${C.brown}"/>`,
		`<path d="${SMILE}" fill="none" stroke="${C.brown}" stroke-width="9" stroke-linecap="round"/>`,
		shape(HELMET, C.yellow),
		`<path d="M292 52L280 92M330 40L324 84M370 40L376 84M408 54L420 92" stroke="${C.vent}" stroke-width="12" stroke-linecap="round"/>`,
	].join("");
}

// The rider, drawn on an 800 × 800 grid; badge() fits it into the white disc.
function rider() {
	return [
		tube("M300 480L365 525L340 612", C.orange, 64, 44),
		ring(150, 665, 95, C.yellow, 34, 16),
		ring(500, 665, 95, C.yellow, 34, 16),
		`<circle cx="150" cy="665" r="10" fill="${C.ink}"/><circle cx="500" cy="665" r="10" fill="${C.ink}"/>`,
		tube(
			"M150 665L300 680L440 545L425 500L250 520L300 680M250 520L150 665M440 545L500 665",
			C.yellow,
			32,
			16,
		),
		tube(
			"M425 500L428 455M395 455H515A30 30 0 0 1 515 515H502",
			C.yellow,
			32,
			16,
		),
		`<circle cx="300" cy="680" r="17" fill="${C.ink}"/>`,
		`<path d="M300 680L262 712" stroke="${C.ink}" stroke-width="14" stroke-linecap="round"/>`,
		tube("M215 490L235 700", C.orange, 82, 62),
		shape(
			"M200 718C200 698 225 690 250 692C285 694 300 708 298 724C296 740 270 745 245 744C215 743 200 735 200 718Z",
			C.peach,
		),
		tube("M440 330L535 340Q578 320 605 275", C.orange, 74, 54),
		shape(
			"M552 98C612 125 658 205 627 292C617 312 588 306 592 286C608 225 585 170 540 120C532 110 540 95 552 98Z",
			C.banana,
		),
		shape(
			"M575 238C578 216 600 212 608 228L632 224C654 222 658 256 648 274C638 292 605 294 590 282C575 272 572 252 575 238Z",
			C.peach,
		),
		`<path d="M604 240C616 246 622 260 618 272" fill="none" stroke="${C.ink}" stroke-width="8" stroke-linecap="round"/>`,
		`<clipPath id="body"><path d="${BODY}"/></clipPath>`,
		`<path d="${BODY}" fill="${C.yellow}"/>`,
		`<g clip-path="url(#body)"><path d="M100 330H480V368H100Z" fill="${C.white}" stroke="${C.ink}" stroke-width="11"/><path d="M100 392Q170 405 300 398" fill="none" stroke="${C.ink}" stroke-width="11"/></g>`,
		`<path d="${BODY}" fill="none" stroke="${C.ink}" stroke-width="11" stroke-linejoin="round"/>`,
		tube("M180 300L205 420Q215 455 260 460L345 462", C.orange, 74, 54),
		shape(
			"M150 280C175 262 215 266 232 290L240 338C205 346 170 346 140 340C135 318 138 296 150 280Z",
			C.yellow,
		),
		shape(
			"M345 432C365 425 395 430 405 450C412 470 400 490 375 492C352 494 338 480 338 462C338 448 338 437 345 432Z",
			C.peach,
		),
		head(),
	].join("");
}

// The whole badge on a 512 × 512 canvas, transparent outside the coin.
function badge() {
	return [
		`<circle cx="256" cy="256" r="245" fill="${C.ink}"/>`,
		`<circle cx="256" cy="256" r="237" fill="none" stroke="${C.gold}" stroke-width="11.5"/>`,
		`<circle cx="256" cy="256" r="152" fill="${C.white}" stroke="${C.gold}" stroke-width="9"/>`,
		arcText("RYNKE-COIN", {
			radius: 196,
			span: 110,
			height: 45,
			weight: 28,
			color: C.gold,
		}),
		arcText("TEAM RYNKEBY HAMBURG", {
			radius: 196,
			span: 150,
			height: 33,
			weight: 30,
			color: C.yellow,
			bottom: true,
		}),
		star(60, 256, 18, 7.5),
		star(452, 256, 18, 7.5),
		`<g transform="translate(132.9 108) scale(0.361)">${rider()}</g>`,
	].join("");
}

const svg = (body, size = 512) =>
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">${body}</svg>\n`;

// Scaled around the centre, on an opaque background (maskable, iOS).
const framed = (scale) =>
	svg(
		`<rect width="512" height="512" fill="${C.white}"/><g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${badge()}</g>`,
	);

// Favicon: the full badge is unreadable at 16–32 px, so only the head on the
// coin.
const favicon = svg(
	`<title>Rynke-Coin</title><!-- Generated by scripts/icons.mjs; edit that, then run pnpm icons. -->` +
		`<circle cx="32" cy="32" r="31" fill="${C.ink}"/><circle cx="32" cy="32" r="28" fill="${C.white}" stroke="${C.gold}" stroke-width="3"/>` +
		`<g transform="translate(32 34) scale(0.155) translate(-345 -172)">${head()}</g>`,
	64,
);

// Android status bar badge: only the alpha channel counts, so white on
// transparent — the coin's rim around the helmeted head.
const HEAD_96 = "translate(48 51) scale(0.2) translate(-345 -170)";
const mono = svg(
	`<mask id="face"><rect width="96" height="96" fill="#fff"/><g transform="${HEAD_96}" fill="none" stroke="#000" stroke-linecap="round"><circle cx="325" cy="158" r="7" stroke-width="14"/><circle cx="385" cy="158" r="7" stroke-width="14"/><path d="${SMILE}" stroke-width="14"/><path d="M238 128C310 118 380 118 450 128" stroke-width="12"/></g></mask>` +
		`<circle cx="48" cy="48" r="44" fill="none" stroke="#fff" stroke-width="7"/>` +
		`<g mask="url(#face)"><g transform="${HEAD_96}" fill="#fff"><path d="${HEAD}"/><circle cx="243" cy="168" r="30"/><circle cx="447" cy="168" r="30"/><path d="${HELMET}"/></g></g>`,
	96,
);

function png(name, size, source) {
	execFileSync("rsvg-convert", ["-w", size, "-h", size, "-o", OUT + name], {
		input: source,
	});
}

const icon = svg(
	`<title>Rynke-Coin</title><!-- Generated by scripts/icons.mjs; edit that, then run pnpm icons. -->${badge()}`,
);
writeFileSync(`${OUT}icon.svg`, icon);
writeFileSync(`${OUT}favicon.svg`, favicon);
png("icon-192.png", "192", icon);
png("icon-512.png", "512", icon);
png("icon-maskable-512.png", "512", framed(0.8));
png("apple-touch-icon.png", "180", framed(0.92));
png("badge-96.png", "96", mono);
