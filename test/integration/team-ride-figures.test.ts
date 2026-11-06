import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { evaluateChange } from "../../src/rynke/apply";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { riderPage, seedBalance, seedRide } from "../support/rider-view";
import { activityRecord } from "../support/rynke";

// The ride stats ranking on `/team` (feature 032 US1, US3, US4, FR-019,
// FR-020, SC-003, SC-005, contracts/pages.md). Today is 2026-10-06, a
// Tuesday: the week runs 5 to 11 October. Synthetic riders only.

const ctx = makeCtx();
const { de } = CATALOGS;

const R1 = { id: 920_001, name: "Ottilie" };
const R2 = { id: 920_002, name: "Waltraud" };
const VIEWER = { id: 920_003, name: "Kunigunde" };
const ORGANISER = { id: 920_004, name: "Hildegard" };
/** On consent version 2: listed, but in no ride figure (FR-020). */
const ON_TWO = { id: 920_005, name: "Brunhilde" };
const UNCONSENTED = { id: 920_006, name: "Gertrude" };
const ALL = [R1, R2, VIEWER, ORGANISER, ON_TWO, UNCONSENTED];

let nextId = 1;

/** A counting ride of `km` and `m` elevation, started at 09:00 on `date`. */
async function ride(
	athleteId: number,
	date: string,
	km: number,
	m: number,
	counts = true,
) {
	await seedRide(athleteId, {
		id: nextId++,
		start_date: `${date}T07:00:00Z`,
		start_date_local: `${date}T09:00:00Z`,
		distance_m: km * 1000,
		result: { counts, elevationDm: m * 10, distanceRynke: Math.floor(km / 10) },
	});
}

function sectionOf(page: string, open: string, close: string): string {
	const start = page.indexOf(open);
	if (start < 0) return "";
	return page.slice(start, page.indexOf(close, start) + close.length);
}

const mainOf = (page: string) =>
	page.match(/<main[^>]*>[\s\S]*<\/main>/)?.[0] ?? "";
const leaderboardOf = (page: string) =>
	sectionOf(page, '<section class="leaderboard', "</section>");
const myPlaceOf = (page: string) =>
	sectionOf(page, '<section class="my-place', "</section>");
const navOf = (page: string, name: string) =>
	sectionOf(page, `<nav class="list-scope ${name}"`, "</nav>");

function linksOf(page: string, name: string) {
	return [...navOf(page, name).matchAll(/<a [^>]*href="([^"]*)"([^>]*)>/g)].map(
		(m) => ({
			href: m[1]?.replaceAll("&amp;", "&"),
			current: (m[2] ?? "").includes('aria-current="true"'),
		}),
	);
}

/** Each row's place, "you", and its main figure. */
function rowsOf(page: string) {
	return [
		...leaderboardOf(page).matchAll(
			/<li class="row( you)?">[\s\S]*?<span class="row-place">([^<]*)<\/span>[\s\S]*?<span class="row-total">([^<]*)<\/span>[\s\S]*?<\/li>/g,
		),
	].map((m) => ({ you: m[1] !== undefined, place: m[2], total: m[3] }));
}

const page = async (path: string, viewer = VIEWER.id, on = ctx) =>
	(await riderPage(on, viewer, path)).html;

beforeEach(async () => {
	await resetDb();
	nextId = 1;
	for (const rider of ALL) {
		await seedRider(ctx, {
			athleteId: rider.id,
			firstName: rider.name,
			organiser: rider === ORGANISER,
			consentVersion:
				rider === ON_TWO ? 2 : rider === UNCONSENTED ? null : undefined,
		});
		await seedBalance(rider.id, { trainingRynke: 100, teamRynke: 10 });
	}
	// Season: R1 3 rides 98.8 km 920 m; R2 2 rides 110 km 1300 m; the viewer
	// 2 rides 40 km 400 m; the organiser none.
	await ride(R1.id, "2026-10-06", 42.7, 380);
	await ride(R1.id, "2026-10-05", 6.1, 40);
	await ride(R1.id, "2026-09-10", 50, 500);
	await ride(R2.id, "2026-10-01", 30, 100);
	await ride(R2.id, "2026-09-20", 80, 1200);
	await ride(VIEWER.id, "2026-10-06", 20, 200);
	await ride(VIEWER.id, "2026-05-01", 20, 200);
	// Doesn't count (US1 scenario 4).
	await ride(VIEWER.id, "2026-10-06", 99, 900, false);
	await ride(ON_TWO.id, "2026-10-06", 100, 1000);
	await ride(UNCONSENTED.id, "2026-10-06", 100, 1000);
});

