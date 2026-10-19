import { test as base, expect, type Page } from "@playwright/test";
import { signIn, skipTours } from "./sign-in";

// Smoke tests in every browser (chromium, firefox, webkit): each page loads
// without a script error, fits a small phone, a phone and a desktop without sideways
// scrolling, and the parts `public/app.js` drives show up. The riders are the
// fake mode's synthetic samples (dev/fake-strava/samples.ts).

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
	// Playwright's WebKit has no push service: getSubscription() never returns
	// and blocks the page. Without PushManager, the app treats it as a browser
	// without push and Settings shows notifications as unsupported.
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
/** The narrowest phones still in use, such as the first iPhone SE (#115). */
const SMALL_PHONE = { width: 320, height: 568 };
const DESKTOP = { width: 1280, height: 800 };

async function expectNoSidewaysScroll(page: Page) {
	const { scroll, client } = await page.locator("html").evaluate((html) => ({
		scroll: html.scrollWidth,
		client: html.clientWidth,
	}));
	expect(scroll).toBeLessThanOrEqual(client);
}

/** Loads `path` at both sizes and checks the shell around the content. */
/** Marks the loaded page; a reload or another page load loses the mark. */
async function markPage(page: Page) {
	await page.evaluate(() => {
		(globalThis as { e2eMark?: boolean }).e2eMark = true;
	});
}

/** Whether the page marked by `markPage` is still the one shown. */
function samePage(page: Page) {
	return page.evaluate(
		() => (globalThis as { e2eMark?: boolean }).e2eMark === true,
	);
}

async function checkPage(page: Page, path: string, shell = true) {
	for (const size of [SMALL_PHONE, PHONE, DESKTOP]) {
		await page.setViewportSize(size);
		const response = await page.goto(path);
		expect(response?.status(), path).toBe(200);
		await expectNoSidewaysScroll(page);
		if (!shell) continue;
		await expect(page.locator("nav.app-nav")).toBeVisible();
		// Unscrolled, the top bar is flat in every browser (#62): still the
		// light scheme's surface-container, not the lifted -high.
		await expect(page.locator("header.top-bar")).toHaveCSS(
			"background-color",
			"rgb(246, 242, 224)",
		);
	}
}

test("landing page", async ({ page }) => {
	await checkPage(page, "/", false);
	await expect(page.locator("h1")).toBeVisible();
});

test.describe("a rider", () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page, "Tina TrainingDone");
	});

	for (const path of [
		"/team",
		"/me",
		"/me/rides",
		"/me/badges",
		"/me/settings",
	]) {
		test(`sees ${path}`, async ({ page }) => {
			await checkPage(page, path);
		});
	}

	test("sees one notifications state in Settings", async ({ page }) => {
		await page.goto("/me/settings");
		const section = page.locator("#notifications");
		await expect(section).toBeVisible();
		await expect(section.locator("[data-state]:visible")).toHaveCount(1);
	});

	test("swaps the Team views in place, at the same scroll position (#113)", async ({
		page,
	}) => {
		await page.setViewportSize(PHONE);
		await page.goto("/team");
		await page.waitForLoadState();
		const kind = page.locator("nav.kind-switch a[aria-current]");
		const html = page.locator("html");
		const scrollTop = () => html.evaluate((root) => root.scrollTop);
		await markPage(page);
		// The switch is at the top: a real tap there would scroll back up
		// first, so the page is scrolled down and the link clicked as is.
		await html.evaluate((root) => {
			root.scrollTop = Math.min(200, root.scrollHeight - root.clientHeight);
		});
		const before = await scrollTop();
		expect(before).toBeGreaterThan(0);
		await page
			.locator("nav.kind-switch a:not([aria-current])")
			.dispatchEvent("click");
		await page.waitForURL(/kind=team/);
		await expect(kind).toHaveAttribute("href", "/team?kind=team");
		expect(await scrollTop()).toBe(before);
		expect(await samePage(page)).toBe(true);

		// The back button brings the previous view back, still in place.
		await page.goBack();
		await expect(kind).toHaveAttribute("href", "/team");
		expect(await samePage(page)).toBe(true);

		// Another way to the page still starts at the top.
		await page.goto("/team");
		expect(await scrollTop()).toBe(0);
	});

	test("picks the dark scheme for this device", async ({ page }) => {
		await page.goto("/me/settings");
		await skipTours(page);
		await page.locator("label", { has: page.locator("[value=dark]") }).click();
		await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
		await expect(page.locator("body")).toHaveCSS(
			"background-color",
			"rgb(18, 17, 12)",
		);
		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-scheme", "dark");
	});
});

