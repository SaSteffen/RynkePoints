import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./sign-in";

// Screenshots of every page that shows Strava data, or data derived from it,
// for Strava's Developer Program review (docs/strava-developer-program.md,
// step 6). Fake mode's synthetic riders only (constitution Principle I), in
// both languages, on a phone and a desktop. Run through
// `scripts/strava-review.sh`, which reads the manifest written at the end.

const OUT = process.env.STRAVA_REVIEW_OUT ?? "strava-review/manual";
const LANGS = ["de", "en"] as const;
const SIZES = {
	phone: { width: 390, height: 844 },
	desktop: { width: 1280, height: 800 },
} as const;

interface Shot {
	file: string;
	path: string;
	what: string;
}

/** What each screenshot shows, for the report; written after the last test. */
const manifest: Shot[] = [];

/** The `page()` routes in src/http/router.ts the review doesn't need. */
const NOT_SHOWN = new Set([
	"/connect", // redirects to Strava
	"/auth/callback", // redirects to a page
]);

/** Every route in src/http/router.ts's `page()`, by the path it answers. */
const COVERED = new Set([
	"/",
	"/me",
	"/me/rides",
	"/team",
	"/me/settings",
	"/me/disconnect",
	"/organiser",
	"/organiser/riders",
]);

async function shoot(page: Page, lang: string, slug: string, what: string) {
	for (const [size, viewport] of Object.entries(SIZES)) {
		await page.setViewportSize(viewport);
		const path = new URL(page.url()).pathname;
		await page.reload({ waitUntil: "networkidle" });
		const file = join(lang, size, `${slug}.png`);
		await page.screenshot({ path: join(OUT, file), fullPage: true });
		manifest.push({ file, path, what });
	}
}

async function visit(page: Page, path: string) {
	const response = await page.goto(path, { waitUntil: "networkidle" });
	expect(response?.status(), path).toBe(200);
}

/** The first link on the page to a path under `prefix`, visible or not. */
async function firstLink(
	page: Page,
	prefix: string,
	hasText?: string,
): Promise<string> {
	const href = await page
		.locator(`a[href^="${prefix}"]`)
		.filter({ hasText })
		.first()
		.getAttribute("href");
	expect(href, prefix).toBeTruthy();
	return href ?? "";
}

test.describe.configure({ mode: "serial" });

test("every page route is in the review", () => {
	const router = readFileSync("src/http/router.ts", "utf8");
	const pages = router.slice(router.indexOf("async function page("));
	const routes = [...pages.matchAll(/case "([^"]+)":/g)].map((m) => m[1]);
	const missing = routes.filter(
		(r) => r !== undefined && !COVERED.has(r) && !NOT_SHOWN.has(r),
	);
	expect(
		missing,
		"new pages: screenshot them here and in docs/strava-developer-program.md",
	).toEqual([]);
});

for (const lang of LANGS) {
	test.describe(lang, () => {
		test.beforeEach(async ({ context, baseURL }) => {
			await context.addCookies([
				{ name: "rp_lang", value: lang, url: baseURL ?? "" },
			]);
		});

		test("public pages", async ({ page }) => {
			await visit(page, "/");
			await expect(page.locator("img.cws-light")).toBeVisible();
			await shoot(
				page,
				lang,
				"01-landing",
				"Landing page: what we read and who sees it, the rider's consent, and the official Connect with Strava button",
			);
			await page.goto("/notice/team-full");
			await shoot(
				page,
				lang,
				"02-team-full",
				"Shown when Strava refuses another athlete because the app is at capacity",
			);
		});

		test("a rider's pages", async ({ page }) => {
			await signIn(page, "Tina TrainingDone");
			const pages = [
				[
					"/me",
					"03-me",
					"The rider's own overview: points derived from their rides. Only the rider sees it.",
				],
				[
					"/me/rides",
					"04-rides",
					"The rider's own rides, with names and View on Strava links. Only the rider sees it.",
				],
				[
					"/team",
					"05-team",
					"Team page: every rider's points without names, for the whole team",
				],
				[
					"/me/settings",
					"06-settings",
					"The rider's settings: language, notifications, disconnecting",
				],
				[
					"/me/disconnect",
					"07-disconnect",
					"Disconnecting: deletes all of the rider's data and revokes the app's access",
				],
			] as const;
			for (const [path, slug, what] of pages) {
				await visit(page, path);
				await expect(page.locator("footer img.pbs-light")).toBeVisible();
				await shoot(page, lang, slug, what);
			}
		});

		test("an organiser's pages", async ({ page }) => {
			await signIn(page, "Olga Organiser");
			await visit(page, "/organiser");
			await shoot(
				page,
				lang,
				"08-organiser-events",
				"Organisers: the team's events",
			);
			await visit(page, await firstLink(page, "/organiser/events/"));
			await shoot(
				page,
				lang,
				"09-organiser-event",
				"Organisers: one event and which riders attended (first names)",
			);
			await visit(page, "/organiser/riders");
			await shoot(
				page,
				lang,
				"10-organiser-riders",
				"Organisers: the riders by first name, with their points status",
			);
			await visit(page, await firstLink(page, "/organiser/riders/", "Tina"));
			await shoot(
				page,
				lang,
				"11-organiser-rider",
				"Organisers: one rider's points and where they come from (first name)",
			);
		});

		test("a push notification", async ({ page }) => {
			await signIn(page, "Tina TrainingDone");
			// The text the service worker shows: the rider's own rise, else the
			// cached general text.
			let response = await page.request.get(
				`/me/notification-text?lang=${lang}`,
			);
			if (response.status() !== 200) {
				response = await page.request.get(`/notification-text?lang=${lang}`);
			}
			const { title, body } = (await response.json()) as {
				title: string;
				body: string;
			};
			const icon = new URL("/icons/icon-192.png", page.url()).href;
			await page.setViewportSize(SIZES.phone);
			// Waits for "load", so the icon is in.
			await page.setContent(`<!doctype html>
<style>body{margin:0;padding:24px;background:#1c1b1f;font-family:system-ui,sans-serif;width:342px}
.n{display:flex;gap:12px;background:#f4eff4;border-radius:24px;padding:16px;color:#1c1b1f}
.n img{width:40px;height:40px;border-radius:50%}.t{font-weight:600}</style>
<div class="n"><img src="${icon}" alt=""><div><div class="t"></div><div class="b"></div></div></div>`);
			await page.locator(".t").evaluate((el, text) => {
				el.textContent = text;
			}, title);
			await page.locator(".b").evaluate((el, text) => {
				el.textContent = text;
			}, body);
			const file = join(lang, "phone", "12-notification.png");
			await page.locator("body").screenshot({ path: join(OUT, file) });
			manifest.push({
				file,
				path: "(push)",
				what: "Push notification to the rider's own device about new points (mock-up of the phone's notification with the app's real text)",
			});
		});
	});
}

test.afterAll(() => {
	writeFileSync(
		join(OUT, "screens.json"),
		`${JSON.stringify(manifest, null, "\t")}\n`,
	);
});
