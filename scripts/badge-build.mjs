#!/usr/bin/env node
// Builds the badge files the app shows (feature 013, contracts/badge-assets.md):
//
//   pnpm badge-build                      every badge whose SVG isn't committed
//   pnpm badge-build distance-100 ...     only these, committed or not (a retake)
//
// 1. Checks art/badges/badges.json and prompt.txt; exits 2 on any problem, or
//    on an unknown id, before writing anything.
// 2. Writes public/badges/placeholder-{personal,team}.svg: the frame with the
//    coin's Rynke, shown until a badge has a picture (FR-040a).
//    Every badge and placeholder is one file without the milestone ribbon
//    (FR-040b): the page draws the ribbon over it on the cards and in the
//    large view, and writes the milestone onto it (issue #180).
// 3. Snaps each original in art/badges/originals/ to the coin palette, in place,
//    as <id>.png (research R7): a fraction of the generator's file size, and
//    what tracing needs.
//    A run without ids skips a badge whose public/badges/<id>.svg is
//    committed and unchanged in git, so it never rebuilds the finished set.
// 4. Traces it and writes public/badges/<id>.svg: the frame with the picture in
//    its window. Only a run without ids removes badge SVGs whose original is
//    gone, so a filtered run never deletes another badge.
// 5. Writes src/badges/pictures.ts: every badge with a finished SVG.
// 6. Builds the Team page's quote monkeys from art/quotes/ the same way
//    (scripts/quote-monkeys.mjs, art/quotes/README.md): public/quotes/<id>.svg
//    and src/http/quote-monkeys.ts. Their ids work like badge ids here.
// 7. Updates src/http/art-versions.ts, the pictures' hashes (pnpm art-versions).
//
// Needs ImageMagick and potrace, like pnpm illustrations. Running it again
// without changes changes no file.

import { execFileSync } from "node:child_process";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { frameSvg, placeholderSvg } from "./badge-frame.mjs";
import { validateBadges } from "./badge-prompts.mjs";
import { buildQuoteMonkeys, loadMonkeys } from "./quote-monkeys.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ART = join(ROOT, "art/badges");
const ORIGINALS = join(ART, "originals");
const OUT = join(ROOT, "public/badges");
const LIST = join(ROOT, "src/badges/pictures.ts");
const WARN_BYTES = 100_000;

const fail = (lines) => {
	console.error(lines.join("\n"));
	process.exit(2);
};

// 1. Inputs.
const data = JSON.parse(readFileSync(join(ART, "badges.json"), "utf8"));
const problems = validateBadges(data);
if (!readFileSync(join(ART, "prompt.txt"), "utf8").includes("{{scene}}"))
	problems.push("prompt.txt: no {{scene}}");
const monkeys = loadMonkeys();
const allProblems = [
	...problems.map((p) => `art/badges: ${p}`),
	...monkeys.problems,
];
if (allProblems.length > 0)
	fail(["The art is not valid:", ...allProblems.map((p) => `  ${p}`)]);
const badges = new Map(data.badges.map((b) => [b.id, b]));

const named = process.argv.slice(2);
const unknown = named.filter((id) => !badges.has(id) && !monkeys.ids.has(id));
if (unknown.length > 0)
	fail([`Unknown badge or monkey id(s): ${unknown.join(", ")}`]);
// The named badges; a run naming only monkeys builds no badge.
const only = named.filter((id) => badges.has(id));
const filtered = named.length > 0;

const originals = new Map();
for (const f of readdirSync(ORIGINALS)) {
	if (f.startsWith(".")) continue;
	const id = basename(f, extname(f));
	if (!badges.has(id))
		fail([`art/badges/originals/${f}: no badge ${id} in badges.json`]);
	if (originals.has(id))
		fail([`art/badges/originals: two originals for ${id}, keep one`]);
	originals.set(id, f);
}

/** Writes only when the content changed, so a rebuild leaves git clean. */
function write(path, content) {
	try {
		if (readFileSync(path, "utf8") === content) return false;
	} catch {}
	writeFileSync(path, content);
	return true;
}

// 2. Placeholders.
mkdirSync(OUT, { recursive: true });
for (const kind of ["personal", "team"]) {
	write(join(OUT, `placeholder-${kind}.svg`), placeholderSvg(kind));
	// No ribbon files any more (issue #180).
	rmSync(join(OUT, `placeholder-${kind}-ribbon.svg`), { force: true });
}

