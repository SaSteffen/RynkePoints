import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { setStravaUsage } from "../support/usage";

// The Admin tab's number (feature 048 US5, contracts/nav-count.md): the usage
// marks the list's head counts, on every page, and on "Nutzung". State hints
// never count. Only synthetic figures; nothing asks Strava or Cloudflare.

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const ctx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;

async function page(path: string, athleteId = ADMIN): Promise<string> {
	const res = await handleFetch(
		request(path, {
			cookies: await sessionCookie(ctx, athleteId),
			acceptLanguage: "de",
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

/** The navigation's link to `href`, opening tag to its end. */
function tab(text: string, href: string): string {
	const nav = text.slice(text.indexOf('<nav class="app-nav"'));
	const start = nav.indexOf(`<a href="${href}"`);
	return start === -1
		? "missing"
		: nav.slice(start, nav.indexOf("</a>", start));
}

/** "Nutzung" in the Admin tab switch. */
function segment(text: string): string {
	const start = text.indexOf('<a class="segmented" href="/admin"');
	return start === -1
		? "missing"
		: text.slice(start, text.indexOf("</a>", start));
}

/** One figure at Hinweis (30 %), one at Warnung (85 %). */
const twoMarks = () =>
	setStravaUsage({
		observedAt: NOW,
		readDaily: 900,
		limitReadDaily: 3000,
		allDaily: 850,
		limitAllDaily: 1000,
	});

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("the Admin tab's number", () => {
	it("counts the marks on any page, with a label saying so", async () => {
		await twoMarks();
		const link = tab(await page("/me"), "/admin/riders");
		expect(link).toContain('aria-label="Admin, 2 brauchen deinen Blick"');
		expect(link).toContain(
			'<span class="count-badge" aria-hidden="true">2</span>',
		);
	});

	it("shows the same number on the tab, on Nutzung and in the list's head", async () => {
		await twoMarks();
		const text = await page("/admin");
		expect(tab(text, "/admin/riders")).toContain(
			'<span class="count-badge" aria-hidden="true">2</span>',
		);
		const usage = segment(text);
		expect(usage).toContain('aria-label="Nutzung, 2 brauchen deinen Blick"');
		expect(usage).toContain(
			'<span class="count-badge" aria-hidden="true">2</span>',
		);
		expect(text).toContain(">1 Warnung<");
		expect(text).toContain(">1 Hinweis<");
	});

	it("is on Nutzung on the riders page too", async () => {
		await twoMarks();
		expect(segment(await page("/admin/riders"))).toContain(
			'<span class="count-badge" aria-hidden="true">2</span>',
		);
	});

	it("names one mark in the singular", async () => {
		await setStravaUsage({
			observedAt: NOW,
			readDaily: 900,
			limitReadDaily: 3000,
		});
		expect(tab(await page("/me"), "/admin/riders")).toContain(
			'aria-label="Admin, 1 braucht deinen Blick"',
		);
	});

	it("shows nothing with only state hints", async () => {
		// No device gets notifications: listed, never counted.
		const text = await page("/admin");
		expect(text).toContain("Du bekommst keine Nutzungshinweise");
		expect(tab(text, "/admin/riders")).not.toContain("count-badge");
		expect(segment(text)).not.toContain("count-badge");
	});

	it("leaves Orga's number to Orga", async () => {
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			administrator: true,
			organiser: true,
		});
		await twoMarks();
		const text = await page("/me", ATHLETE_B);
		expect(tab(text, "/admin/riders")).toContain("count-badge");
		expect(tab(text, "/organiser/riders")).not.toContain("count-badge");
	});

	it("is no number for a rider who isn't an administrator", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await twoMarks();
		const text = await page("/me", ATHLETE_B);
		expect(tab(text, "/admin/riders")).toBe("missing");
		expect(text).not.toContain("count-badge");
	});

	it("asks neither Strava nor Cloudflare", async () => {
		const fetch = vi.spyOn(globalThis, "fetch");
		await twoMarks();
		await page("/me");
		await page("/admin");
		expect(fetch).not.toHaveBeenCalled();
	});
});
