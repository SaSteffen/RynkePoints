import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { BADGES } from "../../src/badges/catalog";
import { badgeWindow } from "../../src/badges/evaluate";
import { BADGE_OUTLINE } from "../../src/badges/outline";
import { BADGE_PICTURES } from "../../src/badges/pictures";
import { readRiderBadges } from "../../src/db/badges";
import { artUrl } from "../../src/http/art";
import { escapeHtml } from "../../src/http/html";
import { milestone, renderBadgeReveal } from "../../src/http/sections/badges";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { BADGE_NAMES } from "../../src/i18n/messages/badges.de";
import { countingWindow } from "../../src/rynke/rules";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";
import { riderPage, seedBalance, seedRides } from "../support/rider-view";
import { attendRaw, insertEvent } from "../support/rynke";

// The Abzeichen section on its own page, the rider's badges and the team's
// (feature 013 US1, US4, contracts/abzeichen-section.md "Rules the tests
// check"). Synthetic badges.

const ctx = makeCtx();
const { de } = CATALOGS;

function nameOf(id: string): string {
	const name = BADGE_NAMES[id];
	if (!name) throw new Error(`no name for ${id}`);
	return name;
}

async function earn(athleteId: number, badges: [string, string][]) {
	await env.DB.batch(
		badges.map(([id, date]) =>
			env.DB.prepare(
				"INSERT INTO rider_badges (athlete_id, badge_id, earned_on) VALUES (?, ?, ?)",
			).bind(athleteId, id, date),
		),
	);
}

/** The section's markup, or null when the page has none. */
async function section(
	athleteId = ATHLETE_A,
	acceptLanguage?: string,
	path = "/me/badges",
) {
	const { status, html } = await riderPage(
		ctx,
		athleteId,
		path,
		acceptLanguage,
	);
	expect(status).toBe(200);
	return {
		html,
		section:
			html.match(
				/<section class="badges"[\s\S]*<\/section>(?=\n<\/div>|\n?<\/main>)/,
			)?.[0] ?? null,
	};
}

/** The gallery of the rider's own group, shown by the "Alle" filter. */
const galleryOf = (badges: string | null) =>
	badges?.match(
		/<div class="badge-gallery">[\s\S]*?<\/div>\n<\/section>/,
	)?.[0] ?? "";

/** The rider's own group; the team's follows it on the same page. */
const personalGroup = (badges: string | null) =>
	badges?.match(
		/<section id="badges-personal" class="badge-group badge-group-personal"[\s\S]*?<\/section>/,
	)?.[0] ?? "";

const EARNED: [string, string][] = [
	["distance-100", "2026-03-08"],
	["distance-500", "2026-05-01"],
	["elevation-1000", "2026-04-12"],
];

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

