import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import { attendRaw, insertEvent } from "../support/rynke";

// The Termine tab (feature 019 US1–US3, FR-001–FR-010, contracts/pages.md,
// contracts/http-routes.md). The test season runs 2026-01-01 to 2027-06-30
// and the clock says Tuesday 2026-10-06. Synthetic riders and events only.

const ctx = makeCtx();
const { de, en } = CATALOGS;
const RIDER = ATHLETE_A;
const OTHER = ATHLETE_B;
const ORGANISER = ATHLETE_C;

async function page(path = "/events", athleteId = RIDER, lang?: string) {
	const res = await handleFetch(
		request(path, {
			cookies: await sessionCookie(ctx, athleteId),
			acceptLanguage: lang,
		}),
		ctx,
	);
	return { res, html: await res.text() };
}

async function post(path: string, athleteId = RIDER, origin?: string | null) {
	return handleFetch(
		request(path, {
			method: "POST",
			form: {},
			cookies: await sessionCookie(ctx, athleteId),
			origin,
		}),
		ctx,
	);
}

/** The card of `eventId` on the page. */
function cardOf(html: string, eventId: number): string {
	return (
		html.match(
			new RegExp(
				`<li class="event-card[^"]*" id="event-${eventId}">[\\s\\S]*?</li>`,
			),
		)?.[0] ?? ""
	);
}

/** The event ids of the cards in a list, in order. */
function idsIn(html: string): number[] {
	return [...html.matchAll(/id="event-(\d+)"/g)].map((m) => Number(m[1]));
}

async function reportsOf(athleteId = RIDER): Promise<number[]> {
	const { results } = await env.DB.prepare(
		"SELECT event_id FROM participation_reports WHERE athlete_id = ? ORDER BY event_id",
	)
		.bind(athleteId)
		.all<{ event_id: number }>();
	return results.map((r) => r.event_id);
}

async function snapshot() {
	const rows = async (table: string) =>
		(await env.DB.prepare(`SELECT * FROM ${table}`).all()).results;
	return {
		balances: await rows("rynke_balances"),
		attendances: await rows("attendances"),
		badges: await rows("rider_badges"),
	};
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: RIDER, firstName: "Katrin" });
	await seedRider(ctx, { athleteId: OTHER, firstName: "Emil" });
	await seedRider(ctx, { athleteId: ORGANISER, organiser: true });
});

