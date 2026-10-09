import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { applyTeamEventChange } from "../../src/rynke/apply";
import { CURRENT_RULES, countingWindow } from "../../src/rynke/rules";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import { insertEvent } from "../support/rynke";

// Organisers manage the season's team events (feature 014 Story 1, FR-010–
// FR-013, FR-040, contracts/http-routes.md). The test season starts on
// 2026-01-01 and the clock says 2026-10-06; the current rules have no
// deadline. Synthetic riders and events only.

const ctx = makeCtx();
const { de } = CATALOGS;
const ORGANISER = ATHLETE_C;
const OTHER_ORGANISER = 900004;
const RIDER = ATHLETE_A;
const ORGANISER_NAME = "Synthetic Orga";
const TODAY = "2026-10-06";

interface EventRow {
	event_id: number;
	kind: string;
	event_date: string;
	name: string | null;
	changed_by: number | null;
	changed_at: number | null;
}

async function events(): Promise<EventRow[]> {
	const { results } = await env.DB.prepare(
		"SELECT * FROM team_events ORDER BY event_id",
	).all<EventRow>();
	return results;
}

async function post(
	path: string,
	form: Record<string, string>,
	athleteId = ORGANISER,
): Promise<Response> {
	return handleFetch(
		request(path, { form, cookies: await sessionCookie(ctx, athleteId) }),
		ctx,
	);
}

async function page(
	path: string,
	athleteId = ORGANISER,
): Promise<{ status: number; html: string }> {
	const res = await handleFetch(
		request(path, { cookies: await sessionCookie(ctx, athleteId) }),
		ctx,
	);
	return { status: res.status, html: await res.text() };
}

function expectRedirect(res: Response, location: string): void {
	expect(res.status).toBe(303);
	expect(res.headers.get("Location")).toBe(location);
}

/** Records `athleteIds` as attending, re-evaluating them as the pages do. */
async function attend(eventId: number, athleteIds: number[]): Promise<void> {
	await applyTeamEventChange(
		env.DB,
		{ kind: "add-attendance", eventId, athleteIds },
		CURRENT_RULES,
		countingWindow(env),
		NOW,
	);
}

async function teamRynke(athleteId: number): Promise<number | null> {
	return env.DB.prepare(
		"SELECT team_rynke FROM rynke_balances WHERE athlete_id = ?",
	)
		.bind(athleteId)
		.first<number>("team_rynke");
}

/** The event list items of `/organiser`, in order. */
function listItems(html: string): string[] {
	return [
		...html.matchAll(/<li class="organiser-event">([\s\S]*?)<\/li>/g),
	].map((m) => m[1] ?? "");
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, {
		athleteId: ORGANISER,
		firstName: ORGANISER_NAME,
		organiser: true,
	});
	await seedRider(ctx, { athleteId: OTHER_ORGANISER, organiser: true });
	await seedRider(ctx, { athleteId: RIDER });
	await seedRider(ctx, { athleteId: ATHLETE_B });
});

describe("POST /organiser/events", () => {
	it("creates an event with today's date and no name (FR-011, FR-040)", async () => {
		const res = await post("/organiser/events", {
			kind: "team_training",
			date: TODAY,
			name: "  ",
		});
		const [row] = await events();
		expectRedirect(res, `/organiser/events/${row?.event_id}?done=created`);
		expect(row).toMatchObject({
			kind: "team_training",
			event_date: TODAY,
			name: null,
			changed_by: ORGANISER,
			changed_at: NOW,
		});
	});

	it.each([
		["before the season start", "2025-12-31", "outside_season"],
		["not a date", "2026-02-30", "invalid_date"],
	])("refuses a date %s", async (_name, date, code) => {
		const res = await post("/organiser/events", {
			kind: "team_training",
			date,
			name: "",
		});
		expectRedirect(res, `/organiser?error=${code}`);
		expect(await events()).toEqual([]);
	});

	it.each([
		["an unknown kind", { kind: "party" }, "unknown_kind"],
		["a 101-character name", { name: "x".repeat(101) }, "invalid_name"],
	])("refuses %s", async (_name, fields, code) => {
		const res = await post("/organiser/events", {
			kind: "team_training",
			date: TODAY,
			name: "",
			...fields,
		});
		expectRedirect(res, `/organiser?error=${code}`);
		expect(await events()).toEqual([]);
	});
});

