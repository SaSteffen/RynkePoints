// node tools/content-rating/apply.mjs [phrases file] [round] [additions.json]
// Drops every phrase marked "cut" in rounds/<round>/decisions.json, applies rewordings
// ({ old: new }) and appends new quotes at the end of their section. Season
// sections (SEASON_QUOTES_*, one array per season) work the same way.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PHRASES = "src/content/phrases/hamburg.de.ts";
const quotesPath = process.argv[2] ?? DEFAULT_PHRASES;
const roundDir = join(here, "rounds", process.argv[3] ?? "current");
const additionsPath = process.argv[4] ?? join(roundDir, "additions.json");
const decisions = JSON.parse(
	readFileSync(join(roundDir, "decisions.json"), "utf8"),
);
const { rewordings = {}, add = {} } = existsSync(additionsPath)
	? JSON.parse(readFileSync(additionsPath, "utf8"))
	: {};
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const lines = readFileSync(quotesPath, "utf8").split("\n");
const listOf = (line, list) =>
	line.includes("QUOTES_PUSH")
		? "push"
		: line.includes("QUOTES_ON_TRACK")
			? "onTrack"
			: list;
// Every section the file has, so additions to a later season section wait for it.
const known = new Set();
for (let i = 0, list = null; i < lines.length; i++) {
	list = listOf(lines[i], list);
	const comment = lines[i].match(/^\t\/\/\s*(.+)$/);
	if (comment) known.add(`${list}/${comment[1]}`);
}

const out = [];
let list = null;
let section = null;
let indent = "\t";
const flush = () => {
	for (const text of add[`${list}/${section}`] ?? [])
		out.push(`${indent}"${esc(text)}",`);
	if (list && section) delete add[`${list}/${section}`];
};
let removed = 0;
for (const line of lines) {
	const comment = line.match(/^\t\/\/\s*(.+)$/);
	// A section ends at the next comment, at the end of a list or of a season's array.
	if (comment || line.startsWith("] as const") || line === "\t],") flush();
	// Sections the file doesn't have yet go at the end of their list.
	if (line.startsWith("] as const")) {
		for (const key of Object.keys(add).filter(
			(k) => k.startsWith(`${list}/`) && !known.has(k),
		)) {
			out.push(`\t// ${key.slice(list.length + 1)}`);
			for (const text of add[key]) out.push(`\t"${esc(text)}",`);
			delete add[key];
		}
	}
	// SEASON_QUOTES_PUSH contains QUOTES_PUSH, so this covers the season lists too.
	list = listOf(line, list);
	if (comment) section = comment[1];
	if (line.startsWith("] as const") || line === "\t],") section = null;
	const m = line.match(/^(\t+)"((?:[^"\\]|\\.)*)",\s*$/);
	if (m) {
		indent = m[1];
		if (decisions[m[2]]?.verdict === "cut") {
			removed++;
			continue;
		}
		if (rewordings[m[2]]) {
			out.push(`${indent}"${esc(rewordings[m[2]])}",`);
			continue;
		}
	}
	out.push(line);
}
const left = Object.keys(add);
if (left.length) throw new Error(`unknown sections: ${left.join(", ")}`);
writeFileSync(quotesPath, out.join("\n"));
console.log(`removed ${removed}`);
