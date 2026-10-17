import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { quoteId } from "../../src/http/sections/team";
import { CATALOGS } from "../../src/i18n/catalogs";
import {
	QUOTES_ON_TRACK,
	QUOTES_PUSH,
	SEASON_QUOTES_ON_TRACK,
	SEASON_QUOTES_PUSH,
} from "../../src/i18n/messages/quotes.de";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { riderPage, seedBalance, seedRide } from "../support/rider-view";

// Where the rider stands at `/team` and how the team is doing (016 US1, US2,
// FR-010–FR-017, FR-041, SC-002, SC-003, contracts/pages.md,
// contracts/http-routes.md), and the quote that fits the viewer (US3,
// FR-020–FR-025). Synthetic riders only.

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
const teamChartOf = (page: string) =>
	sectionOf(page, '<figure class="team-chart', "</figure>");
const quoteOf = (page: string) =>
	sectionOf(page, '<blockquote class="quote', "</blockquote>");
const leaderboardOf = (page: string) =>
	sectionOf(page, '<section class="leaderboard', "</section>");

/** The shown rows' `li` markup, in order. */
function rowItemsOf(page: string): string[] {
	return (
		leaderboardOf(page).match(/<li class="row[^"]*">[\s\S]*?<\/li>/g) ?? []
	);
}

