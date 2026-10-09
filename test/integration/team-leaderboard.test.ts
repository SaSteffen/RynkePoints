import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { makeCtx, request, resetDb, seedRider } from "../support/ctx";
import { riderPage, seedBalance } from "../support/rider-view";

// Where the rider stands at `/team` (016 US1, FR-010–FR-016, SC-002, SC-003,
// contracts/pages.md, contracts/http-routes.md). Synthetic riders only.

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
