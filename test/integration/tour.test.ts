import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { escapeHtml } from "../../src/http/html";
import { TOURS } from "../../src/http/tour";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";
import { riderPage, seedBalance } from "../support/rider-view";

// Onboarding tours (issue #90): a hint per page of the rider tour, then the
// organiser tour for organisers; each shown until finished or skipped, which is
// stored on the rider row and so counts on every device.

const ctx = makeCtx();
const { de } = CATALOGS;
const t = (id: keyof typeof de) => escapeHtml(de[id]);

/** The tour hint on a page, or null. */
function hint(page: string): string | null {
	return page.match(/<aside class="tour"[\s\S]*?<\/aside>/)?.[0] ?? null;
}

/** The navigation item the page points at. */
function target(page: string): string | null {
	return page.match(/<a href="([^"]+)"[^>]* class="tour-target"/)?.[1] ?? null;
}

async function hintOn(path: string) {
	const { status, html } = await riderPage(ctx, ATHLETE_A, path);
	expect(status).toBe(200);
	return { card: hint(html), target: target(html), page: html };
}

async function finish(tour: string, next = "/me/settings") {
	return handleFetch(
		request("/me/tour", {
			form: { tour, page: next },
			cookies: await sessionCookie(ctx, ATHLETE_A),
		}),
		ctx,
	);
}

const setOrganiser = (value: 0 | 1) =>
	env.DB.prepare("UPDATE riders SET organiser = ? WHERE athlete_id = ?")
		.bind(value, ATHLETE_A)
		.run();

/** A rider past the first import, which the tours wait for (issue #119). */
async function seedReadyRider(options?: Parameters<typeof seedRider>[1]) {
	await seedRider(ctx, options);
	await seedBalance(ATHLETE_A);
}

beforeEach(resetDb);

describe("the rider tour", () => {
	it("starts on its first page for a rider who hasn't seen it", async () => {
		await seedReadyRider();
		const { card, target: at } = await hintOn("/team");
		expect(card).toContain(t("tour.rider.team"));
		expect(card).toContain("1 von 4");
		expect(card).toContain('href="/me?tour=rider"');
		expect(at).toBe("/team");
	});

	it("offers to start on any other page", async () => {
		await seedReadyRider();
		const { card, target: at } = await hintOn("/me/rides");
		expect(card).toContain(t("tour.rider.intro"));
		expect(card).toContain('href="/team?tour=rider"');
		expect(at).toBe("/team");
	});

	it("covers every rider page, one step each, pointing at its nav item", async () => {
		await seedReadyRider();
		expect(TOURS.rider.map((s) => s.path)).toEqual([
			"/team",
			"/me",
			"/me/rides",
			"/me/settings",
		]);
		for (const [i, step] of TOURS.rider.entries()) {
			const { card, target: at } = await hintOn(`${step.path}?tour=rider`);
			expect(card).toContain(t(step.text));
			expect(at).toBe(step.path);
			const next = TOURS.rider[i + 1];
			if (next) expect(card).toContain(`href="${next.path}?tour=rider"`);
			else expect(card).toContain(t("tour.done"));
		}
	});

	it("can be skipped at any step, and doesn't come back", async () => {
		await seedReadyRider();
		const { card } = await hintOn("/me?tour=rider");
		expect(card).toContain('<form method="post" action="/me/tour">');
		expect(card).toContain(t("tour.skip"));
		const response = await finish("rider", "/me");
		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("/me");
		expect((await getRider(env.DB, ATHLETE_A))?.onboardedAt).toBe(NOW);
		for (const path of ["/team", "/me", "/me/rides", "/me/settings"]) {
			expect((await hintOn(path)).card).toBeNull();
		}
	});

	it("is remembered on the rider, not the device", async () => {
		await seedReadyRider();
		await finish("rider");
		// A fresh session cookie, as on another device.
		expect((await hintOn("/team")).card).toBeNull();
	});

	it("shows for riders stored before the release", async () => {
		await seedReadyRider();
		expect((await getRider(env.DB, ATHLETE_A))?.onboardedAt).toBeNull();
		expect((await hintOn("/team")).card).not.toBeNull();
	});

	it("starts again from Settings", async () => {
		await seedReadyRider();
		await finish("rider");
		const { page } = await hintOn("/me/settings");
		expect(page).toContain('<section id="settings-tour"');
		expect(page).toContain(
			`<a class="button-outlined" href="/team?tour=rider">${t("settings.tour.rider")}</a>`,
		);
		expect(page).not.toContain("?tour=organiser");
		expect((await hintOn("/team?tour=rider")).card).toContain(
			t("tour.rider.team"),
		);
	});
});