describe("POST /organiser/events/{id}", () => {
	it("changes kind, date and name, and the list shows it (FR-011)", async () => {
		const id = await insertEvent("team_training", "2026-09-01");
		const res = await post(`/organiser/events/${id}`, {
			kind: "technique_training",
			date: "2026-09-02",
			name: " Synthetic hill session ",
		});
		expectRedirect(res, `/organiser/events/${id}?done=saved`);
		expect((await events())[0]).toMatchObject({
			kind: "technique_training",
			event_date: "2026-09-02",
			name: "Synthetic hill session",
			changed_by: ORGANISER,
			changed_at: NOW,
		});
		const [item] = listItems((await page("/organiser")).html);
		expect(item).toContain("Synthetic hill session");
		expect(item).toContain(escapeHtml(de["rynke.source.technique_training"]));
	});

	it("refuses a new date outside the season, nothing changes (FR-012)", async () => {
		const id = await insertEvent("team_training", "2026-09-01");
		const before = await events();
		const res = await post(`/organiser/events/${id}`, {
			kind: "team_training",
			date: "2025-06-01",
			name: "",
		});
		expectRedirect(res, `/organiser/events/${id}?error=outside_season`);
		expect(await events()).toEqual(before);
	});

	it("sends an update of an event deleted meanwhile to the list", async () => {
		const id = await insertEvent("team_training", "2026-09-01");
		await env.DB.prepare("DELETE FROM team_events").run();
		const res = await post(`/organiser/events/${id}`, {
			kind: "team_training",
			date: "2026-09-01",
			name: "",
		});
		expectRedirect(res, "/organiser?error=event_missing");
		expect(await events()).toEqual([]);
	});
});

describe("POST /organiser/events/{id}/delete", () => {
	it("deletes the event and its attendance; the balance follows (FR-013)", async () => {
		const id = await insertEvent("team_training", "2026-09-01");
		await attend(id, [RIDER]);
		expect(await teamRynke(RIDER)).toBeGreaterThan(0);
		const res = await post(`/organiser/events/${id}/delete`, {});
		expectRedirect(res, "/organiser?done=deleted");
		expect(await events()).toEqual([]);
		const attendances = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM attendances",
		).first<number>("n");
		expect(attendances).toBe(0);
		expect(await teamRynke(RIDER)).toBe(0);
	});

	it("sends a delete of an event deleted meanwhile to the list", async () => {
		const id = await insertEvent("team_training", "2026-09-01");
		await env.DB.prepare("DELETE FROM team_events").run();
		const res = await post(`/organiser/events/${id}/delete`, {});
		expectRedirect(res, "/organiser?error=event_missing");
	});
});

