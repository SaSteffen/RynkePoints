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
// or tests. Gemini's page is not an API: when its markup changes, update
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
// --browser chrome|chromium (default chrome), --pause <seconds> between badges
// (default 20), --timeout <seconds> per image (default 300).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const ART = fileURLToPath(new URL("../art/badges/", import.meta.url));
const OUT = join(ART, "originals");
const DEBUG = join(tmpdir(), "rynkepoints-badge-art");
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
		/open upload file menu|upload|add files|hochladen|dateien hinzufügen|upload-menü/i,
	uploadItem: /^(upload files?|dateien hochladen|datei hochladen)/i,
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
		pause: { type: "string", default: "20" },
		timeout: { type: "string", default: "300" },
	},
});

const { snippets, badges } = JSON.parse(
	readFileSync(join(ART, "badges.json"), "utf8"),
);
const template = readFileSync(join(ART, "prompt.txt"), "utf8").trim();

/** The badge's full prompt: the template with its scene and snippets filled in. */
function prompt(badge) {
	const scene = badge.scene.replace(/{{(\w+)}}/g, (_, name) => {
		if (!(name in snippets)) throw new Error(`${badge.id}: no snippet ${name}`);
		return snippets[name];
	});
	return template.replace("{{scene}}", scene);
}

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

/** Attaches the reference through the upload menu, else a drop on the editor. */
async function attach(page, editor, file) {
	try {
		const chooser = page.waitForEvent("filechooser", { timeout: 10_000 });
		await page
			.getByRole("button", { name: SELECTORS.uploadMenu })
			.first()
			.click({ timeout: 5_000 });
		const item = page
			.getByRole("menuitem", { name: SELECTORS.uploadItem })
			.or(page.getByRole("button", { name: SELECTORS.uploadItem }))
			.first();
		if (await item.isVisible().catch(() => false)) await item.click();
		await (await chooser).setFiles(file);
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
		{ timeout: seconds * 1000, polling: 1000 },
	);
	return handle.jsonValue();
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
		return { path, full: false };
	}
}

const launch = {
	headless: false,
	viewport: null,
	acceptDownloads: true,
	// Google refuses sign-ins in browsers that announce automation.
	ignoreDefaultArgs: ["--enable-automation"],
	args: ["--disable-blink-features=AutomationControlled"],
	...(opts.browser === "chrome" ? { channel: "chrome" } : {}),
};
const browser = opts.cdp ? await chromium.connectOverCDP(opts.cdp) : undefined;
const context = browser
	? browser.contexts()[0]
	: await chromium.launchPersistentContext(opts.profile, launch);

const failed = [];
for (const [n, badge] of todo.entries()) {
	console.log(`[${n + 1}/${todo.length}] ${badge.id}`);
	const page = await context.newPage();
	try {
		const editor = await openChat(page);
		await attach(page, editor, REFERENCE[badge.group]);
		await send(page, editor, prompt(badge));
		const result = await waitForImage(page, Number(opts.timeout));
		if (result.limit) {
			console.error("Gemini's usage limit reached; stopping. Run again later.");
			failed.push(badge.id);
			break;
		}
		const old = existing(badge.id);
		const saved = await download(page, result.index, badge.id);
		if (old && join(OUT, old) !== saved.path)
			console.log(`  note: ${old} is still there, remove it`);
		console.log(
			`  saved ${saved.path}${saved.full ? "" : " (preview size: the full-size download failed)"}`,
		);
	} catch (error) {
		const shot = join(DEBUG, `${badge.id}.png`);
		await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
		console.error(`  failed: ${error.message.split("\n")[0]} (see ${shot})`);
		failed.push(badge.id);
	} finally {
		await page.close().catch(() => {});
	}
	if (n < todo.length - 1) await sleep(Number(opts.pause));
}

if (browser) await browser.close();
else await context.close();
if (failed.length > 0) {
	console.error(`Not done: ${failed.join(" ")}`);
	process.exit(1);
}