describe("GET /team with Rynke picked (SC-003)", () => {
	it("is today's page plus Rank by, with Rynke current and no period", async () => {
		const html = await page("/team");
		expect(linksOf(html, "rank-by")).toEqual([
			{ href: "/team", current: true },
			{ href: "/team?by=sessions", current: false },
			{ href: "/team?by=km", current: false },
			{ href: "/team?by=elevation", current: false },
		]);
		expect(navOf(html, "rank-by")).toContain("data-swap");
		expect(navOf(html, "rank-period")).toBe("");
		expect(html).not.toContain("ride-team-line");
		expect(leaderboardOf(html)).toContain(escapeHtml(de["team.list.hint"]));
	});
});

describe("GET /team by a ride figure (US1)", () => {
	it("ranks by km over the season", async () => {
		const html = await page("/team?by=km");
		expect(rowsOf(html)).toEqual([
			{ you: false, place: "🥇", total: "110,0 km" },
			{ you: false, place: "🥈", total: "98,8 km" },
			{ you: true, place: "🥉", total: "40,0 km" },
			{ you: false, place: "4", total: "0,0 km" },
		]);
		const place = myPlaceOf(html);
		expect(place).toContain(
			escapeHtml(
				de["team.place"].replace("{place}", "3").replace("{count}", "4"),
			),
		);
		expect(place).toContain(
			escapeHtml(de["team.ride.place.next"].replace("{n}", "58,9 km")),
		);
		// The typical ride of the viewer's season: 20 and 20 km.
		expect(place).toContain(
			escapeHtml(de["team.ride.typical"].replace("{n}", "20,0 km")),
		);
		expect(place).toContain(escapeHtml(de["team.ride.typical.hint"]));
	});

	it("ranks by sessions, sharing a place on equal counts (US1 scenario 7)", async () => {
		const html = await page("/team?by=sessions");
		expect(rowsOf(html)).toEqual([
			{ you: false, place: "🥇", total: "3 Fahrten" },
			{ you: false, place: "🥈", total: "2 Fahrten" },
			{ you: true, place: "🥈", total: "2 Fahrten" },
			{ you: false, place: "4", total: "0 Fahrten" },
		]);
	});

	it("ranks by elevation", async () => {
		const html = await page("/team?by=elevation");
		expect(rowsOf(html).map((r) => r.total)).toEqual([
			"1.300 Hm",
			"920 Hm",
			"400 Hm",
			"0 Hm",
		]);
	});

	it("counts only rides of the week or month (US1 scenario 6)", async () => {
		const week = await page("/team?by=km&period=week");
		expect(rowsOf(week).map((r) => r.total)).toEqual([
			"48,8 km",
			"20,0 km",
			"0,0 km",
			"0,0 km",
		]);
		expect(rowsOf(week)[1]?.you).toBe(true);
		const month = await page("/team?by=km&period=month");
		expect(rowsOf(month).map((r) => r.total)).toEqual([
			"48,8 km",
			"30,0 km",
			"20,0 km",
			"0,0 km",
		]);
	});

	it("shows the other two figures small, and a bar against the leader", async () => {
		const html = await page("/team?by=km");
		const own =
			leaderboardOf(html).match(/<li class="row you">[\s\S]*?<\/li>/)?.[0] ??
			"";
		expect(own).toContain('<span class="row-other">2 Fahrten · 400 Hm</span>');
		expect(own).toMatch(
			/<span class="ride-bar" role="img" aria-label="[^"]+">/,
		);
		expect(own).toContain('style="width:36.4%"');
		expect(own).not.toContain("sparkline");
		expect(own).not.toContain(de["team.ride.typical"].split(":")[0] ?? "");
	});

	it("keeps the period links and the other parameters, leaving defaults out", async () => {
		const html = await page("/team?by=km&period=week&all=1");
		expect(linksOf(html, "rank-by")).toEqual([
			{ href: "/team?all=1", current: false },
			{ href: "/team?by=sessions&period=week&all=1", current: false },
			{ href: "/team?by=km&period=week&all=1", current: true },
			{ href: "/team?by=elevation&period=week&all=1", current: false },
		]);
		expect(linksOf(html, "rank-period")).toEqual([
			{ href: "/team?by=km&all=1", current: false },
			{ href: "/team?by=km&period=month&all=1", current: false },
			{ href: "/team?by=km&period=week&all=1", current: true },
		]);
	});

	it("falls back to the default for unknown values", async () => {
		const html = await page("/team?by=watts&period=year");
		expect(linksOf(html, "rank-by")[0]).toEqual({
			href: "/team",
			current: true,
		});
		const km = await page("/team?by=km&period=year");
		expect(linksOf(km, "rank-period")[0]).toEqual({
			href: "/team?by=km",
			current: true,
		});
	});

	it("ignores by on the Team Rynke view", async () => {
		const html = await page("/team?kind=team&by=km");
		expect(navOf(html, "rank-by")).toBe("");
		expect(html).not.toContain("ride-bar");
	});

	it("keeps the peloton and the team chart of Rynke", async () => {
		const html = await page("/team?by=km");
		expect(html).toContain('<figure class="peloton card"');
		expect(html).toContain('<figure class="team-chart card"');
	});

	it("names nobody and carries no other rider's ID, as a rider and an organiser (FR-019, SC-005)", async () => {
		for (const viewer of [VIEWER.id, ORGANISER.id]) {
			for (const path of [
				"/team?by=km",
				"/team?by=sessions&period=week",
				"/team?by=elevation&all=1",
			]) {
				const main = mainOf(await page(path, viewer));
				for (const rider of ALL) {
					expect(main, path).not.toContain(rider.name);
					expect(main, path).not.toContain(String(rider.id));
				}
				expect(main).not.toContain("strava.com/athletes");
			}
		}
	});

	it("ranks the organiser like any rider (US2 scenario 4)", async () => {
		const html = await page("/team?by=km", ORGANISER.id);
		expect(rowsOf(html).find((r) => r.you)?.place).toBe("4");
	});

	it("reads stored rides the same as added-up ones", async () => {
		const added = await page("/team?by=km&period=week");
		for (const rider of [R1, R2, VIEWER, ORGANISER]) {
			const { results } = await env.DB.prepare(
				"SELECT * FROM activities WHERE athlete_id = ?",
			)
				.bind(rider.id)
				.all();
			await evaluateChange(ctx, rider.id, {
				kind: "upsert",
				records: results.map((row) =>
					activityRecord(row.strava_activity_id as number, {
						...(row as object),
					}),
				),
			});
		}
		const stored = await page("/team?by=km&period=week");
		expect(rowsOf(stored).length).toBe(rowsOf(added).length);
	});
});

