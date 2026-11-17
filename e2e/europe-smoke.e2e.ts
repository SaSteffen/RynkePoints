import { expect } from "@playwright/test";
import { hamburg } from "../src/teams/hamburg";
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

test("Europe's name", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("body")).toContainText("Team Rynkeby Europe");
});

test("no Hamburg text", async ({ page }) => {
	await page.goto("/");
	await expect(page.locator("body")).not.toContainText("Hamburg");
	await signIn(page, RIDER);
	await skipTours(page);
	for (const path of RIDER_PAGES) {
		await page.goto(path);
		await expect(page.locator("body"), path).not.toContainText("Hamburg");
	}
});

test("a common phrase on the Team page", async ({ page }) => {
	await signIn(page, RIDER);
	await skipTours(page);
	await page.goto("/team");
	await expect(page.locator(".quote").first()).toBeVisible();
});

// Hamburg's badges with Hamburg motifs show the neutral picture (FR-024). Most
// sit in the large views, which stay hidden until opened.
test("the placeholder badge picture", async ({ page }) => {
	await page.goto("/_dev/badges?lang=en");
	await expect(
		page.locator('img[src^="/badges/placeholder.svg"]').first(),
	).toBeAttached();
	for (const id of hamburg.art.teamSpecificBadges) {
		await expect(page.locator(`img[src^="/badges/${id}.svg"]`)).toHaveCount(0);
	}
});

// Europe's 25 km minimum ride length (feature 039 US3).
test("a ride under 25 km doesn't count", async ({ page }) => {
	await signIn(page, "Siiri ShortRide");
	await skipTours(page);
	await page.goto("/me/rides");
	await expect(page.locator("#rides")).toContainText(
		"Too short: 24.9 km, at least 25 km needed.",
	);
});

// No Team Rynke and no events on Europe (feature 039 US4).
test("no events and no Team Rynke", async ({ page }) => {
	await signIn(page, RIDER);
	await skipTours(page);
	await page.goto("/me");
	await expect(page.locator('a[href="/events"]')).toHaveCount(0);
	await expect(page.locator("#tour-team")).toHaveCount(0);
	await page.goto("/team");
	await expect(page.locator("nav.kind-switch")).toHaveCount(0);
	expect((await page.goto("/events"))?.status()).toBe(404);
});

// Europe needs 84 Training Rynke from outside virtual rides (feature 039
// US6); Védís has 70 outdoors and the rest virtual.
test("84 Training Rynke from outside virtual rides", async ({ page }) => {
	await signIn(page, "V\u{e9}d\u{ed}s Virtual");
	await skipTours(page);
	await page.goto("/me");
	await expect(page.locator("#tour-outdoor")).toContainText(
		"Training Rynke outdoors: 70 of 84",
	);
});
