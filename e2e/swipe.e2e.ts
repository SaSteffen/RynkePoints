import { expect, type Page, test } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";

// Swiping between the sections (feature 023) on a phone-sized page, with the
// fake mode's synthetic sample rider. Chromium only: real touch input goes
// through its DevTools protocol.

test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

test.skip(({ browserName }) => browserName !== "chromium", "needs CDP touch");

/** A one-finger swipe across the middle of the screen, from `fromX` to `toX`. */
async function swipe(page: Page, fromX: number, toX: number, y = 400) {
	const cdp = await page.context().newCDPSession(page);
	const point = (x: number) => [{ x, y }];
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: point(fromX),
	});
	for (const step of [0.25, 0.5, 0.75, 1]) {
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: point(fromX + (toX - fromX) * step),
		});
	}
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchEnd",
		touchPoints: [],
	});
}

/** The sections a swipe rotates through: the navigation's, without Settings. */
async function ring(page: Page) {
	const paths = await page
		.locator("nav.app-nav a")
		.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
	return paths.filter((path) => path !== "/me/settings");
}

test("swipes round the sections in both directions, Settings left out", async ({
	page,
}) => {
	await signIn(page, "Tina TrainingDone");
	await skipTours(page);
	await page.goto("/team");
	const paths = await ring(page);
	expect(paths.slice(0, 4)).toEqual([
		"/team",
		"/me",
		"/me/rides",
		"/me/badges",
	]);

	// To the left: the next section.
	await swipe(page, 300, 60);
	await page.waitForURL("**/me");
	// To the right, twice: back to Team, then round to the last one.
	await swipe(page, 60, 300);
	await page.waitForURL("**/team");
	await swipe(page, 60, 300);
	await page.waitForURL(`**${paths.at(-1)}`);
	// And to the left from the last one: round to Team.
	await swipe(page, 300, 60);
	await page.waitForURL("**/team");

	// Too short: no switch.
	await swipe(page, 200, 160);
	await page.waitForTimeout(500);
	await expect(page).toHaveURL(/\/team$/);
});

test("doesn't swipe away from Settings", async ({ page }) => {
	await signIn(page, "Tina TrainingDone");
	await skipTours(page);
	await page.goto("/me/settings");
	await swipe(page, 300, 60);
	await page.waitForTimeout(500);
	await expect(page).toHaveURL(/\/me\/settings$/);
});
