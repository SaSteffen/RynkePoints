#!/usr/bin/env node
// Generates the badge pictures (feature 013) with Gemini in the browser, the
// way the rider-state illustrations were made, without the copy and paste: for
// every badge in art/badges/badges.json it opens a fresh Gemini chat, attaches
// the badge base reference, pastes the badge's prompt (art/badges/prompt.txt
// with the badge's scene filled in), waits for the image and downloads it at
// full size to art/badges/originals/<id>.<ext>. Badges that already have an
// original are skipped unless --force. The originals are then traced into SVGs
// like the illustrations (art/badges/README.md).
//
// It drives a real, signed-in Chrome with Playwright; nothing here runs in CI
// or tests. To go easy on Gemini it works strictly one badge at a time in one
// tab, waits a few seconds between the steps of a badge (open, attach, paste,
// send, download), rests one to three minutes between badges (twice as long
// after a failure) and stops after 10 badges per run; run it again to go on. Gemini's page is not an API: when its markup changes, update
// SELECTORS below. On a failure the page is screenshotted to the temp folder
// and the next badge is tried; a usage-limit message stops the run.
//
//   pnpm badge-art                      every badge without an original
//   pnpm badge-art distance-100 run-length-marathon
//   pnpm badge-art --print running-10   print prompts only, no browser
//   pnpm badge-art --force distance-100 make a new one even if one exists
//   pnpm badge-art --cdp http://127.0.0.1:9222   use a Chrome you started
//
// Other options: --profile <dir> (default ~/.cache/rynkepoints/gemini-profile),
// --browser chrome|chromium (default chrome), --timeout <seconds> per image
// (default 300). Pacing, in seconds, as a fixed value or a random range:
// --step <s> between the steps of a badge (default 3-8), --pause <s> between
// badges (default 90-180), --max <n> badges per run (default 10).
import {
	copyFileSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildPrompt, validateBadges } from "./badge-prompts.mjs";

const ART = fileURLToPath(new URL("../art/badges/", import.meta.url));
const OUT = join(ART, "originals");
const DEBUG = join(tmpdir(), "rynkepoints-badge-art");
// pnpm badge-build snaps the originals to the palette in place (research R7);
// the raw downloads are kept here, outside the repo, in case they're needed.
const RAW = join(homedir(), ".cache/rynkepoints/badge-art/raw");
const REFERENCE = {
	personal: join(ART, "reference/badge-personal.png"),
	team: join(ART, "reference/badge-team.png"),
};
const GEMINI = "https://gemini.google.com/app";

// Gemini's page, in English and German. The first match wins.
const SELECTORS = {
	editor: [
		'rich-textarea div[contenteditable="true"]',
		'div.ql-editor[contenteditable="true"]',
		'[role="textbox"][contenteditable="true"]',
	],
	uploadMenu:
		/uploads (&|and) tools|open upload file menu|upload|add files|hochladen|dateien hinzufügen|upload-menü/i,
	uploadItem: /^(upload files?|dateien hochladen|datei hochladen)/i,
	// The menu's hidden image input, in the page once the menu has opened.
	imageInput: 'input[type="file"][accept^="image"]',
	attachmentPreview: [
		"uploader-file-preview",
		'[data-test-id*="file-preview"]',
		".file-preview-container img",
		'input-area-v2 img[src^="blob:"]',
	],
	send: /^(send message|send|nachricht senden|senden)$/i,
	response: "model-response",
	download:
		/download full[- ]size|herunterladen|in originalgröße|in voller größe|download/i,
	limit:
		/(reached|hit) your (daily )?limit|limit (for|on) (image|images)|limit erreicht|kontingent/i,
};

const { values: opts, positionals: only } = parseArgs({
	allowPositionals: true,
	options: {
		force: { type: "boolean", default: false },
		print: { type: "boolean", default: false },
		cdp: { type: "string" },
		profile: {
			type: "string",
			default: join(homedir(), ".cache/rynkepoints/gemini-profile"),
		},
		browser: { type: "string", default: "chrome" },
		step: { type: "string", default: "3-8" },
		pause: { type: "string", default: "90-180" },
		max: { type: "string", default: "10" },
		timeout: { type: "string", default: "300" },
	},
});

