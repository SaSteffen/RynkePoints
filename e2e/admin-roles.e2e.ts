import { expect } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// Admin › Rollen (feature 043 quickstart §1–2): the choice dialog gives a role,
// "Rückgängig" takes it back, so the shared fake team ends as it started.
// The riders are the fake mode's synthetic samples. The browsers share one
// fake team and run at once, so each gives the role to its own rider, and
// none of these riders is one the smoke test removes.

const RIDER: Record<string, string> = {
	chromium: "Greta",
	firefox: "Fritz Festtag",
	webkit: "Fabian",
};

test("an administrator gives the Orga role and undoes it", async ({ page }) => {
	await signIn(page, "Alex Admin");
	await page.goto("/admin/roles");
	await skipTours(page);

	const rider = RIDER[test.info().project.name] ?? "Greta";
	const give = page.locator(".roles-give");
	await give.getByRole("searchbox").fill(rider.toLowerCase());
	await expect(give.locator("li[data-name]:visible")).toHaveCount(1);
	await give.getByRole("button", { name: "Rolle geben" }).click();

	const sheet = page.locator("dialog.role-sheet");
	await expect(sheet).toBeVisible();
	await expect(sheet.getByRole("heading")).toHaveText(`Rolle für ${rider}`);
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
		page.locator(`.roles-give li[data-name='${rider.toLowerCase()}']`),
	).toHaveCount(1);
});

test("Abbrechen closes the dialog without a change", async ({ page }) => {
	await signIn(page, "Alex Admin");
	await page.goto("/admin/roles");
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
