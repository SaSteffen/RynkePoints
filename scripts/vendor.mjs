#!/usr/bin/env node
// Copies the browser builds of the chart library (feature 009 research R6)
// and the MP4 muxer (feature 033 research R5) from node_modules into
// public/vendor/: no build step for browser code,
// and the version in each file name, so the files can be cached for good.
// The copies are committed. With `--check` nothing is written, and the exit
// code is 1 when a copy is missing, differs or is left over from an older
// version (`pnpm lint` runs it so).
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
const OUT = fileURLToPath(new URL("public/vendor/", ROOT));

/**
 * Each package's browser build, under the name it gets in public/vendor/.
 * The licence is read from `licenceFile`, or LICENSE.md when it's not given.
 */
const PACKAGES = [
	{
		name: "chart.js",
		file: "dist/chart.umd.min.js",
		as: (version) => `chart-${version}.umd.min.js`,
		licence: (version) => `chart-${version}.LICENSE.txt`,
	},
	{
		name: "chartjs-plugin-zoom",
		file: "dist/chartjs-plugin-zoom.min.js",
		as: (version) => `chartjs-plugin-zoom-${version}.min.js`,
		licence: (version) => `chartjs-plugin-zoom-${version}.LICENSE.txt`,
	},
	{
		name: "mp4-muxer",
		file: "build/mp4-muxer.js",
		as: (version) => `mp4-muxer-${version}.js`,
		licence: (version) => `mp4-muxer-${version}.LICENSE.txt`,
		licenceFile: "LICENSE",
	},
];

const check = process.argv.includes("--check");

/** File name → contents that public/vendor/ should hold. */
const wanted = new Map();
for (const pkg of PACKAGES) {
	const dir = new URL(`node_modules/${pkg.name}/`, ROOT);
	const { version } = JSON.parse(
		readFileSync(new URL("package.json", dir), "utf8"),
	);
	wanted.set(pkg.as(version), readFileSync(new URL(pkg.file, dir)));
	wanted.set(
		pkg.licence(version),
		readFileSync(new URL(pkg.licenceFile ?? "LICENSE.md", dir)),
	);
}

const present = existsSync(OUT) ? readdirSync(OUT) : [];
const problems = [];
for (const [name, contents] of wanted) {
	const path = `${OUT}${name}`;
	if (existsSync(path) && readFileSync(path).equals(contents)) continue;
	if (check) problems.push(`${name} is missing or differs`);
	else {
		mkdirSync(OUT, { recursive: true });
		writeFileSync(path, contents);
	}
}
for (const name of present) {
	if (wanted.has(name)) continue;
	if (check) problems.push(`${name} is left over`);
	else rmSync(`${OUT}${name}`);
}

if (problems.length > 0) {
	console.error(
		`public/vendor/ is out of date; run pnpm vendor:\n  ${problems.join("\n  ")}`,
	);
	process.exit(1);
}