describe("GET /events (US1)", () => {
	it("starts with the Spond and Strava note, then the upcoming events with the hint", async () => {
		const soon = await insertEvent("team_training", "2026-10-10", "Elbdeich");
		const later = await insertEvent("technique_training", "2026-10-24");
		const { res, html } = await page();
		expect(res.status).toBe(200);
		const note = html.indexOf(escapeHtml(de["events.note.body"]));
		const hint = html.indexOf(escapeHtml(de["events.upcoming.hint"]));
		expect(html).toContain(escapeHtml(de["events.note.title"]));
		expect(note).toBeGreaterThan(0);
		expect(hint).toBeGreaterThan(note);
		expect(idsIn(html)).toEqual([soon, later]);
		expect(cardOf(html, soon)).toContain(">Elbdeich<");
		expect(html).not.toContain(escapeHtml(de["events.upcoming.none"]));
	});

	it("says no events are planned and gives no hint without upcoming events", async () => {
		await insertEvent("team_training", "2026-09-01");
		const { html } = await page();
		expect(html).toContain(escapeHtml(de["events.upcoming.none"]));
		expect(html).not.toContain(escapeHtml(de["events.upcoming.hint"]));
	});

	it("shows each event's kind and the Rynke its attendance earns (FR-002)", async () => {
		const weekend = await insertEvent("training_weekend_day", "2026-10-10");
		const card = cardOf((await page()).html, weekend);
		expect(card).toContain(escapeHtml(de["rynke.source.training_weekend_day"]));
		expect(card).toContain(`<svg class="coin coin-mini coin-team"`);
		expect(card).toContain("+5 Team");
		expect(card).toContain("+10 Training");
	});

	it("lists past events newest first, five and a link to all (FR-001)", async () => {
		const past: number[] = [];
		for (const day of ["01", "05", "10", "15", "20", "25"]) {
			past.push(await insertEvent("team_training", `2026-09-${day}`));
		}
		const { html } = await page();
		expect(idsIn(html)).toEqual(past.slice(1).reverse());
		expect(html).toContain('href="/events?past=all#past"');
		expect(html).toContain(escapeHtml(de["events.past.all"]));
		const all = await page("/events?past=all");
		expect(idsIn(all.html)).toEqual([...past].reverse());
		expect(all.html).not.toContain(escapeHtml(de["events.past.all"]));
	});

	it("leaves out events outside the counting window and shows no Rynke sums", async () => {
		const before = await insertEvent("team_training", "2025-12-31");
		const after = await insertEvent("team_training", "2027-07-01");
		const inside = await insertEvent("team_training", "2026-10-10");
		const { html } = await page();
		expect(idsIn(html)).toEqual([inside]);
		expect(idsIn(html)).not.toContain(before);
		expect(idsIn(html)).not.toContain(after);
	});

	it("speaks English", async () => {
		await insertEvent("team_training", "2026-10-10");
		const { html } = await page("/events", RIDER, "en");
		expect(html).toContain(escapeHtml(en["events.note.title"]));
		expect(html).toContain(escapeHtml(en["events.join"]));
	});

	it("sends an organiser to the Orga pages (research R8)", async () => {
		const { res } = await page("/events", ORGANISER);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/organiser");
	});

	it("shows nothing of other riders (FR-010)", async () => {
		const event = await insertEvent("team_training", "2026-10-10");
		const past = await insertEvent("team_training", "2026-09-10");
		await post(`/events/${event}/report`, OTHER);
		await post(`/events/${past}/report`, OTHER);
		await attendRaw(past, [ORGANISER]);
		const { html } = await page();
		expect(html).not.toContain("Emil");
		expect(cardOf(html, event)).toContain(`action="/events/${event}/report"`);
		expect(cardOf(html, past)).toContain(escapeHtml(de["events.report"]));
		expect(cardOf(html, past)).not.toContain(escapeHtml(de["events.attended"]));
	});
});

describe("Bin dabei and Doch nicht dabei (US2)", () => {
	it("stores an intent and shows the green button with both labels", async () => {
		const event = await insertEvent("team_training", "2026-10-10");
		const before = await snapshot();
		const res = await post(`/events/${event}/report`);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe(`/events#event-${event}`);
		expect(await reportsOf()).toEqual([event]);
		expect(await snapshot()).toEqual(before);
		const card = cardOf((await page()).html, event);
		expect(card).toContain(`action="/events/${event}/report/delete"`);
		expect(card).toContain('aria-pressed="true"');
		expect(card).toContain(`<span class="event-next">`);
		expect(card).toContain(escapeHtml(de["events.leave"]));
		expect(card).toContain(
			`aria-label="${escapeHtml(de["events.joined.label"])}"`,
		);
	});

	it("keeps one report when tapped twice", async () => {
		const event = await insertEvent("team_training", "2026-10-10");
		await post(`/events/${event}/report`);
		await post(`/events/${event}/report`);
		expect(await reportsOf()).toEqual([event]);
	});

	it("withdraws an intent before the event", async () => {
		const event = await insertEvent("team_training", "2026-10-10");
		await post(`/events/${event}/report`);
		const res = await post(`/events/${event}/report/delete`);
		expect(res.headers.get("Location")).toBe(`/events#event-${event}`);
		expect(await reportsOf()).toEqual([]);
		const card = cardOf((await page()).html, event);
		expect(card).toContain(`action="/events/${event}/report"`);
		expect(card).not.toContain('aria-pressed="true"');
	});

	it("refuses to withdraw once the event has taken place, on its day too", async () => {
		const today = await insertEvent("team_training", "2026-10-06");
		await env.DB.prepare(
			"INSERT INTO participation_reports (event_id, athlete_id, reported_at) VALUES (?, ?, ?)",
		)
			.bind(today, RIDER, NOW - 86400)
			.run();
		const res = await post(`/events/${today}/report/delete`);
		expect(res.headers.get("Location")).toBe(
			`/events?error=event_over#event-${today}`,
		);
		expect(await reportsOf()).toEqual([today]);
	});

	it("shows the refusal notice", async () => {
		const error = await page("/events?error=event_over");
		expect(error.html).toContain(escapeHtml(de["events.error.event_over"]));
	});

	it("refuses an organiser, another origin and a visitor", async () => {
		const event = await insertEvent("team_training", "2026-10-10");
		expect((await post(`/events/${event}/report`, ORGANISER)).status).toBe(403);
		expect(
			(await post(`/events/${event}/report`, RIDER, "https://evil.test"))
				.status,
		).toBe(403);
		const visitor = await handleFetch(
			request(`/events/${event}/report`, { method: "POST", form: {} }),
			ctx,
		);
		expect(visitor.status).toBe(403);
		expect(await reportsOf(ORGANISER)).toEqual([]);
		expect(await reportsOf()).toEqual([]);
	});

	it("refuses an unknown event and one outside the counting window", async () => {
		const outside = await insertEvent("team_training", "2025-12-31");
		for (const id of [outside, 999_999]) {
			const res = await post(`/events/${id}/report`);
			expect(res.headers.get("Location")).toBe("/events?error=event_missing");
		}
		expect(await reportsOf()).toEqual([]);
	});

	it("refuses a rider who must reconnect", async () => {
		await seedRider(ctx, {
			athleteId: 900_005,
			status: "needs_reconnect",
		});
		const event = await insertEvent("team_training", "2026-10-10");
		expect((await post(`/events/${event}/report`, 900_005)).status).toBe(403);
	});
});