const data = JSON.parse(readFileSync(join(ART, "badges.json"), "utf8"));
const template = readFileSync(join(ART, "prompt.txt"), "utf8").trim();
const problems = validateBadges(data);
if (!template.includes("{{scene}}")) problems.push("prompt.txt: no {{scene}}");
if (problems.length > 0) {
	console.error(`art/badges is not valid:\n  ${problems.join("\n  ")}`);
	process.exit(2);
}
const { snippets, badges } = data;
const prompt = (badge) => buildPrompt(template, snippets, badge);

function existing(id) {
	try {
		return readdirSync(OUT).find((f) => f.startsWith(`${id}.`));
	} catch {
		return undefined;
	}
}

const unknown = only.filter((id) => !badges.some((b) => b.id === id));
if (unknown.length > 0) {
	console.error(`Unknown badge id(s): ${unknown.join(", ")}`);
	process.exit(2);
}
const chosen = badges.filter((b) => only.length === 0 || only.includes(b.id));

if (opts.print) {
	for (const badge of chosen) {
		console.log(`### ${badge.id} (attach ${REFERENCE[badge.group]})\n`);
		console.log(`${prompt(badge)}\n`);
	}
	process.exit(0);
}

const todo = chosen.filter((b) => opts.force || !existing(b.id));
if (todo.length === 0) {
	console.log("Every chosen badge has an original already (use --force).");
	process.exit(0);
}

const { chromium } = await import("@playwright/test");
mkdirSync(OUT, { recursive: true });
mkdirSync(DEBUG, { recursive: true });

const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

/** "90-180" or "120": seconds, a random point in the range for each wait. */
function range(name, value) {
	const m = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?$/.exec(value);
	const lo = m ? Number(m[1]) : Number.NaN;
	const hi = m?.[2] ? Number(m[2]) : lo;
	if (!(lo >= 0 && hi >= lo)) {
		console.error(`--${name} needs seconds like 120 or 90-180, not ${value}`);
		process.exit(2);
	}
	return { lo, hi };
}
const STEP = range("step", opts.step);
const PAUSE = range("pause", opts.pause);
const MAX = Number(opts.max);
if (!(Number.isInteger(MAX) && MAX > 0)) {
	console.error(`--max needs a whole number above 0, not ${opts.max}`);
	process.exit(2);
}
/** Seconds at a random point in the range. */
const pick = ({ lo, hi }) => lo + Math.random() * (hi - lo);
const wait = (r) => sleep(pick(r));
/** A breather between two steps of one badge. */
const step = () => wait(STEP);

async function firstVisible(page, selectors, timeout) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		for (const selector of selectors) {
			const loc = page.locator(selector).first();
			if (await loc.isVisible().catch(() => false)) return loc;
		}
		await sleep(0.5);
	}
	return undefined;
}

/** A fresh chat; waits for the user to sign in on the first run. */
async function openChat(page) {
	await page.goto(GEMINI, { waitUntil: "domcontentloaded" });
	let editor = await firstVisible(page, SELECTORS.editor, 30_000);
	if (!editor) {
		console.log(
			"Sign in to Google in the browser window; waiting up to 10 minutes.",
		);
		editor = await firstVisible(page, SELECTORS.editor, 600_000);
		if (!editor) throw new Error("Gemini's prompt box never appeared");
		await page.goto(GEMINI, { waitUntil: "domcontentloaded" });
		editor = await firstVisible(page, SELECTORS.editor, 30_000);
	}
	return editor;
}

/**
 * Attaches the reference through the upload menu's image input, else its file
 * chooser, else a drop on the editor.
 */
