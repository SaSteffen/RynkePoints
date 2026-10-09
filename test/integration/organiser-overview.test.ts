import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { makeCtx, request, resetDb, seedRider } from "../support/ctx";
import { riderPage, seedBalance } from "../support/rider-view";

// The organiser overview at `/organiser/riders` (016 US4, FR-031–FR-035,
// contracts/pages.md, contracts/http-routes.md). The test clock is 6 October
// 2026, the deadline 30 June 2027: 267 days to go. Synthetic riders only.

const ctx = makeCtx();
const { de } = CATALOGS;

const ORGANISER = { id: 920_001, name: "Olga" };
const QUALIFIED = { id: 920_002, name: "Paula" };
const JONAS_ON_TRACK = { id: 920_003, name: "Jonas" };
const JONAS_BEHIND = { id: 920_004, name: "Jonas" };
const UNCONSENTED = { id: 920_005, name: "Ermentrude" };
const NOT_ORGANISER = QUALIFIED;

/** A catalog text with its placeholders filled in, escaped like the page. */
function fill(text: string, params: Record<string, string | number> = {}) {
	return escapeHtml(
		text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name])),
	);
}

function sectionOf(page: string, open: string, close: string): string {
	const start = page.indexOf(open);
	if (start < 0) return "";
	return page.slice(start, page.indexOf(close, start) + close.length);
}

const cardsOf = (page: string) =>
	page.match(/<li class="rider-card [^"]*">[\s\S]*?<\/details>\s*<\/li>/g) ??
	[];
const tableOf = (page: string) =>
	sectionOf(page, '<table class="rider-table">', "</table>");
const cardOf = (page: string, id: number) =>
	cardsOf(page).find((card) => card.includes(`/organiser/riders/${id}"`)) ?? "";
const rowOf = (page: string, id: number) =>
	tableOf(page)
		.match(/<tr class="status-[\s\S]*?<\/tr>/g)
		?.find((row) => row.includes(`/organiser/riders/${id}"`)) ?? "";

async function overview(path = "/organiser/riders") {
	return riderPage(ctx, ORGANISER.id, path);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, {
		athleteId: ORGANISER.id,
		firstName: ORGANISER.name,
		organiser: true,
	});
	for (const { id, name } of [QUALIFIED, JONAS_ON_TRACK, JONAS_BEHIND]) {
		await seedRider(ctx, { athleteId: id, firstName: name });
	}
	await seedRider(ctx, {
		athleteId: UNCONSENTED.id,
		firstName: UNCONSENTED.name,
		consentVersion: null,
	});
	await seedBalance(QUALIFIED.id, {
		distanceRynke: 260,
		elevationRynke: 30,
		trainingRynke: 300,
		trainingMissing: 0,
		teamRynke: 30,
		teamMissing: 0,
		trainingWithoutVirtual: 250,
		virtualShareMissing: 0,
		qualified: true,
	});
	await seedBalance(JONAS_ON_TRACK.id, {
		distanceRynke: 200,
		trainingRynke: 200,
		trainingMissing: 50,
		teamRynke: 20,
		teamMissing: 5,
		trainingWithoutVirtual: 150,
		virtualShareMissing: 17,
	});
	await seedBalance(JONAS_BEHIND.id, {
		distanceRynke: 41,
		elevationRynke: 5,
		trainingRynke: 50,
		trainingMissing: 200,
		teamRynke: 5,
		teamMissing: 20,
		trainingWithoutVirtual: 40,
		virtualShareMissing: 127,
	});
	await seedBalance(UNCONSENTED.id, { trainingRynke: 999, teamRynke: 99 });
});