describe("while the first import runs", () => {
	it("shows no tour, not even one started from Settings", async () => {
		await seedRider(ctx, { organiser: true });
		for (const path of [
			"/team",
			"/me",
			"/me/rides",
			"/me/settings",
			"/me?tour=rider",
			"/organiser/riders?tour=organiser",
		]) {
			expect((await hintOn(path)).card).toBeNull();
		}
	});

	it("starts once the first Rynke are in", async () => {
		await seedRider(ctx);
		expect((await hintOn("/team")).card).toBeNull();
		await seedBalance(ATHLETE_A);
		expect((await hintOn("/team")).card).toContain(t("tour.rider.team"));
		expect((await getRider(env.DB, ATHLETE_A))?.onboardedAt).toBeNull();
	});
});

describe("the organiser tour", () => {
	it("is never shown to a rider who isn't an organiser", async () => {
		await seedReadyRider();
		await finish("rider");
		expect((await hintOn("/team")).card).toBeNull();
		expect((await hintOn("/me?tour=organiser")).card).toBeNull();
		await finish("organiser");
		expect(
			(await getRider(env.DB, ATHLETE_A))?.organiserOnboardedAt,
		).toBeNull();
	});

	it("follows the rider tour for a rider made organiser on their first day", async () => {
		await seedReadyRider({ organiser: true });
		expect((await hintOn("/team")).card).toContain(t("tour.rider.team"));
		const done = await finish("rider", "/me/settings");
		expect(done.headers.get("Location")).toBe("/me/settings");
		const { card, target: at } = await hintOn("/me/settings");
		expect(card).toContain(t("tour.organiser.intro"));
		expect(card).toContain('href="/organiser/riders?tour=organiser"');
		expect(at).toBe("/organiser/riders");
	});

	it("covers only the organiser pages", async () => {
		await seedReadyRider({ organiser: true });
		await finish("rider");
		expect(TOURS.organiser.map((s) => s.path)).toEqual([
			"/organiser/riders",
			"/organiser",
		]);
		const riders = await hintOn("/organiser/riders");
		expect(riders.card).toContain(t("tour.organiser.riders"));
		expect(riders.card).toContain('href="/organiser?tour=organiser"');
		expect(riders.target).toBe("/organiser/riders");
		const events = await hintOn("/organiser?tour=organiser");
		expect(events.card).toContain(t("tour.organiser.events"));
		expect(events.card).toContain(t("tour.done"));
		await finish("organiser", "/organiser");
		expect((await hintOn("/organiser/riders")).card).toBeNull();
		expect((await hintOn("/team")).card).toBeNull();
	});

	it("shows again when organiser rights are removed and given again", async () => {
		await seedReadyRider({ organiser: true });
		await finish("rider");
		await finish("organiser");
		expect((await hintOn("/team")).card).toBeNull();
		await setOrganiser(0);
		expect(
			(await getRider(env.DB, ATHLETE_A))?.organiserOnboardedAt,
		).toBeNull();
		await setOrganiser(1);
		expect((await hintOn("/team")).card).toContain(t("tour.organiser.intro"));
	});

	it("starts again from Settings", async () => {
		await seedReadyRider({ organiser: true });
		await finish("rider");
		await finish("organiser");
		expect((await hintOn("/me/settings")).page).toContain(
			`<a class="button-outlined" href="/organiser/riders?tour=organiser">${t("settings.tour.organiser")}</a>`,
		);
	});
});

describe("POST /me/tour", () => {
	it("refuses another origin", async () => {
		await seedReadyRider();
		const response = await handleFetch(
			request("/me/tour", {
				form: { tour: "rider", page: "/me" },
				origin: "https://evil.test",
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(response.status).toBe(403);
		expect((await getRider(env.DB, ATHLETE_A))?.onboardedAt).toBeNull();
	});

	it("sends a visitor to the start page", async () => {
		const response = await handleFetch(
			request("/me/tour", { form: { tour: "rider", page: "/me" } }),
			ctx,
		);
		expect(response.headers.get("Location")).toBe("/");
	});

	it("only returns to a tour's own pages", async () => {
		await seedReadyRider();
		const response = await finish("rider", "https://evil.test/");
		expect(response.headers.get("Location")).toBe("/me");
	});
});