describe("the team's figures (US3)", () => {
	it("sums the ranked riders' rides, with the median of all of them", async () => {
		const html = await page("/team?by=km&period=week");
		// Week: 42.7, 6.1 and 20 km; 380, 40 and 200 m.
		expect(html).toContain(
			`<p class="ride-team-line">${escapeHtml(
				de["team.ride.teamLine"]
					.replace("{period}", "Woche")
					.replace("{km}", "68,8 km")
					.replace("{sessions}", "3 Fahrten")
					.replace("{elevation}", "620 Hm")
					.replace("{typical}", "20,0 km"),
			)}</p>`,
		);
	});

	it("leaves a rider below version 3 out of every row, total and count (SC-004)", async () => {
		const html = await page("/team?by=km");
		expect(leaderboardOf(html)).toContain(
			escapeHtml(de["team.list.count"].replace("{n}", "4")),
		);
		// 100 km of the rider on version 2 would make the season 348.8 km.
		expect(html).toContain("248,8 km");
		expect(html).not.toContain("348,8");
		expect(html).not.toContain("100,0 km");
	});

	it("says nobody has ridden yet in an empty period", async () => {
		await env.DB.prepare(
			"DELETE FROM activities WHERE start_date_local >= '2026-10-05'",
		).run();
		const html = await page("/team?by=sessions&period=week");
		expect(html).toContain(
			`<p class="ride-team-line">${escapeHtml(de["team.ride.nobodyYet"])}</p>`,
		);
		expect(myPlaceOf(html)).not.toContain(
			escapeHtml(de["team.ride.typical.hint"]),
		);
	});
});

describe("GET /team with RIDE_FIGURES off (US4 scenario 1)", () => {
	const off = { ...ctx, env: { ...ctx.env, RIDE_FIGURES: "off" } };

	it("shows no Rank by and ignores by and period", async () => {
		const plain = await page("/team", VIEWER.id, off);
		const asked = await page("/team?by=km&period=week", VIEWER.id, off);
		for (const html of [plain, asked]) {
			expect(html).not.toContain("rank-by");
			expect(html).not.toContain("rank-period");
			expect(html).not.toContain("ride-");
		}
		expect(leaderboardOf(asked)).toBe(leaderboardOf(plain));
		expect(myPlaceOf(asked)).toBe(myPlaceOf(plain));
	});
});
