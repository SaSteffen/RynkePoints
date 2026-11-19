#!/usr/bin/env node
// Draft line drawings of the coin for the German Team Rynkeby teams
// (art/coin/teams/README.md), made from Hamburg's line drawing so the whole
// set looks like one family:
//
//   front: Hamburg's front, its lower lettering wiped and the team's name set
//          in its place ("TEAM RYNKEBY <NAME>"); Rynke stays identical.
//   back:  the team's generated scene, art/coin/teams/originals/coin-<team>.*
//          (pnpm badge-art coin-<team>), with "<NAME> • PARIS" set on top.
//
// Both are traced like Hamburg's line drawing, ink only on transparent paper,
// into art/coin/teams/<team>/rynke-coin-line-{front,back}.svg. A team without
// a generated back yet gets only its front.
//
// It also writes the reference the generator gets for every back:
// Hamburg's back with its lettering and its own scene wiped, the frame, the
// climb, the Eiffel Tower and the bottom icons kept
// (art/coin/teams/reference/coin-back-blank.png).
//
// The lettering is set here, not drawn by the generator: it spells every name
// right and fits any length. It follows Hamburg's letters (hollow, rounded,
// Nunito Black from album/fonts) on the same arcs and shrinks only when a
// name won't fit; on the front, a long name takes the two stars' room first.
// Chromium (Playwright's, as for the e2e tests) sets it, ImageMagick and
// potrace do the rest, like pnpm coin-art.
//
//   pnpm team-coins                every team
//   pnpm team-coins berlin muenchen  only these teams (ids without "coin-")
import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateCoins } from "./quote-prompts.mjs";
import { palette, traceImage } from "./trace.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIR = "art/coin/teams";
const HAMBURG = "art/coin/reference/rynke-coin-line-drawing.jpeg";
const BLANK_BACK = `${DIR}/reference/coin-back-blank.png`;
const FONT = "album/fonts/Nunito-Black.woff2";

// Every side is set on a 2048 px canvas, the coin centred with radius R.
const SIZE = 2048;
const C = SIZE / 2;
const R = 960;
// Hamburg's coins in its line drawing: [centre x, centre y, radius], in its
// pixels (as in coin-art.mjs).
const HAMBURG_COINS = { front: [688, 672, 576], back: [1921, 657, 584] };

// Hamburg's lettering band on the canvas: between the chain (front) or the
// arc line (back) and the inner ring, centred at radius 810. The letters'
// size and the arcs' room are Hamburg's: "TEAM RYNKEBY HAMBURG" spans about
// 148° between the stars, "HAMBURG · PARIS" about 118° between the arc
// line's ends and the Eiffel Tower's tip.
const BAND = { inner: 716, outer: 902, centre: 808 };
const FONT_SIZE = { front: 175, back: 175 };
// The back's arc line under the lettering: radius, and where it ends, in px
// above the centre.
const ARC = { r: 699, end: 205 };
const SPAN = { front: 166, frontNoStars: 196, back: 122 };
const STARS = [
	[C - 800, C],
	[C + 800, C],
];

const LINE_COLOURS = palette([
	{ name: "paper", hex: "#ffffff" },
	{ name: "ink", hex: "#1c1b13" },
]);

const coins = JSON.parse(readFileSync(join(ROOT, DIR, "coins.json"), "utf8"));
const problems = validateCoins(coins);
if (problems.length > 0) {
	console.error(`${DIR}/coins.json is not valid:\n  ${problems.join("\n  ")}`);
	process.exit(2);
}
const wanted = process.argv.slice(2);
const teams = coins.coins
	.map((coin) => ({ ...coin, team: coin.id.replace(/^coin-/, "") }))
	.filter(({ team }) => wanted.length === 0 || wanted.includes(team));
