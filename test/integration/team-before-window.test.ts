import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { riderPage, seedBalance, seedRide } from "../support/rider-view";

// The Team tab's Training view before the qualification window opens
// (feature 040): the ride figures lead, what only Rynke can fill waits under a
// note, and a guest still sees the peloton. Today is 2026-10-06, in the
// season (from 2026-09-01); the window opens on 2027-01-01. Synthetic riders
// only.

const { de } = CATALOGS;

const started = makeCtx();
const before = {
	...started,
	env: { ...started.env, QUALIFICATION_START_DATE: "2027-01-01" },
};

const VIEWER = "930001";
const OTHER = "930002";
const GUEST = "930003";

const NOTE = `<p class="before-window-note">${escapeHtml(de["team.beforeWindow"]).replace("{date}", "01.01.2027")}</p>`;

function sectionOf(page: string, open: string, close: string): string {
	const start = page.indexOf(open);
	if (start < 0) return "";
	return page.slice(start, page.indexOf(close, start) + close.length);
}

const navOf = (page: string, name: string) =>
	sectionOf(page, `<nav class="list-scope ${name}"`, "</nav>");

/** The `href` and `aria-current` of each link in `nav.list-scope.{name}`. */
function linksOf(page: string, name: string) {
	return [...navOf(page, name).matchAll(/<a [^>]*href="([^"]*)"([^>]*)>/g)].map(
		(m) => ({
			href: m[1],
			current: (m[2] ?? "").includes('aria-current="true"'),
		}),
	);
}

/** The markers of the page's cards, in the order they appear in `<main>`. */
function order(page: string, markers: readonly string[]): number[] {
	const main = page.indexOf("<main");
	return markers.map((marker) => page.indexOf(marker, main));
}

const inOrder = (at: number[]) =>
	at.every((i) => i > 0) && at.every((i, n) => n === 0 || i > (at[n - 1] ?? 0));

beforeEach(async () => {
	await resetDb();
	for (const [id, name, rynke] of [
		[VIEWER, "Ottilie", 120],
		[OTHER, "Waltraud", 80],
	] as const) {
		await seedRider(started, { athleteId: id, firstName: name });
		await seedBalance(id, { trainingRynke: rynke, teamRynke: 10 });
		await seedRide(id, {
			id: id,
			start_date: "2026-10-05T07:00:00Z",
			start_date_local: "2026-10-05T09:00:00Z",
			distance_m: 40_000,
		});
	}
	await seedRider(started, { athleteId: GUEST, guest: true });
});