describe("GET /organiser", () => {
	it("lists the season's events newest first with the attendee count (FR-010)", async () => {
		const older = await insertEvent("team_training", "2026-03-01", "Older");
		await insertEvent("technique_training", "2025-12-31", "Last season");
		const newer = await insertEvent("training_weekend_day", "2026-09-20");
		// Stands in for an event after a deadline: past today, still listed.
		const later = await insertEvent("team_training", "2027-03-01", "Later");
		await attend(newer, [RIDER, ATHLETE_B]);
		await attend(older, [RIDER]);
		const { status, html } = await page("/organiser");
		expect(status).toBe(200);
		expect(html).toMatch(/<a href="\/organiser\/riders" aria-current="page">/);
		expect(html).toContain(
			`<a class="segmented" href="/organiser" aria-current="true">`,
		);
		const items = listItems(html);
		expect(items).toHaveLength(3);
		expect(items[0]).toContain(`href="/organiser/events/${later}"`);
		expect(items[1]).toContain(`href="/organiser/events/${newer}"`);
		expect(items[1]).toContain(
			escapeHtml(de["organiser.events.attendees"].replace("{count}", "2")),
		);
		expect(items[2]).toContain(`href="/organiser/events/${older}"`);
		expect(items[2]).toContain(
			escapeHtml(de["organiser.events.attendees"].replace("{count}", "1")),
		);
		expect(html).not.toContain("Last season");
	});

	it("offers the new-event form dated today", async () => {
		const { html } = await page("/organiser");
		expect(html).toContain('<form method="post" action="/organiser/events"');
		expect(html).toContain(`type="date" name="date" value="${TODAY}"`);
		expect(html).toContain(escapeHtml(de["organiser.events.none"]));
	});

	it("shows a known code's notice and ignores an unknown one (R3)", async () => {
		const done = await page("/organiser?done=deleted");
		expect(done.html).toContain(escapeHtml(de["organiser.done.deleted"]));
		const bogus = await page("/organiser?error=bogus");
		expect(bogus.html).not.toContain('class="notice');
	});
});

describe("GET /organiser/events/{id}", () => {
	it("has the edit form and the delete button inside a <details> (FR-013)", async () => {
		const id = await insertEvent("team_training", "2026-09-01", "Synthetic");
		const { status, html } = await page(`/organiser/events/${id}`);
		expect(status).toBe(200);
		expect(html).toContain(
			`<form method="post" action="/organiser/events/${id}"`,
		);
		expect(html).toMatch(
			new RegExp(
				`<details[^>]*>(?:(?!</details>)[\\s\\S])*action="/organiser/events/${id}/delete"(?:(?!</details>)[\\s\\S])*</details>`,
			),
		);
	});

	it("gives 404 for an unknown event", async () => {
		expect((await page("/organiser/events/999999")).status).toBe(404);
	});
});

describe("the change record (FR-040, R9)", () => {
	const changedBy = (name: string) =>
		escapeHtml(
			de["organiser.changedBy"]
				.replace("{name}", name)
				.replace("{date}", "06.10.2026"),
		);

	async function created(): Promise<number> {
		await post("/organiser/events", {
			kind: "team_training",
			date: TODAY,
			name: "",
		});
		return (await events())[0]?.event_id ?? 0;
	}

	it("names the organiser who changed the event", async () => {
		const id = await created();
		const { html } = await page(`/organiser/events/${id}`, OTHER_ORGANISER);
		expect(html).toContain(changedBy(ORGANISER_NAME));
	});

	it("shows a former organiser once the organiser's rider row is gone", async () => {
		const id = await created();
		await env.DB.prepare("DELETE FROM riders WHERE athlete_id = ?")
			.bind(ORGANISER)
			.run();
		expect((await events())[0]?.changed_by).toBeNull();
		const { html } = await page(`/organiser/events/${id}`, OTHER_ORGANISER);
		expect(html).toContain(changedBy(de["organiser.formerOrganiser"]));
		expect(
			listItems((await page("/organiser", OTHER_ORGANISER)).html)[0],
		).toContain(changedBy(de["organiser.formerOrganiser"]));
	});

	it("shows a former organiser once the organiser no longer shares their name", async () => {
		const id = await created();
		await env.DB.prepare("DELETE FROM consent_records WHERE athlete_id = ?")
			.bind(ORGANISER)
			.run();
		for (const path of ["/organiser", `/organiser/events/${id}`]) {
			const { html } = await page(path, OTHER_ORGANISER);
			expect(html).not.toContain(ORGANISER_NAME);
			expect(html).toContain(changedBy(de["organiser.formerOrganiser"]));
		}
	});

	it("shows nothing for an event from before the change record", async () => {
		const id = await insertEvent("team_training", "2026-09-01");
		const { html } = await page(`/organiser/events/${id}`);
		expect(html).not.toContain('class="change-record"');
	});
});