describe("the Abzeichen section", () => {
	beforeEach(async () => {
		await seedBalance(ATHLETE_A);
		// 13 counting rides of 40 km and 300 m: 520 km, 3,900 m.
		await seedRides(ATHLETE_A, 13, "2026-05-10");
		await earn(ATHLETE_A, EARNED);
	});

	it("has the heading and the intro", async () => {
		const { section: badges } = await section();
		expect(badges).not.toBeNull();
		expect(badges).toContain(
			`<h2 id="badges-heading" class="visually-hidden">${de["badges.heading"]}</h2>`,
		);
	});

	it("has a switch with links to both groups and a filter for all badges (Part I)", async () => {
		const { section: badges } = await section();
		const bar =
			badges?.match(/<div class="badges-switch">[\s\S]*?<\/fieldset>/)?.[0] ??
			"";
		expect(bar).toContain(
			`<a class="segmented" href="#badges-personal" aria-current="true">${de["badges.switch.personal"]}</a>`,
		);
		expect(bar).toContain(
			`<a class="segmented" href="#badges-team">${de["badges.switch.team"]}</a>`,
		);
		expect(bar).toContain(
			`<label><input type="radio" name="badges-filter" value="newest" autocomplete="off" checked>${de["badges.switch.newest"]}</label>`,
		);
		expect(bar).toContain(
			`<label><input type="radio" name="badges-filter" value="all" autocomplete="off">${de["badges.switch.all"]}</label>`,
		);
		// Before both groups; the cards and the gallery are both there.
		expect(badges?.indexOf("badges-switch")).toBeLessThan(
			badges?.indexOf('id="badges-personal"') ?? -1,
		);
		expect(personalGroup(badges)).toContain('<ul class="badge-cards">');
		expect(personalGroup(badges)).toContain('<div class="badge-gallery">');
	});

	it("shows one card per category, newest first, with the ribbon and what is missing", async () => {
		const { section: badges } = await section();
		const cards = [
			...(badges ?? "").matchAll(
				/<li class="badge-card" data-category="(\w+)">([\s\S]*?)<\/li>/g,
			),
		];
		expect(cards.map((m) => m[1])).toEqual(["distance", "elevation"]);
		const distance = cards[0]?.[2] ?? "";
		expect(distance).toContain('popovertarget="badge-distance-500"');
		expect(distance).toContain(
			`<span class="badge-ribbon-text">500\u00a0km</span>`,
		);
		// One picture per badge; the page draws the ribbon over it (#180).
		expect(distance).toContain('<span class="badge-art"><img src="/badges/');
		expect(distance).toContain(
			'<svg class="badge-ribbon" viewBox="0 0 100 100" aria-hidden="true"><use href="#badge-ribbon" fill="#1c1b13"/></svg></span><span class="badge-ribbon-text">',
		);
		const gallery = badges?.match(
			/<div class="badge-gallery">([\s\S]*?)<\/section>/,
		)?.[1];
		expect(gallery).toContain('class="badge-art"');
		expect(gallery).not.toContain("badge-ribbon");
		expect(badges).toMatch(
			/<div popover id="badge-distance-500" [^>]*>[\s\S]*?<svg class="badge-ribbon"[^>]*><use href="#badge-ribbon" fill="#1c1b13"\/>/,
		);
		expect(badges).toContain('<g id="badge-ribbon" stroke="#1c1b13">');
		expect(distance).toContain(
			escapeHtml(de["badges.missing"].replace("{value}", "480\u00a0km")),
		);
		expect(distance).toContain('<span style="width:52%"></span>');
		expect(distance).toContain(
			`<span class="badge-next">${escapeHtml(de["badges.next"])}</span>`,
		);
		expect(badges).toContain(
			escapeHtml(de["badges.missing"].replace("{value}", "1.100\u00a0m")),
		);
		expect(distance).toContain(
			`aria-label="${escapeHtml(`${nameOf("distance-500")}, 500\u00a0km`)}"`,
		);
	});

	it("sparkles a badge for a day after it was earned", async () => {
		// The test clock is 6 October 2026: today and yesterday sparkle.
		await earn(ATHLETE_A, [
			["distance-1000", "2026-10-05"],
			["elevation-5000", "2026-10-04"],
		]);
		const { section: badges } = await section();
		const button = (id: string) =>
			badges?.match(
				new RegExp(
					`<button class="[^"]*" popovertarget="badge-${id}"[\\s\\S]*?</button>`,
				),
			)?.[0] ?? "";
		expect(button("distance-1000")).toContain('class="badge badge-fresh"');
		expect(button("distance-1000")).toContain(
			'<span class="badge-sparkles" aria-hidden="true">',
		);
		expect(button("elevation-5000")).toContain('class="badge"');
		expect(button("elevation-5000")).not.toContain("badge-sparkles");
		expect(button("distance-100")).not.toContain("badge-fresh");
		// The picture shapes its shine; every badge has its own tilt.
		expect(button("distance-1000")).toMatch(
			/style="--tilt:-?\d(\.\d)?deg;--badge-src:url\(\/badges\/distance-1000\.svg\?v=[0-9a-f]{10}\)"/,
		);
	});

	it("uses the finished picture or the placeholder", async () => {
		const missing = BADGES.find(
			(b) => b.group === "personal" && !BADGE_PICTURES.has(b.id),
		);
		if (missing) await earn(ATHLETE_A, [[missing.id, "2026-05-02"]]);
		const { section: badges } = await section();
		if (BADGE_PICTURES.has("distance-500")) {
			expect(badges).toContain(`src="${artUrl("/badges/distance-500.svg")}"`);
		}
		if (missing) {
			expect(badges).toContain(
				`src="${artUrl("/badges/placeholder-personal.svg")}"`,
			);
			expect(badges).not.toContain(`/badges/${missing.id}`);
		}
	});

	it("has the gallery behind the filter, counted, in catalog order", async () => {
		const { section: badges } = await section();
		expect(badges).toContain('<div class="badge-gallery">');
		expect(badges).toContain(
			`<span class="badges-title-all">${de["badges.personal.all"].replace("{n}", "3")}</span>`,
		);
		const gallery = galleryOf(badges);
		expect(
			[...gallery.matchAll(/popovertarget="badge-([\w-]+)"/g)].map((m) => m[1]),
		).toEqual(["distance-500", "distance-100", "elevation-1000"]);
	});

	it("shows the badges still to earn as empty outlines in the gallery (#109)", async () => {
		const { section: badges } = await section();
		const gallery = galleryOf(badges);
		const lists = [...gallery.matchAll(/<ul>([\s\S]*?)<\/ul>/g)].map(
			(m) => m[1] ?? "",
		);
		// Distance: 2 of 5 earned; elevation: 1 of 4; the other categories have
		// none yet and show only outlines (part C's eight after running).
		const slots = (list: string) =>
			list.match(
				/<li class="badge-slot" aria-hidden="true"><svg class="badge-outline badge-outline-plain"/g,
			)?.length;
		expect(lists.map(slots)).toEqual([
			3, 3, 4, 2, 10, 4, 6, 6, 5, 4, 5, 3, 3, 3, 3, 8, 14,
		]);
		expect(lists.slice(2).join("")).not.toContain("popovertarget");
		expect(lists[0]?.lastIndexOf('popovertarget="')).toBeLessThan(
			lists[0]?.indexOf("badge-slot") ?? 0,
		);
	});

	it("shows the categories without a badge as dotted cards after the others, with their bar", async () => {
		const { section: badges } = await section();
		const cards = [
			...personalGroup(badges).matchAll(
				/<li class="badge-card( badge-card-empty)?" data-category="(\w+)">/g,
			),
		];
		expect(cards.findIndex((m) => m[1])).toBe(2);
		const rows = cards.filter((m) => m[1]).map((m) => m[2]);
		expect(rows).toEqual([
			"team_events",
			"technique",
			"training_rynke",
			"run_length",
			"running",
			"ride_length",
			"virtual_rides",
			"swim_length",
			"swimming",
			"winter_november",
			"winter_december",
			"winter_january",
			"winter_february",
			"tour_de_paris",
			"surprise",
		]);
		expect(badges).toContain(
			escapeHtml(de["badges.missing"].replace("{value}", "1\u00a0Termin")),
		);
		expect(badges).toContain(
			`<div class="badge-slot">${BADGE_OUTLINE}<p class="badge-about">`,
		);
		expect(badges).toContain('<g id="badge-shape">');
	});

	it("explains each category in the gallery, the large view and the empty outline", async () => {
		const { section: badges } = await section();
		const about = (category: "distance" | "running") =>
			escapeHtml(de[`badges.about.${category}`]);
		// In the gallery under its name and in the large view; the card's
		// picture fills the circle, so not on the card.
		expect(badges).toContain(
			`<h4>${escapeHtml(de["badges.category.distance"])}</h4>\n<p class="badge-about">${about("distance")}</p>`,
		);
		expect(badges).not.toContain("badge-large-about");
		const distanceCard =
			badges?.match(
				/<li class="badge-card" data-category="distance">[\s\S]*?<\/li>/,
			)?.[0] ?? "";
		expect(distanceCard).not.toContain("badge-about");
		// Inside the outline of a category without a badge.
		expect(badges).toContain(
			`<h4>${escapeHtml(de["badges.category.running"])}</h4>\n<div class="badge-slot">${BADGE_OUTLINE}<p class="badge-about">${about("running")}</p></div>`,
		);
	});

	it("opens a large view per earned badge with name, what it was for and the date", async () => {
		const { section: badges } = await section();
		const popovers = [
			...(badges ?? "").matchAll(
				/<div popover id="badge-([\w-]+)" class="badge-large">([\s\S]*?)<\/div>/g,
			),
		];
		expect(popovers.map((m) => m[1]).sort()).toEqual(
			EARNED.map(([id]) => id).sort(),
		);
		const large = popovers.find((m) => m[1] === "distance-100")?.[2] ?? "";
		expect(large).toContain(`<h4>${escapeHtml(nameOf("distance-100"))}</h4>`);
		expect(large).toContain(
			escapeHtml(de["badges.for.distance"].replace("{value}", "100\u00a0km")),
		);
		expect(large).toContain(
			escapeHtml(de["badges.earnedOn"].replace("{date}", "08.03.2026")),
		);
		// Opening it shines the badge and sets stars twinkling, every time,
		// however old the badge.
		expect(large).toContain(
			'<span class="badge" style="--badge-src:url(/badges/',
		);
		expect(large).toContain('<span class="badge-sparkles" aria-hidden="true">');
	});

	it("shows the German names on the English page (FR-041)", async () => {
		const { section: badges } = await section(ATHLETE_A, "en");
		expect(badges).toContain(escapeHtml(nameOf("distance-500")));
		expect(badges).toContain(CATALOGS.en["badges.heading"]);
	});

	it("sends nothing of an unearned badge (SC-003)", async () => {
		const { html } = await section();
		const earned = new Set(EARNED.map(([id]) => id));
		for (const badge of BADGES) {
			if (earned.has(badge.id)) continue;
			expect(html).not.toContain(`badge-${badge.id}"`);
			expect(html).not.toContain(`/badges/${badge.id}.svg`);
			expect(html, badge.id).not.toContain(`>${escapeHtml(nameOf(badge.id))}<`);
		}
	});

	it("shows another rider nothing of these badges", async () => {
		await seedBalance(ATHLETE_B, { trainingRynke: 5 });
		const { html } = await section(ATHLETE_B);
		for (const [id] of EARNED) expect(html).not.toContain(id);
	});
});