/**
 * Opens Rides once the sample rider's first data is there; the waiting state
 * only reloads by itself with the page script on.
 */
async function openRides(page: Page, path = "/me/rides") {
	await expect(async () => {
		await page.goto(path);
		await expect(page.locator("[data-waiting]")).toHaveCount(0);
	}).toPass({ timeout: 30_000 });
}

/** The distance of the card linking to `href` from the viewport's top. */
function topOf(page: Page, href: string): Promise<number> {
	return page
		.locator(`li.ride-card:has(a.strava-activity[href="${href}"])`)
		.evaluate((card) => Math.round(card.getBoundingClientRect().top));
}

test.describe("the continuous ride list (018)", () => {
	test.beforeEach(async ({ page }) => {
		await page.setViewportSize(PHONE);
		await signIn(page, "Paula Paging");
		await skipTours(page);
	});

	test("loads every ride by scrolling, with the season's total (US1)", async ({
		page,
	}) => {
		await openRides(page);
		const rides = page.locator("section#rides");
		const cards = rides.locator("li.ride-card");
		await expect(rides.locator(".rides-total")).toHaveText(
			"45 Fahrten in dieser Saison",
		);
		await expect(cards).toHaveCount(20);
		for (const count of [40, 45]) {
			await cards.last().scrollIntoViewIfNeeded();
			await expect(cards).toHaveCount(count);
		}
		await expect(rides.locator(".rides-more")).toBeHidden();
		await expect(page).toHaveURL(/\/me\/rides$/);
		await expectNoSidewaysScroll(page);
	});

	test("keeps the ride in view on the way back and on a reload (US2)", async ({
		page,
	}) => {
		await openRides(page);
		const cards = page.locator("section#rides li.ride-card");
		for (const count of [40, 45]) {
			await cards.last().scrollIntoViewIfNeeded();
			await expect(cards).toHaveCount(count);
		}
		const card = cards.nth(35);
		const href = await card.locator("a.strava-activity").getAttribute("href");
		if (href === null) throw new Error("no link to Strava on ride 36");
		await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
		const before = await topOf(page, href);

		await page.goto("/me");
		await page.goBack();
		await expect(cards).toHaveCount(45);
		await expect.poll(() => topOf(page, href)).toBeCloseTo(before, -1);

		await page.reload();
		await expect(cards).toHaveCount(45);
		await expect.poll(() => topOf(page, href)).toBeCloseTo(before, -1);

		// The navigation bar is a fresh visit: the top, the newest rides.
		await page.locator('nav.app-nav a[href="/me/rides"]').click();
		await expect(cards).toHaveCount(20);
		const html = page.locator("html");
		expect(await html.evaluate((root) => root.scrollTop)).toBe(0);
	});

	test("continues below a later page, with a link to the newest (US3)", async ({
		page,
	}) => {
		await openRides(page, "/me/rides?page=2");
		const cards = page.locator("section#rides li.ride-card");
		await expect(page.locator(".rides-newest a")).toHaveAttribute(
			"href",
			"/me/rides",
		);
		await expect(cards).toHaveCount(20);
		await cards.last().scrollIntoViewIfNeeded();
		await expect(cards).toHaveCount(25);
	});
});

