import { expect } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// Team Europe's smoke test (feature 026 US8, T057), in Chromium only: the app
// in fake mode with `--env europe` on its own server (`pnpm
// test:e2e:server:europe`, https://europe.localhost:8798) and Europe's
// synthetic sample riders (dev/fake-strava/samples.europe.ts).

/** A Europe sample rider with rides, a reached target and the organiser role. */
const RIDER = "Tuuli TrainingDone";

/** Pages a signed-in rider sees, checked for Hamburg's text. */
const RIDER_PAGES = ["/me", "/team", "/me/rides", "/me/badges", "/me/settings"];

test("English by default", async ({ page, request }) => {
	// No Accept-Language at all: the team's default locale.
	const bare = await request.get("/", { headers: { "Accept-Language": "" } });
	expect(bare.status()).toBe(200);
	expect(await bare.text()).toMatch(/<html lang="en"/);
	// Only languages the app doesn't ship (this project's browser locale):
	// the team's foreign locale, English too.
	await page.goto("/");
	await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

// Enable after T050/T052: the team's name still comes from the catalogs.
test.fixme("Europe's name", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("body")).toContainText("Team Rynkeby Europe");
	await expect(page).toHaveTitle(/Europe/);
});

// Enable after T050/T052: the catalogs still name Team Rynkeby Hamburg.
test.fixme("no Hamburg text", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("body")).not.toContainText("Hamburg");
	await signIn(page, RIDER);
	await skipTours(page);
	for (const path of RIDER_PAGES) {
		await page.goto(path);
		await expect(page.locator("body"), path).not.toContainText("Hamburg");
	}
});

// Enable once the common phrase sets exist: they await a human rating round.
test.fixme("a common phrase on the Team page", async ({ page }) => {
	await signIn(page, RIDER);
	await skipTours(page);
	await page.goto("/team");
	await expect(page.locator(".phrase").first()).toBeVisible();
});

// Enable once the placeholder badge picture exists: it waits for the review of
// Hamburg's teamSpecificBadges list.
test.fixme("the placeholder badge picture", async ({ page }) => {
	await page.goto("/_dev/badges?lang=en");
	await expect(page.locator('img[src*="placeholder"]').first()).toBeVisible();
});
