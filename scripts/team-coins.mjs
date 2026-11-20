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
// A back with a coloured take (art/coin/teams/colour/originals/
// coin-<team>-colour.*, pnpm badge-art coin-<team>-colour) is traced in colour
// too, into art/coin/teams/<team>/rynke-coin-back.svg: the line drawing's
// areas filled with the colours Gemini gave them (fillRegions), its lettering
// band painted black and the name set in gold, like Hamburg's coloured back.
//
// It also writes the reference the generator gets for every back:
// Hamburg's back with its lettering and its own scene wiped, the frame, the
// climb, the Eiffel Tower and the bottom icons kept
// (art/coin/teams/reference/coin-back-blank.png).
//
// The lettering is set here, not drawn by the generator: it spells every name
// right and fits any length. It follows Hamburg's letters (hollow, rounded,
// Nunito from album/fonts, the dot between the words solid) on the same arcs
// and shrinks only when a name won't fit; on the front, a long name takes the
// two stars' room first. The letters go into the SVG as the font's own
// outlines, not traced, so they stay crisp. Chromium (Playwright's, as for
// the e2e tests) wipes the old lettering, ImageMagick and potrace trace the
// rest, like pnpm coin-art.
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
import { openSync as openFont } from "fontkit";
import { validateCoins } from "./quote-prompts.mjs";
import { palette, traceImage } from "./trace.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIR = "art/coin/teams";
const HAMBURG = "art/coin/reference/rynke-coin-line-drawing.jpeg";
const BLANK_BACK = `${DIR}/reference/coin-back-blank.png`;
const FONT = "album/fonts/Nunito-Black.woff2";
// The letters' outline, as thick as the drawing's lines.
const LETTER_LINE = 9;

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

// The coloured backs (art/coin/teams/colour): Hamburg's back palette
// (coin-art.mjs) plus the greens, browns, sand and red the other teams' scenes need,
// bottom to top.
const COLOUR_BACK = palette([
	{ name: "cream", hex: "#fffdf5" },
	{ name: "sky", hex: "#a9d6f2" },
	{ name: "glass", hex: "#e8f3fb" },
	{ name: "water", hex: "#3a8fd0" },
	{ name: "grass", hex: "#7fbf5a" },
	{ name: "copper", hex: "#6fae8f" },
	{ name: "fir", hex: "#3f7a3a" },
	{ name: "brick", hex: "#b5562f" },
	{ name: "wood", hex: "#c4802a" },
	{ name: "sand", hex: "#f0c888" },
	{ name: "quay", hex: "#5e5c55" },
	{ name: "red", hex: "#ce223a" },
	{ name: "yellow", hex: "#fbe122" },
	{ name: "gold", hex: "#c99a2e" },
	{ name: "ink", hex: "#1c1b13" },
]);
const GOLD = "#c99a2e";
const INK = "#1c1b13";

const LINE_COLOURS = palette([
	{ name: "paper", hex: "#ffffff" },
	{ name: "ink", hex: "#1c1b13" },
]);

