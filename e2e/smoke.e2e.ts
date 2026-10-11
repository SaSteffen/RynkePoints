import { test as base, expect, type Page } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";

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

	test("keeps the scroll position on the Team switches (#113)", async ({
		page,
	}) => {
		await page.setViewportSize(PHONE);
		await page.goto("/team");
		await skipTours(page);
		const other = page.locator("nav.kind-switch a:not([aria-current])");
		const html = page.locator("html");
		const scrollTop = () => html.evaluate((root) => root.scrollTop);
		// The switch is at the top: a real tap there would scroll back up
		// first, so the page is scrolled down and the link clicked as is.
		await html.evaluate((root) => {
			root.scrollTop = Math.min(200, root.scrollHeight - root.clientHeight);
		});
		const before = await scrollTop();
		expect(before).toBeGreaterThan(0);
		await other.dispatchEvent("click");
		await page.waitForURL(/kind=team/);
		await expect.poll(scrollTop).toBe(before);
		// Another way to the page still starts at the top.
		await page.goto("/team");
		expect(await scrollTop()).toBe(0);
	});

	test("picks the dark scheme for this device", async ({ page }) => {
		await page.goto("/me/settings");
		await skipTours(page);
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

test("a rider walks through the tour, one page each", async ({ page }) => {
	await signIn(page, "Vera Virtual");
	// Started as from Settings, so it doesn't depend on another browser's run.
	await page.goto("/team?tour=rider");
	const tour = page.locator("aside.tour");
	for (const [path, step] of [
		["/team", "1 von 4"],
		["/me", "2 von 4"],
		["/me/rides", "3 von 4"],
	] as const) {
		await expect(tour).toContainText(step);
		await expect(page.locator(`nav.app-nav a[href="${path}"]`)).toHaveClass(
			"tour-target",
		);
		await tour.getByRole("link", { name: "Weiter" }).click();
	}
	await expect(page).toHaveURL(/\/me\/settings\?tour=rider$/);
	await expect(tour).toContainText("4 von 4");
	await tour.getByRole("button", { name: "Alles klar" }).click();
	await expect(page).toHaveURL(/\/me\/settings$/);
	await expect(tour).toHaveCount(0);
	await page.goto("/team");
	await expect(tour).toHaveCount(0);
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
			await skipTours(page);
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
