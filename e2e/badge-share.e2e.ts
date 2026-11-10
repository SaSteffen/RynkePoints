import { expect, type Locator, type Page } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// Sharing a badge (feature 033 quickstart.md): the pictures are drawn in the
// browser and never leave it. The riders are the fake mode's synthetic
// samples; the sample rider's name must never reach a file name.

const RIDER = "Bea Badges";

// Every picture is drawn in the browser. Linux WebKit, with no GPU and another
// test beside it, takes seconds per step there: past 30 s in the nightly run.
test.describe.configure({ timeout: 90_000 });

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
	await expect(sheet.locator(".share-save")).toBeEnabled({ timeout: 15_000 });
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

	test("shares a badge as a story, a picture and a sticker (US1)", {
		tag: "@cross-browser",
	}, async ({ page }) => {
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

test.describe("on a desktop", () => {
	// The projects' desktop default: 1280 px wide, a mouse, no touch.

	test("shows the share button on hover or focus, never under a preview (US4)", async ({
		page,
		browserName,
	}) => {
		await openBadges(page);
		await page.mouse.move(0, 0);
		const card = page.locator(".badge-card").filter({
			has: page.locator(".badge-share-mini"),
		});
		const badge = card.locator("button.badge").first();
		const mini = card.locator(".badge-share-mini").first();
		const large = page.locator(
			`[id="${await badge.getAttribute("popovertarget")}"]`,
		);

		// Hidden until the mouse is on the card (FR-002).
		await expect(mini).toHaveCSS("opacity", "0");
		await card.first().hover({ position: { x: 4, y: 4 } });
		await expect(mini).toHaveCSS("opacity", "1");

		// The hover preview has no "Teilen" (FR-004) and makes way for the
		// share button (FR-005).
		await badge.hover();
		await expect(large).toBeVisible();
		await expect(large).toHaveClass(/badge-large-hover/);
		await expect(large.locator(".badge-share")).toBeHidden();
		await mini.hover();
		await expect(large).toBeHidden();
		await mini.click();
		const sheet = sheetOf(page);
		await expect(sheet).toHaveAttribute("open", "");

		// A centred dialog, not a bottom sheet.
		const box = await sheet.boundingBox();
		const viewport = page.viewportSize();
		expect(box && viewport).toBeTruthy();
		if (box && viewport) {
			expect(box.y).toBeGreaterThan(0);
			expect(box.y + box.height).toBeLessThan(viewport.height - 1);
			expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(
				2,
			);
		}
		await sheet.locator(".share-sheet-head button").click();
		await expect(sheet).not.toHaveAttribute("open", "");

		// Clicking the badge pins its large view, which then has "Teilen".
		await badge.click();
		await expect(large).toBeVisible();
		await expect(large).not.toHaveClass(/badge-large-hover/);
		await expect(large.locator(".badge-share")).toBeVisible();
		await large.locator(".badge-large-close").click();
		await expect(large).toBeHidden();

		// The keyboard reaches the button and shows it. Safari's Tab skips
		// buttons unless the rider turns that on.
		if (browserName === "webkit") return;
		await page.mouse.move(0, 0);
		await badge.focus();
		await page.keyboard.press("Tab");
		await expect(mini).toBeFocused();
		await expect(mini).toHaveCSS("opacity", "1");
	});

	test("shows the three-dots share icon, not Apple's (US5)", async ({
		page,
	}) => {
		await openBadges(page);
		const mini = page.locator(".badge-share-mini").first();
		await expect(mini.locator(".share-icon-apple")).toHaveCount(1);
		await expect(mini.locator(".share-icon-dots")).toHaveCount(1);
		await mini.hover();
		await expect(mini.locator(".share-icon-dots")).toBeVisible();
		await expect(mini.locator(".share-icon-apple")).toBeHidden();
	});

	test("keeps a long name above the date and inside the picture", async ({
		page,
	}) => {
		await openBadges(page);
		// A synthetic name far longer than any in the catalogs.
		await page.evaluate((name) => {
			const { document } = globalThis as unknown as {
				document: {
					querySelectorAll(s: string): Iterable<{ textContent: string }>;
				};
			};
			for (const h4 of document.querySelectorAll(".badge-large h4"))
				h4.textContent = name;
		}, "Zweieinhalbmal um die Erde und danach noch quer durch ganz Europa bis ans Nordkap und wieder zurück");
		const mini = page.locator(".badge-share-mini").first();
		await mini.hover();
		await mini.click();
		const sheet = sheetOf(page);
		await ready(sheet);
		expect(await canvasSize(sheet)).toEqual([1080, 1920]);

		// The caption band of the story, between the badge and the app mark.
		const caption = await sheet
			.locator(".share-preview canvas")
			.evaluate((canvas: Canvas) => {
				const top = 1290;
				const bottom = 1590;
				const w = canvas.width;
				const data =
					canvas.getContext("2d")?.getImageData(0, top, w, bottom - top).data ??
					[];
				let nameBottom = -1;
				let dateTop = Number.POSITIVE_INFINITY;
				let edge = 0;
				for (let i = 0; i < data.length; i += 4) {
					const r = data[i] ?? 0;
					const g = data[i + 1] ?? 0;
					const b = data[i + 2] ?? 0;
					const x = (i / 4) % w;
					const y = top + Math.floor(i / 4 / w);
					// The name is near-black, the date #6b6650.
					if (r < 60 && g < 60 && b < 50) nameBottom = Math.max(nameBottom, y);
					if (
						Math.abs(r - 0x6b) < 8 &&
						Math.abs(g - 0x66) < 8 &&
						Math.abs(b - 0x50) < 8
					)
						dateTop = Math.min(dateTop, y);
					if ((x < 70 || x >= w - 70) && (r < 245 || g < 245)) edge++;
				}
				return { nameBottom, dateTop, edge };
			});
		expect(caption.nameBottom).toBeGreaterThan(0);
		expect(caption.dateTop).toBeLessThan(1590);
		expect(caption.nameBottom).toBeLessThan(caption.dateTop);
		expect(caption.edge).toBe(0);
	});

	test("copies a still picture (US4)", async ({
		page,
		context,
		browserName,
	}) => {
		test.skip(
			browserName !== "chromium",
			"only Chromium grants the clipboard permission to tests",
		);
		await context.grantPermissions(["clipboard-read", "clipboard-write"]);
		await openBadges(page);
		const card = page.locator(".badge-card").filter({
			has: page.locator(".badge-share-mini"),
		});
		await card.first().hover({ position: { x: 4, y: 4 } });
		await card.locator(".badge-share-mini").first().click();
		const sheet = sheetOf(page);
		await ready(sheet);
		const copy = sheet.locator(".share-copy");
		await expect(copy).toBeVisible();
		await copy.click();
		await expect(sheet.locator(".share-status")).toHaveText(
			"Kopiert: zum Einfügen bereit.",
		);
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

	test("turns and sizes the badge by the handle in its corner and by keys", async ({
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
			.setInputFiles(await syntheticPhoto(page, 1600, 1200));
		await ready(sheet);

		const frame = sheet.locator(".share-frame");
		const handle = sheet.locator(".share-turn");
		await expect(handle).toBeVisible();
		await expect(handle).toHaveAccessibleName(
			"Abzeichen drehen oder Größe ändern",
		);
		const turnOf = () =>
			frame.evaluate((el: { style: { transform: string } }) =>
				Number.parseFloat(el.style.transform.replace("rotate(", "")),
			);
		const start = await badgeOnPhoto(sheet);

		// A quarter turn round the badge's centre, at the same distance.
		const box = await sheet.locator(".share-preview canvas").boundingBox();
		const corner = await handle.boundingBox();
		if (!box || !corner) throw new Error("no preview");
		const cx = box.x + 0.78 * box.width;
		const cy = box.y + 0.78 * box.height;
		const hx = corner.x + corner.width / 2;
		const hy = corner.y + corner.height / 2;
		await page.mouse.move(hx, hy);
		await page.mouse.down();
		await page.mouse.move(cx - (hy - cy), cy + (hx - cx), { steps: 8 });
		await page.mouse.up();
		await ready(sheet);
		expect(await turnOf()).toBeCloseTo(Math.PI / 2, 1);
		// The same badge in the same place, only turned.
		const turned = await badgeOnPhoto(sheet);
		expect(turned.count / start.count).toBeGreaterThan(0.85);
		expect(turned.count / start.count).toBeLessThan(1.15);
		expect(Math.abs(turned.x - start.x)).toBeLessThan(0.04);
		expect(Math.abs(turned.y - start.y)).toBeLessThan(0.04);

		// Up makes it bigger; Shift+Left turns it back by 15°.
		await handle.focus();
		for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowUp");
		await page.keyboard.press("Shift+ArrowLeft");
		await ready(sheet);
		expect((await badgeOnPhoto(sheet)).count).toBeGreaterThan(
			turned.count * 1.3,
		);
		expect(await turnOf()).toBeCloseTo(Math.PI / 2 - Math.PI / 12, 1);
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

/**
 * Whether this browser can encode the story video (research R4): one real
 * frame, since some browsers say yes to H.264 and then fail.
 */
const canEncode = (page: Page) =>
	page.evaluate(async () => {
		// The e2e files have no DOM types: just the bits used here.
		interface Encoder {
			state: string;
			configure(config: object): void;
			encode(frame: { close(): void }, options: object): void;
			flush(): Promise<void>;
			close(): void;
		}
		const g = globalThis as unknown as {
			VideoEncoder?: (new (init: {
				output(): void;
				error(): void;
			}) => Encoder) & {
				isConfigSupported(config: object): Promise<{ supported?: boolean }>;
			};
			VideoFrame: new (source: unknown, init: object) => { close(): void };
			document: {
				createElement(tag: "canvas"): {
					width: number;
					height: number;
					getContext(kind: "2d"): {
						fillRect(x: number, y: number, w: number, h: number): void;
					} | null;
				};
			};
		};
		const config = {
			codec: "avc1.42E028",
			width: 1080,
			height: 1920,
			bitrate: 8_000_000,
			framerate: 30,
			avc: { format: "avc" },
		};
		if (!g.VideoEncoder) return false;
		try {
			if (!(await g.VideoEncoder.isConfigSupported(config)).supported) {
				return false;
			}
			let made = false;
			const encoder = new g.VideoEncoder({
				output: () => {
					made = true;
				},
				error: () => {},
			});
			const canvas = g.document.createElement("canvas");
			canvas.width = config.width;
			canvas.height = config.height;
			canvas.getContext("2d")?.fillRect(0, 0, 2, 2);
			encoder.configure(config);
			const frame = new g.VideoFrame(canvas, { timestamp: 0 });
			encoder.encode(frame, { keyFrame: true });
			frame.close();
			await encoder.flush();
			encoder.close();
			return made;
		} catch {
			return false;
		}
	});

/** Opens the sheet on the first card, once the muxer has loaded or failed. */
async function openSparkling(page: Page) {
	await openBadges(page);
	const mini = page.locator(".badge-card .badge-share-mini").first();
	const id = await mini.getAttribute("data-badge");
	await mini.click();
	const sheet = sheetOf(page);
	await ready(sheet);
	await page.waitForLoadState("networkidle");
	await ready(sheet);
	return { sheet, id };
}

const RENDERING = { timeout: 60_000 };

test.describe("sparkling", () => {
	test.describe.configure({ timeout: 120_000 });
	test("makes the sparkling story as an MP4 on the device, or isn't offered (US3)", async ({
		page,
	}) => {
		const { sheet, id } = await openSparkling(page);
		const shiny = sheet.locator(".share-shiny");
		if (!(await canEncode(page))) {
			await expect(shiny).toBeHidden();
			return;
		}
		await expect(shiny).toBeVisible();
		await shiny.locator("[role=switch]").click();
		await expect(shiny.locator("[role=switch]")).toHaveAttribute(
			"aria-checked",
			"true",
		);
		await expect(sheet.locator(".share-busy")).toBeVisible();
		await expect(sheet.locator(".share-busy")).toHaveText("Wird gerendert …");
		await expect(sheet.locator(".share-save")).toBeDisabled();
		await expect(sheet.locator(".share-copy")).toBeHidden();
		await expect(sheet.locator(".share-busy")).toBeHidden(RENDERING);
		await ready(sheet);
		await expect(sheet.locator(".share-preview video")).toBeVisible();
		await expect(sheet.locator(".share-copy")).toBeHidden();

		const download = page.waitForEvent("download");
		await sheet.locator(".share-save").click();
		const saved = await download;
		expect(saved.suggestedFilename()).toMatch(
			new RegExp(`^[a-z0-9-]+-${id}-story\\.mp4$`),
		);
		const mp4 = await saved.createReadStream().then(async (stream) => {
			const chunks: Buffer[] = [];
			for await (const chunk of stream) chunks.push(chunk as Buffer);
			return Buffer.concat(chunks);
		});
		expect(mp4.subarray(4, 8).toString("latin1")).toBe("ftyp");
		expect(mp4.includes("avc1")).toBe(true);
	});

	test("starts again for new settings and stops when the sheet closes", async ({
		page,
	}) => {
		const errors: string[] = [];
		page.on("console", (message) => {
			if (message.type() === "error") errors.push(message.text());
		});
		page.on("pageerror", (error) => errors.push(error.message));
		const { sheet } = await openSparkling(page);
		test.skip(!(await canEncode(page)), "this browser can't encode H.264");

		await sheet.locator(".share-shiny [role=switch]").click();
		await expect(sheet.locator(".share-busy")).toBeVisible();
		// Bild while the story is rendering: the square one is made instead.
		await sheet
			.locator("label")
			.filter({ hasText: /^Bild$/ })
			.click();
		await expect(sheet.locator(".share-busy")).toBeVisible();
		await expect(sheet.locator(".share-busy")).toBeHidden(RENDERING);
		await ready(sheet);
		const download = page.waitForEvent("download");
		await sheet.locator(".share-save").click();
		expect((await download).suggestedFilename()).toMatch(/-image\.mp4$/);

		// "Ohne Hintergrund" has no video, and the still picture comes back.
		await sheet.locator(".share-plain [role=switch]").click();
		await expect(sheet.locator(".share-shiny")).toBeHidden();
		await ready(sheet);
		await expect(sheet.locator(".share-preview canvas")).toBeVisible();
		await expect(sheet.locator(".share-preview video")).toBeHidden();
		await sheet.locator(".share-plain [role=switch]").click();

		// Closed while rendering: it stops, quietly.
		await expect(sheet.locator(".share-busy")).toBeVisible();
		await sheet.locator(".share-sheet-close").click();
		await expect(sheet).not.toHaveAttribute("open", "");
		await expect(sheet.locator(".share-busy")).toBeHidden();
		await page.waitForTimeout(500);
		expect(errors).toEqual([]);
	});
});

test.describe("sparkling, with reduced motion", () => {
	test.describe.configure({ timeout: 120_000 });
	test.use({ reducedMotion: "reduce" });

	test("doesn't play the video by itself (FR-026)", async ({ page }) => {
		const { sheet } = await openSparkling(page);
		test.skip(!(await canEncode(page)), "this browser can't encode H.264");
		await sheet.locator(".share-shiny [role=switch]").click();
		await expect(sheet.locator(".share-busy")).toBeHidden(RENDERING);
		await ready(sheet);
		const video = sheet.locator(".share-preview video");
		await expect(video).toBeVisible();
		expect(
			await video.evaluate(
				(element: { paused: boolean; controls: boolean }) => [
					element.paused,
					element.controls,
				],
			),
		).toEqual([true, true]);
	});
});
