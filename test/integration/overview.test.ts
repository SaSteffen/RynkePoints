import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { RULES_HANDOUT_URL } from "../../src/http/rider-sections";
import { CATALOGS } from "../../src/i18n/catalogs";
import { CURRENT_RULES } from "../../src/rynke/rules";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { riderPage, seedBalance, seedRide } from "../support/rider-view";

// The Overview at `/me` (feature 011 FR-010, US1 scenario 1): notices, the
// greeting, the summary, the gauges, the breakdown and the rules, in this
// order, and nothing of Rides, Settings or the account.

const ctx = makeCtx();
const { de } = CATALOGS;

/** `main`'s content, inside the grid that holds all of it (011 pages.md). */
async function main(): Promise<string> {
	const { status, html } = await riderPage(ctx, ATHLETE_A);
	expect(status).toBe(200);
	const grid = html.match(
		/<main>\s*<div class="overview-grid">([\s\S]*)<\/div>\s*<\/main>/,
	);
	expect(grid).not.toBeNull();
	return grid?.[1] ?? "";
}

function expectInOrder(page: string, parts: string[]) {
	let at = -1;
	for (const part of parts) {
		const next = page.indexOf(part, at + 1);
		expect(next, part).toBeGreaterThan(at);
		at = next;
	}
}

const PARTS = [
	'<p class="greeting">',
	'<section id="rynke" class="rynke-summary verdict card">',
	'<section class="rynke-gauges">',
	'<section class="rynke-breakdown card card-outlined">',
	'<section class="rynke-rules card card-outlined">',
	`href="${RULES_HANDOUT_URL}"`,
	'<aside id="install"',
];

beforeEach(resetDb);

describe("GET /me Overview", () => {
	it("shows greeting, summary, gauges, breakdown and rules in order", async () => {
		await seedRider(ctx);
		await seedBalance(ATHLETE_A);
		const page = await main();
		expect(page.trimStart().startsWith("<p>Import abgeschlossen</p>")).toBe(
			true,
		);
		expectInOrder(page, PARTS);
		expect(page).toContain(
			`<p class="greeting">${escapeHtml(de["me.greeting"].replace("{firstName}", "Testrider A"))}</p>`,
		);
		expect(page).not.toContain("notice-error");
	});

	it("puts each gauge in its own card (011 US3)", async () => {
		await seedRider(ctx);
		await seedBalance(ATHLETE_A);
		const gauges = (await main()).match(
			/<section class="rynke-gauges">([\s\S]*?)<section class="rynke-breakdown/,
		)?.[1];
		const figures = [...(gauges ?? "").matchAll(/<figure class="gauge/g)];
		const cards = [
			...(gauges ?? "").matchAll(
				/<section class="card">\n<figure class="gauge/g,
			),
		];
		expect(figures.length).toBeGreaterThan(1);
		expect(cards).toHaveLength(figures.length);
	});

	it("starts with the reconnect notice, then 005's notices", async () => {
		await seedRider(ctx, {
			status: "needs_reconnect",
			importStatus: "running",
		});
		await seedBalance(ATHLETE_A, { rulesVersion: CURRENT_RULES.version + 1 });
		const page = await main();
		expect(
			page.trimStart().startsWith('<aside class="notice notice-error">'),
		).toBe(true);
		expectInOrder(page, [
			`<p>${escapeHtml(de["me.status.needsReconnect"])}</p>`,
			`<a class="button" href="/connect">${escapeHtml(de["me.reconnect"])}</a>`,
			'<section class="notice" role="status">',
			'<p class="greeting">',
			'<section id="rynke" class="rynke-summary verdict card">',
		]);
	});

	it("has no rides, notifications, consent or account actions", async () => {
		await seedRider(ctx);
		await seedBalance(ATHLETE_A);
		await seedRide(ATHLETE_A, {
			id: 8_100_001,
			name: "Synthetic Overview ride",
		});
		const page = await main();
		for (const absent of [
			'class="ride-list"',
			'class="rides"',
			'id="rides"',
			"Synthetic Overview ride",
			'id="notifications"',
			escapeHtml(de["me.consent.heading"]),
			escapeHtml(de["landing.dataRead"]),
			'href="/me/disconnect"',
			'action="/logout"',
			'action="/lang"',
		]) {
			expect(page).not.toContain(absent);
		}
	});
});
