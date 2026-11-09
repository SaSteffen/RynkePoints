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

/** A synthetic photo of one colour, as PNG bytes, made in the page. */
async function syntheticPhoto(page: Page, width: number, height: number) {
	const base64 = await page.evaluate(
		([w, h]) => {
			// The e2e files have no DOM types: just the bits used here.
			const { document } = globalThis as unknown as {
				document: {
					createElement(tag: "canvas"): {
						width: number;
						height: number;
						toDataURL(type: string): string;
						getContext(kind: "2d"): {
							fillStyle: string;
							fillRect(x: number, y: number, w: number, h: number): void;
						} | null;
					};
				};
			};
			const canvas = document.createElement("canvas");
			canvas.width = w;
			canvas.height = h;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("no 2d context");
			ctx.fillStyle = "#2050c0";
			ctx.fillRect(0, 0, w, h);
			return canvas.toDataURL("image/png").split(",")[1] ?? "";
		},
		[width, height] as const,
	);
	return {
		name: "ride.png",
		mimeType: "image/png",
		buffer: Buffer.from(base64, "base64"),
	};
}

/**
 * Where the badge sits on the photo: how many pixels aren't the photo's blue,
 * and their centre as fractions of the photo.
 */
const badgeOnPhoto = (sheet: Locator) =>
	sheet.locator(".share-preview canvas").evaluate((canvas: Canvas) => {
		const { width: w, height: h } = canvas;
		const data = canvas.getContext("2d")?.getImageData(0, 0, w, h).data ?? [];
		let count = 0;
		let x = 0;
		let y = 0;
		for (let i = 0; i < data.length; i += 4) {
			const blue =
				Math.abs((data[i] ?? 0) - 0x20) < 12 &&
				Math.abs((data[i + 1] ?? 0) - 0x50) < 12 &&
				Math.abs((data[i + 2] ?? 0) - 0xc0) < 12;
			if (blue) continue;
			count++;
			x += (i / 4) % w;
			y += Math.floor(i / 4 / w);
		}
		return { count, x: x / count / w, y: y / count / h };
	});

test.describe("on a photo", () => {
	test("puts the badge on the rider's photo, which stays on the device (US2)", async ({
		page,
	}) => {
		await openBadges(page);
		await page.locator(".badge-card .badge-share-mini").first().click();
		const sheet = sheetOf(page);
		await ready(sheet);
		const id = await page
			.locator(".badge-card .badge-share-mini")
			.first()
			.getAttribute("data-badge");

		await sheet
			.locator("label")
			.filter({ hasText: /Auf Foto/ })
			.click();
		const empty = sheet.locator(".share-photo-empty");
		await expect(empty.locator(".share-pick")).toBeVisible();
		await expect(empty).toContainText("Dein Foto bleibt auf deinem Gerät.");
		await expect(sheet.locator(".share-save")).toBeDisabled();

		// From picking to saving, nothing leaves the page (FR-022).
		const requests: string[] = [];
		page.on("request", (request) => {
			if (/^https?:/.test(request.url())) requests.push(request.url());
		});

		await sheet
			.locator(".share-file")
			.setInputFiles(await syntheticPhoto(page, 1600, 1200));
		await ready(sheet);
		await expect(empty).toBeHidden();
		await expect(sheet.locator(".share-repick")).toBeVisible();
		await expect(sheet.locator(".share-hint-mouse")).toBeVisible();
		expect(await canvasSize(sheet)).toEqual([1600, 1200]);

		// The badge starts at the lower right.
		const start = await badgeOnPhoto(sheet);
		expect(start.x).toBeGreaterThan(0.65);
		expect(start.y).toBeGreaterThan(0.65);

		// Dragged with the mouse to the upper left.
		const canvas = sheet.locator(".share-preview canvas");
		const box = await canvas.boundingBox();
		if (!box) throw new Error("no preview");
		await page.mouse.move(box.x + 0.78 * box.width, box.y + 0.78 * box.height);
		await page.mouse.down();
		await page.mouse.move(box.x + 0.4 * box.width, box.y + 0.5 * box.height, {
			steps: 5,
		});
		await page.mouse.move(box.x + 0.3 * box.width, box.y + 0.3 * box.height, {
			steps: 5,
		});
		await page.mouse.up();
		await ready(sheet);
		const dragged = await badgeOnPhoto(sheet);
		expect(dragged.x).toBeLessThan(0.4);
		expect(dragged.y).toBeLessThan(0.4);

		// The wheel makes it bigger.
		await page.mouse.wheel(0, -300);
		await ready(sheet);
		const bigger = await badgeOnPhoto(sheet);
		expect(bigger.count).toBeGreaterThan(dragged.count * 1.3);

		const download = page.waitForEvent("download");
		await sheet.locator(".share-save").click();
		const saved = await download;
		expect(saved.suggestedFilename()).toMatch(
			new RegExp(`^[a-z0-9-]+-${id}-photo\\.png$`),
		);
		const png = await saved.createReadStream().then(async (stream) => {
			const chunks: Buffer[] = [];
			for await (const chunk of stream) chunks.push(chunk as Buffer);
			return Buffer.concat(chunks);
		});
		// A PNG's width and height sit at bytes 16 and 20 of its header.
		expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1600, 1200]);
		expect(requests).toEqual([]);
	});

	test("scales a large photo down and refuses one it can't read", async ({
		page,
	}) => {
		await openBadges(page);
		await page.locator(".badge-card .badge-share-mini").first().click();
		const sheet = sheetOf(page);
		await ready(sheet);
		await sheet
			.locator("label")
			.filter({ hasText: /Auf Foto/ })
			.click();

		await sheet
			.locator(".share-file")
			.setInputFiles(await syntheticPhoto(page, 4000, 1000));
		await ready(sheet);
		expect(await canvasSize(sheet)).toEqual([1920, 480]);

		// "Anderes Foto" with bytes that aren't a picture.
		await sheet.locator(".share-file").setInputFiles({
			name: "ride.jpg",
			mimeType: "image/jpeg",
			buffer: Buffer.from("not a photo at all"),
		});
		await expect(sheet.locator(".share-photo-unreadable")).toBeVisible();
		await expect(sheet.locator(".share-pick")).toBeVisible();
		await expect(sheet.locator(".share-save")).toBeDisabled();

		// Closed and opened again, the photo is gone.
		await sheet.locator(".share-sheet-close").click();
		await page.locator(".badge-card .badge-share-mini").first().click();
		await ready(sheet);
		await sheet
			.locator("label")
			.filter({ hasText: /Auf Foto/ })
			.click();
		await expect(sheet.locator(".share-pick")).toBeVisible();
		await expect(sheet.locator(".share-photo-unreadable")).toBeHidden();
	});
});
