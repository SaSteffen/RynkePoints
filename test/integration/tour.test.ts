import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { escapeHtml } from "../../src/http/html";
import { stepHref, TOURS, tourSteps } from "../../src/http/tour";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { CURRENT_RULES } from "../../src/rynke/rules";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";
import { riderPage, seedBalance, seedRide } from "../support/rider-view";

// Onboarding tours (issue #90, feature 020): hints on the rider tour's pages,
// some pointing at an element and showing the example rider, then the
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
		expect(card).toContain("1 von 11");
		expect(card).toContain('href="/team?tour=rider&amp;step=2#tour-peloton"');
		expect(at).toBe("/team");
	});

	it("offers to start on any other page", async () => {
		await seedReadyRider();
		const { card, target: at } = await hintOn("/me/rides");
		expect(card).toContain(t("tour.rider.intro"));
		expect(card).toContain('href="/team?tour=rider&amp;step=1"');
		expect(at).toBe("/team");
	});

	it("covers every rider page, pointing at its nav item or one element", async () => {
		await seedReadyRider();
		const steps = tourSteps("rider", { organiser: false });
		expect(steps.map((s) => [s.path, s.target ?? null])).toEqual([
			["/team", null],
			["/team", "tour-peloton"],
			["/me", null],
			["/me", "tour-elevation"],
			["/me", "tour-team"],
			["/me", "tour-outdoor"],
			["/me/rides", "tour-rejected-ride"],
			["/me/rides", "tour-short-ride"],
			["/me/badges", null],
			["/events", null],
			["/me/settings", null],
		]);
		for (const [i, step] of steps.entries()) {
			const {
				card,
				target: at,
				page,
			} = await hintOn(`${step.path}?tour=rider&step=${i + 1}`);
			expect(card).toContain(`${i + 1} von ${steps.length}`);
			if (step.target) {
				expect(card).toContain(`data-target="${step.target}"`);
				expect(page).toContain(`id="${step.target}"`);
				expect(at).toBeNull();
			} else {
				expect(card).not.toContain("data-target");
				expect(at).toBe(step.path);
			}
			const next = steps[i + 1];
			if (next) {
				expect(card).toContain(
					`href="${stepHref("rider", { organiser: false }, i + 1).replace("&", "&amp;")}"`,
				);
			} else expect(card).toContain(t("tour.done"));
		}
	});

	it("names the rule values of the rules in effect (020 FR-008)", async () => {
		await seedReadyRider();
		const elevation = (await hintOn("/me?tour=rider&step=4")).card;
		expect(elevation).toContain(
			`Alle 1.000\u00a0Höhenmeter bringen dir ${CURRENT_RULES.elevationStepRynke}\u00a0Trainingsrynke`,
		);
		const team = (await hintOn("/me?tour=rider&step=5")).card;
		expect(team).toContain(
			`Für Paris brauchst du ${CURRENT_RULES.teamThreshold}.`,
		);
		const outdoor = (await hintOn("/me?tour=rider&step=6")).card;
		expect(outdoor).toContain("Höchstens 1/3 deiner Trainingsrynke");
		expect(outdoor).toContain("Mindestens 167 von 250 Trainingsrynke");
		const short = (await hintOn("/me/rides?tour=rider&step=8")).card;
		expect(short).toContain(
			"Für jede volle 10\u00a0km einer Fahrt gibt es 1\u00a0Trainingsrynke.",
		);
	});

	it("shows a page's first step for an old link or a step of another page", async () => {
		await seedReadyRider();
		expect((await hintOn("/me?tour=rider")).card).toContain("3 von 11");
		expect((await hintOn("/team?tour=rider&step=5")).card).toContain(
			"1 von 11",
		);
		expect((await hintOn("/me?tour=rider&step=x")).card).toContain("3 von 11");
	});

	it("has a Termine step for riders who aren't organisers (019 T040)", async () => {
		await seedReadyRider();
		const { card, target: at } = await hintOn("/events?tour=rider&step=10");
		expect(card).toContain(t("tour.rider.events"));
		expect(at).toBe("/events");
		expect((await hintOn("/me/badges?tour=rider&step=9")).card).toContain(
			'href="/events?tour=rider&amp;step=10"',
		);
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
		for (const path of [
			"/team",
			"/me",
			"/me/rides",
			"/me/badges",
			"/me/settings",
		]) {
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
			`<a class="button-outlined" href="/team?tour=rider&amp;step=1">${t("settings.tour.rider")}</a>`,
		);
		expect(page).not.toContain("?tour=organiser");
		expect((await hintOn("/team?tour=rider")).card).toContain(
			t("tour.rider.team"),
		);
	});
});

