#!/usr/bin/env node
// Traces each team's Rynke coin artwork into the SVGs the app and print use
// (issue: coin artwork). The founding team's, in art/coin/:
//
//   art/coin/originals/rynke-coin-front.jpeg  -> public/coin/rynke-coin-front.svg
//   art/coin/originals/rynke-coin-back.jpeg   -> public/coin/rynke-coin-back.svg
//   art/coin/reference/rynke-coin-line-drawing.jpeg
//                                             -> art/coin/rynke-coin-line-front.svg
//                                                art/coin/rynke-coin-line-back.svg
//   art/coin/originals/rynke-coin-hero-<n>.png -> public/coin/rynke-coin-hero-<n>.svg
//                                                (art/coin/hero/README.md)
//
// Team Europe's, in art/coin/europe/, stay beside their originals and are
// copied to public/teams/europe/coin/, where only Europe's team data points
// (feature 026 research R14). It shares the portraits, which show only the
// character.
//
// The full-colour originals are snapped to their own palettes (the back needs
// the Elbe, sky, glass and brick the shared coin palette doesn't have), and a
// few regions are recoloured after snapping where the generator got the coin
// wrong (FIXES). The line drawing has both sides side by side; each is cut
// out and traced as ink only, with transparent paper.
//
// Needs ImageMagick and potrace, like pnpm illustrations. Running it again
// without changes changes no file, as long as those tools' versions stay the
// same: a newer ImageMagick redraws the line drawings and the portraits slightly.
import { execFileSync } from "node:child_process";
import {
	mkdtempSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { palette, traceImage } from "./trace.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

// The coin's colours (`--rp-coin-*` in src/http/style.ts), bottom to top.
const FRONT_COLOURS = palette([
	{ name: "cream", hex: "#fffdf5" },
	{ name: "yellow", hex: "#fbe122" },
	{ name: "gold", hex: "#c99a2e" },
	{ name: "fur", hex: "#c8641e" },
	{ name: "muzzle", hex: "#f0a868" },
	{ name: "ink", hex: "#1c1b13" },
]);

const BACK_COLOURS = palette([
	{ name: "cream", hex: "#fffdf5" },
	{ name: "sky", hex: "#a9d6f2" },
	{ name: "glass", hex: "#e8f3fb" },
	{ name: "water", hex: "#3a8fd0" },
	{ name: "brick", hex: "#b5562f" },
	{ name: "quay", hex: "#5e5c55" },
	{ name: "yellow", hex: "#fbe122" },
	{ name: "gold", hex: "#c99a2e" },
	{ name: "ink", hex: "#1c1b13" },
]);

// Team Europe's back: Alpine greys, a yellow road, green grass and firs, and
// the flags' blue and red.
const EUROPE_BACK_COLOURS = palette([
	{ name: "cream", hex: "#fffdf5" },
	{ name: "snow-shade", hex: "#d2dbdf" },
	{ name: "sky", hex: "#9dd0eb" },
	{ name: "rock-light", hex: "#97a3b4" },
	{ name: "rock", hex: "#657686" },
	{ name: "grass", hex: "#a6c778" },
	{ name: "fir", hex: "#4a713e" },
	{ name: "trunk", hex: "#6f5036" },
	{ name: "flag-blue", hex: "#184190" },
	{ name: "flag-red", hex: "#ce223a" },
	{ name: "road", hex: "#fbc63f" },
	{ name: "gold", hex: "#b8923e" },
	{ name: "ink", hex: "#000000" },
]);

const LINE_COLOURS = palette([
	{ name: "paper", hex: "#ffffff" },
	{ name: "ink", hex: "#1c1b13" },
]);

// Recolourings after snapping, in the original's 2048 px: every region of
// one colour wholly inside the box changes colour (see trace.mjs).
const FIXES = {
	// Team Europe's front has the same layout, so the same fixes.
	front: [
		// The team's name in gold like "RYNKE-COIN" on top: the
		// letters in the black ring's lower half, not its two yellow stars.
		{
			box: [0, 1120, 2048, 2048],
			ring: [1024, 1024, 728, 960],
			from: "yellow",
			to: "gold",
		},
		// The banana is yellow, not a white peel.
		{ box: [1340, 490, 1530, 870], from: "cream", to: "yellow" },
		// The handlebar is black, tape, hoods and all, so it reads apart from
		// the yellow frame.
		{ box: [960, 1070, 1470, 1345], from: "yellow", to: "ink" },
		{ box: [960, 1060, 1500, 1360], from: "gold", to: "ink" },
		...["fur", "muzzle"].flatMap((from) => [
			{ box: [1340, 1030, 1500, 1360], from, to: "ink" },
			{ box: [995, 1080, 1070, 1145], from, to: "ink" },
		]),
	],
	back: [],
};

const STAR =
	"M0,-4 L0.94,-1.29 L3.8,-1.24 L1.52,0.49 L2.35,3.24 L0,1.6 L-2.35,3.24 L-1.52,0.49 L-3.8,-1.24 L-0.94,-1.29 Z";

// The European flag's twelve stars on Team Europe's back, in the original's
// 2048 px: at about 10 px each the tracer's smoothing loses them, so they're
// drawn on top.
const EU_STARS = [
	[1108, 443],
	[1086, 445],
	[1130, 450],
	[1070, 460],
	[1146, 467],
	[1065, 481],
	[1152, 489],
	[1070, 503],
	[1146, 510],
	[1086, 520],
	[1130, 524],
	[1108, 529],
]
	.map(([x, y]) => {
		const at = `${((x / 2048) * 100).toFixed(2)} ${((y / 2048) * 100).toFixed(2)}`;
		return `<path fill="#fbc63f" transform="translate(${at}) scale(0.08)" d="${STAR}"/>`;
	})
	.join("");

// One entry per team. `backOverlay` is drawn over the traced back. `lineCoins` has each side's coin in the line drawing:
// [centre x, centre y, radius across, radius down], in its pixels. Everything
// outside it (the dimension lines) is dropped, and an oval coin ends up round.
const TEAMS = [
	{
		art: "art/coin",
		appOut: "public/coin",
		backColours: BACK_COLOURS,
		lineCoins: { front: [688, 672, 576, 576], back: [1921, 657, 584, 584] },
	},
	{
		art: "art/coin/europe",
		appOut: "art/coin/europe",
		publicOut: "public/teams/europe/coin",
		backColours: EUROPE_BACK_COLOURS,
		backOverlay: EU_STARS,
		lineCoins: { front: [736, 703, 615, 626], back: [2053, 703, 622, 626] },
	},
];

function svg(title, source, { height, markup }) {
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${height}">` +
		`<title>${title}</title>` +
		`<!-- Generated by scripts/coin-art.mjs from ${source}; replace that, then run pnpm coin-art. -->` +
		`${markup}</svg>\n`
	);
}