describe("the Abzeichen section without badges", () => {
	it("encourages a rider without badges (US1 scenario 4)", async () => {
		await seedBalance(ATHLETE_A);
		const { section: badges } = await section();
		expect(badges).toContain(escapeHtml(de["badges.empty"]));
		// The gallery has outlines only (#109).
		expect(galleryOf(badges)).toContain('<li class="badge-slot"');
		expect(badges).not.toContain("popovertarget");
		expect([
			...personalGroup(badges).matchAll(
				/<li class="badge-card badge-card-empty"/g,
			),
		]).toHaveLength(17);
	});

	it("isn't there in the waiting state (US1 scenario 5)", async () => {
		const { html, section: badges } = await section();
		expect(badges).toBeNull();
		expect(html).not.toContain('class="badges"');
		expect(html).toContain('class="waiting');
	});
});

describe("the team's badges (US4)", () => {
	const TEAM = [900011, 900012, 900013, 900014, 900015];

	beforeEach(async () => {
		await seedBalance(ATHLETE_A);
		await earn(ATHLETE_A, EARNED);
		for (const athleteId of TEAM) {
			await seedRider(ctx, { athleteId, firstName: `Teamrider${athleteId}` });
		}
		// Five listed riders at one team training: the first big training.
		await attendRaw(await insertEvent("team_training", "2026-04-11"), TEAM);
	});

	const teamGroup = (badges: string | null) =>
		badges?.match(
			/<section id="badges-team" class="badge-group badge-group-team"[\s\S]*?<\/section>/,
		)?.[0] ?? "";

	it("shows them after the rider's own, with their own heading and count", async () => {
		const { section: badges } = await section();
		const team = teamGroup(badges);
		expect(team).toContain(
			`<h3 id="badges-team-heading"><span class="badges-title-newest">${de["badges.team.newest"]}</span><span class="badges-title-all">${de["badges.team.all"].replace("{n}", "1")}</span></h3>`,
		);
		expect(team).toContain('popovertarget="badge-big-training-5"');
		expect(badges?.indexOf("badge-group-team")).toBeGreaterThan(
			badges?.indexOf("badge-group-personal") ?? -1,
		);
		expect(badges).toContain(
			`<span class="badges-title-all">${de["badges.personal.all"].replace("{n}", "3")}</span>`,
		);
		if (!BADGE_PICTURES.has("big-training-5")) {
			expect(team).toContain(`src="${artUrl("/badges/placeholder-team.svg")}"`);
		}
		expect(badges).toContain(
			'<div popover id="badge-big-training-5" class="badge-large badge-large-team">',
		);
		expect(team).toContain('<use href="#badge-ribbon" fill="#8cc4f0"/>');
	});

	it("scrolls to the rider's own new badge before the team's (Part I)", async () => {
		const { html } = await section();
		expect(html).toContain(
			'<aside class="badges-reveal" role="status" data-scroll-to="distance">',
		);
		const i18n = createI18n("de", CATALOGS);
		const team = { badgeId: "big-training-5", earnedOn: "2026-04-11" };
		const own = { badgeId: "elevation-1000", earnedOn: "2026-04-12" };
		expect(String(renderBadgeReveal(i18n, [team, own]))).toContain(
			'data-scroll-to="elevation"',
		);
		expect(String(renderBadgeReveal(i18n, [team]))).toContain(
			'data-scroll-to="big_training"',
		);
	});

	it("keeps all badges off the Overview and the Team page", async () => {
		for (const path of ["/me", "/team"]) {
			const { html } = await section(ATHLETE_A, undefined, path);
			expect(html, path).not.toContain('class="badges"');
			expect(html, path).not.toContain("popovertarget");
		}
	});

	it("names no rider (FR-032)", async () => {
		const { section: badges } = await section();
		for (const athleteId of TEAM) {
			expect(badges).not.toContain(`Teamrider${athleteId}`);
		}
	});

	it("shows only the team categories without a badge, in the team group", async () => {
		const { section: badges } = await section();
		const rows = [
			...teamGroup(badges).matchAll(
				/<li class="badge-card badge-card-empty" data-category="(\w+)">/g,
			),
		].map((m) => m[1]);
		expect(rows).toEqual([
			"team_training_rynke",
			"team_distance",
			"team_elevation",
			"team_running",
			"attendances",
			"team_surprise",
		]);
	});

	it("shows the Tour de Paris days among the rider's own, no bar (021 US2)", async () => {
		await earn(ATHLETE_A, [
			["tour-de-paris-1", "2026-07-04"],
			["tour-de-paris-3", "2026-07-06"],
		]);
		const { section: badges } = await section();
		expect(teamGroup(badges)).not.toContain("tour_de_paris");
		const personal = personalGroup(badges);
		const card =
			personal.match(
				/<li class="badge-card" data-category="tour_de_paris">[\s\S]*?<\/li>/,
			)?.[0] ?? "";
		// The newest day on the card, no bar towards another (FR-013).
		expect(card).toContain('popovertarget="badge-tour-de-paris-3"');
		// The placeholder only while the day has no picture yet.
		expect(card).toContain(
			`src="${artUrl(
				BADGE_PICTURES.has("tour-de-paris-3")
					? "/badges/tour-de-paris-3.svg"
					: "/badges/placeholder-personal.svg",
			)}"`,
		);
		expect(card).toContain(
			`<span class="badge-ribbon-text">${escapeHtml(de["badges.value.tourDay"].replace("{n}", "3"))}</span>`,
		);
		expect(card).not.toContain('class="badge-progress"');
		const gallery =
			personal.match(
				/<div class="badge-gallery-category">\s*<h4[^>]*>[^<]*Tour de Paris[\s\S]*?<\/ul>/,
			)?.[0] ?? "";
		expect(gallery).toContain('popovertarget="badge-tour-de-paris-1"');
		expect(gallery.match(/class="badge-slot"/g)).toHaveLength(6);
		const large =
			badges?.match(
				/<div popover id="badge-tour-de-paris-3" [^>]*>[\s\S]*?<\/div>/,
			)?.[0] ?? "";
		expect(large).toContain(
			`<h4>${escapeHtml(nameOf("tour-de-paris-3"))}</h4>`,
		);
		expect(large).toContain(
			escapeHtml(de["badges.tourDay.for"].replace("{day}", "3")),
		);
		expect(large).toContain(
			escapeHtml(de["badges.earnedOn"].replace("{date}", "06.07.2026")),
		);
	});

	it("counts a rider without a current consent towards nothing (US4 scenario 4)", async () => {
		await env.DB.prepare("DELETE FROM consent_records WHERE athlete_id = ?")
			.bind(TEAM[0])
			.run();
		const { section: badges } = await section();
		expect(badges).not.toContain("big-training-5");
	});
});

