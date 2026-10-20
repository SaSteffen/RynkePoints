#!/usr/bin/env node
// Makes every listed rider's season album (feature 021 US3,
// contracts/season-album-command.md): starts the local album Worker
// (album/wrangler.jsonc) under `wrangler dev`, prints each rider's album page
// with Playwright's Chromium into season-albums/<season>/, which git ignores,
// and checks every PDF for print (research R14).
//
//   pnpm season:album [--cutoff YYYY-MM-DD] [--local] [--rider <athleteId>]
//
// Without --local it reads production's D1 through Wrangler's login, read
// only (album/guard.ts); it writes nothing, calls no Strava and notifies no
// one. Like `pnpm strava:review --remote`, that is a manual maintainer task.
// It never uploads or deletes an album: the maintainer hands each rider their
// own and deletes the folder.
import { execFileSync, spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_ROOT = join(ROOT, "season-albums");
const PORT = 8798;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const MM_PER_PT = 25.4 / 72;
const DAY_MS = 86_400_000;

const EXIT_PRINT_CHECK = 1;
const EXIT_PRECONDITION = 2;
const EXIT_WORKER = 3;

function fail(code, message) {
	console.error(message);
	process.exit(code);
}

// Options.
const USAGE =
	"Usage: pnpm season:album [--cutoff YYYY-MM-DD] [--local] [--rider <athleteId>]";
const options = { cutoff: null, local: false, rider: null };
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
	const arg = args[i];
	if (arg === "--local") options.local = true;
	else if (arg === "--cutoff" && args[i + 1]) options.cutoff = args[++i];
	else if (arg === "--rider" && /^\d+$/.test(args[i + 1] ?? ""))
		options.rider = Number(args[++i]);
	else fail(EXIT_PRECONDITION, USAGE);
}

const berlinToday = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Berlin",
}).format(new Date());
const cutoff = options.cutoff ?? berlinToday;

const config = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8");
const setting = (name) =>
	config.match(new RegExp(`"${name}": "([^"]+)"`))?.[1] ?? null;
const seasonStart = setting("SEASON_START_DATE");
const deadline = setting("QUALIFICATION_DEADLINE");
if (!seasonStart || !deadline) {
	fail(
		EXIT_PRECONDITION,
		"wrangler.jsonc has no SEASON_START_DATE or QUALIFICATION_DEADLINE.",
	);
}
const startYear = Number(seasonStart.slice(0, 4));
const season = `${startYear}/${String(startYear + 1).slice(2)}`;
const OUT = join(OUT_ROOT, season.replace("/", "-"));

// Preconditions: nothing is written when one fails.
function isCalendarDate(value) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function ignoredByGit(path) {
	try {
		execFileSync("git", ["check-ignore", "-q", path], { cwd: ROOT });
		return true;
	} catch {
		return false;
	}
}

if (!ignoredByGit("season-albums/")) {
	fail(
		EXIT_PRECONDITION,
		"season-albums/ is not ignored by git. Add it to .gitignore first: the albums hold real rider data.",
	);
}
if (!existsSync(chromium.executablePath())) {
	fail(
		EXIT_PRECONDITION,
		"Playwright's Chromium is not installed. Run: pnpm exec playwright install chromium",
	);
}
if (!isCalendarDate(cutoff)) {
	fail(EXIT_PRECONDITION, `--cutoff ${cutoff} is not a date YYYY-MM-DD.`);
}
if (cutoff > berlinToday) {
	fail(
		EXIT_PRECONDITION,
		`The cut-off ${cutoff} is after today (${berlinToday}).`,
	);
}
if (cutoff < seasonStart) {
	fail(
		EXIT_PRECONDITION,
		`The cut-off ${cutoff} is before the season start ${seasonStart} in wrangler.jsonc. Has the season start already moved to the next season? Make the albums with the season start of the season they are for.`,
	);
}

// Albums from an earlier run (FR-034).
function pdfsUnder(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return pdfsUnder(path);
		return entry.name.endsWith(".pdf") ? [path] : [];
	});
}

