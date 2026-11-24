// Captures real fake-mode pages as a sample rider: each page's HTML, its text
// and full-page screenshots at phone (390) and desktop (1280) width.
//
//   node .claude/skills/design-canvas/scripts/capture.mjs <out-dir> "<Rider Name>" /admin /me/settings …
//
// BASE overrides the app's address (default http://localhost:8789, Hamburg).
// Every tour is dismissed first, so no tour step covers the page.
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const [out, who, ...paths] = process.argv.slice(2);
if (!out || !who || paths.length === 0) {
	console.error('usage: capture.mjs <out-dir> "<Rider Name>" <path> [<path> …]');
	process.exit(2);
}
const base = process.env.BASE ?? "http://localhost:8789";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ baseURL: base })).newPage();
await page.goto("/_dev/");
await page
	.getByRole("row")
	.filter({ hasText: who })
	.getByRole("button", { name: "Connect as" })
	.click();
await page.getByRole("button", { name: "Authorize" }).click();
await page.waitForURL(
	(u) => !/^\/(_dev|auth)\//.test(u.pathname) && u.pathname !== "/",
);
for (const tour of ["rider", "organiser"]) {
	await page.request.post("/me/tour", {
		form: { tour, page: "/me" },
		headers: { Origin: base },
		maxRedirects: 0,
	});
}

for (const path of paths) {
	const name =
		path.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto(path);
	writeFileSync(`${out}/${name}.html`, await page.content());
	writeFileSync(`${out}/${name}.txt`, await page.locator("main").innerText());
	for (const [w, h] of [
		[390, 844],
		[1280, 900],
	]) {
		await page.setViewportSize({ width: w, height: h });
		await page.waitForTimeout(250);
		await page.screenshot({ path: `${out}/${name}-${w}.png`, fullPage: true });
	}
	console.log(`${path} → ${out}/${name}.html, -390.png, -1280.png`);
}
await browser.close();
