#!/usr/bin/env node
// Traces every file in art/illustrations/ (the image generator's originals,
// any name, any format ImageMagick reads; it goes by the content, not the
// extension) into a flat SVG in public/illustrations/ with the same base name,
// overwriting an SVG of that name; other SVGs there stay. Dotfiles (the
// folder's .gitkeep) are skipped. Like icons.mjs it shells out to tools that
// aren't project dependencies, ImageMagick (`magick` or `convert`) and potrace:
// the outputs are committed and only change with the artwork.
//
// Per image: scale down to at most 2048 px, flood the white paper in from the
// edges and drop it, snap every other pixel to the nearest coin colour, smooth
// away anti-aliasing fringes, then trace one layer per colour with potrace.
// Each layer covers its own colour plus every colour stacked above it, so the
// layers overlap instead of leaving hairline gaps between them.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../art/illustrations/", import.meta.url));
const OUT = fileURLToPath(new URL("../public/illustrations/", import.meta.url));

// The coin's colours (`--rp-coin-*` in src/http/style.ts), bottom to top. Ink
// comes last: the outlines sit on top of every fill.
const PALETTE = [
	{ name: "cream", hex: "#fffdf5" },
	{ name: "yellow", hex: "#fbe122" },
	{ name: "gold", hex: "#c99a2e" },
	{ name: "fur", hex: "#c8641e" },
	{ name: "muzzle", hex: "#f0a868" },
	{ name: "blue", hex: "#8cc4f0" },
	{ name: "ink", hex: "#1c1b13" },
].map((c) => ({
	...c,
	rgb: [1, 3, 5].map((i) => Number.parseInt(c.hex.slice(i, i + 2), 16)),
}));

const MAX_SIZE = 2048;
// Paper: near-white and grey-ish, which includes the soft edge pixels around
// the outlines. Only paper connected to the image's border is removed, so
// cream areas inside an outline stay.
const PAPER_MIN = 170;
const PAPER_CHROMA = 40;
// Side of the majority filter's window; removes 1–2 px colour fringes.
const SMOOTH = 5;
// potrace: drop specks up to this many pixels, smooth corners, simplify curves.
const POTRACE = ["-t", "48", "-a", "1", "-O", "0.4", "-u", "4"];

const magick = (() => {
	for (const bin of ["magick", "convert"]) {
		try {
			execFileSync(bin, ["-version"], { stdio: "ignore" });
			return bin;
		} catch {}
	}
	throw new Error("ImageMagick (magick or convert) is required");
})();

function readImage(file) {
	const args = [file, "-auto-orient", "-resize", `${MAX_SIZE}x${MAX_SIZE}>`];
	const [w, h] = execFileSync(magick, [...args, "-format", "%w %h", "info:"])
		.toString()
		.trim()
		.split(" ")
		.map(Number);
	const rgba = execFileSync(
		magick,
		[...args, "-alpha", "set", "-depth", "8", "rgba:-"],
		{ maxBuffer: w * h * 4 + 1024 },
	);
	return { w, h, rgba };
}

