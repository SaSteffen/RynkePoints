import { beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	tableCounts,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { riderPage, seedBalance, seedRides } from "../support/rider-view";

const ctx = makeCtx();
const switchTo = (lang: string, next?: string, origin?: string | null) =>
	handleFetch(
		request("/lang", {
			form: next === undefined ? { lang } : { lang, next },
			origin,
		}),
		ctx,
	);

beforeEach(resetDb);

describe("POST /lang", () => {
	it("switches to English and returns to the page", async () => {
		const res = await switchTo("en", "/notice/expired");
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/notice/expired");
		const cookie = res.headers.get("Set-Cookie") ?? "";
		const parts = cookie.split(";").map((p) => p.trim());
		expect(parts[0]).toBe("rp_lang=en");
		expect(parts).toEqual(
			expect.arrayContaining([
				"Path=/",
				"Max-Age=31536000",
				"SameSite=Lax",
				"Secure",
				"HttpOnly",
			]),
		);
	});

	it("applies at once and beats Accept-Language", async () => {
		const res = await handleFetch(
			request("/notice/expired", {
				cookies: { rp_lang: "en" },
				acceptLanguage: "de-DE",
			}),
			ctx,
		);
		const page = await res.text();
		expect(page).toContain('<html lang="en">');
		expect(res.headers.get("Content-Language")).toBe("en");
		expect(page).toContain("Sign-in expired");
		expect(page).toContain(
			'<button name="lang" value="en" lang="en" aria-current="true">English</button>',
		);
	});

	it("switches back to German", async () => {
		const res = await switchTo("de", "/notice/expired");
		expect(res.headers.get("Set-Cookie")).toMatch(/^rp_lang=de;/);
		const page = await handleFetch(
			request("/notice/expired", {
				cookies: { rp_lang: "de" },
				acceptLanguage: "en",
			}),
			ctx,
		);
		expect(await page.text()).toContain("Anmeldung abgelaufen");
	});

	it("ignores an unsupported language", async () => {
		const res = await switchTo("fr", "/notice/expired");
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/notice/expired");
		expect(res.headers.get("Set-Cookie")).toBeNull();
	});

	it.each([
		"https://evil.example/",
		"//evil.example",
		"/\\evil.example",
		"/strava/webhook/test-verify-token",
		"/notice/unknown",
		"/me?x=1",
		"/me?page=0",
		"/me?page=abc",
		"/me?page=2&x=1",
		"/me?foo=1",
		"/me?page=01",
		"/me?page=10000",
		undefined,
	])("redirects %j to /", async (next) => {
		const res = await switchTo("en", next);
		expect(res.headers.get("Location")).toBe("/");
	});

	it.each([
		"/",
		"/me",
		"/me/disconnect",
		"/notice/team-full",
		"/me?page=2",
		"/me?page=9999",
	])("keeps %s", async (next) => {
		const res = await switchTo("en", next);
		expect(res.headers.get("Location")).toBe(next);
	});

	it.each([
		["missing", null],
		["foreign", "https://evil.example"],
	])("refuses a %s Origin", async (_label, origin) => {
		const res = await switchTo("en", "/", origin);
		expect(res.status).toBe(403);
		expect(res.headers.get("Set-Cookie")).toBeNull();
		const page = await res.text();
		expect(page).toContain('<html lang="de">');
		expect(page).toContain("Anfrage abgelehnt");
	});

	it("needs no sign-in and stores nothing", async () => {
		const before = await tableCounts();
		await switchTo("en", "/");
		await switchTo("de", "/me");
		await switchTo("fr", "/");
		expect(await tableCounts()).toEqual(before);
	});
});

describe("the switcher on /me (US5)", () => {
	beforeEach(async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedBalance(ATHLETE_A);
		await seedRides(ATHLETE_A, 45, "2026-10-06");
	});

	it("S5-4: keeps the table page", async () => {
		const res = await switchTo("en", "/me?page=2");
		expect(res.headers.get("Location")).toBe("/me?page=2");
	});

	it.each([
		["/me?page=2", "/me?page=2"],
		["/me?page=1", "/me"],
		["/me", "/me"],
		["/me?page=99", "/me?page=3"],
	])("on %s sends next %s", async (path, next) => {
		const { html } = await riderPage(ctx, ATHLETE_A, path);
		expect(html).toContain(`<input type="hidden" name="next" value="${next}">`);
	});
});