describe("Ich war dabei (US3)", () => {
	it("stores a request and locks the button (FR-005)", async () => {
		const event = await insertEvent("team_training", "2026-09-26");
		const before = cardOf((await page()).html, event);
		expect(before).toContain(`action="/events/${event}/report"`);
		expect(before).toContain(escapeHtml(de["events.report"]));
		await post(`/events/${event}/report`);
		const card = cardOf((await page()).html, event);
		expect(card).toContain('aria-disabled="true"');
		expect(card).toContain(
			`aria-label="${escapeHtml(de["events.reported.label"])}"`,
		);
		expect(card).not.toContain("<form");
	});

	it("turns an intent into a locked request once the event has taken place", async () => {
		const event = await insertEvent("team_training", "2026-10-06");
		await env.DB.prepare(
			"INSERT INTO participation_reports (event_id, athlete_id, reported_at) VALUES (?, ?, ?)",
		)
			.bind(event, RIDER, NOW - 86400)
			.run();
		const card = cardOf((await page()).html, event);
		expect(card).toContain('aria-disabled="true"');
		expect(card).not.toContain("<form");
	});

	it("says 'Du warst dabei' once attendance is recorded, without a button", async () => {
		const event = await insertEvent("team_training", "2026-09-26");
		await attendRaw(event, [RIDER]);
		const card = cardOf((await page()).html, event);
		expect(card).toContain(escapeHtml(de["events.attended"]));
		expect(card).not.toContain("<form");
		expect(card).not.toContain("<button");
		const res = await post(`/events/${event}/report`);
		expect(res.headers.get("Location")).toBe(
			`/events?error=already_attending#event-${event}`,
		);
		expect(await reportsOf()).toEqual([]);
	});

	it("shows the default button again after a denial, and says nothing about it (FR-009)", async () => {
		const event = await insertEvent("team_training", "2026-09-26");
		await post(`/events/${event}/report`);
		await env.DB.prepare("DELETE FROM participation_reports").run();
		const { html } = await page();
		const card = cardOf(html, event);
		expect(card).toContain(`action="/events/${event}/report"`);
		for (const word of ["abgelehnt", "bestätigt", "eingetragen"]) {
			expect(card).not.toContain(word);
		}
	});
});