describe("the example rider (feature 020)", () => {
	/** The Training Rynke in the Overview's hero. */
	const training = (page: string) =>
		page.match(
			/<p class="hero-total"><span class="rynke-amount">([^<]*)<\/span>/,
		)?.[1];

	/** A rider with Rynke of their own, which the tour's pages must not show. */
	async function seedOwnRynke() {
		await seedRider(ctx);
		await seedBalance(ATHLETE_A, {
			distanceRynke: 77,
			trainingRynke: 77,
			trainingMissing: 173,
		});
		await seedRide(ATHLETE_A, {
			id: 424242,
			result: { counts: true, distanceRynke: 7 },
		});
	}

	it("shows on the tour's Du steps instead of the rider's own Rynke", async () => {
		await seedOwnRynke();
		for (const step of [3, 4, 5, 6]) {
			const { page } = await hintOn(`/me?tour=rider&step=${step}`);
			expect(page).toContain(
				`<p class="notice tour-example" role="note">${t("tour.example")}</p>`,
			);
			expect(page).toContain('id="tour-elevation"');
			expect(page).toContain('id="tour-team"');
			// The example has a virtual ride, so the "draußen" gauge shows.
			expect(page).toContain('id="tour-outdoor"');
			expect(training(page)).toBe("43");
		}
		const own = (await hintOn("/me")).page;
		expect(own).not.toContain("tour-example");
		expect(training(own)).toBe("77");
	});

	it("shows its rides on the tour's Fahrten steps, without links to Strava", async () => {
		await seedOwnRynke();
		const { page } = await hintOn("/me/rides?tour=rider&step=8");
		expect(page).toContain("tour-example");
		expect(page).toContain('<dl class="ride-figures" id="tour-short-ride">');
		// It earns no Rynke, so no coin on its status (FR-011).
		expect(page).toMatch(
			/<span class="chip ride-status">zählt<\/span><\/div>\s*<dl class="ride-figures" id="tour-short-ride">/,
		);
		// The ride that doesn't count, with its reasons open (FR-006).
		expect(page).toMatch(
			/<li class="ride-card ride-not-counting" id="tour-rejected-ride">[\s\S]*?<details class="ride-why" open>/,
		);
		expect(page).not.toContain('class="tap strava-activity"');
		expect(page).not.toContain("424242");
		const own = (await hintOn("/me/rides")).page;
		expect(own).not.toContain("tour-example");
		expect(own).toContain("/activities/424242");
	});

	it("is never stored, marked as seen or celebrated (FR-007)", async () => {
		await seedOwnRynke();
		const before = await env.DB.prepare(
			"SELECT (SELECT count(*) FROM activities) AS a, (SELECT count(*) FROM ride_results) AS r, (SELECT training_rynke FROM rynke_balances WHERE athlete_id = ?1) AS b, (SELECT count(*) FROM rynke_seen) AS s",
		)
			.bind(ATHLETE_A)
			.first();
		const { page } = await hintOn("/me?tour=rider&step=3");
		expect(page).not.toContain('class="celebrate"');
		await hintOn("/me/rides?tour=rider&step=7");
		const after = await env.DB.prepare(
			"SELECT (SELECT count(*) FROM activities) AS a, (SELECT count(*) FROM ride_results) AS r, (SELECT training_rynke FROM rynke_balances WHERE athlete_id = ?1) AS b, (SELECT count(*) FROM rynke_seen) AS s",
		)
			.bind(ATHLETE_A)
			.first();
		expect(after).toEqual(before);
	});

	it("doesn't show outside the tour's Du and Fahrten steps", async () => {
		await seedOwnRynke();
		for (const path of [
			"/team?tour=rider&step=1",
			"/me/badges?tour=rider&step=9",
			"/me?tour=organiser",
		]) {
			expect((await hintOn(path)).page).not.toContain("tour-example");
		}
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
		expect(card).toContain(
			'href="/organiser/riders?tour=organiser&amp;step=1"',
		);
		expect(at).toBe("/organiser/riders");
	});

	it("takes the rider tour without Termine (020 FR-002)", async () => {
		await seedReadyRider({ organiser: true });
		const steps = tourSteps("rider", { organiser: true });
		expect(steps.map((s) => s.path)).not.toContain("/events");
		expect(steps).toHaveLength(TOURS.rider.length - 1);
		const badges = (await hintOn("/me/badges?tour=rider&step=9")).card;
		expect(badges).toContain(`9 von ${steps.length}`);
		expect(badges).toContain('href="/me/settings?tour=rider&amp;step=10"');
		expect(badges).not.toContain("/events");
	});

	it("covers only the organiser pages, pointing at its nav item or one element (020 FR-012)", async () => {
		await seedReadyRider({ organiser: true });
		await finish("rider");
		const steps = tourSteps("organiser", { organiser: true });
		expect(steps.map((s) => [s.path, s.target ?? null])).toEqual([
			["/organiser/riders", null],
			["/organiser/riders", "tour-groups"],
			["/organiser/riders", "tour-pace"],
			["/organiser", "tour-requests"],
			["/organiser", "tour-new-event"],
			["/organiser", "tour-later-event"],
			["/organiser", "tour-past-event"],
		]);
		for (const [i, step] of steps.entries()) {
			const {
				card,
				target: at,
				page,
			} = await hintOn(`${step.path}?tour=organiser&step=${i + 1}`);
			expect(card).toContain(`${i + 1} von ${steps.length}`);
			if (step.target) {
				expect(card).toContain(`data-target="${step.target}"`);
				expect(page).toContain(`id="${step.target}"`);
				expect(at).toBeNull();
			} else expect(at).toBe(step.path);
			const next = steps[i + 1];
			if (next) {
				expect(card).toContain(
					`href="${stepHref("organiser", { organiser: true }, i + 1).replace("&", "&amp;")}"`,
				);
			} else expect(card).toContain(t("tour.done"));
		}
		const events = (await hintOn("/organiser?tour=organiser&step=5")).card;
		expect(events).toContain(
			`Ein Teamtraining bringt ${CURRENT_RULES.teamEvents.team_training.team}\u00a0Teamrynke`,
		);
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
			`<a class="button-outlined" href="/organiser/riders?tour=organiser&amp;step=1">${t("settings.tour.organiser")}</a>`,
		);
	});
});