describe("GET /organiser/riders, who may see it (US4 #4)", () => {
	it("sends a visitor to the start page", async () => {
		const res = await handleFetch(request("/organiser/riders"), ctx);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it("refuses a rider who isn't an organiser", async () => {
		const { status, html } = await riderPage(
			ctx,
			NOT_ORGANISER.id,
			"/organiser/riders",
		);
		expect(status).toBe(403);
		expect(html).not.toContain('<li class="rider-card');
	});

	it("shows it to an organiser", async () => {
		expect((await overview()).status).toBe(200);
	});
});

describe("GET /organiser/riders, the overview", () => {
	it("shows the deadline, the days to go and who qualifies (FR-031)", async () => {
		const { html } = await overview();
		expect(html).toContain(
			fill(de["organiser.overview.deadline"], { date: "30.06.2027" }),
		);
		expect(html).toContain(fill(de["organiser.overview.daysLeft"], { n: 267 }));
		expect(html).toContain(
			fill(de["organiser.overview.qualified"], { n: 1, count: 4 }),
		);
	});

	it("has the four tiles with their counts (FR-032)", async () => {
		const { html } = await overview();
		const tiles = [
			...sectionOf(html, '<nav class="group-tiles', "</nav>").matchAll(
				/href="([^"]*)"[^>]*><span class="tile-count">(\d+)<\/span><span class="tile-label">([^<]*)</g,
			),
		].map((m) => [m[1], m[2], m[3]]);
		expect(tiles).toEqual([
			[
				"/organiser/riders?group=push",
				"2",
				escapeHtml(de["organiser.overview.group.push"]),
			],
			[
				"/organiser/riders?group=on_track",
				"1",
				escapeHtml(de["organiser.overview.group.onTrack"]),
			],
			[
				"/organiser/riders?group=in",
				"1",
				escapeHtml(de["organiser.overview.group.in"]),
			],
			[
				"/organiser/riders?group=all",
				"4",
				escapeHtml(de["organiser.overview.group.all"]),
			],
		]);
	});

	it("renders only the picked group and marks its tile", async () => {
		const qualified = (await overview("/organiser/riders?group=in")).html;
		expect(cardsOf(qualified)).toHaveLength(1);
		expect(cardOf(qualified, QUALIFIED.id)).not.toBe("");
		expect(qualified).toContain(
			'href="/organiser/riders?group=in" aria-current="true"',
		);
		const onTrack = (await overview("/organiser/riders?group=on_track")).html;
		expect(cardsOf(onTrack)).toHaveLength(1);
		expect(cardOf(onTrack, JONAS_ON_TRACK.id)).not.toBe("");
		expect(tableOf(onTrack).match(/<tr class="status-/g)).toHaveLength(1);
	});

	it("links both Jonas to Strava and nobody else (US4 #3)", async () => {
		const { html } = await overview();
		for (const { id } of [JONAS_ON_TRACK, JONAS_BEHIND]) {
			expect(cardOf(html, id)).toContain(
				`href="https://www.strava.com/athletes/${id}"`,
			);
		}
		for (const { id } of [QUALIFIED, ORGANISER]) {
			expect(cardOf(html, id)).not.toContain("strava.com/athletes");
		}
		expect(html.match(/strava\.com\/athletes\//g)).toHaveLength(
			// Card and table row, for both.
			4,
		);
	});

	it("links each name to the rider's corrections", async () => {
		const { html } = await overview();
		for (const { id, name } of [ORGANISER, QUALIFIED, JONAS_BEHIND]) {
			expect(cardOf(html, id)).toContain(
				`<a href="/organiser/riders/${id}"><span class="rider-name">${name}</span></a>`,
			);
			expect(rowOf(html, id)).toContain(`href="/organiser/riders/${id}"`);
		}
	});

	it("shows the stored balance in the card and the table row (US4 #2, FR-033)", async () => {
		const { html } = await overview();
		const card = cardOf(html, JONAS_BEHIND.id);
		expect(card).toContain(
			fill(de["organiser.overview.training"], { n: 50, threshold: 250 }),
		);
		expect(card).toContain(
			fill(de["organiser.overview.team"], { n: 5, threshold: 25 }),
		);
		expect(card).toContain(
			fill(de["organiser.overview.outdoor"], { n: 40, required: 167 }),
		);
		expect(card).toContain(
			`${fill(de["organiser.overview.toGo.training"], { n: 200 })} · ${escapeHtml(de["organiser.overview.behind"])}`,
		);
		expect(card).toContain(fill(de["organiser.overview.distance"], { n: 41 }));
		expect(card).toContain(fill(de["organiser.overview.elevation"], { n: 5 }));
		expect(card).toContain(fill(de["organiser.overview.virtual"], { n: 20 }));
		const row = rowOf(html, JONAS_BEHIND.id);
		for (const figure of ["50", "5", "40", "41", "20 %"]) {
			expect(row).toContain(`>${figure}<`);
		}
		expect(row).toContain(escapeHtml(de["organiser.overview.group.push"]));
	});

	it("names the even pace for the bars (FR-033, FR-041)", async () => {
		const { html } = await overview();
		// ⌊250 × 278 ÷ 545⌋ and ⌊25 × 278 ÷ 545⌋ on 6 October 2026.
		expect(html).toContain(
			fill(de["organiser.overview.hint"], { training: 127, team: 12 }),
		);
	});

	it("lists who qualified (US4 #2, FR-034)", async () => {
		const { html } = await overview();
		const qualified = sectionOf(
			html,
			'<section class="qualified">',
			"</section>",
		);
		expect(qualified).toContain(QUALIFIED.name);
		expect(qualified).not.toContain("Jonas");
	});

	it("says nobody qualifies yet", async () => {
		await env.DB.prepare("DELETE FROM rynke_balances WHERE athlete_id = ?")
			.bind(QUALIFIED.id)
			.run();
		const { html } = await overview();
		expect(html).toContain(escapeHtml(de["organiser.overview.nobodyYet"]));
	});

	it("says when nobody is listed", async () => {
		await env.DB.prepare(
			"UPDATE riders SET status = 'needs_reconnect', reconnect_requested_at = 1",
		).run();
		const { html } = await overview();
		expect(html).toContain(escapeHtml(de["organiser.overview.none"]));
	});

	it("leaves out the rider without consent", async () => {
		const { html } = await overview();
		expect(html).not.toContain(UNCONSENTED.name);
		expect(html).not.toContain(`/organiser/riders/${UNCONSENTED.id}`);
		expect(html).not.toContain(">999<");
	});
});

describe("GET /organiser/riders only reads (FR-003)", () => {
	it.each(["/organiser/riders", "/organiser/riders?group=push"])(
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
			const { status } = await riderPage(readCtx, ORGANISER.id, path);
			expect(status).toBe(200);
			expect(fetchSpy).not.toHaveBeenCalled();
			fetchSpy.mockRestore();
		},
	);
});