/** A row's total, after its mini coin. */
function totalOf(row: string): string | undefined {
	return row.match(
		/<span class="row-total">(?:<svg[\s\S]*?<\/svg>)?(?:<span class="visually-hidden">[^<]*<\/span>)?\s*([^<]*)<\/span>/,
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
	it("shows no place card; the viewer's row carries the place (019 FR-045)", async () => {
		const { status, html } = await riderPage(ctx, VIEWER, "/team");
		expect(status).toBe(200);
		expect(html).not.toContain("my-place");
		expect(rowsOf(html).find((r) => r.you)).toEqual({ you: true, place: "6" });
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
		// The coin says which kind; its name is for screen readers only.
		expect(own).toMatch(
			new RegExp(
				`<span class="row-other"><svg class="coin coin-mini coin-team"[^>]*>.*?</svg><span class="visually-hidden">${de["rynke.team"]}</span> 25</span>`,
			),
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

	it("reorders by Team (US1 #4)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?kind=team");
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
		expect(rowsOf(html).find((r) => r.you)).toEqual({ you: true, place: "6" });
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

	it("marks the switch and toggle links to keep the scroll position (#113)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		for (const name of ["kind-switch", "list-scope"]) {
			const nav = sectionOf(html, `<nav class="${name}"`, "</nav>");
			const links = [...nav.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
			expect(links.length).toBeGreaterThan(0);
			for (const link of links) expect(link).toContain(" data-keep-scroll");
		}
	});
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
		expect(total).toContain('src="/coin/rynke-coin-front.svg"');
		expect(total).toContain('<p class="team-total-value">');
		expect(total).toContain(escapeHtml(de["team.total.label"]));
		expect(total).toContain(
			escapeHtml(de["team.total.training"]).replace(
				"{n}",
				'<span class="rynke-amount">1.790</span>',
			),
		);
		expect(total).toContain(escapeHtml(de["team.total.kind"]));
		expect(total).toContain(fill(de["team.total.thisWeek"], { n: "1.775" }));
	});

	it("gives the Team team total with the coin's back", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team?kind=team", "en");
		const total = teamTotalOf(html);
		expect(total).toContain('src="/coin/rynke-coin-back.svg"');
		// In the Teamrynke blue, as on the personal page.
		expect(total).toContain('<p class="team-total-value hero-team">');
		expect(total).toContain(
			escapeHtml(en["team.total.team"]).replace(
				"{n}",
				'<span class="rynke-amount">199</span>',
			),
		);
		expect(total).toContain(escapeHtml(en["team.total.kind"]));
		expect(total).toContain(fill(en["team.total.thisWeek"], { n: 199 }));
	});

	it("draws no peloton (019 FR-045)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		expect(html).not.toContain("peloton");
	});

	it("draws one bar per week and names the best week", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const chart = teamChartOf(html);
		expect(chart.match(/<rect /g)).toHaveLength(41);
		expect(chart.match(/<rect [^>]*class="current"/g)).toHaveLength(1);
		expect(chart).toContain(
			`aria-label="${fill(de["team.chart.label"], { kind: de["rynke.training"], weeks: 41, total: "1.790" })}"`,
		);
		expect(chart).toContain(
			fill(de["team.chart.best"], { date: "06.10.2026", n: "1.775" }),
		);
		expect(chart).toContain(escapeHtml(de["team.chart.hint"]));
		expect(chart).toContain(
			`<span class="team-chart-kind"><svg class="coin coin-mini"`,
		);
		expect(chart).toContain(
			`<p class="chart-axis"><span>04.01.2026</span><span>${escapeHtml(de["team.chart.now"])}</span></p>`,
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

	it("orders the sections as 019 FR-046 does", async () => {
		const { html } = await riderPage(ctx, ORGANISER, "/team");
		const at = (marker: string) => html.indexOf(marker, html.indexOf("<main"));
		const order = [
			'<section class="team-total',
			'<nav class="kind-switch"',
			'<blockquote class="quote',
			'<section class="leaderboard',
			'<figure class="team-chart',
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
		expect(total).toContain(
			escapeHtml(de["team.total.training"]).replace(
				"{n}",
				'<span class="rynke-amount">0</span>',
			),
		);
		expect(total).not.toContain("🔥");
		expect(teamChartOf(html)).not.toContain(
			escapeHtml(de["team.chart.best"].split("{n}")[0] ?? ""),
		);
	});
});

describe("GET /team, a quote for the viewer (US3)", () => {
	// makeCtx's day, 6 October, is in autumn (FR-025).
	const PUSH = [...QUOTES_PUSH, ...SEASON_QUOTES_PUSH.autumn];
	const ON_TRACK = [...QUOTES_ON_TRACK, ...SEASON_QUOTES_ON_TRACK.autumn];

	/** The quote's text, unescaped back to the list's string. */
	function quoteTextOf(page: string): string | undefined {
		const text = quoteOf(page).match(/<p>([^<]*)<\/p>/)?.[1];
		return [...PUSH, ...ON_TRACK].find((quote) => escapeHtml(quote) === text);
	}

	it("gives a viewer who doesn't qualify a push quote in German (US3 #1)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const quote = quoteOf(html);
		expect(quote).toMatch(/^<blockquote class="quote quote-push" lang="de">/);
		expect(quote).toContain(escapeHtml(de["team.quote.push"]));
		expect(PUSH).toContain(quoteTextOf(html));
	});

	it("gives a viewer who qualifies an on-track quote (US3 #2)", async () => {
		await seedBalance(VIEWER, {
			trainingRynke: 120,
			teamRynke: 25,
			qualified: true,
		});
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const quote = quoteOf(html);
		expect(quote).toMatch(
			/^<blockquote class="quote quote-on-track" lang="de">/,
		);
		expect(quote).toContain(escapeHtml(de["team.quote.onTrack"]));
		expect(ON_TRACK).toContain(quoteTextOf(html));
	});

	it("keeps the quote German in English, under an English heading (US3 #4)", async () => {
		const { html } = await riderPage(ctx, VIEWER, "/team", "en");
		const quote = quoteOf(html);
		expect(quote).toMatch(/^<blockquote class="quote quote-push" lang="de">/);
		expect(quote).toContain(escapeHtml(en["team.quote.push"]));
		expect(PUSH).toContain(quoteTextOf(html));
	});

	it("picks the quote at random on each load (US3 #3)", async () => {
		const random = vi.spyOn(crypto, "getRandomValues");
		const pick = async (value: number) => {
			random.mockImplementationOnce((array) => {
				if (array instanceof Uint32Array) array[0] = value;
				return array;
			});
			return quoteTextOf((await riderPage(ctx, VIEWER, "/team")).html);
		};
		try {
			expect(await pick(0)).toBe(QUOTES_PUSH[0]);
			// The first quote is seen now, so the same value gives the next
			// (issue #96), and a larger one wraps around the rest.
			expect(await pick(0)).toBe(QUOTES_PUSH[1]);
			expect(await pick(PUSH.length - 2 + 1)).toBe(QUOTES_PUSH[3]);
			// In autumn, the autumn quotes follow the list's (FR-025); three are
			// seen.
			expect(await pick(QUOTES_PUSH.length - 3)).toBe(
				SEASON_QUOTES_PUSH.autumn[0],
			);
		} finally {
			random.mockRestore();
		}
	});
});