function age(ms) {
	const days = Math.floor((Date.now() - ms) / DAY_MS);
	if (days === 0) return "today";
	return days === 1 ? "1 day ago" : `${days} days ago`;
}

const earlier = pdfsUnder(OUT_ROOT);

console.log(
	`Season ${season}, cut-off ${cutoff}, ${options.local ? "sample season (--local)" : "production (read-only)"}`,
);
if (earlier.length > 0) {
	const newest = Math.max(...earlier.map((path) => statSync(path).mtimeMs));
	const oldest = Math.min(...earlier.map((path) => statSync(path).mtimeMs));
	const when =
		age(newest) === age(oldest)
			? `from ${age(newest)}`
			: `from ${age(oldest)} to ${age(newest)}`;
	console.log(
		`${earlier.length} ${earlier.length === 1 ? "album" : "albums"} ${when} ${earlier.length === 1 ? "is" : "are"} still in season-albums/.`,
	);
}

// The album Worker.
let worker = null;
let browser = null;
let workerLog = "";

function stopAll() {
	if (worker && worker.exitCode === null) {
		try {
			// Its own process group: wrangler and workerd go with it.
			process.kill(-worker.pid, "SIGTERM");
		} catch {}
	}
	worker = null;
}

process.on("exit", stopAll);
for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => {
		stopAll();
		process.exit(130);
	});
}

