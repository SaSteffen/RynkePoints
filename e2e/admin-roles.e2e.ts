import { expect } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// Admin › Rider und Rollen (feature 045 quickstart §2): "Ändern" opens the one
// dialog with the rider's facts, gives a role, "Rückgängig" takes it back, so
// the shared fake team ends as it started. The riders are the fake mode's
// synthetic samples. The browsers share one fake team and run at once, so
// each gives the role to its own rider, and none of these riders is one the
// smoke test removes.

const RIDER: Record<string, string> = {
	chromium: "Greta",
	firefox: "Fritz Festtag",
	webkit: "Fabian",
};

test("an administrator gives the Orga role and undoes it", async ({ page }) => {
	await signIn(page, "Alex Admin");
	await page.goto("/admin/riders");
	await skipTours(page);

	const rider = RIDER[test.info().project.name] ?? "Greta";
	await page.getByRole("searchbox").fill(rider.toLowerCase());
	const visible = page.locator("li[data-name]:visible");
	await expect(visible).toHaveCount(1);
	await visible.getByRole("button", { name: "Ändern" }).click();

	const sheet = page.locator("dialog.role-sheet");
	await expect(sheet).toBeVisible();
	await expect(sheet.getByRole("heading", { level: 2 })).toHaveText(rider);
	await expect(sheet.locator(".rider-facts dt")).toHaveText([
		"Verbindung",
		"Verbunden am",
		"Mitgliedschaft zuletzt geprüft",
		"Import",
	]);
	await expect(sheet.getByRole("link", { name: "Entfernen" })).toHaveAttribute(
		"href",
		/^\/admin\/riders\/\d+\/remove$/,
	);
	await expect(sheet.getByRole("radio", { name: /^Keine/ })).toBeChecked();
	await sheet.getByRole("radio", { name: /^Orga/ }).check();
	await sheet.getByRole("button", { name: "Speichern" }).click();

	const notice = page.locator(".notice-undo");
	await expect(notice).toContainText(`${rider} ist jetzt in der Orga.`);
	await notice.getByRole("button", { name: "Rückgängig" }).click();
	await expect(page.locator(".notice-undo")).toContainText(
		`${rider} ist nicht mehr in der Orga.`,
	);
	await expect(
		page.locator(`li[data-name='${rider.toLowerCase()}']`),
	).toHaveCount(1);
});

test("Abbrechen closes the dialog without a change", async ({ page }) => {
	await signIn(page, "Alex Admin");
	await page.goto("/admin/riders");
	await skipTours(page);
	await page
		.locator("li[data-name='olga organiser']")
		.getByRole("button", { name: "Ändern" })
		.click();
	const sheet = page.locator("dialog.role-sheet");
	await expect(sheet.getByRole("radio", { name: /^Orga/ })).toBeChecked();
	await sheet.getByRole("button", { name: "Abbrechen" }).click();
	await expect(sheet).toBeHidden();
	await expect(page.locator(".notice-undo")).toHaveCount(0);
});