for (const team of wanted)
	if (!teams.some((t) => t.team === team)) {
		console.error(`No coin for ${team} in ${DIR}/coins.json`);
		process.exit(2);
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

const tmp = mkdtempSync(join(tmpdir(), "team-coins-"));
const { chromium } = await import("@playwright/test");
const browser = await chromium.launch();
const page = await browser.newPage({
	viewport: { width: SIZE, height: SIZE },
	deviceScaleFactor: 1,
});
const font = readFileSync(join(ROOT, FONT)).toString("base64");

try {
	// Hamburg's two sides on the canvas, everything outside the coin (the
	// dimension lines) dropped.
	const hamburg = {};
	for (const [side, [x, y, r]] of Object.entries(HAMBURG_COINS)) {
		const crop = Math.round((r * SIZE) / R);
		hamburg[side] = join(tmp, `hamburg-${side}.png`);
		execFileSync(magick, [
			join(ROOT, HAMBURG),
			"-crop",
			`${crop}x${crop}+${x - crop / 2}+${y - crop / 2}`,
			"+repage",
			"-resize",
			`${SIZE}x${SIZE}!`,
			// Pure ink and paper: the scan's faint grey ghosts go.
			"-colorspace",
			"gray",
			"-threshold",
			"55%",
			...outsideCoinWhite(),
			hamburg[side],
		]);
	}

	mkdirSync(join(ROOT, DIR, "reference"), { recursive: true });
	await compose(hamburg.back, join(ROOT, BLANK_BACK), {
		wipe: [backBand(), backScene()],
		draw: backArc(),
	});
	console.log(`${BLANK_BACK} (${statSync(join(ROOT, BLANK_BACK)).size} bytes)`);

	for (const { team, name, id } of teams) {
		const out = `${DIR}/${team}`;
		mkdirSync(join(ROOT, out), { recursive: true });
		const upper = name.toUpperCase();

		const front = join(tmp, `${team}-front.png`);
		const frontSpan = await compose(hamburg.front, front, {
			wipe: [frontBand()],
			text: { side: "front", words: `TEAM RYNKEBY ${upper}` },
		});
		trace(front, `${out}/rynke-coin-line-front.svg`, `${name}, front`, HAMBURG);
		console.log(`  front lettering: ${fitNote(frontSpan)}`);

		const original = originalOf(id);
		if (!original) {
			console.log(`${id}: no generated back yet (pnpm badge-art ${id})`);
			continue;
		}
		const placed = join(tmp, `${team}-back-placed.png`);
		execFileSync(magick, [
			join(ROOT, original),
			"-colorspace",
			"gray",
			"-fuzz",
			"12%",
			"-trim",
			"+repage",
			"-resize",
			`${2 * R}x${2 * R}!`,
			"-background",
			"white",
			"-gravity",
			"center",
			"-extent",
			`${SIZE}x${SIZE}`,
			"-threshold",
			"55%",
			...outsideCoinWhite(),
			placed,
		]);
		const back = join(tmp, `${team}-back.png`);
		const backSpan = await compose(placed, back, {
			wipe: [backBand()],
			text: { side: "back", words: `${upper} • PARIS` },
		});
		trace(back, `${out}/rynke-coin-line-back.svg`, `${name}, back`, original);
		console.log(`  back lettering: ${fitNote(backSpan)}`);
	}
} finally {
	await browser.close();
	rmSync(tmp, { recursive: true, force: true });
}

/** ImageMagick arguments that paint everything outside the coin white. */
function outsideCoinWhite() {
	return [
		"(",
		"+clone",
		"-fill",
		"white",
		"-colorize",
		"100",
		"-fill",
		"black",
		"-draw",
		`circle ${C},${C} ${C + R + 14},${C}`,
		")",
		"-compose",
		"Lighten",
		"-composite",
	];
}

/** The generated back for `id` in originals/, any image type. */
function originalOf(id) {
	try {
		const file = readdirSync(join(ROOT, DIR, "originals")).find((f) =>
			f.startsWith(`${id}.`),
		);
		return file && `${DIR}/originals/${file}`;
	} catch {
		return undefined;
	}
}

// White areas painted over a side before the lettering, as SVG.
function annulus(inner, outer) {
	const ring = (r) =>
		`M${C - r},${C}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
	return `<path fill-rule="evenodd" d="${ring(outer)}${ring(inner)}"/>`;
}
/** Hamburg's lower lettering, below the stars. */
function frontBand() {
	return `<g clip-path="url(#below)">${annulus(BAND.inner + 2, BAND.outer - 2)}</g>`;
}
/** The lettering band above the back's arc line, clear of the Eiffel Tower's tip. */
function backBand() {
	return `<g clip-path="url(#above)">${annulus(BAND.inner + 8, BAND.outer - 4)}</g>`;
}
/** Hamburg's own scene: the Elbphilharmonie, the cranes and the Elbe, left of the riders. */
function backScene() {
	return (
		`<g clip-path="url(#inside-arc)"><rect x="0" y="0" width="1145" height="1335"/></g>` +
		`<g clip-path="url(#inside-ring)"><rect x="0" y="${C - ARC.end + 10}" width="1145" height="${1335 - C + ARC.end - 10}"/>` +
		`<rect x="0" y="1335" width="1100" height="258"/></g>` +
		// The Elbphilharmonie's quay, reaching under the first rider.
		`<rect x="1100" y="1290" width="115" height="53"/>` +
		`<rect x="1095" y="1340" width="45" height="25"/>` +
		`<rect x="1208" y="1318" width="38" height="22"/>`
	);
}
/** The arc line, drawn again whole where the wiping cut into it. */
function backArc() {
	const x = Math.sqrt(ARC.r ** 2 - ARC.end ** 2);
	return `<path fill="none" stroke="#1c1b13" stroke-width="8" d="M${C - x},${C - ARC.end}A${ARC.r},${ARC.r} 0 0,1 ${C + x},${C - ARC.end}"/>`;
}

/**
 * Sets `base` on the canvas in Chromium, paints the `wipe` areas white and
 * sets the lettering, then saves the page as `out`.
 */
async function compose(base, out, { wipe = [], draw = "", text } = {}) {
	const image = readFileSync(base).toString("base64");
	const html = `<!doctype html><html><head><style>
@font-face { font-family: Coin; src: url(data:font/woff2;base64,${font}) format("woff2"); }
html, body { margin: 0; background: white; }
svg { display: block; }
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
<defs>
<clipPath id="below"><rect x="0" y="${C + 95}" width="${SIZE}" height="${SIZE}"/></clipPath>
<clipPath id="above"><rect x="0" y="0" width="${SIZE}" height="${C - 375}"/></clipPath>
<clipPath id="inside-arc"><circle cx="${C}" cy="${C}" r="${ARC.r + 14}"/></clipPath>
<clipPath id="inside-ring"><circle cx="${C}" cy="${C}" r="898"/></clipPath>
</defs>
<image href="data:image/png;base64,${image}" width="${SIZE}" height="${SIZE}"/>
<g fill="white">${wipe.join("")}</g>
${draw}
<g id="stars-wipe" fill="white"></g>
<g id="lettering"></g>
</svg></body></html>`;
	await page.setContent(html);
	let fit;
	if (text) {
		fit = await page.evaluate(setLettering, {
			...text,
			size: FONT_SIZE[text.side],
			span: SPAN,
			band: BAND,
			stars: STARS,
			c: C,
		});
	}
	await page.screenshot({
		path: out,
		clip: { x: 0, y: 0, width: SIZE, height: SIZE },
	});
	return fit;
}

function fitNote({ degrees, scale, stars }) {
	return (
		`${Math.round(degrees)}°` +
		(scale < 1 ? `, letters at ${Math.round(scale * 100)}%` : "") +
		(stars ? "" : ", without the stars")
	);
}

/** In the page: sets `words` round the arc, sized to fit (see SPAN). */
async function setLettering({ side, words, size, span, band, stars, c }) {
	await document.fonts.load(`${size}px Coin`);
	const ns = "http://www.w3.org/2000/svg";
	const g = document.getElementById("lettering");
	const capHeight = 0.705;
	const bottom = side === "front";

	const make = (fontSize) => {
		g.replaceChildren();
		// Bottom text runs anticlockwise through the bottom with its baseline
		// outside, top text clockwise through the top with its baseline inside:
		// both upright, centred on the band.
		const r = band.centre + ((bottom ? 1 : -1) * capHeight * fontSize) / 2;
		const a = (Math.PI / 180) * 30;
		const x = r * Math.cos(a);
		const y = r * Math.sin(a) * (bottom ? -1 : 1);
		const path = document.createElementNS(ns, "path");
		path.id = "arc";
		path.setAttribute(
			"d",
			`M${c - x},${c + y}A${r},${r} 0 1,${bottom ? 0 : 1} ${c + x},${c + y}`,
		);
		path.setAttribute("fill", "none");
		g.append(path);
		for (const [stroke, width, fill] of [
			["white", 34, "white"],
			["#1c1b13", 9, "white"],
		]) {
			const t = document.createElementNS(ns, "text");
			t.setAttribute("font-family", "Coin");
			t.setAttribute("font-size", String(fontSize));
			t.setAttribute("letter-spacing", String(fontSize * 0.02));
			t.setAttribute("fill", fill);
			t.setAttribute("stroke", stroke);
			t.setAttribute("stroke-width", String(width));
			t.setAttribute("stroke-linejoin", "round");
			const tp = document.createElementNS(ns, "textPath");
			tp.setAttribute("href", "#arc");
			tp.setAttribute("startOffset", "50%");
			tp.setAttribute("text-anchor", "middle");
			tp.textContent = words;
			t.append(tp);
			g.append(t);
		}
		const length = g.querySelector("text").getComputedTextLength();
		return (length / r) * (180 / Math.PI);
	};

	let degrees = make(size);
	let room = bottom ? span.front : span.back;
	let scale = 1;
	const keepStars = !bottom || degrees <= span.front;
	if (!keepStars) {
		// A long name takes the stars' room.
		room = span.frontNoStars;
		const wipe = document.getElementById("stars-wipe");
		for (const [x, y] of stars) {
			const dot = document.createElementNS(ns, "circle");
			dot.setAttribute("cx", String(x));
			dot.setAttribute("cy", String(y));
			dot.setAttribute("r", "85");
			wipe.append(dot);
		}
	}
	if (degrees > room) {
		scale = room / degrees;
		degrees = make(size * scale);
	}
	return { degrees, scale, stars: keepStars };
}

function trace(png, out, title, source) {
	const traced = traceImage(png, { colours: LINE_COLOURS, omit: ["paper"] });
	writeFileSync(
		join(ROOT, out),
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${traced.height}">` +
			`<title>Rynke coin, ${title}, line drawing</title>` +
			`<!-- Generated by scripts/team-coins.mjs from ${source}; replace that, then run pnpm team-coins. -->` +
			`${traced.markup}</svg>\n`,
	);
	console.log(`${out} (${statSync(join(ROOT, out)).size} bytes)`);
}
