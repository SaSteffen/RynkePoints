import { expect } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// Team Europe before its qualification window opens (feature 040 FR-021), in
// Chromium only: its own server (`pnpm test:e2e:server:europe-early`,
// https://europe.localhost:8799) on 18 November 2026, in the season from
// 1 September but before the window from 1 January 2027. Rides count for the
// badges, not for Rynke.

/**
 * A Europe sample rider with rides before the window, among them 14 November's;
 * seeded before it opens, the rest lie in the window
 * (teams/europe/samples.ts).
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

test("the Season ranking counts rides from 1 September", async ({ page }) => {
	await signIn(page, RIDER);
	await page.goto("/team?by=sessions&period=season");
	await skipTours(page);
	await expect(page.locator(".leaderboard .row-total").first()).toBeVisible();
	await expect(page.getByText("Nobody has ridden yet")).toHaveCount(0);
	await expect(
		page.locator(".leaderboard .row-total").first(),
	).not.toContainText(/^0 /);
});

test("organisers see when qualifying starts", async ({ page }) => {
	await signIn(page, "Oskar Organiser");
	await page.goto("/organiser/riders");
	await skipTours(page);
	await expect(page.locator(".overview-before-window")).toContainText(
		"Qualifying starts on",
	);
	await page.goto("/organiser/riders?view=graphs");
	await expect(page.locator("#organiser-graphs")).toContainText(
		"The dashed line marks the start of qualifying",
	);
});

test("the Team page leads with km and keeps Rynke waiting", async ({
	page,
}) => {
	await signIn(page, RIDER);
	await skipTours(page);
	await page.goto("/team");
	await expect(page.locator("nav.rank-by [aria-current]")).toHaveText("km");
	await expect(page.locator(".team-total-week")).toContainText(
		"Rynke count from 01/01/2027",
	);
	// The peloton and the km chart, which Rank by doesn't change, come first;
	// Rank by sits right above the place card and the leaderboard it changes
	// (on wide screens the three have their own column).
	const inOrder = async (selectors: readonly string[]) => {
		const tops = await Promise.all(
			selectors.map(
				async (selector) => (await page.locator(selector).boundingBox())?.y,
			),
		);
		expect(tops.every((y) => y !== undefined)).toBe(true);
		expect(tops).toEqual([...tops].sort((a, b) => (a ?? 0) - (b ?? 0)));
	};
	await inOrder(["figure.peloton", "figure.team-chart"]);
	await inOrder([".rank-controls", ".my-place", ".leaderboard"]);
	await expect(
		page.locator(".before-window", { has: page.locator("figure.peloton") }),
	).toContainText("Rynke count from 01/01/2027");
	await expect(page.locator(".leaderboard .before-window")).toHaveCount(0);
	// Picking Rynke covers its ranking, and Rank by still switches back.
	await page.locator("nav.rank-by a", { hasText: "Rynke" }).click();
	await expect(page.locator(".leaderboard .before-window-note")).toBeVisible();
	await page.locator("nav.rank-by a", { hasText: "km" }).click();
	await expect(page.locator(".leaderboard .before-window")).toHaveCount(0);
});
