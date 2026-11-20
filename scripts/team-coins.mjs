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
import { palette, traceImage, traceShape } from "./trace.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const DIR = "art/coin/teams";
const HAMBURG = "art/coin/reference/rynke-coin-line-drawing.jpeg";
const HAMBURG_COLOUR = "art/coin/originals/rynke-coin-back.jpeg";
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
// Hamburg's Eiffel Tower in the blank: its spire's tip, the row just above
// where its feet stand on the climb, and how far off it Hamburg's coloured
// back, placed like a coloured take, has it.
const TOWER = { spire: [1732, 660], feet: 1268, colour: [-2, -6] };
// Hamburg's three badges in the blank's bottom band, [centre x, centre y,
// radius of the ring] each.
const BADGES = [
	[742, 1746.5, 99],
	[1037, 1765, 120],
	[1332, 1747, 100],
];
const SPAN = { front: 166, frontNoStars: 196, back: 122 };
const STARS = [
	[C - 800, C],
	[C + 800, C],
];

// The coloured backs (art/coin/teams/colour): Hamburg's back palette
// (coin-art.mjs) plus the greens, browns, sand and red the other teams' scenes need,
// bottom to top. Colours marked `fix` are never voted for, only named in
// colours.json's fixes: Gemini's take rarely has them, and as candidates they
// would pull areas away from the colours it meant.
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
	{ name: "stone", hex: "#a3a6a4", fix: true },
	{ name: "bark", hex: "#7a5a3c", fix: true },
	{ name: "chocolate", hex: "#4a2c1e", fix: true },
	{ name: "grape", hex: "#5b3f86", fix: true },
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
// that canvas point filled with that colour; `overlay`, an SVG drawn over
// Gemini's take before the areas vote, so a pattern of our own (München's
// diamonds, coloured by their place in the lattice) gets exactly its colours;
// `recolour`, {box, from, to} each, every area of colour `from` wholly inside
// the box [x0, y0, x1, y1] turned `to` (a forest's see-through trees);
// `behind`, an SVG like `overlay` of what the Eiffel Tower hides, painted only
// where it stands (copyTower). `badges` at the top, regions like these for
// the band's three badges, which every back takes from Hamburg's blank
// (setBadges): coloured like Hamburg's on every coin (road, mountain and
// jerseys yellow).
const colourList = JSON.parse(
	readFileSync(join(ROOT, DIR, "colour/colours.json"), "utf8"),
);
const colourFixes = Object.fromEntries(
	colourList.coins.map((c) => [
		c.id,
		{
			regions: [...colourList.badges, ...(c.regions ?? [])],
			overlay: c.overlay,
			behind: c.behind,
			recolour: c.recolour ?? [],
		},
	]),
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
	const tower = hamburgTower(join(tmp, "hamburg-colour.png"));
	const badges = hamburgBadges();

	for (const { team, name, id, overlay, badges: ownBadges } of teams) {
		const shift = towerShift(id);
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
		setTower(back, tower.ink, tower, shift);
		setBadges(back, badges, ownBadges);
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
		placeColour(join(ROOT, colourOriginal), colourPlaced);
		const fixes = colourFixes[`${id}-colour`];
		if (fixes?.overlay)
			await compose(colourPlaced, colourPlaced, {
				draw: overlayImage(fixes.overlay),
			});
		const filled = join(tmp, `${team}-colour-filled.png`);
		const lineForColour = join(tmp, `${team}-colour-line.png`);
		// A sketchy ring with gaps would let the white outside or the ring's gold
		// leak into the scene: both its circles drawn closed. The black band too,
		// as it will be: a shape reaching up under it (a cap's horn) ends at it
		// instead of running round through the wiped lettering into the sky.
		await compose(back, lineForColour, {
			draw: `<circle cx="${C}" cy="${C}" r="${R - 4}" fill="none" stroke="${INK}" stroke-width="10"/><circle cx="${C}" cy="${C}" r="898" fill="none" stroke="${INK}" stroke-width="8"/><g fill="${INK}">${colourBand()}</g>`,
		});
		fillRegions(lineForColour, colourPlaced, filled, fixes);
		behindTower(filled, tower, shift);
		if (fixes?.behind) {
			const behind = join(tmp, `${team}-colour-behind.png`);
			await compose(filled, behind, { draw: overlayImage(fixes.behind) });
			copyTower(behind, filled, tower, shift);
		}
		const colourBack = join(tmp, `${team}-colour-back.png`);
		await compose(filled, colourBack, {
			wipe: [`<g fill="${INK}">${colourBand()}</g>`],
		});
		const traced = traceImage(colourBack, {
			colours: COLOUR_BACK,
			fixes: fixes?.recolour ?? [],
		});
		const colourOut = `${out}/rynke-coin-back.svg`;
		writeFileSync(
			join(ROOT, colourOut),
			`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${traced.height}">` +
				`<title>Rynke coin, ${name}, back</title>` +
				`<!-- Generated by scripts/team-coins.mjs from ${colourOriginal}; replace that, then run pnpm team-coins. -->` +
				`${traced.markup}${towerMarkup(tower, shift)}<g transform="scale(${100 / SIZE})">${lettering("back", `${upper} • PARIS`, GOLD).markup}</g></svg>\n`,
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

/** `file`'s pixels on the canvas, three bytes (RGB) each. */
function rgbOf(file) {
	return execFileSync(
		magick,
		[file, "-resize", `${SIZE}x${SIZE}!`, "-depth", "8", "rgb:-"],
		{ maxBuffer: SIZE * SIZE * 4 },
	);
}

/** Writes RGB `pixels` on the canvas to `file`. */
function writeRgb(pixels, file) {
	execFileSync(
		magick,
		["-size", `${SIZE}x${SIZE}`, "-depth", "8", "rgb:-", file],
		{ input: pixels },
	);
}

/** A coloured picture of the coin placed on the canvas like the line backs. */
function placeColour(src, out) {
	execFileSync(magick, [
		src,
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
		out,
	]);
}

/**
 * The Eiffel Tower looks the same on every coin: Hamburg's. The drawings copy
 * it from the blank, each a little differently, and the coloured takes fill
 * its lattice black, so it's taken from Hamburg's instead: `ink`, its lines in
 * the blank (everything joined to the spire, down to its feet on the climb);
 * `span`, per row its first and last line, where it stands in front of the
 * scene; and `colourInk`, the dark of Hamburg's coloured back in that span.
 * `scratch` is a file for Hamburg's coloured back on the canvas.
 */
function hamburgTower(scratch) {
	const blank = rgbOf(join(ROOT, BLANK_BACK));
	const isInk = (i) =>
		blank[3 * i] + blank[3 * i + 1] + blank[3 * i + 2] < 3 * 128;
	const ink = new Uint8Array(SIZE * SIZE);
	const start = TOWER.spire[1] * SIZE + TOWER.spire[0];
	const stack = [start];
	ink[start] = 1;
	while (stack.length > 0) {
		const i = stack.pop();
		const x = i % SIZE;
		const y = (i - x) / SIZE;
		for (const j of [
			x > 0 ? i - 1 : -1,
			x < SIZE - 1 ? i + 1 : -1,
			y > 0 ? i - SIZE : -1,
			y < TOWER.feet ? i + SIZE : -1,
		]) {
			if (j < 0 || ink[j] || !isInk(j)) continue;
			ink[j] = 1;
			stack.push(j);
		}
	}
	const span = new Map();
	for (let i = 0; i < ink.length; i++) {
		if (!ink[i]) continue;
		const x = i % SIZE;
		const y = (i - x) / SIZE;
		const [a, b] = span.get(y) ?? [x, x];
		span.set(y, [Math.min(a, x), Math.max(b, x)]);
	}
	placeColour(join(ROOT, HAMBURG_COLOUR), scratch);
	const colour = rgbOf(scratch);
	const colourInk = new Uint8Array(SIZE * SIZE);
	const [cx, cy] = TOWER.colour;
	for (const [y, [a, b]] of span)
		for (let x = a; x <= b; x++) {
			const j = 3 * ((y + cy) * SIZE + x + cx);
			colourInk[y * SIZE + x] = +(
				colour[j] + colour[j + 1] + colour[j + 2] <
				3 * 110
			);
		}
	return { ink, span, colourInk };
}

/**
 * How far the coin's tower stands off the blank's, [dx, dy]: `tower` in
 * coins.json, for a drawing that moved the whole scene (RheinRuhr's).
 */
function towerShift(id) {
	const coin = coins.coins.find((c) => c.id === id.replace(/-colour$/, ""));
	return coin?.tower ?? [0, 0];
}

/** The drawing's own Eiffel Tower replaced by `ink` in its `span`, moved by `shift`. */
function setTower(file, ink, { span }, [dx, dy]) {
	const pixels = Buffer.from(rgbOf(file));
	for (const [y, [a, b]] of span)
		for (let x = a; x <= b; x++)
			pixels.set(
				ink[y * SIZE + x] ? [0, 0, 0] : [255, 255, 255],
				3 * ((y + dy) * SIZE + x + dx),
			);
	writeRgb(pixels, file);
}

/**
 * Hamburg's three badges, the same on every coin: the drawings copy them from
 * the blank, some redrawn (RheinRuhr's riders). The blank's lines in each
 * ring, to set over a back by `setBadges`.
 */
function hamburgBadges() {
	const blank = rgbOf(join(ROOT, BLANK_BACK));
	const ink = new Uint8Array(SIZE * SIZE);
	for (const [cx, cy, r] of BADGES)
		inCircle(cx, cy, r + 8, (i) => {
			ink[i] = +(blank[3 * i] + blank[3 * i + 1] + blank[3 * i + 2] < 3 * 128);
		});
	// The mountain's base line, a few pixels short of the ring at both ends:
	// carried on to it, so the mountain and the ground below it are two areas.
	const [mx, , mr] = BADGES[1];
	for (let y = 1822; y <= 1826; y++)
		for (let x = Math.ceil(mx - mr); x <= mx + mr; x++)
			ink[y * SIZE + x] ||= +(Math.hypot(x - mx, y - BADGES[1][1]) <= mr);
	return ink;
}

/** Calls `f` with the index of every canvas pixel within `r` of [cx, cy]. */
function inCircle(cx, cy, r, f) {
	for (let y = Math.ceil(cy - r); y <= cy + r; y++)
		for (let x = Math.ceil(cx - r); x <= cx + r; x++)
			if (Math.hypot(x - cx, y - cy) <= r) f(y * SIZE + x);
}

/**
 * The drawing's own badges replaced by Hamburg's `ink`: each ring and a
 * little round it painted white first, at ours and at `own`, the centres of
 * a drawing's own badges where it moved them (`badges` in coins.json,
 * RheinRuhr's). A wider margin would cut the band's edge above the middle one.
 */
function setBadges(file, ink, own = []) {
	const pixels = Buffer.from(rgbOf(file));
	const white = (i) => pixels.set([255, 255, 255], 3 * i);
	BADGES.forEach(([cx, cy, r], k) => {
		inCircle(cx, cy, r + 8, white);
		if (own[k]) inCircle(own[k][0], own[k][1], r + 20, white);
	});
	for (const [cx, cy, r] of BADGES)
		inCircle(cx, cy, r + 8, (i) => {
			if (ink[i]) pixels.set([0, 0, 0], 3 * i);
		});
	writeRgb(pixels, file);
}

/**
 * The coloured back where the tower stands painted with what's behind it, the
 * colours beside it in each row (each half of the row from its own side), so
 * the tower drawn over it (`towerMarkup`) shows the sky, hill or meadow
 * through its lattice, like Hamburg's. Gemini's takes fill the lattice black
 * and put their tower a little off ours, so its colours aren't asked.
 */
function behindTower(file, { span }, [dx, dy]) {
	const pixels = Buffer.from(rgbOf(file));
	const dark = (i) =>
		pixels[3 * i] + pixels[3 * i + 1] + pixels[3 * i + 2] < 3 * 50;
	for (const [y, [a, b]] of span) {
		const row = (y + dy) * SIZE;
		const [x0, x1] = [a + dx, b + dx];
		const beside = (from, step) => {
			for (let x = from; Math.abs(x - from) < 60; x += step)
				if (!dark(row + x)) return x;
			return from;
		};
		const left = beside(x0 - 1, -1);
		const right = beside(x1 + 1, 1);
		for (let x = x0; x <= x1; x++) {
			const from = x - x0 <= x1 - x ? left : right;
			pixels.copy(
				pixels,
				3 * (row + x),
				3 * (row + from),
				3 * (row + from + 1),
			);
		}
	}
	writeRgb(pixels, file);
}

/**
 * `from`'s pixels where the tower stands copied into `to`: a coin's `behind`
 * in colours.json, a picture of what the tower hides where the colours beside
 * it differ (a hill sloping down behind it), painted only there.
 */
function copyTower(from, to, { span }, [dx, dy]) {
	const source = rgbOf(from);
	const pixels = Buffer.from(rgbOf(to));
	for (const [y, [a, b]] of span) {
		const row = (y + dy) * SIZE;
		source.copy(
			pixels,
			3 * (row + a + dx),
			3 * (row + a + dx),
			3 * (row + b + dx + 1),
		);
	}
	writeRgb(pixels, to);
}

/**
 * Hamburg's coloured tower (`colourInk`), moved by `shift`, traced on its own:
 * in the coloured back's trace its fine lattice would close up.
 */
function towerMarkup({ colourInk }, [dx, dy]) {
	return traceShape(
		(i) => {
			const x = i % SIZE;
			const y = (i - x) / SIZE;
			return colourInk[(y - dy) * SIZE + x - dx] === 1;
		},
		SIZE,
		SIZE,
		INK,
		{ speckles: 4 },
	);
}

/**
 * Colours the line drawing `line` area by area: every area enclosed by its
 * lines gets the one palette colour most of it has in `colour` (Gemini's
 * coloured take, placed the same way), unless `fixes` name another. The lines
 * stay the line drawing's, each area stays one flat colour, and whatever
 * Gemini added beyond the lines (an extra chain, stray strokes) is dropped.
 * Areas touching the canvas edge stay white paper.
 */
function fillRegions(line, colour, out, { regions = [] } = {}) {
	const ink = rgbOf(line);
	const paint = rgbOf(colour);
	const n = SIZE * SIZE;
	const isInk = (i) => ink[3 * i] + ink[3 * i + 1] + ink[3 * i + 2] < 3 * 128;
	const nearest = (i) => {
		let best = 0;
		let bestD = Number.POSITIVE_INFINITY;
		for (const [k, { rgb, fix }] of COLOUR_BACK.entries()) {
			if (fix) continue;
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
	for (const [x, y, name] of regions) {
		const id = region[y * SIZE + x];
		const c = COLOUR_BACK.find((p) => p.name === name);
		if (id < 0 || !c)
			throw new Error(
				`colour fix [${x}, ${y}, ${name}]: no area or no such colour`,
			);
		fill[id] = c.rgb;
		// An outline with a gap lets the area run out into the sky: say so.
		const size = region.reduce((n, r) => n + (r === id), 0);
		if (size > 400000)
			console.warn(
				`  colour fix [${x}, ${y}, ${name}]: its area is ${size} px, as big as the sky; does its outline leak?`,
			);
	}
	const pixels = Buffer.alloc(3 * n);
	const inkRgb = COLOUR_BACK.find((p) => p.name === "ink").rgb;
	for (let i = 0; i < n; i++) {
		const c = region[i] === -1 ? inkRgb : (fill[region[i]] ?? [255, 255, 255]);
		pixels.set(c, 3 * i);
	}
	// The arc line's ends below the band, which the drawings keep from
	// Hamburg's blank (where Hamburg's chain hangs), would cross the sky: where
	// it has one colour on both sides it takes that colour. Wiping it out of the
	// line drawing instead cut a gap into every line crossing it, and areas ran
	// out through the gaps. The right end only as far down as it goes: below,
	// the Eiffel Tower's lattice crosses that circle. Just under the band,
	// where its outer side is the band, it takes the inner side's colour, or a
	// stub of it hangs from the band's corner.
	for (let y = C - 380; y <= C + 200; y++)
		for (let x = 0; x < (y <= C - ARC.end + 40 ? SIZE : C); x++) {
			const i = y * SIZE + x;
			const d = Math.hypot(x - C, y - C);
			if (region[i] !== -1 || Math.abs(d - ARC.r) > 10) continue;
			const at = (r) => {
				const j =
					Math.round(C + ((y - C) * r) / d) * SIZE +
					Math.round(C + ((x - C) * r) / d);
				return region[j] === -1 ? null : fill[region[j]];
			};
			const inner = at(ARC.r - 15);
			const outer = at(ARC.r + 15) ?? (y < C - 355 ? inner : null);
			if (inner && inner === outer) pixels.set(inner, 3 * i);
		}
	writeRgb(pixels, out);
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
