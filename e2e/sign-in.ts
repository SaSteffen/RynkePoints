import type { Page } from "@playwright/test";

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
