import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRider } from "../../src/db/riders";
import { artUrl } from "../../src/http/art";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { evaluateChange } from "../../src/rynke/apply";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { countRows } from "../support/d1-rows";
import { riderPage, seedBalance } from "../support/rider-view";
import { activityRecord, insertEvent, reportRaw } from "../support/rynke";

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

/** The rows a group shows; the others are there for the search, `hidden`. */
const cardsOf = (page: string) =>
	(
		page.match(
			/<li class="rider-row [^"]*"[^>]*>[\s\S]*?<\/details>\s*<\/li>/g,
		) ?? []
	).filter((row) => !row.slice(0, row.indexOf(">")).endsWith(" hidden"));
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
		expect(html).not.toContain('<li class="rider-row');
	});

	it("shows it to an organiser under Orga, with the switch to the events", async () => {
		const { status, html } = await overview();
		expect(status).toBe(200);
		expect(html).toMatch(/<a href="\/organiser\/riders" aria-current="page">/);
		const switcher = sectionOf(html, '<nav class="organiser-switch"', "</nav>");
		expect(switcher).toContain(
			`<a class="segmented" href="/organiser/riders" aria-current="true">`,
		);
		expect(switcher).toContain(
			`${escapeHtml(de["organiser.switch.riders"])}</a>`,
		);
		expect(switcher).toContain(`<a class="segmented" href="/organiser">`);
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

	it("shows the coin's back as the team's artwork", async () => {
		const { html } = await overview();
		expect(html).toContain(
			`<section class="overview-deadline">\n<img class="coin-art coin coin-large" src="${artUrl("/coin/rynke-coin-back.svg")}" alt="" width="144" height="144"><div>`,
		);
	});

	it("has the five tiles with their counts (FR-032, 019 FR-034)", async () => {
		const { html } = await overview();
		const tiles = [
			...sectionOf(html, '<nav class="group-tiles', "</nav>").matchAll(
				/href="([^"]*)"[^>]*><span class="tile-count">(\d+)<\/span><span class="tile-label">([^<]*)</g,
			),
		].map((m) => [m[1], m[2], m[3]]);
		expect(tiles).toEqual([
			[
				"/organiser/riders?group=requests",
				"0",
				escapeHtml(de["organiser.overview.group.requests"]),
			],
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
			'href="/organiser/riders?group=in" data-swap aria-current="true"',
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
			// Row, table row and the graphs' list, for both.
			6,
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
		for (const figure of ["50", "5", "41", "20 %"]) {
			expect(row).toContain(`>${figure}<`);
		}
		// One Rynke column, Training above Team (019 follow-up).
		expect(row.indexOf('class="bar-block bar-training"')).toBeLessThan(
			row.indexOf('class="bar-block bar-team"'),
		);
		expect(row).toContain(escapeHtml(de["organiser.overview.group.push"]));
		expect(row).toContain(
			`<span class="to-go behind">${fill(de["organiser.overview.toGo.short"], { n: 200 })}<span class="visually-hidden"> · ${escapeHtml(de["organiser.overview.behind"])}</span></span>`,
		);
	});

	it("leaves the to-go figure out of the table row once an amount is met", async () => {
		const row = rowOf((await overview()).html, QUALIFIED.id);
		expect(row).not.toContain('class="to-go');
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

// Feature 019 FR-034: riders with open requests, one line per request.
describe("GET /organiser/riders with open requests", () => {
	beforeEach(async () => {
		const technique = await insertEvent("technique_training", "2026-09-26");
		const training = await insertEvent("team_training", "2026-09-19");
		const upcoming = await insertEvent("team_training", "2026-10-10");
		await reportRaw(technique, JONAS_BEHIND.id);
		await reportRaw(training, JONAS_BEHIND.id);
		await reportRaw(training, QUALIFIED.id);
		await reportRaw(upcoming, JONAS_ON_TRACK.id);
	});

	it("counts riders with open requests in an alert tile", async () => {
		const { html } = await overview();
		expect(html).toMatch(
			/<a class="group-tile tile-requests tile-alert" href="\/organiser\/riders\?group=requests" data-swap><span class="tile-count">2<\/span>/,
		);
	});

	it("shows only them under the requests tile", async () => {
		const { html } = await overview("/organiser/riders?group=requests");
		expect(cardsOf(html)).toHaveLength(2);
		expect(cardOf(html, JONAS_ON_TRACK.id)).toBe("");
		expect(tableOf(html).match(/<tr class="status-/g)).toHaveLength(2);
	});

	it("puts them first when everyone is shown", async () => {
		const { html } = await overview("/organiser/riders?group=all");
		const ids = [...tableOf(html).matchAll(/\/organiser\/riders\/(\d+)"/g)].map(
			(m) => Number(m[1]),
		);
		expect(ids.slice(0, 2).sort()).toEqual(
			[QUALIFIED.id, JONAS_BEHIND.id].sort(),
		);
	});

	it("gives each open request its own line and forms", async () => {
		const { html } = await overview("/organiser/riders?group=requests");
		const row = rowOf(html, JONAS_BEHIND.id);
		expect(row.match(/<li class="request">/g)).toHaveLength(2);
		expect(row.match(/name="decision" value="confirm"/g)).toHaveLength(2);
		expect(row.match(/name="decision" value="deny"/g)).toHaveLength(2);
		expect(row).toContain(
			'<input type="hidden" name="back" value="/organiser/riders?group=requests">',
		);
		expect(cardOf(html, JONAS_BEHIND.id)).toContain("rider-requests");
		expect(
			rowOf(html, QUALIFIED.id).match(/<li class="request">/g),
		).toHaveLength(1);
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

describe("GET /organiser/riders, the graphs (feature 029)", () => {
	const dataOf = (page: string) => {
		const opening =
			'<script type="application/json" id="organiser-graphs-data">';
		const json = sectionOf(page, opening, "</script>")
			.slice(opening.length)
			.replace("</script>", "");
		return JSON.parse(json) as {
			agreedCount: number;
			riders: { id: number; name: string; days: number[][] }[];
			notAgreed: { name: string }[];
			teamSum: { outdoorM: number[] };
		};
	};
	const ride = (id: number, athleteId: number, overrides = {}) =>
		activityRecord(id, {
			athlete_id: athleteId,
			name: "Morning loop Synthetic",
			start_date: "2026-05-02T07:30:00Z",
			start_date_local: "2026-05-02T09:30:00Z",
			...overrides,
		});
	const agree = (id: number, version: number) =>
		env.DB.prepare(
			"INSERT OR REPLACE INTO consent_records (athlete_id, version, accepted_at) VALUES (?, ?, 1)",
		)
			.bind(id, version)
			.run();
	/** A rider who hasn't been asked about daily figures yet. */
	const onlyVersion2 = async (id: number) => {
		await env.DB.prepare("DELETE FROM consent_records WHERE athlete_id = ?")
			.bind(id)
			.run();
		await agree(id, 2);
	};
	const withEnv = async <T>(
		settings: Partial<typeof ctx.env>,
		use: () => Promise<T>,
	): Promise<T> => {
		const before = ctx.env;
		ctx.env = { ...before, ...settings };
		try {
			return await use();
		} finally {
			ctx.env = before;
		}
	};

	it("gives the section an organiser, with who agreed and who hasn't", async () => {
		await evaluateChange(ctx, QUALIFIED.id, {
			kind: "upsert",
			records: [ride(7_000_001, QUALIFIED.id)],
		});
		await onlyVersion2(JONAS_BEHIND.id);
		const { html } = await overview();
		expect(html).toContain('<section id="organiser-graphs"');
		expect(html).toContain("/vendor/chart-4.6.1.umd.min.js");
		const data = dataOf(html);
		const paula = data.riders.find((r) => r.id === QUALIFIED.id);
		expect(paula?.days).toHaveLength(1);
		expect(paula?.days[0]?.[1]).toBe(40000);
		// In the table, in no line and no team value (SC-004).
		expect(rowOf(html, JONAS_BEHIND.id)).not.toBe("");
		expect(data.riders.map((r) => r.id)).not.toContain(JONAS_BEHIND.id);
		expect(data.notAgreed.map((r) => r.name)).toContain(JONAS_BEHIND.name);
		expect(data.agreedCount).toBe(data.riders.length);
	});

	it("keeps a not yet agreed rider's rides out of the team's sums, until they agree", async () => {
		await evaluateChange(ctx, JONAS_BEHIND.id, {
			kind: "upsert",
			records: [ride(7_000_002, JONAS_BEHIND.id)],
		});
		await onlyVersion2(JONAS_BEHIND.id);
		const sum = (page: string) =>
			dataOf(page).teamSum.outdoorM.reduce((a, b) => a + b, 0);
		expect(sum((await overview()).html)).toBe(0);
		await agree(JONAS_BEHIND.id, 3);
		const { html } = await overview();
		expect(sum(html)).toBe(40000);
		expect(dataOf(html).riders.map((r) => r.id)).toContain(JONAS_BEHIND.id);
	});

	it("removes a rider who leaves from every line", async () => {
		await evaluateChange(ctx, QUALIFIED.id, {
			kind: "upsert",
			records: [ride(7_000_003, QUALIFIED.id)],
		});
		await deleteRider(env.DB, QUALIFIED.id);
		const data = dataOf((await overview()).html);
		expect(data.riders.map((r) => r.id)).not.toContain(QUALIFIED.id);
		expect(data.teamSum.outdoorM.every((v) => v === 0)).toBe(true);
	});

	it("gives correct lines to a rider who agreed before their row was raised", async () => {
		await evaluateChange(ctx, QUALIFIED.id, {
			kind: "upsert",
			records: [
				ride(7_000_004, QUALIFIED.id),
				ride(7_000_005, QUALIFIED.id, {
					sport_type: "VirtualRide",
					start_date: "2026-05-02T15:00:00Z",
					start_date_local: "2026-05-02T17:00:00Z",
				}),
			],
		});
		const fromRow = dataOf((await overview()).html).riders.find(
			(r) => r.id === QUALIFIED.id,
		);
		await env.DB.prepare(
			"UPDATE rider_summaries SET version = 1, days = '[]', virtual_days = '[]', own_days = '[]'",
		).run();
		const addedUp = dataOf((await overview()).html).riders.find(
			(r) => r.id === QUALIFIED.id,
		);
		expect(addedUp?.days).toEqual(fromRow?.days);
		expect(addedUp?.days[0]?.[2]).toBe(40000);
	});

	it("names no ride, ride ID or start time anywhere (FR-003)", async () => {
		await evaluateChange(ctx, QUALIFIED.id, {
			kind: "upsert",
			records: [ride(7_000_006, QUALIFIED.id)],
		});
		const { html } = await overview();
		const section = sectionOf(
			html,
			'<section id="organiser-graphs"',
			"</section>",
		);
		expect(section).not.toBe("");
		expect(html).not.toContain("Morning loop Synthetic");
		expect(section).not.toContain("7000006");
		expect(section).not.toContain("09:30");
	});

	it.each([
		["the setting off", { ORGANISER_PROGRESS_GRAPH: "off" }],
		["percent figures", { ORGANISER_FIGURES: "percent" }],
	])(
		"has no section, data, script or read with %s (SC-007)",
		async (_, settings) => {
			await withEnv(settings, async () => {
				const { ctx: counted, counter } = countRows(ctx);
				const cookies = await sessionCookie(ctx, ORGANISER.id);
				counter.reset();
				const res = await handleFetch(
					request("/organiser/riders", { cookies }),
					counted,
				);
				const html = await res.text();
				expect(html).not.toContain("organiser-graphs");
				expect(html).not.toContain("chart-4.6.1");
				expect(html).not.toContain("data-view-pick");
				expect(counter.statements().join("\n")).not.toContain("virtual_days");
			});
		},
	);

	it("shows the section with nobody agreed, without an average", async () => {
		await env.DB.prepare(
			"UPDATE consent_records SET version = 2 WHERE athlete_id <> ?",
		)
			.bind(ORGANISER.id)
			.run();
		await env.DB.prepare(
			"UPDATE consent_records SET version = 3 WHERE athlete_id = ?",
		)
			.bind(ORGANISER.id)
			.run();
		const { html } = await overview();
		expect(dataOf(html).agreedCount).toBe(1);
		expect(html).toContain(escapeHtml(de["organiser.graphs.note.nobody"]));
	});

	it("doesn't give the section to a rider who isn't an organiser", async () => {
		const { status, html } = await riderPage(
			ctx,
			NOT_ORGANISER.id,
			"/organiser/riders",
		);
		expect(status).toBe(403);
		expect(html).not.toContain("organiser-graphs-data");
	});

	it("puts the table above the section and the qualified list below it (FR-018)", async () => {
		const { html } = await overview();
		const order = [
			'class="overview-deadline"',
			'class="group-tiles',
			'class="team-hint"',
			'class="rider-table"',
			'id="organiser-graphs"',
			'class="qualified"',
		].map((part) => html.indexOf(part));
		expect(order.every((at) => at >= 0)).toBe(true);
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});

	it("keeps that order without the graphs, and the phone's rows (FR-021)", async () => {
		await withEnv({ ORGANISER_PROGRESS_GRAPH: "off" }, async () => {
			const { html } = await overview();
			expect(html).toContain('class="rider-search"');
			expect(html).toContain('<ul class="rider-rows');
			expect(html).toContain('class="table-scroll"');
			expect(html).not.toContain("data-view=");
			expect(html.indexOf('class="rider-table"')).toBeLessThan(
				html.indexOf('class="qualified"'),
			);
		});
	});

	it("renders everyone's row, those outside the group hidden, by name", async () => {
		const { html } = await overview("/organiser/riders?group=in");
		expect(html).toContain(
			`<li class="rider-row status-in" data-name="${QUALIFIED.name.toLowerCase()}">`,
		);
		expect(html).toContain(
			`data-name="${ORGANISER.name.toLowerCase()}" hidden>`,
		);
	});

	it("opens rows from the start when at most five show", async () => {
		const few = (await overview("/organiser/riders?group=in")).html;
		expect(few).toMatch(/data-name="paula">\n<details open>/);
	});

	it("opens on the riders, honours view=graphs and ignores any other view", async () => {
		const plain = (await overview("/organiser/riders")).html;
		expect(plain).toContain('class="team-overview" data-view="riders"');
		const asked = (await overview("/organiser/riders?view=graphs")).html;
		expect(asked).toContain('class="team-overview" data-view="graphs"');
		const other = (await overview("/organiser/riders?view=x")).html;
		expect(other).toContain('class="team-overview" data-view="riders"');
	});

	it("shows open reports in a box of at most three, with the way to all", async () => {
		const eventIds = [];
		for (const date of [
			"2026-09-01",
			"2026-09-02",
			"2026-09-03",
			"2026-09-04",
		]) {
			const id = await insertEvent("team_training", date);
			eventIds.push(id);
			await reportRaw(id, QUALIFIED.id);
		}
		const { html } = await overview();
		const box = sectionOf(html, '<section class="requests-box"', "</section>");
		expect(box.match(/<li class="request">/g)).toHaveLength(3);
		expect(box).toContain(fill(de["organiser.graphs.reports"].other, { n: 4 }));
		expect(box).toContain(
			'href="/organiser/riders?group=requests&amp;view=riders"',
		);
		expect(box).toContain(
			fill(de["organiser.graphs.reports.showAll"], { n: 4 }),
		);
		expect(eventIds).toHaveLength(4);
	});
});

describe("GET /organiser/riders, sessions (ride stats ranking US2)", () => {
	const dataOf = (page: string) => {
		const opening =
			'<script type="application/json" id="organiser-graphs-data">';
		const json = sectionOf(page, opening, "</script>")
			.slice(opening.length)
			.replace("</script>", "");
		return JSON.parse(json) as {
			riders: { id: number; days: number[][] }[];
			teamSum: { sessions: number[] };
			sessions: boolean;
		};
	};
	const ride = (
		id: number,
		athleteId: number,
		day: string,
		km: number,
		hour = 7,
	) =>
		activityRecord(id, {
			athlete_id: athleteId,
			start_date: `${day}T${String(hour).padStart(2, "0")}:30:00Z`,
			start_date_local: `${day}T${String(hour + 2).padStart(2, "0")}:30:00Z`,
			distance_m: km * 1000,
			moving_time_s: Math.round(km * 150),
			elapsed_time_s: Math.round(km * 150),
		});
	const toVersion2 = (id: number) =>
		env.DB.prepare(
			"UPDATE consent_records SET version = 2 WHERE athlete_id = ?",
		)
			.bind(id)
			.run();

	beforeEach(async () => {
		// Paula: three rides, two on one day; the typical ride is 40 km.
		await evaluateChange(ctx, QUALIFIED.id, {
			kind: "upsert",
			records: [
				ride(7_100_001, QUALIFIED.id, "2026-05-02", 40),
				ride(7_100_002, QUALIFIED.id, "2026-05-02", 20, 15),
				ride(7_100_003, QUALIFIED.id, "2026-05-09", 60),
			],
		});
		// Jonas, behind, on version 2: in the table, in no figure.
		await evaluateChange(ctx, JONAS_BEHIND.id, {
			kind: "upsert",
			records: [ride(7_100_004, JONAS_BEHIND.id, "2026-05-02", 30)],
		});
		await toVersion2(JONAS_BEHIND.id);
	});

	it("has a Sessions column before Distance with the count and the typical ride", async () => {
		const { html } = await overview();
		const head = sectionOf(tableOf(html), "<thead>", "</thead>");
		expect(
			head.indexOf(escapeHtml(de["organiser.overview.column.sessions"])),
		).toBeLessThan(
			head.indexOf(escapeHtml(de["organiser.overview.column.distance"])),
		);
		expect(rowOf(html, QUALIFIED.id)).toContain(
			`<td class="number sessions-cell"><span>3</span><small class="typical">${fill(de["organiser.overview.typical"], { n: "40,0" })}</small></td>`,
		);
	});

	it("shows 0 and no typical ride without a ride, and – below version 3", async () => {
		const { html } = await overview();
		expect(rowOf(html, JONAS_ON_TRACK.id)).toContain(
			'<td class="number sessions-cell"><span>0</span></td>',
		);
		expect(rowOf(html, JONAS_BEHIND.id)).toContain('<td class="number">–</td>');
	});

	it("shows the count and typical ride on the one-line rows' cards, not folded away", async () => {
		const { html } = await overview("/organiser/riders?group=all");
		const card = cardOf(html, QUALIFIED.id);
		expect(card).toContain(
			`<p class="rider-sessions">${fill(de["organiser.overview.sessions.typical"], { n: 3, typical: "40,0" })}</p>`,
		);
		expect(
			sectionOf(card, '<details class="rider-breakdown">', "</details>"),
		).not.toContain("rider-sessions");
	});

	it("gives the graphs sessions per day, and the team's without a rider below version 3", async () => {
		const { html } = await overview();
		const data = dataOf(html);
		expect(data.sessions).toBe(true);
		const paula = data.riders.find((r) => r.id === QUALIFIED.id);
		expect(paula?.days.map((day) => day.length)).toEqual([5, 5]);
		expect(paula?.days.map((day) => day[4])).toEqual([2, 1]);
		expect(data.teamSum.sessions.reduce((a, b) => a + b, 0)).toBe(3);
		expect(html).toContain('data-tab="sessions"');
		expect(html).toContain('<figure class="org-graph" data-metric="sessions">');
	});

	it("has no column in the percent table", async () => {
		const before = ctx.env;
		ctx.env = { ...before, ORGANISER_FIGURES: "percent" };
		try {
			const { html } = await overview();
			expect(tableOf(html)).not.toContain(
				escapeHtml(de["organiser.overview.column.sessions"]),
			);
			expect(html).not.toContain("sessions-cell");
		} finally {
			ctx.env = before;
		}
	});

	it("shows and reads nothing of it with RIDE_FIGURES off (US4 scenario 1)", async () => {
		const before = ctx.env;
		ctx.env = { ...before, RIDE_FIGURES: "off" };
		try {
			const { html } = await overview();
			expect(html).not.toContain("sessions-cell");
			expect(html).not.toContain('data-tab="sessions"');
			expect(html).not.toContain('data-metric="sessions"');
			expect(dataOf(html).sessions).toBe(false);
			expect(tableOf(html)).not.toContain(
				escapeHtml(de["organiser.overview.column.sessions"]),
			);
			const cookies = await sessionCookie(ctx, ORGANISER.id);
			const rowsRead = async () => {
				const { ctx: counted, counter } = countRows(ctx);
				counter.reset();
				await (
					await handleFetch(request("/organiser/riders", { cookies }), counted)
				).text();
				return counter.read();
			};
			const off = await rowsRead();
			ctx.env = before;
			expect(off).toBeLessThan(await rowsRead());
		} finally {
			ctx.env = before;
		}
	});
});