async function attach(page, editor, file) {
	try {
		await page
			.getByRole("button", { name: SELECTORS.uploadMenu })
			.first()
			.click({ timeout: 5_000 });
		const input = page.locator(SELECTORS.imageInput).first();
		if ((await input.count()) > 0) {
			await input.setInputFiles(file);
			await page.keyboard.press("Escape").catch(() => {});
		} else {
			const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
			// Awaited below; without this a failed click leaves it to crash the run.
			chooser.catch(() => {});
			await page
				.getByRole("menuitem", { name: SELECTORS.uploadItem })
				.or(page.getByRole("button", { name: SELECTORS.uploadItem }))
				.first()
				.click({ timeout: 5_000 });
			await (await chooser).setFiles(file);
		}
	} catch {
		await page.keyboard.press("Escape").catch(() => {});
		const data = readFileSync(file).toString("base64");
		await editor.evaluate(async (el, b64) => {
			const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
			const dt = new DataTransfer();
			dt.items.add(
				new File([bytes], "badge-reference.png", { type: "image/png" }),
			);
			for (const type of ["dragenter", "dragover", "drop"]) {
				el.dispatchEvent(
					new DragEvent(type, { bubbles: true, dataTransfer: dt }),
				);
			}
		}, data);
	}
	const preview = await firstVisible(page, SELECTORS.attachmentPreview, 30_000);
	if (!preview) throw new Error("the reference image didn't attach");
}

async function send(page, editor, text) {
	await editor.click();
	await editor.fill(text);
	await step();
	const button = page.getByRole("button", { name: SELECTORS.send }).first();
	// Disabled while the attachment is still uploading.
	for (let i = 0; i < 60 && !(await button.isEnabled().catch(() => false)); i++)
		await sleep(0.5);
	if (await button.isEnabled().catch(() => false)) await button.click();
	else await editor.press("Enter");
}

/** Waits for a full image in the last answer; returns its index there. */
async function waitForImage(page, seconds) {
	const handle = await page.waitForFunction(
		({ response, limit }) => {
			const answers = document.querySelectorAll(response);
			const last = answers[answers.length - 1];
			if (!last) return false;
			const limited = new RegExp(limit.source, limit.flags);
			if (limited.test(last.textContent ?? "")) return { limit: true };
			const imgs = [...last.querySelectorAll("img")];
			const i = imgs.findIndex(
				(img) => img.complete && img.naturalWidth >= 512,
			);
			return i >= 0 ? { index: i } : false;
		},
		{
			response: SELECTORS.response,
			limit: { source: SELECTORS.limit.source, flags: SELECTORS.limit.flags },
		},
		{ timeout: seconds * 1000, polling: 2000 },
	);
	return handle.jsonValue();
}

/** A copy of the raw download, by id and time, so retakes don't overwrite it. */
function keepRaw(path, id) {
	mkdirSync(RAW, { recursive: true });
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	copyFileSync(path, join(RAW, `${id}-${stamp}${extname(path)}`));
}

async function download(page, index, id) {
	const answer = page.locator(SELECTORS.response).last();
	const img = answer.locator("img").nth(index);
	await img.scrollIntoViewIfNeeded();
	await img.hover();
	try {
		const event = page.waitForEvent("download", { timeout: 60_000 });
		await answer
			.getByRole("button", { name: SELECTORS.download })
			.first()
			.click({ timeout: 10_000 });
		const file = await event;
		const ext = extname(file.suggestedFilename()) || ".png";
		const path = join(OUT, `${id}${ext}`);
		await file.saveAs(path);
		keepRaw(path, id);
		return { path, full: true };
	} catch {
		// The preview in the page, smaller than the full-size download.
		const { b64, type } = await img.evaluate(async (el) => {
			const blob = await (await fetch(el.src)).blob();
			const buf = new Uint8Array(await blob.arrayBuffer());
			let s = "";
			for (const b of buf) s += String.fromCharCode(b);
			return { b64: btoa(s), type: blob.type };
		});
		const ext = type === "image/jpeg" ? ".jpg" : ".png";
		const path = join(OUT, `${id}${ext}`);
		writeFileSync(path, Buffer.from(b64, "base64"));
		keepRaw(path, id);
		return { path, full: false };
	}
}