async function startWorker() {
	const wranglerArgs = [
		"dev",
		"-c",
		"album/wrangler.jsonc",
		"--ip",
		"127.0.0.1",
		"--port",
		String(PORT),
		"--var",
		`SEASON_START_DATE:${seasonStart}`,
		"--var",
		`QUALIFICATION_DEADLINE:${deadline}`,
		"--show-interactive-dev-session=false",
		...(options.local
			? ["--local", "--persist-to", ".wrangler/fake-state"]
			: []),
	];
	worker = spawn(join(ROOT, "node_modules", ".bin", "wrangler"), wranglerArgs, {
		cwd: ROOT,
		detached: true,
		stdio: ["ignore", "pipe", "pipe"],
	});
	for (const stream of [worker.stdout, worker.stderr]) {
		stream.on("data", (chunk) => {
			workerLog += chunk;
		});
	}
	const started = Date.now();
	while (Date.now() - started < 90_000) {
		if (!worker || worker.exitCode !== null) break;
		try {
			const res = await fetch(`${ORIGIN}/album.css`);
			if (res.ok) return;
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	stopAll();
	fail(
		EXIT_WORKER,
		`The album Worker did not start:\n${workerLog.trim() || "(no output)"}`,
	);
}

async function getJson(path) {
	const res = await fetch(`${ORIGIN}${path}`);
	if (!res.ok) {
		throw new Error(`${path} answered ${res.status}: ${await res.text()}`);
	}
	return res.json();
}

// The print check (research R14, FR-050, FR-053–FR-056). Images and fonts
// are looked for in every object of the file, not only in the pages'
// resources: Chromium also puts images into soft masks and patterns.
function lookupDict(doc, value) {
	const found = value ? doc.context.lookup(value) : undefined;
	return found instanceof PDFDict ? found : null;
}

const nameOf = (dict, key) => dict?.get(PDFName.of(key))?.toString();

/** Whether `font` (a font dictionary) carries its glyphs in the file. */
function embedded(doc, font) {
	const subtype = nameOf(font, "Subtype");
	// Type 3 glyphs are drawn by the PDF itself.
	if (subtype === "/Type3") return true;
	let described = font;
	if (subtype === "/Type0") {
		const descendants = doc.context.lookup(
			font.get(PDFName.of("DescendantFonts")),
		);
		described = lookupDict(doc, descendants?.get?.(0)) ?? font;
	}
	const descriptor = lookupDict(
		doc,
		described.get(PDFName.of("FontDescriptor")),
	);
	return ["FontFile", "FontFile2", "FontFile3"].some((key) =>
		descriptor?.has(PDFName.of(key)),
	);
}

/** Why the album at `path` is not ready for print; empty when it is. */
async function printProblems(path) {
	const doc = await PDFDocument.load(readFileSync(path), {
		updateMetadata: false,
	});
	const reasons = [];
	const pages = doc.getPages();
	if (pages.length % 2 !== 0) {
		reasons.push(`it has ${pages.length} pages, an odd number`);
	}
	pages.forEach((page, index) => {
		const box = page.getMediaBox();
		const width = box.width * MM_PER_PT;
		const height = box.height * MM_PER_PT;
		if (Math.abs(width - 210) > 0.5 || Math.abs(height - 297) > 0.5) {
			reasons.push(
				`page ${index + 1} is ${width.toFixed(1)} × ${height.toFixed(1)} mm, not A4`,
			);
		}
	});
	let images = 0;
	const bareFonts = new Set();
	for (const [, object] of doc.context.enumerateIndirectObjects()) {
		const dict = object instanceof PDFRawStream ? object.dict : object;
		if (!(dict instanceof PDFDict)) continue;
		if (nameOf(dict, "Subtype") === "/Image") images++;
		if (
			nameOf(dict, "Type") === "/Font" &&
			nameOf(dict, "Subtype") !== "/CIDFontType2" &&
			nameOf(dict, "Subtype") !== "/CIDFontType0" &&
			!embedded(doc, dict)
		) {
			bareFonts.add(nameOf(dict, "BaseFont") ?? "a font");
		}
	}
	if (images > 0) {
		reasons.push(
			`it holds ${images} ${images === 1 ? "image" : "images"} where everything should be vector`,
		);
	}
	for (const font of bareFonts) {
		reasons.push(`it uses ${font} without embedding it`);
	}
	return reasons;
}

function megabytes(bytes) {
	return `${Math.round(bytes / 1e6)} MB`;
}

// Making the albums.
await startWorker();
let riders;
try {
	riders = await getJson(`/riders?cutoff=${cutoff}`);
} catch (error) {
	stopAll();
	fail(EXIT_WORKER, `Could not list the riders: ${error.message}`);
}
if (options.rider !== null) {
	riders = riders.filter((rider) => rider.athleteId === options.rider);
	if (riders.length === 0) {
		stopAll();
		fail(EXIT_PRECONDITION, `Rider ${options.rider} is not listed.`);
	}
}

mkdirSync(OUT, { recursive: true });
const written = [];
const failed = [];
let bytes = 0;
const startedAt = Date.now();
try {
	browser = await chromium.launch();
	const page = await browser.newPage();
	for (const rider of riders) {
		const file = join(OUT, `${rider.file}.pdf`);
		const res = await page.goto(
			`${ORIGIN}/album/${rider.athleteId}?cutoff=${cutoff}`,
			{ waitUntil: "networkidle", timeout: 120_000 },
		);
		if (!res?.ok()) {
			throw new Error(
				`the album of ${rider.file} answered ${res?.status()}: ${await res?.text()}`,
			);
		}
		await page.evaluate(() => document.fonts.ready);
		await page.pdf({
			path: file,
			preferCSSPageSize: true,
			printBackground: true,
		});
		written.push(file);
		bytes += statSync(file).size;
		const reasons = await printProblems(file);
		if (reasons.length > 0) failed.push({ file, reasons });
	}
} catch (error) {
	console.error(`Stopped: ${error.message}`);
	if (written.length > 0) {
		console.error(
			`${written.length} albums written so far stay in ${relative(ROOT, OUT)}/.`,
		);
	}
	await browser?.close();
	stopAll();
	process.exit(EXIT_WORKER);
}
await browser.close();
stopAll();

const seconds = (Date.now() - startedAt) / 1000;
console.log(
	`${written.length} ${written.length === 1 ? "album" : "albums"} written to ${relative(ROOT, OUT)}/ (${megabytes(bytes)}, ${seconds.toFixed(0)} s)`,
);
console.log(
	`Print check: ${written.length - failed.length} of ${written.length} passed`,
);
for (const { file, reasons } of failed) {
	for (const reason of reasons) {
		console.log(`  ${relative(OUT, file)}: ${reason}`);
	}
}
console.log("Delete season-albums/ once every rider has their album.");
process.exit(failed.length > 0 ? EXIT_PRINT_CHECK : 0);