describe("GET /team before the window opens", () => {
	it("opens on km, with Rank by right above what it changes", async () => {
		const { html } = await riderPage(before, VIEWER, "/team");
		// km is the default, so its link is the plain /team and Rynke's names itself.
		expect(linksOf(html, "rank-by")).toEqual([
			{ href: "/team?by=rynke", current: false },
			{ href: "/team?by=sessions", current: false },
			{ href: "/team", current: true },
			{ href: "/team?by=elevation", current: false },
		]);
		expect(navOf(html, "rank-period")).not.toBe("");
		expect(
			inOrder(
				order(html, [
					'<section class="team-total',
					'<figure class="peloton',
					'<figure class="team-chart',
					'<div class="team-ranking">',
					'<div class="rank-controls">',
					'<section class="my-place',
					'<section class="leaderboard',
				]),
			),
		).toBe(true);
	});

	it("keeps Rank by outside the leaderboard card", async () => {
		const { html } = await riderPage(before, VIEWER, "/team");
		const board = sectionOf(html, '<section class="leaderboard', "</section>");
		expect(board).not.toContain("rank-by");
		expect(board).not.toContain("rank-controls");
	});

	it("shows the km chart, not the Rynke one", async () => {
		const { html } = await riderPage(before, VIEWER, "/team");
		const chart = sectionOf(html, '<figure class="team-chart', "</figure>");
		expect(chart).toContain(escapeHtml(de["team.ride.chart.heading"]));
		expect(chart).not.toContain("before-window");
		expect(html.match(/<figure class="team-chart/g)).toHaveLength(1);
	});

	it("leaves the team card open and says when Rynke start counting", async () => {
		const { html } = await riderPage(before, VIEWER, "/team");
		const total = sectionOf(html, '<section class="team-total', "</section>");
		expect(total).toContain(
			`<p class="team-total-week">${escapeHtml(de["team.total.beforeWindow"]).replace("{date}", "01.01.2027")}</p>`,
		);
		expect(total).not.toContain("before-window");
	});

	it("puts the peloton under the note", async () => {
		const { html } = await riderPage(before, VIEWER, "/team");
		expect(html).toContain(
			`<div class="before-window"><div class="before-window-card" inert aria-hidden="true"><figure class="peloton`,
		);
		expect(html).toContain(NOTE);
	});

	it("keeps the place card and the km leaderboard readable", async () => {
		const { html } = await riderPage(before, VIEWER, "/team");
		const place = sectionOf(html, '<section class="my-place', "</section>");
		expect(place).not.toBe("");
		expect(html).not.toContain(
			'<div class="before-window-card" inert aria-hidden="true"><section class="my-place',
		);
		const board = sectionOf(html, '<section class="leaderboard', "</section>");
		expect(board).not.toContain("before-window");
	});

	it("covers the Rynke ranking's place and rows, but not Rank by", async () => {
		const { html } = await riderPage(before, VIEWER, "/team?by=rynke");
		expect(linksOf(html, "rank-by")).toContainEqual({
			href: "/team?by=rynke",
			current: true,
		});
		const place = sectionOf(html, '<div class="before-window">', "</section>");
		expect(place).toContain('<section class="my-place');
		const board = sectionOf(html, '<section class="leaderboard', "</section>");
		expect(board).toContain('<div class="before-window">');
		expect(board).toContain(NOTE);
		expect(board).toContain("<ol");
		// Rank by isn't inside any note's card.
		expect(
			sectionOf(html, '<div class="rank-controls">', "</div>"),
		).not.toContain("before-window");
	});

	it("shows a guest the peloton without the You coin", async () => {
		const { status, html } = await riderPage(before, GUEST, "/team");
		expect(status).toBe(200);
		const peloton = sectionOf(html, '<figure class="peloton', "</figure>");
		expect(peloton).toContain('<svg class="peloton-road');
		expect(peloton).not.toContain("peloton-you");
		expect(peloton).not.toContain(escapeHtml(de["team.peloton.you"]));
		expect(peloton).toContain('aria-label="2 Rider zwischen');
	});

	it("waits under the note with the Training ranking off too, with the km chart", async () => {
		const off = {
			...before,
			env: { ...before.env, TRAINING_LEADERBOARD: "off" },
		};
		const { html } = await riderPage(off, VIEWER, "/team");
		expect(html).toContain(
			`<div class="before-window"><div class="before-window-card" inert aria-hidden="true"><figure class="peloton`,
		);
		expect(html).toContain(NOTE);
		const chart = sectionOf(html, '<figure class="team-chart', "</figure>");
		expect(chart).toContain(escapeHtml(de["team.ride.chart.heading"]));
		expect(html.match(/<figure class="team-chart/g)).toHaveLength(1);
		expect(html).not.toContain('<section class="leaderboard');
		expect(html).not.toContain('<section class="my-place');
	});

	it("is the Hamburg page it was once the window has opened", async () => {
		const { html } = await riderPage(started, VIEWER, "/team");
		expect(html).not.toContain("before-window");
		expect(html).not.toContain('team-total-week">Rynke');
		expect(linksOf(html, "rank-by")[0]).toEqual({
			href: "/team",
			current: true,
		});
		expect(
			inOrder(
				order(html, [
					'<figure class="peloton',
					'<figure class="team-chart',
					'<div class="rank-controls">',
					'<section class="my-place',
					'<section class="leaderboard',
				]),
			),
		).toBe(true);
	});
});