test("a rider walks through the tour with the example rider (020)", async ({
	page,
}) => {
	await signIn(page, "Vera Virtual");
	// The tour waits for the first import (issue #119); the page polls itself.
	await page.goto("/me");
	await expect(page.locator("[data-waiting]")).toHaveCount(0, {
		timeout: 30_000,
	});
	// Started as from Settings, so it doesn't depend on another browser's run.
	await page.goto("/team?tour=rider&step=1");
	const tour = page.locator("aside.tour");
	// Each step points at its navigation item, or at an element of its page
	// (feature 020 FR-003); Vera isn't an organiser, so Termine is in (FR-001).
	for (const [path, step, target] of [
		["/team", "1 von 11", null],
		["/team", "2 von 11", "tour-peloton"],
		["/me", "3 von 11", null],
		["/me", "4 von 11", "tour-elevation"],
		["/me", "5 von 11", "tour-team"],
		["/me", "6 von 11", "tour-outdoor"],
		["/me/rides", "7 von 11", "tour-rejected-ride"],
		["/me/rides", "8 von 11", "tour-short-ride"],
		["/me/badges", "9 von 11", null],
		["/events", "10 von 11", null],
	] as const) {
		await expect(tour).toContainText(step);
		if (target) {
			await expect(tour).toHaveAttribute("data-target", target);
			await expect(page.locator(`#${target}`)).toBeInViewport();
		} else {
			await expect(page.locator(`nav.app-nav a[href="${path}"]`)).toHaveClass(
				"tour-target",
			);
		}
		// Du and Fahrten show the example rider, not Vera's own rides (FR-005).
		await expect(page.locator(".tour-example")).toHaveCount(
			path === "/me" || path === "/me/rides" ? 1 : 0,
		);
		await tour.getByRole("link", { name: "Weiter" }).click();
	}
	await expect(page).toHaveURL(/\/me\/settings\?tour=rider&step=11$/);
	await expect(tour).toContainText("11 von 11");
	await tour.getByRole("button", { name: "Alles klar" }).click();
	await expect(page).toHaveURL(/\/me\/settings$/);
	await expect(tour).toHaveCount(0);
	await page.goto("/team");
	await expect(tour).toHaveCount(0);
	// Without the tour, Vera's own rides again.
	await page.goto("/me/rides");
	await expect(page.locator(".tour-example")).toHaveCount(0);
	await expect(page.locator("a.strava-activity").first()).toBeVisible();
});

test.describe("on a touch screen", () => {
	// Taps, not a mouse: a mouse opens the large view on hover.
	test.use({ hasTouch: true });

	test("a rider opens a badge's large view on a phone (013)", async ({
		page,
	}) => {
		await signIn(page, "Bea Badges");
		await page.setViewportSize(PHONE);
		await page.goto("/me/badges");
		const section = page.locator("section.badges");
		await expect(section).toBeVisible();
		await expectNoSidewaysScroll(page);

		// The filter shows every badge instead of the newest per category.
		const gallery = section.locator(".badge-group-personal .badge-gallery");
		await expect(gallery).toBeHidden();
		await section.locator(".badges-filter label").last().tap();
		await expect(gallery).toBeVisible();
		await expect(section.locator(".badge-cards").first()).toBeHidden();
		const badge = gallery.locator("button.badge").first();
		const large = page.locator(
			`[id="${await badge.getAttribute("popovertarget")}"]`,
		);
		await badge.tap();
		await expect(large).toBeVisible();
		await expectNoSidewaysScroll(page);
		await page.keyboard.press("Escape");
		await expect(large).toBeHidden();
		await badge.tap();
		await large.locator(".badge-large-close").tap();
		await expect(large).toBeHidden();
	});
});

