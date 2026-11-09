import { expect, type Locator, type Page } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// Sharing a badge (feature 033 quickstart.md): the pictures are drawn in the
// browser and never leave it. The riders are the fake mode's synthetic
// samples; the sample rider's name must never reach a file name.

const RIDER = "Bea Badges";

async function openBadges(page: Page) {
	await signIn(page, RIDER);
	await page.goto("/me/badges");
	await skipTours(page);
}

const sheetOf = (page: Page) => page.locator("dialog.share-sheet");

/** Picks a format by its label, as a rider taps it. */
async function pick(sheet: Locator, format: "story" | "image" | "photo") {
	await sheet
		.locator("label")
		.filter({ has: sheet.page().locator(`input[value="${format}"]`) })
		.tap();
}

/** Waits until the file for the current settings is ready. */
async function ready(sheet: Locator) {
	await expect(sheet.locator(".share-save")).toBeEnabled();
}

/** The bits of a canvas the tests read; the e2e files have no DOM types. */
interface Canvas {
	width: number;
	height: number;
	getContext(kind: "2d"): {
		getImageData(
			x: number,
			y: number,
			w: number,
			h: number,
		): {
			data: ArrayLike<number>;
		};
	} | null;
}

const canvasSize = (sheet: Locator) =>
	sheet
		.locator(".share-preview canvas")
		.evaluate((canvas: Canvas) => [canvas.width, canvas.height]);

test.describe("on a phone", () => {
	test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

	test("shares a badge as a story, a picture and a sticker (US1)", async ({
		page,
	}) => {
		await page.addInitScript(() => {
			const shared: unknown[] = [];
			Object.assign(globalThis, { shared });
			Object.assign(navigator, {
				canShare: (data: { files?: File[] }) =>
					Array.isArray(data.files) && data.files.length > 0,
				share: async (data: { files: File[]; text: string }) => {
					shared.push({
						files: data.files.map((file) => ({
							name: file.name,
							type: file.type,
							isFile: file instanceof File,
						})),
						text: data.text,
					});
				},
			});
		});
		await openBadges(page);

		const mini = page.locator(".badge-card .badge-share-mini").first();
		// Visible without hover on a touch screen (FR-002).
		await expect(mini).toBeVisible();
		const id = await mini.getAttribute("data-badge");
		expect(id).toBeTruthy();
		const shareText = await page
			.locator(`[id="badge-${id}"] .badge-share`)
			.getAttribute("data-share-text");

		await mini.tap();
		const sheet = sheetOf(page);
		await expect(sheet).toHaveAttribute("open", "");
		await expect(sheet.locator('input[value="story"]')).toBeChecked();
		await ready(sheet);
		expect(await canvasSize(sheet)).toEqual([1080, 1920]);

		// Saved as a story, named for the app and the badge, not the rider.
		const story = page.waitForEvent("download");
		await sheet.locator(".share-save").tap();
		const storyName = (await story).suggestedFilename();
		expect(storyName).toMatch(new RegExp(`^[a-z0-9-]+-${id}-story\\.png$`));
		expect(storyName.toLowerCase()).not.toContain("bea");
		await expect(sheet.locator(".share-status")).not.toBeEmpty();

		// Through the system share, with the share text (FR-014).
		await sheet.locator(".share-send").tap();
		const shared = await page.evaluate(
			() => (globalThis as unknown as { shared: unknown[] }).shared,
		);
		expect(shared).toEqual([
			{
				files: [{ name: storyName, type: "image/png", isFile: true }],
				text: shareText,
			},
		]);

		await pick(sheet, "image");
		await ready(sheet);
		expect(await canvasSize(sheet)).toEqual([1080, 1080]);
		const image = page.waitForEvent("download");
		await sheet.locator(".share-save").tap();
		expect((await image).suggestedFilename()).toMatch(
			new RegExp(`^[a-z0-9-]+-${id}-image\\.png$`),
		);

		// "Ohne Hintergrund": the badge alone, transparent around it, and no
		// sparkling video (FR-011).
		await sheet.locator(".share-plain [role=switch]").tap();
		await expect(sheet.locator(".share-plain [role=switch]")).toHaveAttribute(
			"aria-checked",
			"true",
		);
		await ready(sheet);
		const corner = await sheet
			.locator(".share-preview canvas")
			.evaluate(
				(canvas: Canvas) =>
					canvas.getContext("2d")?.getImageData(4, 4, 1, 1).data[3],
			);
		expect(corner).toBe(0);
		await expect(sheet.locator(".share-shiny")).toBeHidden();
		const sticker = page.waitForEvent("download");
		await sheet.locator(".share-save").tap();
		expect((await sticker).suggestedFilename()).toMatch(
			new RegExp(`^[a-z0-9-]+-${id}-sticker\\.png$`),
		);

		await sheet.locator(".share-sheet-close").tap();
		await expect(sheet).not.toHaveAttribute("open", "");
	});

	test("opens the sheet from a badge's large view (FR-004)", async ({
		page,
	}) => {
		await openBadges(page);
		const badge = page.locator(".badge-card button.badge").first();
		const large = page.locator(
			`[id="${await badge.getAttribute("popovertarget")}"]`,
		);
		await badge.tap();
		await expect(large).toBeVisible();
		await large.locator(".badge-share").tap();
		const sheet = sheetOf(page);
		await expect(sheet).toHaveAttribute("open", "");
		await expect(large).toBeHidden();
		await ready(sheet);
		expect(await canvasSize(sheet)).toEqual([1080, 1920]);
	});
});