describe("GET /team, quotes the viewer has seen (issue #96)", () => {
	// The viewer doesn't qualify and it's autumn: the push list and its autumn
	// quotes.
	const PUSH = [...QUOTES_PUSH, ...SEASON_QUOTES_PUSH.autumn];

	async function shownQuote(): Promise<string | undefined> {
		const { html } = await riderPage(ctx, VIEWER, "/team");
		const text = quoteOf(html).match(/<p>([^<]*)<\/p>/)?.[1];
		return PUSH.find((quote) => escapeHtml(quote) === text);
	}

	async function seenIds(): Promise<string[]> {
		const { results } = await env.DB.prepare(
			"SELECT quote_id FROM quote_seen WHERE athlete_id = ? ORDER BY quote_id",
		)
			.bind(VIEWER)
			.all<{ quote_id: string }>();
		return results.map((row) => row.quote_id);
	}

	async function markSeen(quotes: readonly string[]): Promise<void> {
		await env.DB.prepare(
			`INSERT INTO quote_seen (athlete_id, quote_id)
			SELECT ?1, value FROM json_each(?2)`,
		)
			.bind(VIEWER, JSON.stringify(quotes.map(quoteId)))
			.run();
	}

	it("marks the shown quote as seen", async () => {
		const quote = await shownQuote();
		expect(quote).toBeDefined();
		expect(await seenIds()).toEqual([quoteId(quote ?? "")]);
	});

	it("shows only quotes the viewer hasn't seen", async () => {
		const unseen = [QUOTES_PUSH[3] ?? "", SEASON_QUOTES_PUSH.autumn[0] ?? ""];
		await markSeen(PUSH.filter((quote) => !unseen.includes(quote)));

		const first = await shownQuote();
		const second = await shownQuote();

		expect([first, second].sort()).toEqual([...unseen].sort());
	});

	it("starts over after the last unseen quote, without showing it again next", async () => {
		const last = QUOTES_PUSH[10] ?? "";
		await markSeen(PUSH.filter((quote) => quote !== last));

		expect(await shownQuote()).toBe(last);
		expect(await seenIds()).toEqual([quoteId(last)]);

		const next = await shownQuote();
		expect(next).toBeDefined();
		expect(next).not.toBe(last);
		expect(await seenIds()).toHaveLength(2);
	});

	it("keeps the other list's seen quotes when it starts over", async () => {
		const last = QUOTES_PUSH[10] ?? "";
		const onTrack = QUOTES_ON_TRACK[0] ?? "";
		await markSeen([...PUSH.filter((quote) => quote !== last), onTrack]);

		expect(await shownQuote()).toBe(last);

		expect(await seenIds()).toEqual([quoteId(last), quoteId(onTrack)].sort());
	});

	it("marks nothing on a HEAD", async () => {
		const res = await handleFetch(
			request("/team", {
				method: "HEAD",
				cookies: await sessionCookie(ctx, VIEWER),
			}),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(await seenIds()).toEqual([]);
	});
});

describe("GET /team for others", () => {
	it("puts 1st place first in Training", async () => {
		const { html } = await riderPage(ctx, FIRST, "/team");
		expect(rowsOf(html)[0]).toEqual({ you: true, place: "🥇" });
	});

	it("ranks an organiser like everyone else", async () => {
		const { html } = await riderPage(ctx, ORGANISER, "/team");
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
		"%s writes nothing but the seen quote and calls out to nobody",
		async (path) => {
			const db = env.DB;
			const readOnly = new Proxy(db, {
				get(target, name, receiver) {
					if (name === "prepare") {
						return (query: string) => {
							const statement = query.trimStart().toUpperCase();
							// The shown quote is marked as seen (issue #96).
							const seenQuote = /^(INSERT INTO|DELETE FROM) QUOTE_SEEN\b/.test(
								statement,
							);
							if (!statement.startsWith("SELECT") && !seenQuote) {
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
