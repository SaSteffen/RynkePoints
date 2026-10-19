import { test as base, expect, type Page } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";

// The Overview's progress charts in every browser (feature 009 research R13):
// the period buttons, drag, keys, wheel and touch gestures keep both charts
// on one period, the readout agrees with the table, and dark mode recolours
// the lines. Chart.js draws on a canvas, so the state is read through its
// API (`Chart.getChart`), not from pixels. The riders are the fake mode's
// synthetic samples (dev/fake-strava/samples.ts).

/** Fails the test on any uncaught error or `console.error` in the page. */
const test = base.extend<{ errors: string[]; noPushInWebKit: undefined }>({
	errors: [
		async ({ page }, use) => {
			const errors: string[] = [];
			page.on("pageerror", (error) => errors.push(error.message));
			page.on("console", (message) => {
				if (message.type() === "error") errors.push(message.text());
			});
			await use(errors);
			expect(errors).toEqual([]);
		},
		{ auto: true },
	],
	// Playwright's WebKit has no push service (see smoke.e2e.ts).
	noPushInWebKit: [
		async ({ page, browserName }, use) => {
			if (browserName === "webkit") {
				await page.addInitScript(() => {
					delete (globalThis as { PushManager?: unknown }).PushManager;
				});
			}
			await use(undefined);
		},
		{ auto: true },
	],
});

const PHONE = { width: 360, height: 740 };
const SMALL_PHONE = { width: 320, height: 568 };

type Series = "training" | "team";

interface ChartData {
	axisDays: number;
	lastIndex: number;
	seasonStart: string;
}

/** Signs in as `rider` and opens the Overview once its charts are there. */
async function openOverview(page: Page, rider = "Paula Paging") {
	await signIn(page, rider);
	await page.goto("/me");
	// The waiting state brings the page up to date by itself.
	await expect(page.locator("#progress")).toBeVisible({ timeout: 30_000 });
	await skipTours(page);
	await expect(page.locator("#progress")).toBeVisible();
	await waitForCharts(page);
}

function waitForCharts(page: Page) {
	return page.waitForFunction(() => {
		const { document } = globalThis as unknown as {
			document: { querySelectorAll(selector: string): ArrayLike<Element> };
		};
		const canvases = document.querySelectorAll("#progress canvas");
		const chart = (globalThis as { Chart?: { getChart(c: Element): unknown } })
			.Chart;
		return (
			canvases.length === 2 &&
			chart !== undefined &&
			Array.from(canvases).every((c) => chart.getChart(c) !== undefined)
		);
	});
}

function canvas(page: Page, series: Series) {
	return page.locator(`#progress canvas[data-series="${series}"]`);
}

/** The x axis's shown stretch of a chart, in day indexes. */
function range(page: Page, series: Series) {
	return canvas(page, series).evaluate((element) => {
		const { Chart } = globalThis as unknown as {
			Chart: {
				getChart(c: Element): { scales: { x: { min: number; max: number } } };
			};
		};
		const { min, max } = Chart.getChart(element).scales.x;
		return { min, max };
	});
}

/** Both charts' stretches, after checking they are the same (FR-021). */
async function period(page: Page) {
	const training = await range(page, "training");
	const team = await range(page, "team");
	expect(team.min).toBeCloseTo(training.min, 3);
	expect(team.max).toBeCloseTo(training.max, 3);
	return training;
}

function chartData(page: Page): Promise<ChartData> {
	return page
		.locator("#progress-data")
		.evaluate((script) => JSON.parse(script.textContent ?? "null"));
}

/** The German long date of the season's day `index`, as the readout gives it. */
function longDate(data: ChartData, index: number): string {
	const [year, month, day] = data.seasonStart.split("-").map(Number);
	return new Intl.DateTimeFormat("de-DE", {
		timeZone: "UTC",
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(
		new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + index)),
	);
}

/** Sends synthetic touch pointers over `series`'s canvas (research R13). */
function touch(
	page: Page,
	series: Series,
	steps: { type: string; id: number; dx: number; dy: number }[],
) {
	return canvas(page, series).evaluate((element, list) => {
		const rect = element.getBoundingClientRect();
		const x = rect.left + rect.width / 2;
		const y = rect.top + rect.height / 2;
		for (const { type, id, dx, dy } of list) {
			element.dispatchEvent(
				new (
					globalThis as unknown as {
						PointerEvent: new (type: string, init: object) => Event;
					}
				).PointerEvent(type, {
					pointerId: id,
					pointerType: "touch",
					isPrimary: id === 1,
					clientX: x + dx,
					clientY: y + dy,
					buttons: type === "pointerup" ? 0 : 1,
					bubbles: true,
					cancelable: true,
				}),
			);
		}
	}, steps);
}