test("the badges switch follows the groups while scrolling (013 Part I)", async ({
	page,
}) => {
	await signIn(page, "Bea Badges");
	await page.setViewportSize(PHONE);
	await page.goto("/me/badges");
	const personal = page.locator('.badges-switch a[href="#badges-personal"]');
	const team = page.locator('.badges-switch a[href="#badges-team"]');
	await expect(personal).toHaveAttribute("aria-current", "true");
	await team.click();
	await expect(team).toHaveAttribute("aria-current", "true");
	await expect(personal).not.toHaveAttribute("aria-current");
	// The switch stays in view, under the top bar.
	await expect(page.locator(".badges-switch")).toBeInViewport();
	await page.locator("html").evaluate((root) => {
		root.scrollTop = 0;
	});
	await expect(personal).toHaveAttribute("aria-current", "true");
	await expectNoSidewaysScroll(page);
});

test("a mouse opens a badge's large view beside it on hover, without a close button (013)", async ({
	page,
}) => {
	await signIn(page, "Bea Badges");
	await page.goto("/me/badges");
	const badge = page.locator(".badge-card button.badge").first();
	const large = page.locator(
		`[id="${await badge.getAttribute("popovertarget")}"]`,
	);
	await badge.hover();
	await expect(large).toBeVisible();
	await expect(large.locator(".badge-large-close")).toBeHidden();
	// Beside the mouse, which rests on the badge's middle.
	const pointer = await badge.boundingBox();
	const view = await large.boundingBox();
	if (!pointer || !view) throw new Error("no box");
	const x = pointer.x + pointer.width / 2;
	expect(view.x > x || view.x + view.width < x).toBe(true);
	await page.mouse.move(0, 0);
	await expect(large).toBeHidden();
});

// Feature 019: one rider per browser, since the browsers share the app's data.
const EVENT_RIDER = {
	chromium: "Nora NoRides",
	firefox: "Bea Badges",
	webkit: "Rudi Runner",
} as const;