// Part C (2026-10-12): the new categories on the page. The test clock is 6
// October 2026 in a season from 1 January 2026, so January and February are
// over and November and December are still to come (FR-004a, research R25).
describe("the part C categories on the page", () => {
	const card = (badges: string | null, category: string) =>
		personalGroup(badges).match(
			new RegExp(
				`<li class="badge-card[^"]*" data-category="${category}">[\\s\\S]*?</li>`,
			),
		)?.[0] ?? "";
	const missing = (value: string) =>
		escapeHtml(de["badges.missing"].replace("{value}", value));

	beforeEach(async () => {
		await seedBalance(ATHLETE_A);
	});

	it("shows a ride's length and the days of a coming winter month", async () => {
		// 3 counting rides of 40 km, on 8 to 10 May.
		await seedRides(ATHLETE_A, 3, "2026-05-10");
		const { section: badges } = await section();
		expect(card(badges, "ride_length")).toContain(missing("10\u00a0km"));
		expect(card(badges, "virtual_rides")).toContain(missing("50\u00a0km"));
		expect(card(badges, "winter_november")).toContain(missing("1\u00a0Tag"));
	});

	it("shows no bar for a winter month that is over, but keeps its card", async () => {
		const { section: badges } = await section();
		const january = card(badges, "winter_january");
		expect(january).toContain('<div class="badge-slot">');
		expect(january).not.toContain("badge-progress");
		expect(card(badges, "winter_december")).toContain(
			`<span class="badge-next">${escapeHtml(de["badges.first"])}</span>`,
		);
		expect(card(badges, "winter_december")).toContain("badge-progress");
	});

	it("counts outdoor winter days from the stored results, none after today", async () => {
		// 3 outdoor counting rides on 4 to 6 February; 2 in December, after
		// the test clock's today (6 October 2026).
		await seedRides(ATHLETE_A, 3, "2026-02-06");
		await seedRides(ATHLETE_A, 2, "2026-12-06", 8_300_001);
		const read = await readRiderBadges(
			env.DB,
			ATHLETE_A,
			badgeWindow(countingWindow(env), "2026-10-06"),
		);
		expect(read.winterDays).toEqual({ 2: 3 });
		const { section: badges } = await section();
		expect(card(badges, "winter_december")).toContain(missing("1\u00a0Tag"));
	});

	it("shows swims with one decimal, and decimals on the ribbon only where they are", async () => {
		await env.DB.batch(
			[
				[9_100_001, "2026-05-02", 1200],
				[9_100_002, "2026-05-05", 800],
			].map(([id, day, distance]) =>
				env.DB.prepare(
					`INSERT INTO swims (strava_activity_id, athlete_id, start_date,
						start_date_local, distance_m, is_private, refreshed_at)
					VALUES (?, ?, ?, ?, ?, 0, 0)`,
				).bind(id, ATHLETE_A, `${day}T07:00:00Z`, `${day}T09:00:00Z`, distance),
			),
		);
		await earn(ATHLETE_A, [
			["swim-length-500", "2026-05-02"],
			["swim-length-1000", "2026-05-02"],
		]);
		const { section: badges } = await section();
		const length = card(badges, "swim_length");
		expect(length).toContain(
			'<span class="badge-ribbon-text">1\u00a0km</span>',
		);
		expect(length).toContain(missing("0,7\u00a0km"));
		expect(card(badges, "swimming")).toContain(missing("3,0\u00a0km"));
		const gallery = galleryOf(badges);
		expect(gallery).toContain('<span class="badge-value">0,5\u00a0km</span>');
	});

	it("names winter badges in days on the ribbon", async () => {
		await earn(ATHLETE_A, [["winter-november-5", "2026-11-20"]]);
		const { section: badges } = await section();
		expect(card(badges, "winter_november")).toContain(
			'<span class="badge-ribbon-text">5\u00a0Tage</span>',
		);
	});
});

