import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { BADGES } from "../../src/badges/catalog";
import { BADGE_PICTURES } from "../../src/badges/pictures";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { BADGE_NAMES } from "../../src/i18n/messages/badges.de";
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

/** The rider's own group; the team's follows it on the same page. */
const personalGroup = (badges: string | null) =>
	badges?.match(
		/<section class="badge-group badge-group-personal"[\s\S]*?<\/section>/,
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
		expect(distance).toContain(
			escapeHtml(de["badges.missing"].replace("{value}", "480\u00a0km")),
		);
		expect(distance).toContain('<span style="width:52%"></span>');
		expect(badges).toContain(
			escapeHtml(de["badges.missing"].replace("{value}", "1.100\u00a0m")),
		);
		expect(distance).toContain(
			`aria-label="${escapeHtml(`${nameOf("distance-500")}, 500\u00a0km`)}"`,
		);
	});

	it("uses the finished picture or the placeholder", async () => {
		const missing = BADGES.find(
			(b) => b.group === "personal" && !BADGE_PICTURES.has(b.id),
		);
		if (missing) await earn(ATHLETE_A, [[missing.id, "2026-05-02"]]);
		const { section: badges } = await section();
		if (BADGE_PICTURES.has("distance-500")) {
			expect(badges).toContain('src="/badges/distance-500-ribbon.svg"');
			expect(badges).toContain('src="/badges/distance-500.svg"');
		}
		if (missing) {
			expect(badges).toContain('src="/badges/placeholder-personal-ribbon.svg"');
			expect(badges).toContain('src="/badges/placeholder-personal.svg"');
			expect(badges).not.toContain(`/badges/${missing.id}`);
		}
	});

	it("keeps the gallery closed, counted, in catalog order", async () => {
		const { section: badges } = await section();
		expect(badges).toContain('<details class="badge-gallery">');
		expect(badges).toContain(
			`<summary>${de["badges.personal.all"].replace("{n}", "3")}</summary>`,
		);
		const gallery = badges?.match(/<details[\s\S]*?<\/details>/)?.[0] ?? "";
		expect(
			[...gallery.matchAll(/popovertarget="badge-([\w-]+)"/g)].map((m) => m[1]),
		).toEqual(["distance-500", "distance-100", "elevation-1000"]);
	});

	it("shows the badges still to earn as empty outlines in the gallery (#109)", async () => {
		const { section: badges } = await section();
		const gallery = badges?.match(/<details[\s\S]*?<\/details>/)?.[0] ?? "";
		const lists = [...gallery.matchAll(/<ul>([\s\S]*?)<\/ul>/g)].map(
			(m) => m[1] ?? "",
		);
		// Distance: 2 of 5 earned; elevation: 1 of 4; the other categories have
		// none yet and show only outlines (part C's eight after running).
		const slots = (list: string) =>
			list.match(/<li class="badge-slot" aria-hidden="true"><\/li>/g)?.length;
		expect(lists.map(slots)).toEqual([
			3, 3, 4, 2, 10, 4, 6, 6, 5, 4, 5, 3, 3, 3, 3, 6,
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
			"surprise",
		]);
		expect(badges).toContain(
			escapeHtml(de["badges.missing"].replace("{value}", "1\u00a0Termin")),
		);
		expect(badges).toContain(
			'<span class="badge-slot" aria-hidden="true"></span>',
		);
	});

	it("explains each category under its name", async () => {
		const { section: badges } = await section();
		const about = (category: "distance" | "running") =>
			escapeHtml(de[`badges.about.${category}`]);
		// On the card and in the gallery.
		expect(badges).toContain(
			`<h4>${escapeHtml(de["badges.category.distance"])}</h4>\n<p class="badge-about">${about("distance")}</p>`,
		);
		expect(badges?.split(about("distance")).length).toBe(3);
		// On the card of a category without a badge.
		expect(badges).toContain(
			`<h4>${escapeHtml(de["badges.category.running"])}</h4>\n<p class="badge-about">${about("running")}</p>`,
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
			expect(html).not.toContain(`/badges/${badge.id}-ribbon.svg`);
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
		expect(badges).not.toContain("<details");
		expect(badges).not.toContain("popovertarget");
		expect([
			...personalGroup(badges).matchAll(
				/<li class="badge-card badge-card-empty"/g,
			),
		]).toHaveLength(16);
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
			/<section class="badge-group badge-group-team"[\s\S]*?<\/section>/,
		)?.[0] ?? "";

	it("shows them after the rider's own, with their own heading and count", async () => {
		const { section: badges } = await section();
		const team = teamGroup(badges);
		expect(team).toContain(
			`<h3 id="badges-team-heading">${de["badges.team.newest"]}</h3>`,
		);
		expect(team).toContain(
			`<summary>${de["badges.team.all"].replace("{n}", "1")}</summary>`,
		);
		expect(team).toContain('popovertarget="badge-big-training-5"');
		expect(badges?.indexOf("badge-group-team")).toBeGreaterThan(
			badges?.indexOf("badge-group-personal") ?? -1,
		);
		expect(badges).toContain(
			`<summary>${de["badges.personal.all"].replace("{n}", "3")}</summary>`,
		);
		if (!BADGE_PICTURES.has("big-training-5")) {
			expect(team).toContain('src="/badges/placeholder-team-ribbon.svg"');
		}
		expect(badges).toContain(
			'<div popover id="badge-big-training-5" class="badge-large badge-large-team">',
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
		expect(january).toContain('<span class="badge-slot" aria-hidden="true">');
		expect(january).not.toContain("badge-progress");
		expect(card(badges, "winter_december")).toContain("badge-progress");
	});

	it("counts outdoor winter days from the stored results", async () => {
		// 3 counting rides of 40 km on 4 to 6 December, as outdoor rides.
		await seedRides(ATHLETE_A, 3, "2026-12-06");
		const { section: badges } = await section();
		expect(card(badges, "winter_december")).toContain(missing("2\u00a0Tage"));
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
		const gallery = badges?.match(/<details[\s\S]*?<\/details>/)?.[0] ?? "";
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

	beforeEach(async () => {
		await seedBalance(ATHLETE_A);
	});

	it("shows only ? and an outline without a bar before any (US6 1)", async () => {
		await earn(ATHLETE_A, [["distance-100", "2026-05-02"]]);
		const { section: badges } = await section();
		const card = surpriseCard(badges);
		expect(card).toContain("badge-card-empty");
		expect(card).toContain(about);
		expect(card).not.toContain("badge-progress");
		const gallery = badges?.match(/<details[\s\S]*?<\/details>/)?.[0] ?? "";
		expect(gallery).toContain(about);
	});

	it("names an earned one and says why, and nothing of the others (US6 8)", async () => {
		await earn(ATHLETE_A, [
			["surprise-night-owl", "2026-05-02"],
			["surprise-christmas-eve", "2026-05-04"],
		]);
		const { html, section: badges } = await section();
		const card = surpriseCard(badges);
		expect(card).toContain(about);
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
		] as const) {
			// Whole ids: "surprise-christmas" is a prefix of "-christmas-eve".
			expect(html).not.toContain(`badge-surprise-${name}"`);
			expect(html).not.toContain(`/badges/surprise-${name}.svg`);
			expect(html).not.toContain(`/badges/surprise-${name}-ribbon.svg`);
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
			/<section class="badge-group badge-group-team"[\s\S]*?<\/section>/,
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
