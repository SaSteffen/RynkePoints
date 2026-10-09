import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { makeCtx, request, resetDb, seedRider } from "../support/ctx";
import { riderPage, seedBalance, seedRide } from "../support/rider-view";

// Where the rider stands at `/team` and how the team is doing (016 US1, US2,
// FR-010–FR-017, FR-041, SC-002, SC-003, contracts/pages.md,
// contracts/http-routes.md). Synthetic riders only.

const ctx = makeCtx();
const { de, en } = CATALOGS;

/** Listed riders with a balance, by Training: the viewer is 6th of 14. */
const LISTED = [
	{ id: 910_001, name: "Ottilie", training: 300, team: 20 },
	{ id: 910_002, name: "Waltraud", training: 280, team: 19 },
	{ id: 910_003, name: "Kunigunde", training: 250, team: 18 },
	{ id: 910_004, name: "Hildegard", training: 200, team: 17 },
	{ id: 910_005, name: "Brunhilde", training: 150, team: 16 },
	{ id: 910_006, name: "Gertrude", training: 120, team: 25 },
	{ id: 910_007, name: "Adelheid", training: 100, team: 15 },
	{ id: 910_008, name: "Mechthild", training: 90, team: 14 },
	{ id: 910_009, name: "Irmgard", training: 80, team: 13 },
	{ id: 910_010, name: "Roswitha", training: 70, team: 12 },
	{ id: 910_011, name: "Walburga", training: 60, team: 11 },
	{ id: 910_012, name: "Edeltraud", training: 50, team: 10 },
	{ id: 910_013, name: "Hannelore", training: 40, team: 9 },
];
const VIEWER = 910_006;
const FIRST = 910_001;
const ORGANISER = 910_004;
const WITHOUT_BALANCE = { id: 910_014, name: "Rotraut" };
const UNCONSENTED = { id: 910_015, name: "Ermentrude" };

const OTHERS = [...LISTED, WITHOUT_BALANCE, UNCONSENTED].filter(
	(r) => r.id !== VIEWER,
);

/** A catalog text with its placeholders filled in, escaped like the page. */
function fill(text: string, params: Record<string, string | number> = {}) {
	return escapeHtml(
		text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name])),
	);
}

function mainOf(page: string): string {
	return page.match(/<main[^>]*>[\s\S]*<\/main>/)?.[0] ?? "";
}

function sectionOf(page: string, open: string, close: string): string {
	const start = page.indexOf(open);
	if (start < 0) return "";
	return page.slice(start, page.indexOf(close, start) + close.length);
}

const teamTotalOf = (page: string) =>
	sectionOf(page, '<section class="team-total', "</section>");
const pelotonOf = (page: string) =>
	sectionOf(page, '<figure class="peloton', "</figure>");
const teamChartOf = (page: string) =>
	sectionOf(page, '<figure class="team-chart', "</figure>");
const leaderboardOf = (page: string) =>
	sectionOf(page, '<section class="leaderboard">', "</section>");
const myPlaceOf = (page: string) =>
	sectionOf(page, '<section class="my-place', "</section>");

/** The shown rows' `li` markup, in order. */
function rowItemsOf(page: string): string[] {
	return (
		leaderboardOf(page).match(/<li class="row[^"]*">[\s\S]*?<\/li>/g) ?? []
	);
}

/** A row's total, after its mini coin. */
function totalOf(row: string): string | undefined {
	return row.match(
		/<span class="row-total">(?:<svg[\s\S]*?<\/svg>)?\s*([^<]*)<\/span>/,
	)?.[1];
}

/** Each shown row: its place text (medal or number) and whether it's "you". */
function rowsOf(page: string) {
	return [
		...leaderboardOf(page).matchAll(
			/<li class="row( you)?">[\s\S]*?<span class="row-place">([^<]*)<\/span>[\s\S]*?<\/li>/g,
		),
	].map((m) => ({ you: m[1] !== undefined, place: m[2] }));
}

/** The `href` and `aria-current` of each link in `nav.{name}`. */
function linksOf(page: string, name: string) {
	const nav = sectionOf(page, `<nav class="${name}"`, "</nav>");
	return [...nav.matchAll(/<a [^>]*href="([^"]*)"([^>]*)>/g)].map((m) => ({
		href: m[1],
		current: (m[2] ?? "").includes('aria-current="true"'),
	}));
}