function write(out, content) {
	writeFileSync(join(ROOT, out), content);
	console.log(`${out} (${statSync(join(ROOT, out)).size} bytes)`);
}

for (const { art, appOut, publicOut, backColours, backOverlay = "" } of TEAMS) {
	for (const side of ["front", "back"]) {
		const source = `${art}/originals/rynke-coin-${side}.jpeg`;
		const traced = traceImage(join(ROOT, source), {
			colours: side === "front" ? FRONT_COLOURS : backColours,
			fixes: FIXES[side],
		});
		if (side === "back") traced.markup += backOverlay;
		const content = svg(`Rynke coin, ${side}`, source, traced);
		write(`${appOut}/rynke-coin-${side}.svg`, content);
		if (publicOut) write(`${publicOut}/rynke-coin-${side}.svg`, content);
	}
}

const magick = (() => {
	for (const bin of ["magick", "convert"]) {
		try {
			execFileSync(bin, ["-version"], { stdio: "ignore" });
			return bin;
		} catch {}
	}
	throw new Error("ImageMagick (magick or convert) is required");
})();

const tmp = mkdtempSync(join(tmpdir(), "coin-art-"));
try {
	for (const { art, lineCoins } of TEAMS) {
		const source = `${art}/reference/rynke-coin-line-drawing.jpeg`;
		for (const [side, [cx, cy, rx, ry]] of Object.entries(lineCoins)) {
			const crop = join(tmp, `${side}.png`);
			const width = 2 * rx + 8;
			const height = 2 * ry + 8;
			execFileSync(magick, [
				join(ROOT, source),
				"-crop",
				`${width}x${height}+${cx - width / 2}+${cy - height / 2}`,
				"+repage",
				"-alpha",
				"set",
				"(",
				"+clone",
				"-alpha",
				"transparent",
				"-fill",
				"white",
				"-draw",
				`ellipse ${width / 2},${height / 2} ${rx + 2},${ry + 2} 0,360`,
				")",
				"-compose",
				"DstIn",
				"-composite",
				// Up to the colour originals' canvas, so the thin lines (the
				// Elbphilharmonie's glass) outlast the tracer's smoothing.
				"-resize",
				"2048x2048!",
				crop,
			]);
			const traced = traceImage(crop, {
				colours: LINE_COLOURS,
				omit: ["paper"],
			});
			write(
				`${art}/rynke-coin-line-${side}.svg`,
				svg(`Rynke coin, ${side}, line drawing`, source, traced),
			);
		}
	}
} finally {
	rmSync(tmp, { recursive: true, force: true });
}