describe("the example team (feature 020)", () => {
	/** An organiser past both first steps, with a real event of their own. */
	async function seedOrganiser() {
		await seedReadyRider({ organiser: true });
		await finish("rider");
		await env.DB.prepare(
			"INSERT INTO team_events (kind, event_date, name) VALUES ('team_training', '2026-10-01', 'Echter Termin')",
		).run();
	}

	it("shows on the tour's Rider steps instead of the real team, inert (FR-013, FR-014)", async () => {
		await seedOrganiser();
		for (const step of [1, 2, 3]) {
			const { page } = await hintOn(
				`/organiser/riders?tour=organiser&step=${step}`,
			);
			expect(page).toContain(
				`<p class="notice tour-example" role="note">${t("tour.organiser.example")}</p>`,
			);
			expect(page).toContain('<div class="team-overview" inert>');
			expect(page).toContain('id="tour-groups"');
			expect(page).toContain('id="tour-pace"');
			for (const name of ["Anna", "Ben", "Clara", "Deniz", "Emma", "Finn"]) {
				expect(page).toContain(`<span class="rider-name">${name}</span>`);
			}
			// The rider's own row isn't in it (FR-015).
			expect(page).not.toContain(`href="/organiser/riders/${ATHLETE_A}`);
		}
		await finish("organiser");
		const own = (await hintOn("/organiser/riders")).page;
		expect(own).not.toContain("tour-example");
		expect(own).not.toContain(" inert");
		expect(own).not.toContain('<span class="rider-name">Anna</span>');
	});

	it("has riders in each group the day allows, and open requests", async () => {
		await seedOrganiser();
		const { page } = await hintOn("/organiser/riders?tour=organiser&step=2");
		for (const group of ["push", "on_track", "in"]) {
			expect(page).toContain(`<li class="rider-card status-${group}">`);
		}
		expect(page).toContain('class="group-tile tile-requests tile-alert"');
	});

	it("shows its requests and events on the tour's Termine steps, around the real form", async () => {
		await seedOrganiser();
		const { page } = await hintOn("/organiser?tour=organiser&step=4");
		expect(page).toContain(
			`<p class="notice tour-example" role="note">${t("tour.organiser.example")}</p>`,
		);
		expect(page).toMatch(
			/<section class="open-requests" id="tour-requests"[^>]* inert>/,
		);
		expect(page).toContain('<ul class="organiser-events" inert>');
		expect(page).toMatch(
			/<li class="organiser-event" id="tour-later-event">[\s\S]*?class="chip chip-team"/,
		);
		expect(page).toMatch(
			/<li class="organiser-event" id="tour-past-event">[\s\S]*?class="self-form"/,
		);
		// The new-event form is the real one, outside the example.
		expect(page).toContain(
			'<form method="post" action="/organiser/events" class="organiser-form" id="tour-new-event">',
		);
		expect(page).not.toContain("Echter Termin");
		const own = (await hintOn("/organiser")).page;
		expect(own).toContain("Echter Termin");
		expect(own).not.toContain("tour-example");
		expect(own).not.toContain(" inert");
	});

	it("is never stored (FR-015)", async () => {
		await seedOrganiser();
		const count = () =>
			env.DB.prepare(
				"SELECT (SELECT count(*) FROM riders) AS r, (SELECT count(*) FROM team_events) AS e, (SELECT count(*) FROM attendances) AS a, (SELECT count(*) FROM participation_reports) AS p",
			).first();
		const before = await count();
		await hintOn("/organiser/riders?tour=organiser&step=1");
		await hintOn("/organiser?tour=organiser&step=4");
		expect(await count()).toEqual(before);
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