/** 0 for removed paper, else 1 + the palette index of the nearest colour. */
function labels({ w, h, rgba }) {
	const n = w * h;
	const isPaper = (i) => {
		const [r, g, b, a] = rgba.subarray(i * 4, i * 4 + 4);
		const lo = Math.min(r, g, b);
		return (
			a < 128 || (lo >= PAPER_MIN && Math.max(r, g, b) - lo <= PAPER_CHROMA)
		);
	};

	const paper = new Uint8Array(n);
	const stack = new Int32Array(n);
	let top = 0;
	const seed = (i) => {
		if (!paper[i] && isPaper(i)) {
			paper[i] = 1;
			stack[top++] = i;
		}
	};
	for (let x = 0; x < w; x++) {
		seed(x);
		seed((h - 1) * w + x);
	}
	for (let y = 0; y < h; y++) {
		seed(y * w);
		seed(y * w + w - 1);
	}
	while (top > 0) {
		const i = stack[--top];
		const x = i % w;
		if (x > 0) seed(i - 1);
		if (x < w - 1) seed(i + 1);
		if (i >= w) seed(i - w);
		if (i < n - w) seed(i + w);
	}

	const out = new Uint8Array(n);
	for (let i = 0; i < n; i++) {
		if (paper[i]) continue;
		const [r, g, b] = rgba.subarray(i * 4, i * 4 + 3);
		let best = 0;
		let bestDist = Number.POSITIVE_INFINITY;
		for (let p = 0; p < PALETTE.length; p++) {
			const [pr, pg, pb] = PALETTE[p].rgb;
			// "Redmean" colour distance: cheap and closer to perception than RGB.
			const mean = (r + pr) / 2;
			const dr = r - pr;
			const dg = g - pg;
			const db = b - pb;
			const dist =
				(2 + mean / 256) * dr * dr +
				4 * dg * dg +
				(2 + (255 - mean) / 256) * db * db;
			if (dist < bestDist) {
				bestDist = dist;
				best = p;
			}
		}
		out[i] = best + 1;
	}
	return out;
}

/** Each pixel takes the most common label in its SMOOTH × SMOOTH window. */
function smooth(src, w, h) {
	const out = new Uint8Array(src.length);
	const counts = new Uint16Array(PALETTE.length + 1);
	const r = SMOOTH >> 1;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			counts.fill(0);
			for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) {
				for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
					counts[src[yy * w + xx]]++;
				}
			}
			let best = src[y * w + x];
			for (let l = 0; l < counts.length; l++) {
				if (counts[l] > counts[best]) best = l;
			}
			out[y * w + x] = best;
		}
	}
	return out;
}

/** potrace's binary PBM: a set bit is a pixel to trace. */
function pbm(inside, w, h) {
	const rowBytes = Math.ceil(w / 8);
	const head = Buffer.from(`P4\n${w} ${h}\n`);
	const body = Buffer.alloc(rowBytes * h);
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (inside(y * w + x)) body[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
		}
	}
	return Buffer.concat([head, body]);
}

function trace(bitmap) {
	const svg = execFileSync(
		"potrace",
		["-b", "svg", "--flat", ...POTRACE, "-o", "-"],
		{
			input: bitmap,
			maxBuffer: 64 * 1024 * 1024,
		},
	).toString();
	const transform = svg.match(/<g transform="([^"]+)"/)?.[1];
	const d = svg
		.match(/<path d="([^"]+)"/)?.[1]
		.replace(/\s+/g, " ")
		.trim();
	return transform && d ? { transform, d } : null;
}

function illustration(file) {
	const image = readImage(file);
	const { w, h } = image;
	const label = smooth(labels(image), w, h);

	const used = new Uint32Array(PALETTE.length + 1);
	for (const l of label) used[l]++;

	let transform = "";
	const paths = [];
	for (let p = 0; p < PALETTE.length; p++) {
		if (!used[p + 1]) continue;
		const layer = trace(pbm((i) => label[i] > p, w, h));
		if (!layer) continue;
		transform = layer.transform;
		paths.push(`<path fill="${PALETTE[p].hex}" d="${layer.d}"/>`);
	}

	// 100 user units across, like the coin's symbols.
	const s = 100 / w;
	const vh = Math.round(h * s * 100) / 100;
	const source = basename(file);
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${vh}">` +
		`<!-- Generated by scripts/illustrations.mjs from art/illustrations/${source}; replace that, then run pnpm illustrations. -->` +
		`<g transform="scale(${s.toFixed(6)}) ${transform}">${paths.join("")}</g></svg>\n`
	);
}

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC, { withFileTypes: true })
	.filter((e) => e.isFile() && !e.name.startsWith("."))
	.map((e) => e.name)
	.sort();
if (files.length === 0) console.log(`No images in ${SRC}`);
for (const f of files) {
	const name = `${basename(f, extname(f))}.svg`;
	writeFileSync(OUT + name, illustration(SRC + f));
	console.log(
		`${f} -> public/illustrations/${name} (${statSync(OUT + name).size} bytes)`,
	);
}