test.describe("the progress charts (009)", () => {
	test.beforeEach(async ({ page }) => {
		await openOverview(page);
	});

	test("fit a phone without sideways scrolling", async ({ page }) => {
		for (const size of [SMALL_PHONE, PHONE]) {
			await page.setViewportSize(size);
			await page.goto("/me");
			await expect(page.locator("#progress")).toBeVisible();
			await waitForCharts(page);
			for (const series of ["training", "team"] as const) {
				const box = await canvas(page, series).boundingBox();
				expect(box?.width).toBeGreaterThan(0);
				expect(box?.height).toBeGreaterThan(0);
			}
			const { scroll, client } = await page
				.locator("html")
				.evaluate((html) => ({
					scroll: html.scrollWidth,
					client: html.clientWidth,
				}));
			expect(scroll).toBeLessThanOrEqual(client);
		}
	});

	test("show the last 4 weeks in both charts without a reload", async ({
		page,
	}) => {
		await page.evaluate(() => {
			(globalThis as { e2eMark?: boolean }).e2eMark = true;
		});
		const button = page.getByRole("button", { name: "Letzte 4 Wochen" });
		await button.click();
		const from = Number(await button.getAttribute("data-from"));
		const to = Number(await button.getAttribute("data-to"));
		expect(await period(page)).toEqual({ min: from, max: to });
		await expect(button).toHaveAttribute("aria-pressed", "true");
		await expect(
			page.getByRole("button", { name: "Ganze Saison", exact: true }),
		).toHaveAttribute("aria-pressed", "false");
		expect(
			await page.evaluate(
				() => (globalThis as { e2eMark?: boolean }).e2eMark === true,
			),
		).toBe(true);
	});

	test("zoom both charts to a stretch dragged with the mouse", async ({
		page,
	}) => {
		const { axisDays } = await chartData(page);
		await canvas(page, "training").scrollIntoViewIfNeeded();
		const box = await canvas(page, "training").boundingBox();
		if (!box) throw new Error("no canvas");
		const y = box.y + box.height / 2;
		await page.mouse.move(box.x + box.width * 0.25, y);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.5, y, { steps: 5 });
		await page.mouse.up();
		const zoomed = await period(page);
		expect(zoomed.max - zoomed.min).toBeGreaterThanOrEqual(7);
		expect(zoomed.max - zoomed.min).toBeLessThan(axisDays);
		await page
			.getByRole("button", { name: "Ganze Saison", exact: true })
			.click();
		expect(await period(page)).toEqual({ min: 0, max: axisDays });
	});

	test("step the readout and zoom with the keys", async ({ page }) => {
		const data = await chartData(page);
		const readout = page.locator(".progress-readout");
		await expect(readout).toContainText(longDate(data, data.lastIndex));
		await canvas(page, "team").focus();
		for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
		await expect(readout).toContainText(longDate(data, data.lastIndex - 3));
		const before = await period(page);
		await page.keyboard.press("+");
		const after = await period(page);
		expect(after.max - after.min).toBeLessThan(before.max - before.min);
		await page.keyboard.press("Escape");
		expect(await period(page)).toEqual({ min: 0, max: data.axisDays });
	});

	test("zoom with the wheel only once a chart has focus", async ({ page }) => {
		const { axisDays } = await chartData(page);
		await page.locator("h2#progress-heading").click();
		await canvas(page, "training").scrollIntoViewIfNeeded();
		const box = await canvas(page, "training").boundingBox();
		if (!box) throw new Error("no canvas");
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.wheel(0, -200);
		// The page may scroll; the charts don't zoom.
		await page.waitForTimeout(300);
		expect(await period(page)).toEqual({ min: 0, max: axisDays });
		const scrolled = await page.evaluate(
			() => (globalThis as unknown as { scrollY: number }).scrollY,
		);
		await page.mouse.wheel(0, 120);
		await expect
			.poll(() =>
				page.evaluate(
					() => (globalThis as unknown as { scrollY: number }).scrollY,
				),
			)
			.toBeGreaterThan(scrolled);
		expect(await period(page)).toEqual({ min: 0, max: axisDays });

		await canvas(page, "training").click();
		const now = await canvas(page, "training").boundingBox();
		if (!now) throw new Error("no canvas");
		await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2);
		await page.mouse.wheel(0, -200);
		await expect
			.poll(async () => {
				const { min, max } = await period(page);
				return max - min;
			})
			.toBeLessThan(axisDays);
	});

	test("give the same totals in the readout as in the table", async ({
		page,
	}) => {
		const data = await chartData(page);
		const [year, month, day] = data.seasonStart.split("-").map(Number);
		const weekday = (index: number) =>
			new Date(
				Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + index),
			).getUTCDay();
		// The last Sunday before the last day ends the table's last-but-one row.
		let sunday = data.lastIndex - 1;
		while (weekday(sunday) !== 0) sunday--;
		const rows = page.locator(".progress-table tbody tr");
		const row = rows.nth((await rows.count()) - 2);
		const cells = await row.locator("td").allTextContents();
		await canvas(page, "training").focus();
		await page.keyboard.press("End");
		for (let i = sunday; i < data.lastIndex; i++) {
			await page.keyboard.press("ArrowLeft");
		}
		const readout = page.locator(".progress-readout");
		await expect(readout).toContainText(longDate(data, sunday));
		await expect(readout).toContainText(`${cells[1]} Trainingsrynke`);
		await expect(readout).toContainText(`${cells[3]} Teamrynke`);
	});

	test("pinch and drag with touch, and leave a vertical swipe to the page", async ({
		page,
	}) => {
		const { axisDays } = await chartData(page);
		for (const series of ["training", "team"] as const) {
			await expect(canvas(page, series)).toHaveCSS("touch-action", "pan-y");
		}
		expect(
			await page.evaluate(
				() => (globalThis as { Hammer?: unknown }).Hammer === undefined,
			),
		).toBe(true);

		// Two fingers moving apart zoom in around their midpoint.
		const spread: { type: string; id: number; dx: number; dy: number }[] = [];
		spread.push({ type: "pointerdown", id: 1, dx: -20, dy: 0 });
		spread.push({ type: "pointerdown", id: 2, dx: 20, dy: 0 });
		for (let d = 30; d <= 80; d += 10) {
			spread.push({ type: "pointermove", id: 1, dx: -d, dy: 0 });
			spread.push({ type: "pointermove", id: 2, dx: d, dy: 0 });
		}
		spread.push({ type: "pointerup", id: 1, dx: -80, dy: 0 });
		spread.push({ type: "pointerup", id: 2, dx: 80, dy: 0 });
		await touch(page, "team", spread);
		const pinched = await period(page);
		expect(pinched.max - pinched.min).toBeLessThan(axisDays);
		expect((pinched.min + pinched.max) / 2).toBeGreaterThan(axisDays * 0.35);
		expect((pinched.min + pinched.max) / 2).toBeLessThan(axisDays * 0.65);

		// One finger moving sideways moves the period in both charts.
		const drag = [{ type: "pointerdown", id: 1, dx: 0, dy: 0 }];
		for (let dx = 10; dx <= 100; dx += 10) {
			drag.push({ type: "pointermove", id: 1, dx, dy: 0 });
		}
		drag.push({ type: "pointerup", id: 1, dx: 100, dy: 0 });
		await touch(page, "training", drag);
		const moved = await period(page);
		expect(moved.min).toBeLessThan(pinched.min);
		expect(moved.max - moved.min).toBeCloseTo(pinched.max - pinched.min, 3);

		// Up and down changes nothing.
		const swipe = [{ type: "pointerdown", id: 1, dx: 0, dy: 0 }];
		for (let dy = 10; dy <= 100; dy += 10) {
			swipe.push({ type: "pointermove", id: 1, dx: 0, dy });
		}
		swipe.push({ type: "pointerup", id: 1, dx: 0, dy: 100 });
		await touch(page, "training", swipe);
		expect(await period(page)).toEqual(moved);
	});

	test("take the dark scheme's line colour", async ({ page }) => {
		await page.emulateMedia({ colorScheme: "dark" });
		await expect
			.poll(() =>
				canvas(page, "training").evaluate((element) => {
					const { Chart } = globalThis as unknown as {
						Chart: {
							getChart(c: Element): {
								data: { datasets: { borderColor: string }[] };
							};
						};
					};
					return Chart.getChart(element).data.datasets[0]?.borderColor;
				}),
			)
			.toBe("#a88e00");
	});

	test("load the library from this site, cached for good", async ({ page }) => {
		const response = await page.request.get("/vendor/chart-4.5.1.umd.min.js");
		expect(response.status()).toBe(200);
		expect(response.headers()["cache-control"]).toContain("immutable");
	});
});

test("a rider with virtual rides sees the outdoor curve and the pace (009 US2)", async ({
	page,
}) => {
	await openOverview(page, "Vera Virtual");
	const labels = await canvas(page, "training").evaluate((element) => {
		const { Chart } = globalThis as unknown as {
			Chart: {
				getChart(c: Element): {
					data: {
						datasets: { borderDash?: number[]; borderWidth: number }[];
					};
				};
			};
		};
		return Chart.getChart(element).data.datasets.map(
			(d) => `${d.borderWidth}${d.borderDash?.length ? " dashed" : ""}`,
		);
	});
	// The curve, the outdoor curve, the target, its pace, the 167 line and its pace.
	expect(labels).toEqual(["3", "3", "1.5", "1.5", "1.5", "1.5"]);
	await canvas(page, "training").focus();
	await page.keyboard.press("ArrowLeft");
	const readout = page.locator(".progress-readout");
	await expect(readout).toContainText(
		/vor dem Tempo|hinter dem Tempo|im Tempo/,
	);
	await expect(readout).toContainText("davon draußen:");
});