const launch = {
	headless: false,
	viewport: null,
	acceptDownloads: true,
	// Google refuses sign-ins in browsers that announce automation.
	ignoreDefaultArgs: ["--enable-automation"],
	args: [
		"--disable-blink-features=AutomationControlled",
		// No "Restore pages?" after a run was stopped mid-way.
		"--hide-crash-restore-bubble",
	],
	// Playwright turns Chrome's sandbox off by default; Gemini needs no exception.
	chromiumSandbox: true,
	...(opts.browser === "chrome" ? { channel: "chrome" } : {}),
};
const browser = opts.cdp ? await chromium.connectOverCDP(opts.cdp) : undefined;
const context = browser
	? browser.contexts()[0]
	: await chromium.launchPersistentContext(opts.profile, launch);
// The tab Chrome opens with, so no blank one sits beside the badge's chat.
const first = browser ? undefined : context.pages()[0];

const batch = todo.slice(0, MAX);
if (todo.length > batch.length)
	console.log(
		`${todo.length} badges to make; this run does ${batch.length} (--max).`,
	);
const failed = [];
// Strictly one badge after the other, never two chats at once.
for (const [n, badge] of batch.entries()) {
	console.log(`[${n + 1}/${batch.length}] ${badge.id}`);
	const page = first ?? (await context.newPage());
	let ok = false;
	try {
		const editor = await openChat(page);
		await step();
		await attach(page, editor, REFERENCE[badge.group]);
		await step();
		await send(page, editor, prompt(badge));
		console.log(`  sent; waiting up to ${opts.timeout} s for the image`);
		const result = await waitForImage(page, Number(opts.timeout));
		if (result.limit) {
			console.error("Gemini's usage limit reached; stopping. Run again later.");
			failed.push(badge.id);
			break;
		}
		await step();
		const old = existing(badge.id);
		const saved = await download(page, result.index, badge.id);
		if (old && join(OUT, old) !== saved.path)
			console.log(`  note: ${old} is still there, remove it`);
		console.log(
			`  saved ${saved.path}${saved.full ? "" : " (preview size: the full-size download failed)"}`,
		);
		ok = true;
	} catch (error) {
		const shot = join(DEBUG, `${badge.id}.png`);
		await page
			.screenshot({ path: shot, timeout: 10_000 })
			.catch((e) => console.error(`  no screenshot: ${e.message}`));
		// The page's buttons, to fix SELECTORS when Gemini's markup changed.
		const buttons = await page
			.locator("button, [role=button], [role=menuitem]")
			.evaluateAll((els) =>
				els.map(
					(el) =>
						`${el.getAttribute("aria-label") ?? ""} | ${el.textContent?.trim().slice(0, 60)}`,
				),
			)
			.catch(() => []);
		writeFileSync(join(DEBUG, `${badge.id}.txt`), buttons.join("\n"));
		console.error(`  failed: ${error.message.split("\n")[0]} (see ${shot})`);
		failed.push(badge.id);
	} finally {
		if (page !== first) await page.close().catch(() => {});
	}
	if (n < batch.length - 1) {
		// Twice the rest after a failure, in case Gemini was the trouble.
		const seconds = pick(PAUSE) * (ok ? 1 : 2);
		console.log(
			`  resting ${Math.round(seconds)} s before the next badge (until ${new Date(Date.now() + seconds * 1000).toLocaleTimeString()})`,
		);
		await sleep(seconds);
	}
}
const left = todo.length - batch.length;
if (left > 0) console.log(`${left} badges left; run pnpm badge-art again.`);

if (browser) await browser.close();
else await context.close();
if (failed.length > 0) {
	console.error(`Not done: ${failed.join(" ")}`);
	process.exit(1);
}
