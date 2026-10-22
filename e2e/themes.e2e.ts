import { expect, type Page, test } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";

// The header's theme menu (feature 022 US2, contracts/theme-menu.md) in every
// browser, with the fake mode's synthetic sample rider.

/** Wald's and Rynke Nacht's surface, as the browser reports it. */
const FOREST = "rgb(15, 22, 18)";
const RYNKE_NIGHT = "rgb(18, 17, 12)";

const palette = (page: Page) => page.locator("button.theme-button");
const menu = (page: Page) => page.locator("#theme-menu");

async function start(page: Page) {
	await signIn(page, "Tina TrainingDone");
	await skipTours(page);
	await page.goto("/team");
}

test("picks Wald from the header and keeps it on this device", async ({
	page,
}) => {
	await start(page);
	await page.evaluate(() => {
		(globalThis as { e2eMark?: boolean }).e2eMark = true;
	});
	await palette(page).click();
	await expect(menu(page)).toBeVisible();
	await expect(palette(page)).toHaveAttribute("aria-expanded", "true");
	await menu(page)
		.locator("label", { has: page.locator("[value=forest]") })
		.click();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");
	await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
	await expect(page.locator("body")).toHaveCSS("background-color", FOREST);
	// Applied without a reload, the menu still open with Wald checked.
	expect(
		await page.evaluate(() => (globalThis as { e2eMark?: boolean }).e2eMark),
	).toBe(true);
	await expect(menu(page)).toBeVisible();
	await expect(menu(page).locator("[value=forest]")).toBeChecked();

	await page.reload();
	await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");

	await page.goto("/me/settings");
	await page.getByRole("button", { name: "Abmelden" }).click();
	await page.waitForURL("/");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");
	await signIn(page, "Tina TrainingDone");
	await expect(page.locator("html")).toHaveAttribute("data-theme", "forest");
	await expect(page.locator("body")).toHaveCSS("background-color", FOREST);
});

test("closes the menu with Escape and an outside tap, back on the palette button", async ({
	page,
}) => {
	await start(page);
	await palette(page).click();
	await expect(menu(page).locator("input:checked")).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(menu(page)).toBeHidden();
	await expect(palette(page)).toBeFocused();
	await expect(palette(page)).toHaveAttribute("aria-expanded", "false");

	await palette(page).click();
	await expect(menu(page)).toBeVisible();
	await page.locator("main").click({ position: { x: 5, y: 5 } });
	await expect(menu(page)).toBeHidden();
	await expect(palette(page)).toBeFocused();

	await palette(page).click();
	await menu(page).locator('[data-action="close"]').click();
	await expect(menu(page)).toBeHidden();
	await expect(palette(page)).toBeFocused();
});

test("carries an old dark scheme over as Rynke Nacht", async ({ page }) => {
	await start(page);
	await page.evaluate(() => {
		localStorage.removeItem("rp-theme");
		localStorage.setItem("rp-scheme", "dark");
	});
	await page.reload();
	await expect(page.locator("html")).toHaveAttribute(
		"data-theme",
		"rynke-night",
	);
	expect(
		await page.evaluate(() => [
			localStorage.getItem("rp-theme"),
			localStorage.getItem("rp-scheme"),
		]),
	).toEqual(["rynke-night", null]);
});

test.describe("on a dark device", () => {
	test.use({ colorScheme: "dark" });

	test("follows the device with Automatisch", async ({ page }) => {
		await start(page);
		await palette(page).click();
		await expect(menu(page).locator("[value=auto]")).toBeChecked();
		await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
		await expect(page.locator("body")).toHaveCSS(
			"background-color",
			RYNKE_NIGHT,
		);
	});
});

test.describe("on the smallest phone", () => {
	test.use({ viewport: { width: 320, height: 568 } });

	test("shows both header buttons", async ({ page }) => {
		await start(page);
		await expect(palette(page)).toBeVisible();
		await expect(page.locator("a.refresh")).toBeVisible();
		const [p, r] = await Promise.all([
			palette(page).boundingBox(),
			page.locator("a.refresh").boundingBox(),
		]);
		expect((p?.x ?? 0) + (p?.width ?? 0)).toBeLessThanOrEqual(r?.x ?? 0);
		expect((r?.x ?? 0) + (r?.width ?? 0)).toBeLessThanOrEqual(320);
	});
});