test("a section brought back after a minute is updated in place (011 FR-009)", async ({
	page,
}) => {
	await page.clock.install();
	await signIn(page, "Paula Paging");
	await page.goto("/me");
	await skipTours(page);
	await page.waitForLoadState();
	await markPage(page);
	const first = page.locator("main > *").first();
	await first.evaluate((el) => {
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
	await expect(page.locator("main > *").first()).toBeVisible();
	expect(await samePage(page)).toBe(true);
});

test("a rider says Bin dabei and changes their mind (019 US2)", async ({
	page,
	browserName,
}) => {
	await signIn(page, EVENT_RIDER[browserName]);
	await checkPage(page, "/events");
	await skipTours(page);
	await page.waitForLoadState();
	await markPage(page);
	const card = page.locator("li.event-card").filter({
		hasText: "Sample ride ahead",
	});
	await card.getByRole("button", { name: "Bin dabei" }).click();
	const joined = card.locator("button.event-joined");
	await expect(joined).toHaveAttribute("aria-pressed", "true");
	// Saved in place: no page load, the same address.
	await expect(page).toHaveURL(/\/events$/);
	expect(await samePage(page)).toBe(true);
	await joined.hover();
	await expect(joined.locator(".event-next")).toBeVisible();
	await expect(joined.locator(".event-now")).toBeHidden();
	await joined.click();
	await expect(card.locator("button.event-join")).toBeVisible();
	expect(await samePage(page)).toBe(true);
});

test("an organiser cycles a reported rider's box (019 US5)", async ({
	page,
}) => {
	await signIn(page, "Olga Organiser");
	await page.goto("/organiser");
	await skipTours(page);
	await page
		.locator("li.organiser-event")
		.filter({ hasText: "Sample early ride" })
		.getByRole("link")
		.click();
	// The box is in the markup; it cycles once the deferred script has run.
	await page.waitForLoadState();
	const box = page
		.getByRole("checkbox")
		.and(page.locator(".tri-toggle"))
		.first();
	await expect(box).toHaveAttribute("aria-checked", "mixed");
	await expect(page.locator(".tri-summary")).toBeVisible();
	await box.click();
	await expect(box).toHaveAttribute("aria-checked", "true");
	await box.click();
	await expect(box).toHaveAttribute("aria-checked", "false");
	await box.click();
	await expect(box).toHaveAttribute("aria-checked", "mixed");
	await expectNoSidewaysScroll(page);

	// Saving swaps the page in place and shows the result.
	await markPage(page);
	await box.click();
	await expect(box).toHaveAttribute("aria-checked", "true");
	await page.getByRole("button", { name: "Teilnahme speichern" }).click();
	await expect(page).toHaveURL(/done=attendance/);
	await expect(page.locator("main .notice[role=status]")).toBeVisible();
	expect(await samePage(page)).toBe(true);
});

test("an organiser walks through the Orga tour on the example team (020)", async ({
	page,
}) => {
	await signIn(page, "Olga Organiser");
	await page.goto("/me");
	await expect(page.locator("[data-waiting]")).toHaveCount(0, {
		timeout: 30_000,
	});
	await page.goto("/organiser/riders?tour=organiser&step=1");
	const tour = page.locator("aside.tour");
	// Each step on the example team, which can't be used (FR-013, FR-014).
	for (const [path, step, target] of [
		["/organiser/riders", "1 von 7", null],
		["/organiser/riders", "2 von 7", "tour-groups"],
		["/organiser/riders", "3 von 7", "tour-pace"],
		["/organiser", "4 von 7", "tour-requests"],
		["/organiser", "5 von 7", "tour-new-event"],
		["/organiser", "6 von 7", "tour-later-event"],
		["/organiser", "7 von 7", "tour-past-event"],
	] as const) {
		await expect(page).toHaveURL(new RegExp(`${path}\\?tour=organiser`));
		await expect(tour).toContainText(step);
		await expect(page.locator(".tour-example")).toHaveCount(1);
		if (target) {
			await expect(tour).toHaveAttribute("data-target", target);
			await expect(page.locator(`#${target}`)).toBeInViewport();
		}
		if (path === "/organiser/riders") {
			await expect(page.locator(".team-overview")).toHaveAttribute("inert");
		} else {
			await expect(page.locator("#tour-requests")).toHaveAttribute("inert");
			await expect(page.locator("#tour-new-event")).not.toHaveAttribute(
				"inert",
			);
		}
		if (step === "7 von 7") break;
		await tour.getByRole("link", { name: "Weiter" }).click();
	}
	await tour.getByRole("button", { name: "Alles klar" }).click();
	await expect(tour).toHaveCount(0);
	// Without the tour, the real team again.
	await page.goto("/organiser/riders");
	await expect(page.locator(".tour-example")).toHaveCount(0);
	await expect(
		page.locator(".rider-name:visible", { hasText: "Olga Organiser" }),
	).toHaveCount(1);
});

test("an organiser sees the Orga pages", async ({ page }) => {
	await signIn(page, "Olga Organiser");
	for (const path of ["/organiser/riders", "/organiser"]) {
		await checkPage(page, path);
	}
});

// Browsers without an install prompt of their own get their menu steps.
const MANUAL_INSTALL = {
	firefox:
		"Mozilla/5.0 (Android 15; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0",
	macSafari:
		"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15",
};

for (const [way, userAgent] of Object.entries(MANUAL_INSTALL)) {
	test.describe(`install steps for ${way}`, () => {
		test.use({ userAgent });

		test("show in the app prompt and in Settings", async ({ page }) => {
			await signIn(page, "Tina TrainingDone");
			await page.goto("/me");
			await skipTours(page);
			await expect(
				page.locator(`#app-prompt [data-install="${way}"]`),
			).toBeVisible();
			await page.goto("/me/settings");
			await expect(
				page.locator(`#settings-app [data-install="${way}"]`),
			).toBeVisible();
		});
	});
}