// Part D: "?" until earned, why once earned (FR-015b, SC-003, research R34).
describe("the surprise badges on the page", () => {
	const surpriseCard = (badges: string | null) =>
		personalGroup(badges).match(
			/<li class="badge-card[^"]*" data-category="surprise">[\s\S]*?<\/li>/,
		)?.[0] ?? "";
	const about = `<h4>${escapeHtml(de["badges.category.surprise"])}</h4>\n<p class="badge-about">?</p>`;
	const outline = `<h4>${escapeHtml(de["badges.category.surprise"])}</h4>\n<div class="badge-slot">${BADGE_OUTLINE}<p class="badge-about">?</p></div>`;

	beforeEach(async () => {
		await seedBalance(ATHLETE_A);
	});

	it("shows only ? and an outline without a bar before any (US6 1)", async () => {
		await earn(ATHLETE_A, [["distance-100", "2026-05-02"]]);
		const { section: badges } = await section();
		const card = surpriseCard(badges);
		expect(card).toContain("badge-card-empty");
		expect(card).toContain(outline);
		expect(card).not.toContain("badge-progress");
		const gallery = galleryOf(badges);
		expect(gallery).toContain(about);
	});

	it("names an earned one and says why, and nothing of the others (US6 8)", async () => {
		await earn(ATHLETE_A, [
			["surprise-night-owl", "2026-05-02"],
			["surprise-christmas-eve", "2026-05-04"],
		]);
		const { html, section: badges } = await section();
		const card = surpriseCard(badges);
		expect(card).toContain(
			`<h4>${escapeHtml(de["badges.category.surprise"])}</h4>`,
		);
		expect(card).not.toContain("badge-about");
		expect(card).toContain('popovertarget="badge-surprise-christmas-eve"');
		expect(card).toContain(
			`<span class="badge-ribbon-text">${escapeHtml(de["badges.surprise.christmas-eve"])}</span>`,
		);
		expect(card).not.toContain("badge-progress");
		expect(badges).toContain(escapeHtml(de["badges.surprise.night-owl.for"]));
		for (const name of [
			"new-year",
			"christmas",
			"early-bird",
			"rest-day",
			// Part F (SC-003).
			"festive-500",
			"stage-rider",
			"triathlon",
			"pi-day",
			"solstice",
			"easter",
			"everesting",
			// Part J.
			"winter-sleep",
		] as const) {
			// Whole ids: "surprise-christmas" is a prefix of "-christmas-eve".
			expect(html).not.toContain(`badge-surprise-${name}"`);
			expect(html).not.toContain(`/badges/surprise-${name}.svg`);
			expect(html).not.toContain(escapeHtml(de[`badges.surprise.${name}.for`]));
			expect(html).not.toContain(
				`>${escapeHtml(de[`badges.surprise.${name}`])}<`,
			);
			expect(html).not.toContain(escapeHtml(nameOf(`surprise-${name}`)));
		}
	});
});

