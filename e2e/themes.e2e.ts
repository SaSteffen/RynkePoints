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

// The page-switch shows (feature 022 US4, contracts/page-switch-show.md).

/** Picks a theme as the menu does, and comes back to the Team page. */
async function inTheme(page: Page, theme: string) {
	await start(page);
	await page.evaluate((t) => localStorage.setItem("rp-theme", t), theme);
	await page.reload();
}

const tab = (page: Page, path: string) =>
	page.locator(`nav.app-nav a[href="${path}"]`);
const show = (page: Page) => page.locator(".show");

/**
 * When the page asks for `path`: the moment the show switches, apart from
 * how long the server then takes.
 */
const leaving = (page: Page, path: string) =>
	page
		.waitForRequest(
			(r) => r.isNavigationRequest() && new URL(r.url()).pathname === path,
		)
		.then(() => Date.now());

test("plays the Konfetti show across a tab switch", async ({ page }) => {
	await inTheme(page, "confetti");
	const left = leaving(page, "/me");
	const started = Date.now();
	await tab(page, "/me").click();
	await expect(show(page)).toHaveClass(/\bshow-confetti\b/);
	await expect(show(page)).toHaveAttribute("aria-hidden", "true");
	await expect(show(page).locator("a, button, input, [tabindex]")).toHaveCount(
		0,
	);
	await expect(page.locator(".show:focus, .show :focus")).toHaveCount(0);
	// The page changes once the show is over, not under it.
	expect((await left) - started).toBeGreaterThanOrEqual(3000);
	await page.waitForURL("**/me");
	await expect(show(page)).toHaveCount(0);
});

test("plays the Disco show too", async ({ page }) => {
	await inTheme(page, "disco");
	await tab(page, "/me").click();
	await expect(show(page)).toHaveClass(/\bshow-disco\b/);
	await expect(show(page).locator(".show-ball")).toHaveCount(1);
	await page.waitForURL("**/me");
	await expect(show(page)).toHaveCount(0, { timeout: 3000 });
});

test("skips the show on a tap, straight to the page", async ({ page }) => {
	await inTheme(page, "confetti");
	await tab(page, "/me").click();
	await expect(show(page)).toHaveCount(1);
	await page.mouse.click(195, 400);
	await page.waitForURL("**/me");
	await expect(show(page)).toHaveCount(0);
});

test("plays nothing on a reload, the current tab or going back", async ({
	page,
}) => {
	await inTheme(page, "confetti");
	await expect(show(page)).toHaveCount(0);
	await tab(page, "/team").click();
	await page.waitForTimeout(300);
	await expect(show(page)).toHaveCount(0);
	await tab(page, "/me").click();
	await page.waitForURL("**/me");
	await expect(show(page)).toHaveCount(0, { timeout: 3000 });
	await page.goBack();
	await page.waitForURL("**/team");
	await page.waitForTimeout(300);
	await expect(show(page)).toHaveCount(0);
});

test("plays nothing for Settings or a link in the page", async ({ page }) => {
	await inTheme(page, "confetti");
	await tab(page, "/me/settings").click();
	await page.waitForURL("**/me/settings");
	await expect(show(page)).toHaveCount(0);
	// The Orga page's group tiles filter the riders.
	await page.goto("/organiser/riders");
	await page.locator("main a.group-tile").first().click();
	await page.waitForURL("**/organiser/riders?group=*");
	await expect(show(page)).toHaveCount(0);
});

test("plays nothing with the shows turned off in Settings", async ({
	page,
}) => {
	await inTheme(page, "disco");
	await page.goto("/me/settings");
	const off = page.locator("#settings-shows [role=switch]");
	await expect(off).toHaveAttribute("aria-checked", "false");
	await off.click();
	await expect(off).toHaveAttribute("aria-checked", "true");
	await tab(page, "/me").click();
	await page.waitForURL("**/me");
	await expect(show(page)).toHaveCount(0);
});

test("plays nothing during a tour", async ({ page }) => {
	await inTheme(page, "confetti");
	await page.goto("/team?tour=rider&step=1");
	await tab(page, "/me").click();
	await page.waitForURL("**/me");
	await expect(show(page)).toHaveCount(0);
});

test("plays nothing in a calm theme", async ({ page }) => {
	await inTheme(page, "forest");
	await tab(page, "/me").click();
	await expect(show(page)).toHaveCount(0);
	await page.waitForURL("**/me");
	await expect(show(page)).toHaveCount(0);
});

test.describe("with reduced motion", () => {
	test.use({ reducedMotion: "reduce" });

	test("fades the surface instead and switches after a quarter second", async ({
		page,
	}) => {
		await inTheme(page, "confetti");
		const left = leaving(page, "/me");
		const started = Date.now();
		await tab(page, "/me").click();
		await expect(show(page).locator(".show-fade")).toHaveCount(1);
		await expect(show(page).locator(".show-piece, .show-rainbow")).toHaveCount(
			0,
		);
		const switched = (await left) - started;
		expect(switched).toBeGreaterThanOrEqual(200);
		// Well before the full show's end at 3.2 s.
		expect(switched).toBeLessThan(2000);
		await page.waitForURL("**/me");
		await expect(show(page)).toHaveCount(0);
	});
});