beforeEach(async () => {
	await resetDb();
	for (const { id, name, training, team } of LISTED) {
		await seedRider(ctx, {
			athleteId: id,
			firstName: name,
			organiser: id === ORGANISER,
		});
		await seedBalance(id, { trainingRynke: training, teamRynke: team });
	}
	await seedRider(ctx, {
		athleteId: WITHOUT_BALANCE.id,
		firstName: WITHOUT_BALANCE.name,
	});
	await seedRider(ctx, {
		athleteId: UNCONSENTED.id,
		firstName: UNCONSENTED.name,
		consentVersion: null,
	});
	await seedBalance(UNCONSENTED.id, { trainingRynke: 999, teamRynke: 99 });
});

describe("GET /team, Training around the viewer", () => {
	it("gives the viewer's place and the gap to the next (US1 #1)", async () => {
		const { status, html } = await riderPage(ctx, VIEWER, "/team");
		expect(status).toBe(200);
		const place = myPlaceOf(html);
		expect(place).toContain(fill(de["team.place"], { place: "6.", count: 14 }));
		expect(place).toContain(fill(de["team.place.next"], { n: 31 }));
	});

	it("words the place in English with an ordinal", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team", "en");
		const place = myPlaceOf(html);
		expect(place).toContain(
			fill(en["team.place"], { place: "6th", count: 14 }),
		);
		expect(place).toContain(fill(en["team.place.next"], { n: 31 }));
	});

	it("lists places 3 to 9 with the viewer's own row (US1 #2)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const list = leaderboardOf(html);
		expect(list).toMatch(/<ol start="3">/);
		expect(rowsOf(html)).toEqual([
			{ you: false, place: "🥉" },
			{ you: false, place: "4" },
			{ you: false, place: "5" },
			{ you: true, place: "6" },
			{ you: false, place: "7" },
			{ you: false, place: "8" },
			{ you: false, place: "9" },
		]);
		expect(list).toContain(escapeHtml(de["team.list.you"]));
		expect(list).toContain(fill(de["team.list.ahead"], { n: 2 }));
		expect(list).toContain(fill(de["team.list.behind"], { n: 5 }));
	});

	it("says You in English", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team", "en");
		expect(leaderboardOf(html)).toContain(escapeHtml(en["team.list.you"]));
	});

	it("shows each row's total, the other kind and a labelled sparkline", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const own =
			rowItemsOf(html).find((li) => li.startsWith('<li class="row you">')) ??
			"";
		expect(totalOf(own)).toBe("120");
		expect(own).toContain(
			fill(de["team.list.other"], { n: 25, kind: de["team.kind.team"] }),
		);
		expect(own).toMatch(/<svg [^>]*role="img"/);
		expect(own).toMatch(/aria-label="Woche für Woche: [\d, ]*120"/);
	});
});

describe("GET /team with a kind or Everyone", () => {
	it("shows all 14 rows with medals on places 1–3 only (US1 #3)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?all=1");
		const rows = rowsOf(html);
		expect(rows).toHaveLength(14);
		expect(rows.map((r) => r.place)).toEqual([
			"🥇",
			"🥈",
			"🥉",
			...Array.from({ length: 11 }, (_, i) => String(i + 4)),
		]);
		expect(leaderboardOf(html)).toMatch(/<ol start="1">/);
		expect(leaderboardOf(html)).not.toContain(
			fill(de["team.list.ahead"], { n: 0 }),
		);
	});

	it("counts the rider without a balance with 0, in last place", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?all=1");
		const rows = rowItemsOf(html);
		expect(rows.at(-1)).toContain('<span class="row-place">14</span>');
		expect(totalOf(rows.at(-1) ?? "")).toBe("0");
	});

	it("reorders by Team and gives the leader the lead line (US1 #4)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?kind=team");
		const place = myPlaceOf(html);
		expect(place).toContain(fill(de["team.place"], { place: "1.", count: 14 }));
		expect(place).toContain(escapeHtml(de["team.place.lead"]));
		expect(place).not.toContain(
			escapeHtml(de["team.place.next"].split("{n}")[0] ?? ""),
		);
		expect(rowsOf(html)[0]).toEqual({ you: true, place: "🥇" });
	});

	it("combines the Team kind with Everyone", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?kind=team&all=1");
		const rows = rowsOf(html);
		expect(rows).toHaveLength(14);
		expect(rows[0]).toEqual({ you: true, place: "🥇" });
	});

	it("counts an unknown kind as Training", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?kind=bogus");
		expect(myPlaceOf(html)).toContain(
			fill(de["team.place"], { place: "6.", count: 14 }),
		);
	});

	it.each([
		[
			"/team",
			[
				{ href: "/team", current: true },
				{ href: "/team?kind=team", current: false },
			],
			[
				{ href: "/team", current: true },
				{ href: "/team?all=1", current: false },
			],
		],
		[
			"/team?kind=team&all=1",
			[
				{ href: "/team?all=1", current: false },
				{ href: "/team?kind=team&amp;all=1", current: true },
			],
			[
				{ href: "/team?kind=team", current: false },
				{ href: "/team?kind=team&amp;all=1", current: true },
			],
		],
	])(
		"links %s's switch and toggle, keeping the other parameter",
		async (path, kinds, scopes) => {
			const { html } = await riderPage(ctx, VIEWER, path);
			expect(linksOf(html, "kind-switch")).toEqual(kinds);
			expect(linksOf(html, "list-scope")).toEqual(scopes);
		},
	);
});

