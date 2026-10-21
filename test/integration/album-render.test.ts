import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { readOnly } from "../../album/guard";
import { type AlbumData, loadAlbum } from "../../album/load";
import { renderAlbum } from "../../album/render";
import { ALBUM_CSS } from "../../album/style";
import { BADGES } from "../../src/badges/catalog";
import { BADGE_PICTURES } from "../../src/badges/pictures";
import { makeCtx, resetDb, seedRider, tableCounts } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import { seedBalance, seedRide } from "../support/rider-view";
import { attendRaw, insertEvent } from "../support/rynke";

// One rider's album from a seeded synthetic season (feature 021 US4, US5,
// research R16): its figures are the app's, it names no one else, and nothing
// is written. Tests run with season start 2026-01-01, deadline 2027-06-30
// (vitest.config.ts) and today 2026-10-06 (NOW).

const ctx = makeCtx();
const ANNA = ATHLETE_A;
const BEN = ATHLETE_B;
const NOT_LISTED = ATHLETE_C;
const TODAY = "2026-10-06";

async function load(athleteId: number, firstName: string, cutoff = TODAY) {
	return loadAlbum(
		readOnly(env.DB),
		env,
		{ athleteId, firstName },
		cutoff,
		NOW,
	);
}

async function earn(athleteId: number, badgeId: string, earnedOn: string) {
	await env.DB.prepare(
		"INSERT INTO rider_badges (athlete_id, badge_id, earned_on) VALUES (?, ?, ?)",
	)
		.bind(athleteId, badgeId, earnedOn)
		.run();
}

let tourDay = 0;

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ANNA, firstName: "Anna" });
	await seedRider(ctx, { athleteId: BEN, firstName: "Ben" });
	await seedRider(ctx, {
		athleteId: NOT_LISTED,
		firstName: "Cleo",
		consentVersion: null,
	});
	await seedBalance(ANNA, { trainingRynke: 31, teamRynke: 6 });
	await seedBalance(BEN, { trainingRynke: 17, teamRynke: 3 });
	await seedBalance(NOT_LISTED, { trainingRynke: 500, teamRynke: 50 });
	await seedRide(ANNA, {
		id: 1,
		start_date: "2026-09-07T08:00:00Z",
		result: { counts: true, distanceRynke: 4, elevationDm: 0 },
	});
	await seedRide(ANNA, {
		id: 2,
		start_date: "2026-09-14T08:00:00Z",
		result: { counts: true, distanceRynke: 5, elevationDm: 0 },
	});
	await seedRide(BEN, {
		id: 3,
		start_date: "2026-09-08T08:00:00Z",
		result: { counts: true, distanceRynke: 3, elevationDm: 0 },
	});
	const training = await insertEvent(
		"team_training",
		"2026-09-20",
		"Hafenrunde",
	);
	const technique = await insertEvent("technique_training", "2026-09-27");
	tourDay = await insertEvent("tour_de_paris", "2026-10-01", "Etappe 1");
	await insertEvent("team_training", "2026-10-20", "Später");
	await attendRaw(training, [ANNA, BEN, NOT_LISTED]);
	await attendRaw(technique, [BEN]);
	await attendRaw(tourDay, [ANNA]);
	await earn(ANNA, "distance-100", "2026-09-14");
	await earn(ANNA, "elevation-1000", "2026-10-05");
	await earn(BEN, "distance-500", "2026-09-30");
	// Anna's tour day, stored as a personal badge (021 US2).
	await earn(ANNA, "tour-de-paris-1", "2026-10-01");
});

describe("the summary", () => {
	it("shows the rider's stored Rynke and the team's, as the app does today", async () => {
		const data = await load(ANNA, "Anna");
		expect(data.rider).toEqual({
			athleteId: ANNA,
			firstName: "Anna",
			trainingRynke: 31,
			teamRynke: 6,
			eventsAttended: 2,
		});
		// The Team page's total: the listed riders' balances (feature 016).
		expect(data.team.trainingRynke).toBe(31 + 17);
		expect(data.season).toEqual({
			start: "2026-01-01",
			end: "2026-12-31",
			label: "2026/27",
		});
		expect(data.locale).toBe("de");
	});

	it("takes the daily series' values for a cut-off before today", async () => {
		const data = await load(ANNA, "Anna", "2026-09-10");
		expect(data.rider.trainingRynke).toBe(4);
		expect(data.rider.teamRynke).toBe(0);
		expect(data.rider.eventsAttended).toBe(0);
		expect(data.team.trainingRynke).toBe(4 + 3);
		expect(data.team.events).toEqual([]);
	});

	it("lists every event of the season up to the cut-off, with listed riders and ticks", async () => {
		const data = await load(ANNA, "Anna");
		expect(data.team.events).toEqual([
			{
				date: "2026-09-20",
				kind: "team_training",
				name: "Hafenrunde",
				attendees: 2,
				attendedByRider: true,
			},
			{
				date: "2026-09-27",
				kind: "technique_training",
				name: null,
				attendees: 1,
				attendedByRider: false,
			},
			{
				date: "2026-10-01",
				kind: "tour_de_paris",
				name: "Etappe 1",
				attendees: 1,
				attendedByRider: true,
			},
		]);
	});

	it("renders page 1 and 2 with the figures and the event table", async () => {
		const page = renderAlbum(await load(ANNA, "Anna"));
		expect(page).toContain("Rynke-Album");
		expect(page).toContain("Saison 2026/27");
		expect(page).toContain('<p class="owner-name">Anna</p>');
		expect(page).toContain("<span>31</span>");
		expect(page).toContain("Die Saison des Teams");
		expect(page).toContain('<span class="team-total-value">48</span>');
		expect(page).toContain("Hafenrunde");
		expect(page).toContain('<tr class="tour"');
		expect(page).toContain("3 Teamtermine, davon 1 Tage Tour de Paris");
		expect(page).toContain("du warst dabei (2)");
		expect(page).toContain("Stand: 06.10.2026");
	});

	it("names no other rider, listed or not", async () => {
		const page = renderAlbum(await load(ANNA, "Anna"));
		expect(page).not.toContain("Ben");
		expect(page).not.toContain("Cleo");
		const bens = renderAlbum(await load(BEN, "Ben"));
		expect(bens).not.toContain("Anna");
		expect(bens).not.toContain("Cleo");
	});

	it("writes nothing", async () => {
		const before = await tableCounts();
		await load(ANNA, "Anna");
		await load(BEN, "Ben", "2026-09-10");
		expect(await tableCounts()).toEqual(before);
	});
});

