import { expect, type Page } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// The ride stats ranking in every browser (feature 032 quickstart.md): picking a
// figure and a period swaps the Team page in place, the places and the place
// card follow, and the organiser's Sessions graph draws. The riders are the
// fake mode's synthetic samples.

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 360, height: 740 };

const rankBy = (page: Page) => page.locator("nav.rank-by");
const period = (page: Page) => page.locator("nav.rank-period");

async function openTeam(page: Page, rider: string) {
	await signIn(page, rider);
	await page.goto("/team");
	await skipTours(page);
}

for (const [name, size] of [
	["a phone", PHONE],
	["a wide screen", WIDE],
] as const) {
	test(`picks km, then Week, then Sessions on ${name}`, async ({ page }) => {
		await page.setViewportSize(size);
		await openTeam(page, "Paula Paging");
		await expect(rankBy(page).locator('[aria-current="true"]')).toHaveText(
			"Rynke",
		);
		await expect(period(page)).toHaveCount(0);

		// The page swaps in place: the marker set before the tap survives.
		await page.evaluate(() => {
			(globalThis as { rideStatsMarker?: boolean }).rideStatsMarker = true;
		});
		const marker = () =>
			page.evaluate(
				() => (globalThis as { rideStatsMarker?: boolean }).rideStatsMarker,
			);

		await rankBy(page).getByRole("link", { name: "km" }).click();
		await expect(page).toHaveURL(/\/team\?by=km$/);
		await expect(rankBy(page).locator('[aria-current="true"]')).toHaveText(
			"km",
		);
		await expect(page.locator(".leaderboard .ride-bar").first()).toBeVisible();
		await expect(page.locator(".my-place .place-typical")).toBeVisible();
		await expect(page.locator(".ride-team-line")).toBeVisible();

		await period(page).getByRole("link", { name: "Woche" }).click();
		await expect(page).toHaveURL(/\/team\?by=km&period=week$/);
		await expect(period(page).locator('[aria-current="true"]')).toHaveText(
			"Woche",
		);

		await rankBy(page).getByRole("link", { name: "Fahrten" }).click();
		await expect(page).toHaveURL(/\/team\?by=sessions&period=week$/);
		await expect(page.locator(".leaderboard .row-total").first()).toContainText(
			"Fahrt",
		);
		await expect(page.locator(".my-place .place-next").first()).toContainText(
			"nach Fahrten, Woche",
		);
		expect(await marker()).toBe(true);
	});
}

test("draws the organiser's Sessions graph", async ({ page }) => {
	await page.setViewportSize(PHONE);
	await signIn(page, "Olga Organiser");
	await page.goto("/organiser/riders");
	await skipTours(page);
	await page.goto("/organiser/riders?view=graphs");
	await page.locator('#organiser-graphs button[data-tab="sessions"]').click();
	await page.waitForFunction(() => {
		const { document, Chart } = globalThis as unknown as {
			document: { querySelector(selector: string): unknown };
			Chart?: { getChart(c: unknown): unknown };
		};
		const canvas = document.querySelector(
			'#organiser-graphs canvas[data-metric="sessions"]',
		);
		return Chart !== undefined && Chart.getChart(canvas) !== undefined;
	});
	await expect(
		page.locator('#organiser-graphs figure[data-metric="sessions"]'),
	).toBeVisible();
});