// Part E: the team's surprises (FR-016, FR-016a, research R39).
describe("the team surprise badges on the page", () => {
	const teamGroup = (badges: string | null) =>
		badges?.match(
			/<section id="badges-team" class="badge-group badge-group-team"[\s\S]*?<\/section>/,
		)?.[0] ?? "";
	const card = (badges: string | null) =>
		teamGroup(badges).match(
			/<li class="badge-card[^"]*" data-category="team_surprise">[\s\S]*?<\/li>/,
		)?.[0] ?? "";

	beforeEach(async () => {
		await seedBalance(ATHLETE_A);
		await seedBalance(ATHLETE_B);
	});

	it("shows ? and an outline without a bar before any (US7 1)", async () => {
		const { section: badges } = await section();
		expect(card(badges)).toContain("badge-card-empty");
		expect(card(badges)).toContain('<p class="badge-about">?</p>');
		expect(card(badges)).not.toContain("badge-progress");
	});

	const swimOn = (id: number, athleteId: number, day: string) =>
		env.DB.prepare(
			`INSERT INTO swims (strava_activity_id, athlete_id, start_date,
				start_date_local, distance_m, is_private, refreshed_at)
			VALUES (?, ?, ?, ?, 1500, 0, 0)`,
		)
			.bind(id, athleteId, `${day}T06:00:00Z`, `${day}T08:00:00Z`)
			.run();

	it("counts a swim like a run: no day off on a swim's day (US7 8)", async () => {
		// Rides on 3 and 5 May, a swim on 4 May.
		await seedRides(ATHLETE_A, 1, "2026-05-03", 8_200_001);
		await seedRides(ATHLETE_B, 1, "2026-05-05", 8_200_002);
		await swimOn(9_200_001, ATHLETE_A, "2026-05-04");
		const { html } = await section();
		expect(html).not.toContain('badge-team-surprise-day-off"');
	});

	it("earns the day off between listed riders' activities (US7 2)", async () => {
		// A ride on 3 May, nothing on 4 May, a swim on 5 May.
		await seedRides(ATHLETE_A, 1, "2026-05-03", 8_200_001);
		await swimOn(9_200_002, ATHLETE_B, "2026-05-05");
		const { html, section: badges } = await section();
		const team = card(badges);
		expect(team).toContain('popovertarget="badge-team-surprise-day-off"');
		expect(team).toContain(
			`<span class="badge-ribbon-text">${escapeHtml(de["badges.surprise.day-off"])}</span>`,
		);
		expect(badges).toContain(escapeHtml(de["badges.surprise.day-off.for"]));
		expect(team).not.toContain("badge-progress");
		// No rider named (FR-016a).
		expect(teamGroup(badges)).not.toContain("Testrider");
		expect(html).not.toContain('badge-team-surprise-all-out"');
	});
});

describe("a tour badge's ribbon (feature 021)", () => {
	it("names the tour day, not a count of days", () => {
		const badge = BADGES.find((b) => b.id === "tour-de-paris-3");
		if (!badge) throw new Error("no tour-de-paris-3");
		expect(milestone(createI18n("de", CATALOGS), badge)).toBe("Tag\u00a03");
		expect(milestone(createI18n("en", CATALOGS), badge)).toBe("Day\u00a03");
	});
});
