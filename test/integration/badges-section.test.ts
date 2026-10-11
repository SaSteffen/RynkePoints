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

// The Abzeichen section on the Overview (feature 013 US1,
// contracts/abzeichen-section.md "Rules the tests check"). Synthetic badges.

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
async function section(athleteId = ATHLETE_A, acceptLanguage?: string) {
	const { status, html } = await riderPage(
		ctx,
		athleteId,
		"/me",
		acceptLanguage,
	);
	expect(status).toBe(200);
	return {
		html,
		section:
			html.match(/<section class="badges"[\s\S]*<\/section>\n<\/div>/)?.[0] ??
			null,
	};
}

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

	it("follows the Rynke figures with heading and intro", async () => {
		const { html, section: badges } = await section();
		expect(badges).not.toBeNull();
		expect(html.indexOf('<section class="badges"')).toBeGreaterThan(
			html.indexOf('class="hero"'),
		);
		expect(badges).toContain(
			`<h2 id="badges-heading">${de["badges.heading"]}</h2>`,
		);
		expect(badges).toContain(escapeHtml(de["badges.intro"]));
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

	it("lists the categories without a badge with their bar", async () => {
		const { section: badges } = await section();
		const rows = [
			...(badges ?? "").matchAll(
				/<li class="badge-not-yet-row badge-group-personal" data-category="(\w+)">/g,
			),
		].map((m) => m[1]);
		expect(rows).toEqual([
			"team_events",
			"technique",
			"training_rynke",
			"run_length",
			"running",
		]);
		expect(badges).toContain(
			escapeHtml(de["badges.missing"].replace("{value}", "1\u00a0Termin")),
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
		expect(badges).not.toContain('class="badge-cards"');
		expect(badges).not.toContain("<details");
		expect([
			...(badges ?? "").matchAll(
				/class="badge-not-yet-row badge-group-personal"/g,
			),
		]).toHaveLength(7);
	});

	it("isn't there in the waiting state (US1 scenario 5)", async () => {
		const { html, section: badges } = await section();
		expect(badges).toBeNull();
		expect(html).not.toContain('class="badges"');
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

	it("follows the personal group with its own heading and count", async () => {
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
			badges?.indexOf("badge-group-personal") ?? 0,
		);
		if (!BADGE_PICTURES.has("big-training-5")) {
			expect(team).toContain('src="/badges/placeholder-team-ribbon.svg"');
		}
		expect(badges).toContain(
			'<div popover id="badge-big-training-5" class="badge-large badge-large-team">',
		);
	});

	it("keeps team badges out of the personal group (FR-014)", async () => {
		const { section: badges } = await section();
		const personal =
			badges?.match(
				/<section class="badge-group badge-group-personal"[\s\S]*?<\/section>/,
			)?.[0] ?? "";
		expect(personal).not.toContain("big-training");
		expect(personal).toContain(
			`<summary>${de["badges.personal.all"].replace("{n}", "3")}</summary>`,
		);
	});

	it("names no rider (FR-032)", async () => {
		const { section: badges } = await section();
		for (const athleteId of TEAM) {
			expect(badges).not.toContain(`Teamrider${athleteId}`);
		}
	});

	it("lists the team categories without a badge after the personal ones", async () => {
		const { section: badges } = await section();
		const rows = [
			...(badges ?? "").matchAll(
				/<li class="badge-not-yet-row badge-group-(\w+)" data-category="(\w+)">/g,
			),
		].map((m) => `${m[1]}:${m[2]}`);
		expect(rows.slice(-5)).toEqual([
			"team:team_training_rynke",
			"team:team_distance",
			"team:team_elevation",
			"team:team_running",
			"team:attendances",
		]);
		expect(rows.slice(0, -5).every((r) => r.startsWith("personal:"))).toBe(
			true,
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
