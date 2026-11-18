import { expect } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// Team Europe before its qualification window opens (feature 040 FR-021), in
// Chromium only: its own server (`pnpm test:e2e:server:europe-early`,
// https://europe.localhost:8799) on 18 November 2026, in the season from
// 1 September but before the window from 1 January 2027. Rides count for the
// badges, not for Rynke.

/**
 * A Europe sample rider whose rides all lie in November so far, among them
 * 14 November's (dev/fake-strava/samples.europe.ts).
 */
const RIDER = "Wouter Winter";

test("a ride that doesn't count yet", async ({ page }) => {
	await signIn(page, RIDER);
	await skipTours(page);
	await page.goto("/me/rides");
	const card = page.locator("li.ride-card.ride-not-yet").first();
	await expect(card.locator(".ride-status")).toHaveText("doesn't count yet");
	// Training Rynke and counted elevation: none yet, never 0.
	const figures = card.locator("dl.ride-figures dd");
	await expect(figures.nth(1)).toHaveText("–");
	await expect(figures.nth(2)).toHaveText("–");
	const why = card.locator("details.ride-why");
	await expect(why).toHaveAttribute("open", "");
	await expect(why).toContainText("Qualifying starts on 01/01/2027.");
});

test("the status box says when qualifying starts", async ({ page }) => {
	await signIn(page, RIDER);
	await skipTours(page);
	await page.goto("/me");
	const start = page.locator("p.rynke-deadline-start");
	await expect(start).toContainText("Qualifying starts on 01/01/2027");
	await expect(start).toContainText("you can already earn badges");
	await expect(page.locator(".rynke-deadline-count")).toHaveCount(0);
});

test("badges from rides before the window", async ({ page }) => {
	await signIn(page, RIDER);
	await skipTours(page);
	await page.goto("/me/badges");
	// His November days earned a November badge before the window opened.
	await expect(
		page.locator(
			'li.badge-card[data-category="winter_november"] button.badge[popovertarget^="badge-winter-november-"]',
		),
	).toBeAttached();
	// December is in Europe's season again, still to come.
	await expect(
		page.locator('li.badge-card[data-category="winter_december"]'),
	).toBeAttached();
	// The gallery shows a badge still to earn only as an outline; the team's
	// showcase pictures every badge it lists, Christmas Eve among them.
	await page.goto("/_dev/badges?lang=en");
	await expect(
		page.locator('img[src^="/badges/surprise-christmas-eve.svg"]').first(),
	).toBeAttached();
});