describe("GET /team, the team's progress (US2)", () => {
	// The test season starts on 2026-01-01 and today is Tuesday 2026-10-06:
	// 40 Sundays from 2026-01-04, then today, so 41 weeks. Rides add Training in
	// the weeks ending 2026-09-27 (10) and 2026-10-04 (5); the current week is
	// the stored balances (Training 1790, Team 199). The unconsented rider's ride
	// counts nowhere.
	beforeEach(async () => {
		const ride = (id: number, start: string, distanceRynke: number) => ({
			id,
			start_date: `${start}T08:00:00Z`,
			result: { counts: true, distanceRynke, elevationDm: 0 },
		});
		await seedRide(VIEWER, ride(8_400_001, "2026-09-22", 10));
		await seedRide(FIRST, ride(8_400_002, "2026-09-30", 5));
		await seedRide(UNCONSENTED.id, ride(8_400_003, "2026-09-30", 50));
	});

	it("gives the Training team total and this week's gain (US2 #1)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const total = teamTotalOf(html);
		expect(total).toContain('href="#coin-front"');
		expect(total).toContain(
			fill(de["team.total.label"], { kind: de["team.kind.training"] }),
		);
		expect(total).toContain(">1.790<");
		expect(total).toContain(fill(de["team.total.thisWeek"], { n: "1.775" }));
	});

	it("gives the Team team total with the coin's back", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?kind=team", "en");
		const total = teamTotalOf(html);
		expect(total).toContain('href="#coin-back"');
		expect(total).toContain(
			fill(en["team.total.label"], { kind: en["team.kind.team"] }),
		);
		expect(total).toContain(">199<");
		expect(total).toContain(fill(en["team.total.thisWeek"], { n: 199 }));
	});

	it("draws all 14 listed riders in the peloton, also around the viewer (US2 #2, #3)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const figure = pelotonOf(html);
		expect(figure.match(/href="#coin-mini"/g)).toHaveLength(14);
		expect(figure).toContain(
			`aria-label="${fill(de["team.peloton.label"], { count: 14, min: 0, max: 300, own: 120 })}"`,
		);
		expect(figure).toContain(escapeHtml(de["team.peloton.heading"]));
		expect(figure).toContain(`>${escapeHtml(de["team.peloton.you"])}<`);
	});

	it("draws one bar per week and names the best week", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const chart = teamChartOf(html);
		expect(chart.match(/<rect /g)).toHaveLength(41);
		expect(chart.match(/<rect [^>]*class="current"/g)).toHaveLength(1);
		expect(chart).toContain(
			`aria-label="${fill(de["team.chart.label"], { kind: de["team.kind.training"], weeks: 41, total: "1.790" })}"`,
		);
		expect(chart).toContain(
			fill(de["team.chart.best"], { date: "06.10.2026", n: "1.775" }),
		);
	});

	it("lists every week's total and gain in a details table (FR-041)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const details = sectionOf(teamChartOf(html), "<details", "</details>");
		expect(details).toContain(escapeHtml(de["team.chart.table"]));
		const rows = [
			...details.matchAll(
				/<tr><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g,
			),
		].map((m) => [m[1], m[2], m[3]]);
		expect(rows).toHaveLength(41);
		expect(rows[0]).toEqual(["04.01.2026", "0", ""]);
		expect(rows.slice(-3)).toEqual([
			["27.09.2026", "10", "10"],
			["04.10.2026", "15", "5"],
			["06.10.2026", "1.790", "1.775"],
		]);
	});

	it("follows the Team kind in the chart", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?kind=team");
		expect(teamChartOf(html)).toContain(
			fill(de["team.chart.best"], { date: "06.10.2026", n: 199 }),
		);
	});

	it("orders the sections as the contract does", async () => {
		const { html } = await riderPage(ctx, ORGANISER, "/team");
		const at = (marker: string) => html.indexOf(marker, html.indexOf("<main"));
		const order = [
			'<section class="team-total',
			'<nav class="kind-switch"',
			'<section class="my-place',
			'<figure class="peloton',
			'<section class="leaderboard"',
			'<figure class="team-chart',
			'<p class="organiser-entry"',
		].map(at);
		expect(order.every((i) => i > 0)).toBe(true);
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});
});

