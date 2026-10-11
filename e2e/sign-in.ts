import { expect, type Page } from "@playwright/test";

/** Signs in through the fake Strava's permission screen. */
export async function signIn(page: Page, rider: string) {
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

/**
 * Marks both onboarding tours done for the signed-in rider, as Skip would
 * (issue #90), and reloads, so no hint covers what a test clicks or shoots.
 * The organiser tour is ignored for a rider who isn't an organiser.
 */
export async function skipTours(page: Page) {
	const { origin } = new URL(page.url());
	for (const tour of ["rider", "organiser"]) {
		const response = await page.request.post("/me/tour", {
			form: { tour, page: "/me" },
			headers: { Origin: origin },
			maxRedirects: 0,
		});
		expect(response.status()).toBe(303);
	}
	await page.reload();
	await expect(page.locator("aside.tour")).toHaveCount(0);
}