// The hero coin (art/coin/hero/README.md): the coin's rim, ring, stars, cream
// face and gold chain, drawn here like the app's sprite (src/http/coin.ts),
// with a generated portrait in the face. The prompt has the portrait inside a
// 1800 px circle of the 2048 px canvas, traced into 100 units: radius 43.95.
// That circle becomes the face (radius 31); the head stays inside the chain,
// the shoulders run over it at the bottom, and the face's edge crops them.
const FACE = 31;
// The front's colours plus the badges' light blue for the sweat drop, below
// ink so the outlines stay on top.
const HERO_COLOURS = palette([
	...FRONT_COLOURS.slice(0, -1),
	{ name: "blue", hex: "#8cc4f0" },
	FRONT_COLOURS[FRONT_COLOURS.length - 1],
]);
const GENERATED_R = (1800 / 2048) * 50;

function heroSvg(source, { markup }, n) {
	const k = Number((FACE / GENERATED_R).toFixed(5));
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
		`<title>Rynke coin, hero ${n}</title>` +
		`<!-- Generated by scripts/coin-art.mjs from ${source}; replace that, then run pnpm coin-art. -->` +
		`<defs><clipPath id="rynke-hero-face-${n}"><circle cx="50" cy="50" r="${FACE}"/></clipPath></defs>` +
		'<circle cx="50" cy="50" r="49" fill="#c99a2e"/>' +
		'<circle cx="50" cy="50" r="45" fill="#1c1b13"/>' +
		`<circle cx="50" cy="50" r="${FACE}" fill="#fffdf5"/>` +
		`<path fill="#fbe122" transform="translate(12 50)" d="${STAR}"/>` +
		`<path fill="#fbe122" transform="translate(88 50)" d="${STAR}"/>` +
		'<circle cx="50" cy="50" r="29" fill="none" stroke="#c99a2e" stroke-width="3" stroke-dasharray="4 2.5"/>' +
		`<g clip-path="url(#rynke-hero-face-${n})"><g transform="translate(50 50) scale(${k}) translate(-50 -50)">${markup}</g></g>` +
		"</svg>\n"
	);
}

// The portraits come as screenshots of different sizes and framings: each is
// trimmed to its figure and set on the prompt's canvas, the helmet's top just
// inside the chain (y 250 of 2048) and the shoulders' bottom just past the
// face's edge (y 1960), centred. `crop` first cuts away anything that isn't
// the picture, like the app toolbar caught in hero 4.
const HERO_TOP = 250;
const HERO_BOTTOM = 1960;
const HERO_CROPS = { 4: "660x700+0+27" };

const heroes = readdirSync(join(ROOT, "art/coin/originals"))
	.map((f) => f.match(/^rynke-coin-hero-(\d+)\.(png|jpe?g)$/))
	.filter((m) => m !== null)
	.sort((a, b) => Number(a[1]) - Number(b[1]));
if (heroes.length === 0) {
	console.log(
		"No art/coin/originals/rynke-coin-hero-<n>.* yet: see art/coin/hero/README.md",
	);
}
const heroTmp = mkdtempSync(join(tmpdir(), "coin-hero-"));
try {
	for (const [file, n] of heroes) {
		const source = `art/coin/originals/${file}`;
		const placed = join(heroTmp, `hero-${n}.png`);
		const crop = HERO_CROPS[n];
		execFileSync(magick, [
			join(ROOT, source),
			...(crop ? ["-crop", crop, "+repage"] : []),
			"-fuzz",
			"12%",
			"-trim",
			"+repage",
			"-resize",
			`x${HERO_BOTTOM - HERO_TOP}`,
			"-background",
			"white",
			"-gravity",
			"north",
			"-splice",
			`0x${HERO_TOP}`,
			"-extent",
			"2048x2048",
			placed,
		]);
		write(
			`public/coin/rynke-coin-hero-${n}.svg`,
			heroSvg(source, traceImage(placed, { colours: HERO_COLOURS }), n),
		);
	}
} finally {
	rmSync(heroTmp, { recursive: true, force: true });
}

// The pictures' hashes for their addresses.
await import("./art-versions.mjs");