describe("GET /team without a gain this week", () => {
	it("shows no this-week badge and no best week", async () => {
		await resetDb();
		await seedRider(ctx, { athleteId: VIEWER, firstName: "Gertrude" });
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const total = teamTotalOf(html);
		expect(total).toContain(">0<");
		expect(total).not.toContain("🔥");
		expect(teamChartOf(html)).not.toContain(
			escapeHtml(de["team.chart.best"].split("{date}")[0] ?? ""),
		);
	});
});

describe("GET /team for others", () => {
	it("gives 1st place the lead line in Training", async () => {
		const { html } = await riderPage(ctx, FIRST, "/team");
		const place = myPlaceOf(html);
		expect(place).toContain(fill(de["team.place"], { place: "1.", count: 14 }));
		expect(place).toContain(escapeHtml(de["team.place.lead"]));
	});

	it("ranks an organiser like everyone else", async () => {
		const { html } = await riderPage(ctx, ORGANISER, "/team");
		expect(myPlaceOf(html)).toContain(
			fill(de["team.place"], { place: "4.", count: 14 }),
		);
		expect(rowsOf(html).find((r) => r.you)).toEqual({ you: true, place: "4" });
	});

	it("sends a visitor to the start page (FR-001)", async () => {
		const response = await handleFetch(request("/team"), ctx);
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/");
	});
});

describe("GET /team names nobody (SC-002, US1 #5, US2 #2)", () => {
	it.each(["/team", "/team?all=1", "/team?kind=team&all=1"])(
		"%s shows no other rider's name, ID or profile",
		async (path) => {
			const { html } = await riderPage(ctx, VIEWER, path);
			for (const other of OTHERS) {
				expect(html).not.toContain(other.name);
				expect(html).not.toContain(String(other.id));
			}
			expect(html).not.toContain("strava.com/athletes");
			// Nothing of the rider without consent: not their total.
			expect(mainOf(html)).not.toContain("999");
		},
	);
});

describe("GET /team only reads (FR-003, SC-003, research R11)", () => {
	it.each(["/team", "/team?kind=team&all=1"])(
		"%s writes nothing and calls out to nobody",
		async (path) => {
			const db = env.DB;
			const readOnly = new Proxy(db, {
				get(target, name, receiver) {
					if (name === "prepare") {
						return (query: string) => {
							if (!query.trimStart().toUpperCase().startsWith("SELECT")) {
								throw new Error(`Not a read: ${query}`);
							}
							return target.prepare(query);
						};
					}
					const value = Reflect.get(target, name, receiver);
					return typeof value === "function" ? value.bind(target) : value;
				},
			});
			const fetchSpy = vi.spyOn(globalThis, "fetch");
			const readCtx = { ...ctx, env: { ...ctx.env, DB: readOnly } };
			const { status } = await riderPage(readCtx, VIEWER, path);
			expect(status).toBe(200);
			expect(fetchSpy).not.toHaveBeenCalled();
		},
	);
});
