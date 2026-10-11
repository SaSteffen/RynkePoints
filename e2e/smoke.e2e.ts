import { test as base, expect, type Page } from "@playwright/test";

// Smoke tests in every browser (chromium, firefox, webkit): each page loads
// without a script error, fits a phone and a desktop without sideways
// scrolling, and the parts `public/app.js` drives show up. The riders are the
// fake mode's synthetic samples (dev/fake-strava/samples.ts).

/** Fails the test on any uncaught error or `console.error` in the page. */
const test = base.extend<{ errors: string[]; noPushInWebKit: undefined }>({
	errors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on("pageerror", (error) => errors.push(error.message));
			page.on("console", (message) => {
				if (message.type() === "error") errors.push(message.text());
			});
			await use(errors);
			expect(errors).toEqual([]);
		},
		{ auto: true },
	],
	// Playwright's WebKit has no push service: getSubscription() never returns
	// and blocks the page. Without PushManager, the app treats it as a browser
	// without push and Settings shows notifications as unsupported.
	noPushInWebKit: [
		async ({ page, browserName }, use) => {
			if (browserName === "webkit") {
				await page.addInitScript(() => {
					delete (globalThis as { PushManager?: unknown }).PushManager;
				});
			}
			await use(undefined);
		},
		{ auto: true },
	],
});

/** Signs in through the fake Strava's permission screen. */
async function signIn(page: Page, rider: string) {
	await page.goto("/_dev/");
	await page
		.getByRole("row")
		.filter({ hasText: rider })
		.getByRole("button", { name: "Connect as" })
		.click();
	await page.getByRole("button", { name: "Authorize" }).click();
	await page.waitForURL(
		(url) => !/^\/(_dev|auth)\//.test(url.pathname) && url.pathname !== "/",
	);
}

const PHONE = { width: 360, height: 740 };
const DESKTOP = { width: 1280, height: 800 };

async function expectNoSidewaysScroll(page: Page) {
	const { scroll, client } = await page.locator("html").evaluate((html) => ({
		scroll: html.scrollWidth,
		client: html.clientWidth,
	}));
	expect(scroll).toBeLessThanOrEqual(client);
}

/** Loads `path` at both sizes and checks the shell around the content. */
async function checkPage(page: Page, path: string, shell = true) {
	for (const size of [PHONE, DESKTOP]) {
		await page.setViewportSize(size);
		const response = await page.goto(path);
		expect(response?.status(), path).toBe(200);
		await expectNoSidewaysScroll(page);
		if (!shell) continue;
		await expect(page.locator("nav.app-nav")).toBeVisible();
		// Unscrolled, the top bar is flat in every browser (#62): still the
		// light scheme's surface-container, not the lifted -high.
		await expect(page.locator("header.top-bar")).toHaveCSS(
			"background-color",
			"rgb(246, 242, 224)",
		);
	}
}

test("landing page", async ({ page }) => {
	await checkPage(page, "/", false);
	await expect(page.locator("h1")).toBeVisible();
});

test.describe("a rider", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, "Tina TrainingDone");
	});

	for (const path of ["/team", "/me", "/me/rides", "/me/settings"]) {
		test(`sees ${path}`, async ({ page }) => {
			await checkPage(page, path);
		});
	}

	test("sees one notifications state in Settings", async ({ page }) => {
		await page.goto("/me/settings");
		const section = page.locator("#notifications");
		await expect(section).toBeVisible();
		await expect(section.locator("[data-state]:visible")).toHaveCount(1);
	});

	test("picks the dark scheme for this device", async ({ page }) => {
		await page.goto("/me/settings");
		await page.locator("label", { has: page.locator("[value=dark]") }).click();
		await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
		await expect(page.locator("body")).toHaveCSS(
			"background-color",
			"rgb(18, 17, 12)",
		);
		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
	});
});

test("an organiser sees the Orga pages", async ({ page }) => {
	await signIn(page, "Olga Organiser");
	for (const path of ["/organiser/riders", "/organiser"]) {
		await checkPage(page, path);
	}
});

// Browsers without an install prompt of their own get their menu steps.
const MANUAL_INSTALL = {
	firefox:
		"Mozilla/5.0 (Android 15; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0",
	macSafari:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
};

for (const [way, userAgent] of Object.entries(MANUAL_INSTALL)) {
	test.describe(`install steps for ${way}`, () => {
		test.use({ userAgent });

		test("show in the app prompt and in Settings", async ({ page }) => {
			await signIn(page, "Tina TrainingDone");
			await page.goto("/me");
			await expect(
				page.locator(`#app-prompt [data-install="${way}"]`),
			).toBeVisible();
			await page.goto("/me/settings");
			await expect(
				page.locator(`#settings-app [data-install="${way}"]`),
			).toBeVisible();
		});
	});
}
