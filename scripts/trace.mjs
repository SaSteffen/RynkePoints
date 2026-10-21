// The tracer shared by `pnpm illustrations` and `pnpm badge-build` (feature 013
// research R5): turns an image generator's raster original into flat layers of
// paths in the coin palette. Like icons.mjs it shells out to tools that aren't
// project dependencies, ImageMagick (`magick` or `convert`) and potrace.
//
// Per image: scale down to at most 2048 px, flood the white paper in from the
// edges and drop it, snap every other pixel to the nearest coin colour, smooth
// away anti-aliasing fringes, then trace one layer per colour with potrace.
// Each layer covers its own colour plus every colour stacked above it, so the
// layers overlap instead of leaving hairline gaps between them.
import { execFileSync } from "node:child_process";

// The coin's colours (`--rp-coin-*` in src/http/style.ts), bottom to top, plus
// a light sage for sofas, which black made too heavy next to the badge's
// ribbon (feature 013 part D/E). Ink comes last: the outlines sit on top of
// every fill.
export const PALETTE = palette([
	{ name: "cream", hex: "#fffdf5" },
	{ name: "yellow", hex: "#fbe122" },
	{ name: "gold", hex: "#c99a2e" },
	{ name: "fur", hex: "#c8641e" },
	{ name: "muzzle", hex: "#f0a868" },
	{ name: "blue", hex: "#8cc4f0" },
	{ name: "sage", hex: "#b5d6a7" },
	{ name: "ink", hex: "#1c1b13" },
]);

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
function labels({ w, h, rgba }, palette = PALETTE) {
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
		for (let p = 0; p < palette.length; p++) {
			const [pr, pg, pb] = palette[p].rgb;
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
function smooth(src, w, h, colours = PALETTE.length) {
	const out = new Uint8Array(src.length);
	const counts = new Uint16Array(colours + 1);
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

/** `{ name, hex }` colours, bottom to top, as `traceImage` takes them. */
export function palette(colours) {
	return colours.map((c) => ({
		...c,
		rgb: [1, 3, 5].map((i) => Number.parseInt(c.hex.slice(i, i + 2), 16)),
	}));
}

/**
 * Recolours every region of colour `from` that lies wholly inside `box`
 * ([x0, y0, x1, y1]) and, if given, inside `ring` ([centre x, centre y,
 * inner radius, outer radius]), both in the original's pixels before any
 * scaling down, to the colour `to`: a fix the image generator wouldn't make.
 * Regions reaching outside, like a background, keep their colour.
 */
function recolour(label, w, h, scale, colours, { box, ring, from, to }) {
	const index = (name) => {
		const i = colours.findIndex((c) => c.name === name) + 1;
		if (!i) throw new Error(`Unknown colour ${name}`);
		return i;
	};
	const source = index(from);
	const target = index(to);
	const [x0, y0, x1, y1] = box.map((v) => Math.round(v * scale));
	const [cx, cy, r0, r1] = (ring ?? [0, 0, 0, Number.POSITIVE_INFINITY]).map(
		(v) => v * scale,
	);
	const inRing = (x, y) => {
		const d = Math.hypot(x - cx, y - cy);
		return d >= r0 && d <= r1;
	};
	const seen = new Uint8Array(label.length);
	for (let y = y0; y <= y1; y++) {
		for (let x = x0; x <= x1; x++) {
			const start = y * w + x;
			if (label[start] !== source || seen[start]) continue;
			const region = [start];
			seen[start] = 1;
			let inside = true;
			for (let k = 0; k < region.length; k++) {
				const i = region[k];
				const ix = i % w;
				const iy = (i - ix) / w;
				if (ix < x0 || ix > x1 || iy < y0 || iy > y1 || !inRing(ix, iy)) {
					inside = false;
				}
				for (const j of [
					ix > 0 ? i - 1 : -1,
					ix < w - 1 ? i + 1 : -1,
					iy > 0 ? i - w : -1,
					iy < h - 1 ? i + w : -1,
				]) {
					if (j >= 0 && !seen[j] && label[j] === source) {
						seen[j] = 1;
						region.push(j);
					}
				}
			}
			if (inside) for (const i of region) label[i] = target;
		}
	}
}

/**
 * Drops the region of one colour around each of `holes` ([x, y] in the
 * original's pixels) as paper: background the drawing closes in, like the gap
 * between the legs, which the flood from the edges can't reach.
 */
function cutHoles(label, w, h, scale, holes) {
	for (const [hx, hy] of holes) {
		const start = Math.round(hy * scale) * w + Math.round(hx * scale);
		const source = label[start];
		if (!source) continue;
		const region = [start];
		label[start] = 0;
		for (let k = 0; k < region.length; k++) {
			const i = region[k];
			const ix = i % w;
			const iy = (i - ix) / w;
			for (const j of [
				ix > 0 ? i - 1 : -1,
				ix < w - 1 ? i + 1 : -1,
				iy > 0 ? i - w : -1,
				iy < h - 1 ? i + w : -1,
			]) {
				if (j >= 0 && label[j] === source) {
					label[j] = 0;
					region.push(j);
				}
			}
		}
	}
}

/**
 * Drops, as paper, every shape (touching pixels of any colour) that lies
 * wholly inside one of the `boxes` ([x0, y0, x1, y1] in the original's
 * pixels): stray doodles the image generator added beside the picture.
 */
function eraseShapes(label, w, h, scale, boxes) {
	for (const box of boxes) {
		const [x0, y0, x1, y1] = box.map((v) => Math.round(v * scale));
		const seen = new Uint8Array(label.length);
		for (let y = y0; y <= y1; y++) {
			for (let x = x0; x <= x1; x++) {
				const start = y * w + x;
				if (!label[start] || seen[start]) continue;
				const shape = [start];
				seen[start] = 1;
				let inside = true;
				for (let k = 0; k < shape.length; k++) {
					const i = shape[k];
					const ix = i % w;
					const iy = (i - ix) / w;
					if (ix < x0 || ix > x1 || iy < y0 || iy > y1) inside = false;
					for (const j of [
						ix > 0 ? i - 1 : -1,
						ix < w - 1 ? i + 1 : -1,
						iy > 0 ? i - w : -1,
						iy < h - 1 ? i + w : -1,
					]) {
						if (j >= 0 && !seen[j] && label[j]) {
							seen[j] = 1;
							shape.push(j);
						}
					}
				}
				if (inside) for (const i of shape) label[i] = 0;
			}
		}
	}
}

/**
 * Traces an original into one `<g>` of layered paths, 100 units wide over the
 * full canvas (so images made on the same canvas keep their relative scale).
 * `colours` replaces the coin palette (from `palette()`), `fixes` recolours
 * regions after snapping (see `recolour`), `holes` drops enclosed regions as
 * paper (see `cutHoles`), `erase` drops stray shapes (see `eraseShapes`), and
 * colours named in `omit` are snapped to but not drawn (a line drawing's
 * paper); all are optional.
 */
export function traceImage(
	file,
	{ colours = PALETTE, fixes = [], holes = [], erase = [], omit = [] } = {},
) {
	const image = readImage(file);
	const { w, h } = image;
	const label = smooth(labels(image, colours), w, h, colours.length);
	if (fixes.length > 0 || holes.length > 0 || erase.length > 0) {
		const original = Number(
			execFileSync(magick, [file, "-auto-orient", "-format", "%w", "info:"])
				.toString()
				.trim(),
		);
		for (const fix of fixes) recolour(label, w, h, w / original, colours, fix);
		cutHoles(label, w, h, w / original, holes);
		eraseShapes(label, w, h, w / original, erase);
	}

	const used = new Uint32Array(colours.length + 1);
	for (const l of label) used[l]++;

	let transform = "";
	const paths = [];
	for (let p = 0; p < colours.length; p++) {
		if (!used[p + 1] || omit.includes(colours[p].name)) continue;
		const layer = trace(pbm((i) => label[i] > p, w, h));
		if (!layer) continue;
		transform = layer.transform;
		paths.push(`<path fill="${colours[p].hex}" d="${layer.d}"/>`);
	}

	// 100 user units across, like the coin's symbols.
	const s = 100 / w;
	return {
		height: Math.round(h * s * 100) / 100,
		markup: `<g transform="scale(${s.toFixed(6)}) ${transform}">${paths.join("")}</g>`,
	};
}

/**
 * Writes the original snapped to the palette (paper white) as an indexed PNG of
 * at most 2048 px: what tracing needs, a fraction of the original's size
 * (research R7).
 */
export function snapToPalette(file, out) {
	const image = readImage(file);
	const { w, h } = image;
	const label = labels(image);
	const rgb = Buffer.alloc(w * h * 3, 255);
	for (let i = 0; i < w * h; i++) {
		const l = label[i];
		if (l) rgb.set(PALETTE[l - 1].rgb, i * 3);
	}
	execFileSync(
		magick,
		[
			"-size",
			`${w}x${h}`,
			"-depth",
			"8",
			"rgb:-",
			"-strip",
			"-define",
			"png:compression-level=9",
			`PNG8:${out}`,
		],
		{ input: rgb },
	);
}