describe("the sticker pages", () => {
	function slot(data: AlbumData, badgeId: string) {
		const found = data.slots.find((s) => s.badgeId === badgeId);
		if (!found) throw new Error(`no slot ${badgeId}`);
		return found;
	}

	it("have one slot per catalog badge, in gallery order", async () => {
		const data = await load(ANNA, "Anna");
		expect(data.slots.map((s) => s.badgeId)).toEqual(BADGES.map((b) => b.id));
	});

	it("stick in the rider's badges earned on or before the cut-off", async () => {
		const today = await load(ANNA, "Anna");
		expect(slot(today, "distance-100").earnedOn).toBe("2026-09-14");
		expect(slot(today, "elevation-1000").earnedOn).toBe("2026-10-05");
		expect(slot(today, "distance-500").earnedOn).toBeNull();
		const earlier = await load(ANNA, "Anna", "2026-10-01");
		expect(slot(earlier, "elevation-1000").earnedOn).toBeNull();
	});

	it("stick in the rider's own tour days, not another rider's", async () => {
		const data = await load(ANNA, "Anna");
		expect(slot(data, "tour-de-paris-1").earnedOn).toBe("2026-10-01");
		expect(slot(data, "tour-de-paris-2").earnedOn).toBeNull();
		const before = await load(ANNA, "Anna", "2026-09-30");
		expect(slot(before, "tour-de-paris-1").earnedOn).toBeNull();
		const bens = await load(BEN, "Ben");
		expect(slot(bens, "tour-de-paris-1").earnedOn).toBeNull();
	});

	it("draw a sticker with its picture, or its group's placeholder picture", async () => {
		const page = renderAlbum(await load(ANNA, "Anna"));
		const sticker = (id: string) =>
			page.match(
				new RegExp(
					`data-badge="${id}"[\\s\\S]*?(?=<div class="slot|</section>)`,
				),
			)?.[0] ?? "";
		expect(sticker("distance-100")).toContain('class="sticker"');
		expect(sticker("distance-100")).toContain('src="/badges/distance-100.svg"');
		expect(sticker("distance-100")).toContain("Die ersten Hundert");
		expect(sticker("distance-100")).toContain("14.09.2026");
		// The ribbon with its milestone, and what the badge was for.
		expect(sticker("distance-100")).toMatch(
			/<svg class="ribbon"[\s\S]*?<text [^>]*>100\u00a0km<\/text>/,
		);
		expect(sticker("distance-100")).toContain(
			'<p class="caption-for">Du bist in dieser Saison 100\u00a0km Rad gefahren.</p>',
		);
		// The placeholder only while the badge has no picture yet.
		expect(sticker("tour-de-paris-1")).toContain(
			BADGE_PICTURES.has("tour-de-paris-1")
				? 'src="/badges/tour-de-paris-1.svg"'
				: 'src="/badges/placeholder-personal.svg"',
		);
		expect(sticker("tour-de-paris-1")).toContain("Tour-Tag 1");
	});

	it("leave an empty slot with its placeholder and name, a surprise with ?", async () => {
		const page = renderAlbum(await load(ANNA, "Anna"));
		const empty =
			page.match(
				/data-badge="distance-500"[\s\S]*?(?=<div class="slot)/,
			)?.[0] ?? "";
		expect(empty).not.toContain('class="sticker"');
		expect(empty).toContain('class="placeholder"');
		expect(empty).toContain("Halber Tausender");
		expect(empty).toContain('<p class="caption-value">500\u00a0km</p>');
		expect(empty).not.toContain('class="ribbon"');
		expect(empty).not.toContain("caption-for");
		const surprise = BADGES.find((b) => b.category === "surprise");
		const secret =
			page.match(
				new RegExp(
					`data-badge="${surprise?.id}"[\\s\\S]*?(?=<div class="slot)`,
				),
			)?.[0] ?? "";
		expect(secret).toContain('<p class="secret">?</p>');
		expect(secret).toContain('<p class="caption-name">?</p>');
		expect(secret).not.toContain("badges.about");
		expect(secret).not.toContain("caption-value");
	});

	it("say how many of each group are stuck in", async () => {
		const page = renderAlbum(await load(ANNA, "Anna"));
		const personal = BADGES.filter((b) => b.group === "personal").length;
		const team = BADGES.filter((b) => b.group === "team").length;
		// Two badges and her tour day.
		expect(page).toContain(`<span class="chip">3 von ${personal}</span>`);
		expect(page).toMatch(
			new RegExp(`<span class="chip">\\d+ von ${team}</span>`),
		);
	});
});

describe("the stylesheet", () => {
	const css = ALBUM_CSS;

	it("prints on A4 without margins", () => {
		expect(css).toContain("size: 210mm 297mm;");
		expect(css).toMatch(/@page\s*{[^}]*margin: 0;/);
	});

	it("uses no filter, which Chromium prints as an image (FR-054)", () => {
		const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
		expect(rules).not.toMatch(/filter\s*:/);
	});
});