/**
 * Ids whose public/<folder>/<id>.svg is committed and has no change in git:
 * tracked, and neither staged nor changed in the working tree. Empty when git
 * isn't there, so everything is built.
 */
function committedSvgs(folder) {
	const git = (...args) =>
		execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
	try {
		const tracked = git("ls-files", "-z", "--", `public/${folder}`)
			.split("\0")
			.filter(Boolean);
		const changed = new Set(
			git("diff", "--name-only", "-z", "HEAD", "--", `public/${folder}`)
				.split("\0")
				.filter(Boolean),
		);
		return new Set(
			tracked
				.filter((f) => f.endsWith(".svg") && !changed.has(f))
				.map((f) => basename(f, ".svg")),
		);
	} catch {
		return new Set();
	}
}

// 3. and 4. Snap, trace, compose. Named ids are built even when committed.
const committed = filtered ? new Set() : committedSvgs("badges");
const chosen = filtered ? only : [...originals.keys()].sort();
const todo = chosen.filter((id) => {
	if (!originals.has(id)) {
		console.log(`${id}: no original yet, skipped`);
		return false;
	}
	if (committed.has(id)) {
		console.log(
			`${id}: committed, skipped (pnpm badge-build ${id} to rebuild)`,
		);
		return false;
	}
	return true;
});
if (todo.length > 0) {
	// Loaded only when there is something to trace: it needs ImageMagick.
	const { snapToPalette, traceImage } = await import("./trace.mjs");
	for (const id of todo) {
		const file = originals.get(id);
		const png = join(ORIGINALS, `${id}.png`);
		const tmp = join(ORIGINALS, `.${id}.snapping.png`);
		snapToPalette(join(ORIGINALS, file), tmp);
		const same = (() => {
			try {
				return readFileSync(tmp).equals(readFileSync(png));
			} catch {
				return false;
			}
		})();
		if (same) rmSync(tmp);
		else renameSync(tmp, png);
		if (file !== `${id}.png`) rmSync(join(ORIGINALS, file));
		originals.set(id, `${id}.png`);

		const { markup } = traceImage(png);
		const group = badges.get(id).group;
		const svg = frameSvg(group, markup, id).replace(
			"</title>",
			`</title><!-- Generated by scripts/badge-build.mjs from art/badges/originals/${id}.png; replace that, then run pnpm badge-build ${id}. -->`,
		);
		const out = join(OUT, `${id}.svg`);
		const changed = write(out, svg);
		rmSync(join(OUT, `${id}-ribbon.svg`), { force: true });
		const size = statSync(out).size;
		const kb = `${Math.round(size / 100) / 10} KB`;
		console.log(
			`${id}: ${changed ? "written" : "unchanged"}, ${kb}${size > WARN_BYTES ? " (large: simpler picture?)" : ""}`,
		);
	}
}

// A full run removes badges whose original is gone, and any ribbon file left
// from before the page drew the ribbon (issue #180).
const finished = () =>
	readdirSync(OUT)
		.filter((f) => f.endsWith(".svg") && !f.startsWith("placeholder-"))
		.map((f) => basename(f, ".svg"))
		.filter((name) => !name.endsWith("-ribbon"));
if (!filtered) {
	for (const f of readdirSync(OUT))
		if (f.endsWith("-ribbon.svg")) rmSync(join(OUT, f));
	for (const id of finished()) {
		if (originals.has(id)) continue;
		rmSync(join(OUT, `${id}.svg`));
		console.log(`${id}: removed (no original)`);
	}
}

// 5. The list the app reads.
const ids = finished()
	.filter((id) => badges.has(id))
	.sort();
mkdirSync(join(ROOT, "src/badges"), { recursive: true });
write(
	LIST,
	`// Generated by scripts/badge-build.mjs (pnpm badge-build); don't edit.
// Badges with a finished picture in public/badges/<id>.svg; every other badge
// shows public/badges/placeholder-<group>.svg (feature 013, FR-040a).
export const BADGE_PICTURES: ReadonlySet<string> = new Set([${ids.map((id) => `\n\t"${id}",`).join("")}${ids.length > 0 ? "\n" : ""}]);
`,
);
console.log(
	`${ids.length} of ${badges.size} badges have a picture (src/badges/pictures.ts).`,
);

// 6. The quote monkeys.
await buildQuoteMonkeys(monkeys, {
	only: named.filter((id) => monkeys.ids.has(id)),
	filtered,
	committed: filtered ? new Set() : committedSvgs("quotes"),
});

// 7. The pictures' hashes for their addresses.
await import("./art-versions.mjs");
