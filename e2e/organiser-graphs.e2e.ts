import { expect, type Page } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test as base } from "./test";

// The organiser's graphs in every browser (feature 029 contracts/client.md):
// presets, date boxes and gestures keep the boxes and all graphs on one range,
// the lines follow the dropdown and the tiles, and a phone gets its own layout.
// Chart.js draws on a canvas, so the state is read through its API. The riders
// are the fake mode's synthetic samples.

/** Fails the test on any uncaught error or `console.error` in the page. */
const test = base.extend<{ errors: string[] }>({
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
});

const WIDE = { width: 1280, height: 900 };
const PHONE = { width: 360, height: 740 };
const SECTION = "#organiser-graphs";

async function openRiders(page: Page, path: string) {
	await signIn(page, "Olga Organiser");
	await page.goto("/organiser/riders");
	await skipTours(page);
	await page.goto(path);
}

async function openGraphs(page: Page, path = "/organiser/riders") {
	await openRiders(page, path);
	await waitForCharts(page);
}

function waitForCharts(page: Page) {
	return page.waitForFunction((section) => {
		const { document } = globalThis as unknown as {
			document: { querySelectorAll(selector: string): ArrayLike<Element> };
		};
		const chart = (globalThis as { Chart?: { getChart(c: Element): unknown } })
			.Chart;
		const shown = Array.from(
			document.querySelectorAll(`${section} canvas`),
		).filter((c) => (c as unknown as { offsetParent: unknown }).offsetParent);
		return (
			chart !== undefined &&
			shown.length > 0 &&
			shown.every((c) => chart.getChart(c) !== undefined)
		);
	}, SECTION);
}

interface ChartState {
	metric: string;
	min: number;
	max: number;
	lines: string[];
}

/** What every chart that exists shows, through Chart.js. */
function charts(page: Page): Promise<ChartState[]> {
	return page.evaluate((section) => {
		const { document } = globalThis as unknown as {
			document: {
				querySelectorAll(selector: string): ArrayLike<{
					dataset: { metric: string };
				}>;
			};
		};
		const { Chart } = globalThis as unknown as {
			Chart: {
				getChart(c: unknown):
					| {
							scales: { x: { min: number; max: number } };
							data: { datasets: { lineKey: string }[] };
					  }
					| undefined;
			};
		};
		const states: {
			metric: string;
			min: number;
			max: number;
			lines: string[];
		}[] = [];
		for (const canvas of Array.from(
			document.querySelectorAll(`${section} canvas`),
		)) {
			const chart = Chart.getChart(canvas);
			if (!chart) continue;
			states.push({
				metric: canvas.dataset.metric,
				min: chart.scales.x.min,
				max: chart.scales.x.max,
				lines: chart.data.datasets
					.map((set) => String(set.lineKey))
					.filter((key) => key !== "halo"),
			});
		}
		return states;
	}, SECTION);
}

const fromBox = (page: Page) => page.locator(`${SECTION} input[data-from]`);
const toBox = (page: Page) => page.locator(`${SECTION} input[data-to]`);
const preset = (page: Page, name: string) =>
	page.locator(`${SECTION} button[data-preset="${name}"]`);