const coins = JSON.parse(readFileSync(join(ROOT, DIR, "coins.json"), "utf8"));
// The coloured backs' own fixes (art/coin/teams/colour/colours.json):
// `regions`, [x, y, colour name] each, the area of the line drawing around
// that canvas point filled with that colour; `checker`, a box [x0, y0, x1, y1]
// and two colour names, whose small areas alternate like a chequered pattern
// (München's diamond ribbon), whatever Gemini made of single ones.
const colourFixes = Object.fromEntries(
	JSON.parse(
		readFileSync(join(ROOT, DIR, "colour/colours.json"), "utf8"),
	).coins.map((c) => [c.id, { regions: c.regions ?? [], checker: c.checker }]),
);
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
const font = openFont(join(ROOT, FONT));

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

	for (const { team, name, id, overlay } of teams) {
		const out = `${DIR}/${team}`;
		mkdirSync(join(ROOT, out), { recursive: true });
		const upper = name.toUpperCase();

		const front = join(tmp, `${team}-front.png`);
		const frontText = lettering("front", `TEAM RYNKEBY ${upper}`);
		await compose(hamburg.front, front, {
			wipe: [frontBand(), frontText.stars ? "" : starsWipe()],
		});
		trace(
			front,
			`${out}/rynke-coin-line-front.svg`,
			`${name}, front`,
			HAMBURG,
			frontText.markup,
		);
		console.log(`  front lettering: ${fitNote(frontText)}`);

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
		const backText = lettering("back", `${upper} • PARIS`);
		await compose(placed, back, {
			wipe: [backBand()],
			draw: overlay ? overlayImage(overlay) : "",
		});
		trace(
			back,
			`${out}/rynke-coin-line-back.svg`,
			`${name}, back`,
			original,
			backText.markup,
		);
		console.log(`  back lettering: ${fitNote(backText)}`);

		const colourOriginal = originalOf(
			`${id}-colour`,
			`${DIR}/colour/originals`,
		);
		if (!colourOriginal) continue;
		const colourPlaced = join(tmp, `${team}-colour-placed.png`);
		execFileSync(magick, [
			join(ROOT, colourOriginal),
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
			...outsideCoinWhite(),
			colourPlaced,
		]);
		const filled = join(tmp, `${team}-colour-filled.png`);
		// The arc line's left end below the band would split the sky.
		const lineForColour = join(tmp, `${team}-colour-line.png`);
		await compose(back, lineForColour, { draw: arcEnd() });
		fillRegions(
			lineForColour,
			colourPlaced,
			filled,
			colourFixes[`${id}-colour`],
		);
		const colourBack = join(tmp, `${team}-colour-back.png`);
		await compose(filled, colourBack, {
			wipe: [`<g fill="${INK}">${colourBand()}</g>`],
		});
		const traced = traceImage(colourBack, { colours: COLOUR_BACK });
		const colourOut = `${out}/rynke-coin-back.svg`;
		writeFileSync(
			join(ROOT, colourOut),
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${traced.height}">` +
				`<title>Rynke coin, ${name}, back</title>` +
				`<!-- Generated by scripts/team-coins.mjs from ${colourOriginal}; replace that, then run pnpm team-coins. -->` +
				`${traced.markup}<g transform="scale(${100 / SIZE})">${lettering("back", `${upper} • PARIS`, GOLD).markup}</g></svg>\n`,
		);
		console.log(`${colourOut} (${statSync(join(ROOT, colourOut)).size} bytes)`);
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

/** The generated picture `id` in `dir` (the backs' originals/), any image type. */
function originalOf(id, dir = `${DIR}/originals`) {
	try {
		const file = readdirSync(join(ROOT, dir)).find((f) =>
			f.startsWith(`${id}.`),
		);
		return file && `${dir}/${file}`;
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
/**
 * The coloured back's black band, down to the arc line, which it takes in, so
 * it ends level like Hamburg's.
 */
function colourBand() {
	return `<g clip-path="url(#above)">${annulus(ARC.r - 6, BAND.outer - 4)}</g>`;
}
/**
 * The arc line's left end below the coloured back's band, wiped. (The right
 * end runs into the Eiffel Tower and stays.)
 */
function arcEnd() {
	const from = C - 380;
	const to = C + 200;
	const x = (y) => C - Math.sqrt(ARC.r ** 2 - (y - C) ** 2);
	return `<path fill="none" stroke="white" stroke-width="16" d="M${x(from)},${from}A${ARC.r},${ARC.r} 0 0,0 ${x(to)},${to}"/>`;
}

/** The arc line, drawn again whole where the wiping cut into it. */
function backArc() {
	const x = Math.sqrt(ARC.r ** 2 - ARC.end ** 2);
	return `<path fill="none" stroke="#1c1b13" stroke-width="8" d="M${C - x},${C - ARC.end}A${ARC.r},${ARC.r} 0 0,1 ${C + x},${C - ARC.end}"/>`;
}

/**
 * Sets `base` on the canvas in Chromium, paints the `wipe` areas white and
 * draws `draw` on top, then saves the page as `out`.
 */
async function compose(base, out, { wipe = [], draw = "" } = {}) {
	const image = readFileSync(base).toString("base64");
	const html = `<!doctype html><html><head><style>
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
</svg></body></html>`;
	await page.setContent(html);
	await page.screenshot({
		path: out,
		clip: { x: 0, y: 0, width: SIZE, height: SIZE },
	});
}

function fitNote({ degrees, scale, stars }) {
	return (
		`${Math.round(degrees)}°` +
		(scale < 1 ? `, letters at ${Math.round(scale * 100)}%` : "") +
		(stars ? "" : ", without the stars")
	);
}

/**
 * `words` round the arc in the font's own outlines, as SVG on the canvas,
 * sized to fit (see SPAN): the top text clockwise with its baseline inside,
 * the bottom text anticlockwise with its baseline outside, both upright and
 * centred on the band. Letters are hollow, the dot between words solid;
 * with a `colour`, letters and dot are solid in it.
 */
function lettering(side, words, colour) {
	const bottom = side === "front";
	const capHeight = font.capHeight / font.unitsPerEm;
	const run = font.layout(words);
	const missing = run.glyphs.filter((g) => g.id === 0);
	if (missing.length > 0)
		throw new Error(`${FONT} has no glyph for a letter in "${words}"`);
	const set = (fontSize) => {
		const k = fontSize / font.unitsPerEm;
		const spacing = fontSize * 0.02;
		const r = BAND.centre + ((bottom ? 1 : -1) * capHeight * fontSize) / 2;
		const advances = run.positions.map((p) => p.xAdvance * k + spacing);
		const length = advances.reduce((a, b) => a + b, 0) - spacing;
		let x = -length / 2;
		const paths = run.glyphs.map((glyph, i) => {
			const mid = x + (run.positions[i].xAdvance * k) / 2;
			const left = x + run.positions[i].xOffset * k;
			x += advances[i];
			const phi = mid / r;
			const deg = (phi * 180) / Math.PI;
			const [px, py] = bottom
				? [C + r * Math.sin(phi), C + r * Math.cos(phi)]
				: [C + r * Math.sin(phi), C - r * Math.cos(phi)];
			const d = glyph.path.toSVG();
			if (!d) return "";
			const solid = colour || glyph.codePoints.includes(0x2022);
			const paint = solid
				? `fill="${colour ?? INK}"`
				: `fill="none" stroke="#1c1b13" stroke-width="${(LETTER_LINE / k).toFixed(1)}" stroke-linejoin="round"`;
			return (
				`<path transform="translate(${px.toFixed(2)},${py.toFixed(2)}) rotate(${(bottom ? -deg : deg).toFixed(3)}) ` +
				`translate(${(left - mid).toFixed(2)},0) scale(${k.toFixed(5)},${(-k).toFixed(5)})" ${paint} d="${d}"/>`
			);
		});
		return { degrees: (length / r) * (180 / Math.PI), markup: paths.join("") };
	};
	let text = set(FONT_SIZE[side]);
	let room = bottom ? SPAN.front : SPAN.back;
	const stars = !bottom || text.degrees <= SPAN.front;
	// A long name takes the stars' room.
	if (!stars) room = SPAN.frontNoStars;
	let scale = 1;
	if (text.degrees > room) {
		scale = room / text.degrees;
		text = set(FONT_SIZE[side] * scale);
	}
	return { ...text, scale, stars };
}

/**
 * A line drawing drawn over a generated back before tracing, where the
 * generator can't be trusted with the exact shape (a country's outline, a
 * regular pattern):
 * `file` in art/coin/teams, its top left corner at `box` [x, y] on the canvas,
 * `box[2]` px wide.
 */
function overlayImage({ file, box: [x, y, width] }) {
	const svg = readFileSync(join(ROOT, DIR, file)).toString("base64");
	return `<image href="data:image/svg+xml;base64,${svg}" x="${x}" y="${y}" width="${width}"/>`;
}

/**
 * Colours the line drawing `line` area by area: every area enclosed by its
 * lines gets the one palette colour most of it has in `colour` (Gemini's
 * coloured take, placed the same way), unless `fixes` name another. The lines
 * stay the line drawing's, each area stays one flat colour, and whatever
 * Gemini added beyond the lines (an extra chain, stray strokes) is dropped.
 * Areas touching the canvas edge stay white paper.
 */
function fillRegions(line, colour, out, { regions = [], checker } = {}) {
	const raw = (file) =>
		execFileSync(
			magick,
			[file, "-resize", `${SIZE}x${SIZE}!`, "-depth", "8", "rgb:-"],
			{
				maxBuffer: SIZE * SIZE * 4,
			},
		);
	const ink = raw(line);
	const paint = raw(colour);
	const n = SIZE * SIZE;
	const isInk = (i) => ink[3 * i] + ink[3 * i + 1] + ink[3 * i + 2] < 3 * 128;
	const nearest = (i) => {
		let best = 0;
		let bestD = Number.POSITIVE_INFINITY;
		for (const [k, { rgb }] of COLOUR_BACK.entries()) {
			const d =
				(paint[3 * i] - rgb[0]) ** 2 +
				(paint[3 * i + 1] - rgb[1]) ** 2 +
				(paint[3 * i + 2] - rgb[2]) ** 2;
			if (d < bestD) [best, bestD] = [k, d];
		}
		return best;
	};
	const region = new Int32Array(n).fill(-1);
	const fill = [];
	const stack = new Int32Array(n);
	for (let start = 0; start < n; start++) {
		if (region[start] !== -1 || isInk(start)) continue;
		const id = fill.length;
		const votes = new Float64Array(COLOUR_BACK.length);
		let edge = false;
		let top = 0;
		stack[top++] = start;
		region[start] = id;
		while (top > 0) {
			const i = stack[--top];
			const k = nearest(i);
			// Gemini's own outlines fall on our areas' edges: they count less.
			votes[k] += COLOUR_BACK[k].name === "ink" ? 0.3 : 1;
			const x = i % SIZE;
			const y = (i - x) / SIZE;
			if (x === 0 || y === 0 || x === SIZE - 1 || y === SIZE - 1) edge = true;
			for (const j of [
				x > 0 ? i - 1 : -1,
				x < SIZE - 1 ? i + 1 : -1,
				y > 0 ? i - SIZE : -1,
				y < SIZE - 1 ? i + SIZE : -1,
			]) {
				if (j < 0 || region[j] !== -1 || isInk(j)) continue;
				region[j] = id;
				stack[top++] = j;
			}
		}
		fill.push(edge ? null : COLOUR_BACK[votes.indexOf(Math.max(...votes))].rgb);
	}
	if (checker) chequer(region, fill, isInk, checker);
	for (const [x, y, name] of regions) {
		const id = region[y * SIZE + x];
		const c = COLOUR_BACK.find((p) => p.name === name);
		if (id < 0 || !c)
			throw new Error(
				`colour fix [${x}, ${y}, ${name}]: no area or no such colour`,
			);
		fill[id] = c.rgb;
	}
	const pixels = Buffer.alloc(3 * n);
	const inkRgb = COLOUR_BACK.find((p) => p.name === "ink").rgb;
	for (let i = 0; i < n; i++) {
		const c = region[i] === -1 ? inkRgb : (fill[region[i]] ?? [255, 255, 255]);
		pixels.set(c, 3 * i);
	}
	execFileSync(
		magick,
		["-size", `${SIZE}x${SIZE}`, "-depth", "8", "rgb:-", out],
		{
			input: pixels,
		},
	);
}

/**
 * Recolours the small areas inside `box` that are in one of the colours
 * `from` in two alternating `colours`: areas sharing a line get different
 * ones. Which of the two each gets follows what most of
 * them (by size) already have.
 */
function chequer(
	region,
	fill,
	isInk,
	{ box: [x0, y0, x1, y1], colours, from = colours },
) {
	const [a, b] = colours.map((name) =>
		COLOUR_BACK.find((c) => c.name === name),
	);
	if (!a || !b) throw new Error(`checker colours ${colours}: no such colour`);
	const inside = new Map();
	const size = new Map();
	for (let y = 0; y < SIZE; y++)
		for (let x = 0; x < SIZE; x++) {
			const id = region[y * SIZE + x];
			if (id < 0) continue;
			size.set(id, (size.get(id) ?? 0) + 1);
			const within = x >= x0 && x <= x1 && y >= y0 && y <= y1;
			inside.set(id, (inside.get(id) ?? true) && within);
		}
	// Only the pattern's own cells: small, and in one of the colours Gemini
	// gave them (`from`, its two plus any it mixed up with them).
	const was = from.map((name) => COLOUR_BACK.find((c) => c.name === name)?.rgb);
	const cells = new Set(
		[...inside]
			.filter(([id, v]) => v && size.get(id) < 8000 && was.includes(fill[id]))
			.map(([id]) => id),
	);
	// Areas across a line from each other, weighted by how long the line is:
	// areas meeting only at a corner share a few pixels and don't count.
	const touch = new Map();
	const D = 7;
	for (let y = y0 + D; y <= y1 - D; y++)
		for (let x = x0 + D; x <= x1 - D; x++) {
			const i = y * SIZE + x;
			if (!isInk(i)) continue;
			for (const [p, q] of [
				[i - D, i + D],
				[i - D * SIZE, i + D * SIZE],
			]) {
				const [r, s] = [region[p], region[q]];
				if (r === s || !cells.has(r) || !cells.has(s)) continue;
				const key = r < s ? `${r},${s}` : `${s},${r}`;
				touch.set(key, (touch.get(key) ?? 0) + 1);
			}
		}
	const next = new Map([...cells].map((id) => [id, []]));
	for (const [key, n] of touch) {
		if (n < 12) continue;
		const [r, s] = key.split(",").map(Number);
		next.get(r).push(s);
		next.get(s).push(r);
	}
	// The pattern is the biggest group of cells joined by lines; smaller groups
	// in the box (a wheel's spokes) aren't part of it and keep their colours.
	const parity = new Map();
	let group = [];
	for (const start of cells) {
		if (parity.has(start)) continue;
		const found = [start];
		parity.set(start, 0);
		for (let k = 0; k < found.length; k++)
			for (const n of next.get(found[k]))
				if (!parity.has(n)) {
					parity.set(n, 1 - parity.get(found[k]));
					found.push(n);
				}
		if (found.length > group.length) group = found;
	}
	const same = (id, c) => fill[id] === c.rgb;
	let keep = 0;
	for (const id of group) {
		const want = parity.get(id) === 0 ? a : b;
		const other = want === a ? b : a;
		if (same(id, want)) keep += size.get(id);
		else if (same(id, other)) keep -= size.get(id);
	}
	for (const id of group) {
		const first = parity.get(id) === 0;
		fill[id] = (first === keep >= 0 ? a : b).rgb;
	}
}

/** The front's two stars, wiped when a long name takes their room. */
function starsWipe() {
	return STARS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="85"/>`).join("");
}

function trace(png, out, title, source, letters = "") {
	const traced = traceImage(png, { colours: LINE_COLOURS, omit: ["paper"] });
	writeFileSync(
		join(ROOT, out),
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${traced.height}">` +
			`<title>Rynke coin, ${title}, line drawing</title>` +
			`<!-- Generated by scripts/team-coins.mjs from ${source}; replace that, then run pnpm team-coins. -->` +
			`${traced.markup}` +
			(letters && `<g transform="scale(${100 / SIZE})">${letters}</g>`) +
			`</svg>\n`,
	);
	console.log(`${out} (${statSync(join(ROOT, out)).size} bytes)`);
}
