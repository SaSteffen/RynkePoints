// Screenshots every mock page in <dir>/mock/*.html at phone (390) and desktop
// (1280) width into <dir>/shots/, full page, and prints each picture's size
// (the canvas boards need it).
//
//   node .claude/skills/design-canvas/scripts/shoot.mjs <dir>
//
// The mocks keep the app's root-relative stylesheet link, so each is loaded on
// top of a page of the running app (BASE, default http://localhost:8789).
// Animations are off and the bottom navigation is static, so a full-page shot
// shows it once at the end.
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const dir = process.argv[2];
if (!dir) {
	console.error("usage: shoot.mjs <dir>");
	process.exit(2);
}
const base = process.env.BASE ?? "http://localhost:8789";
const out = `${dir}/shots`;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const file of readdirSync(`${dir}/mock`).filter((f) =>
	f.endsWith(".html"),
)) {
	const name = file.replace(/\.html$/, "");
	for (const [w, h] of [
		[390, 844],
		[1280, 900],
	]) {
		const page = await browser.newPage({ viewport: { width: w, height: h } });
		await page.goto(`${base}/privacy`);
		await page.setContent(readFileSync(`${dir}/mock/${file}`, "utf8"), {
			waitUntil: "load",
		});
		await page.addStyleTag({
			content:
				"*{animation:none!important;transition:none!important}" +
				"nav.app-nav{position:static!important}body{padding-bottom:0!important}",
		});
		await page.waitForTimeout(300);
		const path = `${out}/${name}-${w}.png`;
		await page.screenshot({ path, fullPage: true });
		const height = await page.evaluate(
			() => document.documentElement.scrollHeight,
		);
		console.log(`${path} ${w}×${height}`);
		await page.close();
	}
}
await browser.close();