async function expectAllOnRange(page: Page, from: string, to: string) {
	await expect(fromBox(page)).toHaveValue(from);
	await expect(toBox(page)).toHaveValue(to);
	const start = await page.evaluate(
		(section) =>
			(
				JSON.parse(
					(
						globalThis as unknown as {
							document: {
								querySelector(s: string): { textContent: string };
							};
						}
					).document.querySelector(`${section} #organiser-graphs-data`)
						.textContent,
				) as { firstDay: string }
			).firstDay,
		SECTION,
	);
	const day = (value: string) =>
		Math.round(
			(Date.parse(`${value}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
				86400000,
		);
	for (const chart of await charts(page)) {
		// A one-day range stands half a day either side; + 0 turns -0 into 0.
		expect(Math.ceil(chart.min) + 0).toBe(day(from));
		expect(Math.floor(chart.max) + 0).toBe(day(to));
	}
}

test.describe("wide screen", () => {
	test.use({ viewport: WIDE });

	test("has three graphs, the table above and the switch out of the way", async ({
		page,
	}) => {
		await openGraphs(page);
		expect((await charts(page)).map((c) => c.metric)).toEqual([
			"outdoor",
			"virtual",
			"elevation",
		]);
		await expect(page.locator(".rider-table")).toBeVisible();
		await expect(page.locator(".overview-views")).toBeHidden();
		await expect(page.locator(".rider-search")).toBeHidden();
		const tableBottom = await page
			.locator(".table-scroll")
			.evaluate((el) => el.getBoundingClientRect().bottom);
		const graphsTop = await page
			.locator(SECTION)
			.evaluate((el) => el.getBoundingClientRect().top);
		expect(graphsTop).toBeGreaterThan(tableBottom);
	});

	test("keeps boxes, presets and graphs on one range", async ({ page }) => {
		await openGraphs(page);
		await expect(preset(page, "season")).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		const seasonFrom = await fromBox(page).inputValue();
		const seasonTo = await toBox(page).inputValue();
		await preset(page, "4w").click();
		await expect(preset(page, "4w")).toHaveAttribute("aria-pressed", "true");
		await expect(preset(page, "season")).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		const fourWeeksFrom = await fromBox(page).inputValue();
		await expectAllOnRange(page, fourWeeksFrom, seasonTo);
		// A typed date marks no preset.
		await fromBox(page).fill(seasonFrom);
		await toBox(page).fill(seasonFrom);
		await toBox(page).dispatchEvent("change");
		await expect(preset(page, "4w")).toHaveAttribute("aria-pressed", "false");
		await expectAllOnRange(page, seasonFrom, seasonFrom);
		await preset(page, "season").click();
		await expectAllOnRange(page, seasonFrom, seasonTo);
	});

	test("moves To along when From goes past it", async ({ page }) => {
		await openGraphs(page);
		await preset(page, "4w").click();
		const to = await toBox(page).inputValue();
		const start = await fromBox(page).inputValue();
		await toBox(page).fill(start);
		await toBox(page).dispatchEvent("change");
		await fromBox(page).fill(to);
		await fromBox(page).dispatchEvent("change");
		await expect(toBox(page)).toHaveValue(to);
	});

	test("takes a mouse drag across a graph as the range", async ({ page }) => {
		await openGraphs(page);
		const before = await fromBox(page).inputValue();
		const canvas = page.locator(`${SECTION} canvas[data-metric="outdoor"]`);
		await canvas.scrollIntoViewIfNeeded();
		const box = await canvas.boundingBox();
		if (!box) throw new Error("No canvas");
		await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, {
			steps: 8,
		});
		await page.mouse.up();
		await expect(fromBox(page)).not.toHaveValue(before);
		await expectAllOnRange(
			page,
			await fromBox(page).inputValue(),
			await toBox(page).inputValue(),
		);
		await preset(page, "season").click();
		await expect(fromBox(page)).toHaveValue(before);
	});

	test("chooses lines in the dropdown, and closes it three ways", async ({
		page,
	}) => {
		await openGraphs(page);
		const toggle = page.locator(`${SECTION} [data-picker-toggle]`);
		const panel = page.locator(`${SECTION} [data-picker-panel]`);
		await expect(panel).toBeHidden();
		await toggle.click();
		await expect(panel).toBeVisible();
		// Search and tick.
		await page.locator(`${SECTION} [data-picker-query]`).fill("Clear-all");
		await expect(page.locator(`${SECTION} [data-picker-none]`)).toBeVisible();
		await panel.getByRole("button", { name: /Fertig|Done/ }).click();
		await expect(panel).toBeHidden();
		await expect(toggle).toBeFocused();
		await toggle.click();
		await page.keyboard.press("Escape");
		await expect(panel).toBeHidden();
		await toggle.click();
		await page.mouse.click(2, 400);
		await expect(panel).toBeHidden();
		// Clear all takes every line, the team's too.
		await toggle.click();
		await page.locator(`${SECTION} [data-picker-clear]`).click();
		await expect
			.poll(async () => (await charts(page))[0]?.lines.length)
			.toBe(0);
		// One rider, ticked straight away.
		await page
			.locator(`${SECTION} .org-graphs-option[data-rider]`)
			.first()
			.locator("input")
			.check();
		await expect
			.poll(async () => (await charts(page))[0]?.lines.length)
			.toBe(1);
	});

	test("greys a crowd and ranks its legend, and highlights one line", async ({
		page,
	}) => {
		await openGraphs(page, "/organiser/riders?group=all");
		const crowd = page.locator(
			`${SECTION} figure[data-metric="outdoor"] .org-legend-entry`,
		);
		expect(await crowd.count()).toBeGreaterThan(8);
		await expect(
			page.locator(`${SECTION} figure[data-metric="outdoor"] [data-legend]`),
		).toHaveClass(/org-legend-many/);
		await expect(crowd.first()).toHaveAttribute("data-line", "average");
		// A mouse highlights on hover, a click clears and sets, leaving clears.
		await crowd.nth(2).hover();
		await expect(crowd.nth(2)).toHaveAttribute("aria-pressed", "true");
		await crowd.nth(2).click();
		await expect(crowd.nth(2)).toHaveAttribute("aria-pressed", "false");
		await crowd.nth(2).click();
		await expect(crowd.nth(2)).toHaveAttribute("aria-pressed", "true");
		await page.mouse.move(2, 400);
		await expect(crowd.nth(2)).toHaveAttribute("aria-pressed", "false");
	});

	test("lists who hasn't agreed, without a checkbox, and says how many", async ({
		page,
	}) => {
		await openGraphs(page, "/organiser/riders?group=all");
		await page.locator(`${SECTION} [data-picker-toggle]`).click();
		const waiting = page.locator(`${SECTION} .org-graphs-waiting`);
		await expect(waiting).toBeVisible();
		await expect(page.locator(`${SECTION} [data-note]`)).toBeVisible();
		const name = (await waiting.textContent())?.match(/: (\w+)/)?.[1] ?? "";
		expect(name).not.toBe("");
		await expect(
			page.locator(
				`${SECTION} .org-graphs-option[data-name="${name.toLowerCase()}"]`,
			),
		).toHaveCount(0);
	});

	test("keeps range and view over a tile click, and takes the new group's riders", async ({
		page,
	}) => {
		await openGraphs(page, "/organiser/riders?group=all");
		await preset(page, "4w").click();
		await page.locator(`${SECTION} button[data-mode="daily"]`).click();
		const all = (await charts(page))[0]?.lines.length ?? 0;
		await page.locator(".group-tile.tile-in").click();
		await page.waitForURL(/group=in/);
		await waitForCharts(page);
		await expect(preset(page, "4w")).toHaveAttribute("aria-pressed", "true");
		await expect(
			page.locator(`${SECTION} button[data-mode="daily"]`),
		).toHaveAttribute("aria-pressed", "true");
		expect((await charts(page))[0]?.lines.length).toBeLessThan(all);
	});
});

test.describe("phone", () => {
	test.use({ viewport: PHONE, hasTouch: true });

	test("switches between graphs and riders, one graph at a time", async ({
		page,
	}) => {
		await openGraphs(page);
		await expect(page.locator(".table-scroll")).toBeHidden();
		await expect(page.locator(".overview-views")).toBeVisible();
		await expect(page.locator(".rider-rows")).toBeHidden();
		expect((await charts(page)).map((c) => c.metric)).toEqual(["outdoor"]);
		await page.locator(`${SECTION} button[data-tab="elevation"]`).click();
		expect((await charts(page)).map((c) => c.metric)).toEqual(["elevation"]);
		// The date boxes only after "Custom".
		await expect(fromBox(page)).toBeHidden();
		await page.locator(`${SECTION} button[data-custom]`).click();
		await expect(fromBox(page)).toBeVisible();
		// To the riders: no chart left, the search and the rows there.
		await page.locator('[data-view-pick="riders"]').click();
		await expect(page.locator(SECTION)).toBeHidden();
		await expect(page.locator(".rider-rows")).toBeVisible();
		expect(await charts(page)).toEqual([]);
		await page.locator('[data-view-pick="graphs"]').click();
		await waitForCharts(page);
	});

	test("pinches and drags like the rider's charts, with the boxes following", async ({
		page,
	}) => {
		await openGraphs(page);
		await page.locator(`${SECTION} button[data-custom]`).click();
		const seasonFrom = await fromBox(page).inputValue();
		const canvas = page.locator(`${SECTION} canvas[data-metric="outdoor"]`);
		await expect(canvas).toHaveCSS("touch-action", "pan-y");
		const touch = (steps: { type: string; id: number; dx: number }[]) =>
			canvas.evaluate((element, list) => {
				const rect = element.getBoundingClientRect();
				const x = rect.left + rect.width / 2;
				const y = rect.top + rect.height / 2;
				for (const { type, id, dx } of list) {
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
							clientY: y,
							buttons: type === "pointerup" ? 0 : 1,
							bubbles: true,
							cancelable: true,
						}),
					);
				}
			}, steps);

		const spread = [
			{ type: "pointerdown", id: 1, dx: -20 },
			{ type: "pointerdown", id: 2, dx: 20 },
		];
		for (let d = 30; d <= 80; d += 10) {
			spread.push({ type: "pointermove", id: 1, dx: -d });
			spread.push({ type: "pointermove", id: 2, dx: d });
		}
		spread.push({ type: "pointerup", id: 1, dx: -80 });
		spread.push({ type: "pointerup", id: 2, dx: 80 });
		await touch(spread);
		await expect(fromBox(page)).not.toHaveValue(seasonFrom);
		const pinchedFrom = await fromBox(page).inputValue();
		await expectAllOnRange(page, pinchedFrom, await toBox(page).inputValue());

		const drag = [{ type: "pointerdown", id: 1, dx: 0 }];
		for (let dx = 10; dx <= 100; dx += 10) {
			drag.push({ type: "pointermove", id: 1, dx });
		}
		drag.push({ type: "pointerup", id: 1, dx: 100 });
		await touch(drag);
		await expect(fromBox(page)).not.toHaveValue(pinchedFrom);
		await expect(preset(page, "season")).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	test("finds a rider across the groups, and a tile clears the search", async ({
		page,
	}) => {
		await openRiders(page, "/organiser/riders?view=riders");
		const search = page.locator("[data-rider-search]");
		await expect(search).toBeVisible();
		await search.fill("tina");
		const rows = page.locator(".rider-row:visible");
		await expect(rows).toHaveCount(1);
		// Five or fewer are open.
		await expect(rows.first().locator("details").first()).toHaveAttribute(
			"open",
			"",
		);
		await search.fill("nobody-called-this");
		await expect(page.locator("[data-rider-none]")).toBeVisible();
		await page.locator(".group-tile.tile-all").click();
		await page.waitForURL(/group=all/);
		await expect(page.locator("[data-rider-search]")).toHaveValue("");
		const all = await page.locator(".rider-row:visible").count();
		expect(all).toBeGreaterThan(5);
		await expect(
			page.locator(".rider-row:visible details").first(),
		).not.toHaveAttribute("open", "");
	});

	test("doesn't scroll sideways", async ({ page }) => {
		await openGraphs(page);
		const overflow = () =>
			page.evaluate(() => {
				const { documentElement } = (
					globalThis as unknown as {
						document: {
							documentElement: { scrollWidth: number; clientWidth: number };
						};
					}
				).document;
				return documentElement.scrollWidth - documentElement.clientWidth;
			});
		expect(await overflow()).toBeLessThanOrEqual(0);
		await page.locator(`${SECTION} [data-picker-toggle]`).click();
		expect(await overflow()).toBeLessThanOrEqual(0);
		await page.keyboard.press("Escape");
		await page.locator('[data-view-pick="riders"]').click();
		expect(await overflow()).toBeLessThanOrEqual(0);
	});
});
