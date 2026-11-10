import { expect, type Page } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";
import { test } from "./test";

// The monkey's hint on the badges page (feature 034 contracts/badges-page.md
// › Browser): picked in the browser, remembered there, kept while the page
// refreshes in place. The rider is the fake mode's synthetic sample.

const RIDER = "Bea Badges";
const KEY = "rp-badge-hint";

const hint = (page: Page) => page.locator(".badge-hints a.badge-hint");

/** The last visit's record, as the page wrote it. */
const record = (page: Page) =>
	page.evaluate(
		(key) => JSON.parse(localStorage.getItem(key) ?? "{}"),
		KEY,
	) as Promise<{ date?: string; key?: string | null }>;

const keysOf = (page: Page) =>
	page
		.locator(".badge-hints template[data-hint]")
		.evaluateAll((templates) =>
			templates.map((t) => t.getAttribute("data-hint") ?? ""),
		);

async function openBadges(page: Page) {
	await signIn(page, RIDER);
	await page.goto("/me/badges");
	await skipTours(page);
	// A visit that celebrates new badges has no hint: past it.
	await page.reload();
	await expect(page.locator(".badges")).toBeVisible();
}

test("shows a hint on the first visit, and the card after a tap (US1)", async ({
	page,
}) => {
	await openBadges(page);
	await page.evaluate((key) => localStorage.removeItem(key), KEY);
	await page.reload();
	const keys = await keysOf(page);
	test.skip(keys.length === 0, "the sample rider has no hint today");
	await expect(hint(page)).toBeVisible();
	const shown = await record(page);
	expect(shown.date).toBe(
		await page.locator(".badge-hints").getAttribute("data-today"),
	);
	expect(keys).toContain(shown.key);
	const href = await hint(page).getAttribute("href");
	await hint(page).click();
	await expect(page.locator(".badge-card:target")).toHaveAttribute(
		"id",
		href?.slice(1) ?? "",
	);
	await expect(page.locator(".badge-card:target")).toBeInViewport();
});

test("never the same hint twice in a row, and none on some visits (US3)", async ({
	page,
}) => {
	await openBadges(page);
	const keys = await keysOf(page);
	test.skip(keys.length < 2, "the sample rider has fewer than two hints");
	const today = await page.locator(".badge-hints").getAttribute("data-today");
	// The page decides when it loads: Math.random fixed for the next load.
	const load = async (random: number) => {
		await page.evaluate(
			(r) => sessionStorage.setItem("random", String(r)),
			random,
		);
		await page.reload();
	};
	await page.addInitScript(() => {
		const fixed = sessionStorage.getItem("random");
		if (fixed !== null) Math.random = () => Number(fixed);
	});

	await page.evaluate(([key, value]) => localStorage.setItem(key, value), [
		KEY,
		JSON.stringify({ date: today, key: keys[0] }),
	] as const);
	await load(0);
	await expect(hint(page)).toBeVisible();
	expect((await record(page)).key).not.toBe(keys[0]);

	const before = await record(page);
	await load(0.99);
	await expect(page.locator(".badge-hints")).toBeHidden();
	await expect(hint(page)).toHaveCount(0);
	expect(await record(page)).toEqual(before);

	// Ten visits with chance: never the same one twice in a row.
	await page.evaluate(() => sessionStorage.removeItem("random"));
	let last = (await record(page)).key;
	for (let visit = 0; visit < 10; visit++) {
		await page.reload();
		await expect(page.locator(".badges")).toBeVisible();
		if ((await hint(page).count()) === 0) continue;
		const { key } = await record(page);
		expect(key).not.toBe(last);
		last = key;
	}
});

test("keeps the hint while the page refreshes in place (FR-013)", async ({
	page,
}) => {
	await page.clock.install();
	await openBadges(page);
	await page.evaluate((key) => localStorage.removeItem(key), KEY);
	await page.reload();
	test.skip((await keysOf(page)).length === 0, "no hint today");
	await expect(hint(page)).toBeVisible();
	const text = await hint(page).textContent();
	await page.locator("main .badges").evaluate((el) => {
		el.setAttribute("data-old", "");
	});
	const visibility = (state: "hidden" | "visible") =>
		page.locator("html").evaluate((root, value) => {
			const doc = root.ownerDocument;
			Object.defineProperty(doc, "visibilityState", {
				configurable: true,
				get: () => value,
			});
			doc.dispatchEvent(new Event("visibilitychange"));
		}, state);
	await visibility("hidden");
	await page.clock.fastForward("01:05");
	await visibility("visible");
	await expect(page.locator("main [data-old]")).toHaveCount(0);
	await expect(hint(page)).toHaveText(text ?? "");
});
