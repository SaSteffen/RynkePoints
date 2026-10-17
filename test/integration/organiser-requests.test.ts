import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { undoToken } from "../../src/http/organiser/requests";
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
import { attendRaw, insertEvent, reportRaw } from "../support/rynke";

// Organisers notice and settle riders' requests (feature 019 US4, FR-030–
// FR-035, research R3, R4, R7). The clock says 2026-10-06. Synthetic riders
// and events only.

const ctx = makeCtx();
const { de } = CATALOGS;
const KATRIN = ATHLETE_A;
const EMIL = ATHLETE_B;
const ORGANISER = ATHLETE_C;
const NORA = 900_004;
const IDA = 900_005;

let technique: number;
let training: number;
let upcoming: number;

async function page(path: string, athleteId = ORGANISER) {
	const res = await handleFetch(
		request(path, { cookies: await sessionCookie(ctx, athleteId) }),
		ctx,
	);
	return { res, html: await res.text() };
}

/** POSTs a decision as a form with repeated `athlete` fields. */
async function decide(
	eventId: number,
	athletes: number[],
	decision: string,
	back = "/organiser",
	athleteId = ORGANISER,
): Promise<Response> {
	const form = new URLSearchParams();
	form.append("event", String(eventId));
	for (const id of athletes) form.append("athlete", String(id));
	form.append("decision", decision);
	form.append("back", back);
	const cookies = Object.entries(await sessionCookie(ctx, athleteId))
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");
	return handleFetch(
		new Request("https://rynke.test/organiser/requests", {
			method: "POST",
			body: form,
			headers: {
				Origin: "https://rynke.test",
				Cookie: cookies,
				"Content-Type": "application/x-www-form-urlencoded",
			},
		}),
		ctx,
	);
}

async function undo(token: string, back = "/organiser") {
	return handleFetch(
		request("/organiser/requests/undo", {
			form: { token, back },
			cookies: await sessionCookie(ctx, ORGANISER),
		}),
		ctx,
	);
}

async function reports(eventId: number) {
	const { results } = await env.DB.prepare(
		"SELECT athlete_id, reported_at FROM participation_reports WHERE event_id = ? ORDER BY athlete_id",
	)
		.bind(eventId)
		.all<{ athlete_id: number; reported_at: number }>();
	return results;
}

async function attendees(eventId: number) {
	const { results } = await env.DB.prepare(
		"SELECT athlete_id, changed_by FROM attendances WHERE event_id = ? ORDER BY athlete_id",
	)
		.bind(eventId)
		.all<{ athlete_id: number; changed_by: number | null }>();
	return results;
}

/** The query of a `303`'s Location, as parameters. */
function locationOf(res: Response): { path: string; query: URLSearchParams } {
	expect(res.status).toBe(303);
	const location = new URL(
		res.headers.get("Location") ?? "",
		"https://rynke.test",
	);
	return { path: location.pathname, query: location.searchParams };
}

/** The `<nav class="app-nav">` of a page. */
function navOf(html: string): string {
	return html.match(/<nav class="app-nav"[\s\S]*?<\/nav>/)?.[0] ?? "";
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ORGANISER, organiser: true });
	await seedRider(ctx, { athleteId: KATRIN, firstName: "Katrin" });
	await seedRider(ctx, { athleteId: EMIL, firstName: "Emil" });
	await seedRider(ctx, { athleteId: NORA, firstName: "Nora" });
	await seedRider(ctx, { athleteId: IDA, firstName: "nora" });
	technique = await insertEvent("technique_training", "2026-09-26");
	training = await insertEvent("team_training", "2026-09-19");
	upcoming = await insertEvent("team_training", "2026-10-10");
	await reportRaw(technique, KATRIN, NOW - 30);
	await reportRaw(technique, EMIL, NOW - 20);
	await reportRaw(technique, NORA, NOW - 10);
	await reportRaw(training, KATRIN, NOW - 40);
	await reportRaw(upcoming, EMIL);
	await reportRaw(upcoming, NORA);
});

describe("the count of open requests (FR-030)", () => {
	it("shows 4 on Orga with its name, not counting intents", async () => {
		const nav = navOf((await page("/organiser")).html);
		expect(nav).toContain(
			'<span class="count-badge" aria-hidden="true">4</span>',
		);
		expect(nav).toContain(
			`aria-label="${escapeHtml(de["nav.organiser.open"].replace("{n}", "4"))}"`,
		);
	});

	it("shows it on Termine in the Orga switch", async () => {
		const { html } = await page("/organiser/riders");
		expect(html).toContain(
			`aria-label="${escapeHtml(de["organiser.switch.events.open"].replace("{n}", "4"))}"`,
		);
	});

	it("says 9+ above 9", async () => {
		for (let i = 0; i < 6; i++) {
			const event = await insertEvent("team_training", `2026-08-0${i + 1}`);
			await reportRaw(event, KATRIN);
		}
		expect(navOf((await page("/organiser")).html)).toContain(
			'<span class="count-badge" aria-hidden="true">9+</span>',
		);
	});

	it("shows nothing without open requests and nothing to riders", async () => {
		await env.DB.prepare("DELETE FROM participation_reports").run();
		expect((await page("/team")).html).not.toContain("count-badge");
		await reportRaw(technique, KATRIN);
		const rider = await page("/team", EMIL);
		expect(rider.html).not.toContain("count-badge");
	});

	it("leaves out a request next to attendance", async () => {
		await attendRaw(technique, [KATRIN, EMIL, NORA]);
		expect(navOf((await page("/organiser")).html)).toContain(
			'<span class="count-badge" aria-hidden="true">1</span>',
		);
	});
});

describe("GET /organiser with open requests (FR-031, FR-033)", () => {
	it("groups them by event, newest first, with the quick forms", async () => {
		const { html } = await page("/organiser");
		const block =
			html.match(/<section class="open-requests"[\s\S]*?<\/section>/)?.[0] ??
			"";
		expect(block).toContain(
			escapeHtml(de["organiser.requests.heading"].replace("{n}", "4")),
		);
		expect(block).toContain(
			escapeHtml(de["organiser.requests.intro"].replace("{n}", "2")),
		);
		expect(block.indexOf(`/organiser/events/${technique}`)).toBeLessThan(
			block.indexOf(`/organiser/events/${training}`),
		);
		const names = [...block.matchAll(/<span class="rider-name">([^<]*)</g)].map(
			(m) => m[1],
		);
		expect(names).toEqual(["Emil", "Katrin", "Nora", "Katrin"]);
		// Nora and nora share a first name, so Nora gets her profile link.
		expect(block).toContain(`https://www.strava.com/athletes/${NORA}`);
		expect(
			block.match(
				new RegExp(escapeHtml(de["organiser.requests.confirm"]), "g"),
			),
		).toHaveLength(4);
		expect(block).toContain(
			escapeHtml(de["organiser.requests.confirmAll"].replace("{n}", "3")),
		);
		expect(block.match(/name="decision" value="confirm"/g)?.length).toBe(5);
	});

	it("marks past events with open requests and upcoming ones with intents", async () => {
		const { html } = await page("/organiser");
		const item = (id: number) =>
			html.match(
				new RegExp(
					`<li class="organiser-event" id="event-${id}">[\\s\\S]*?</li>`,
				),
			)?.[0] ?? "";
		expect(item(technique)).toContain(
			escapeHtml(de["organiser.events.open"].replace("{count}", "3")),
		);
		expect(item(upcoming)).toContain(
			escapeHtml(de["organiser.events.intents"].replace("{count}", "2")),
		);
		expect(item(upcoming)).not.toContain("chip-alert");
	});

	it("has no block without open requests", async () => {
		await env.DB.prepare("DELETE FROM participation_reports").run();
		expect((await page("/organiser")).html).not.toContain("open-requests");
	});
});

describe("POST /organiser/requests (FR-031, FR-035)", () => {
	it("confirms: attendance with the change record, the report gone, an undo", async () => {
		const res = await decide(technique, [KATRIN], "confirm");
		const { path, query } = locationOf(res);
		expect(path).toBe("/organiser");
		expect(query.get("done")).toBe("confirmed");
		expect(query.get("undo")).toBeTruthy();
		expect(await attendees(technique)).toEqual([
			{ athlete_id: KATRIN, changed_by: ORGANISER },
		]);
		expect((await reports(technique)).map((r) => r.athlete_id)).toEqual([
			EMIL,
			NORA,
		]);
		const balance = await env.DB.prepare(
			"SELECT team_rynke FROM rynke_balances WHERE athlete_id = ?",
		)
			.bind(KATRIN)
			.first<number>("team_rynke");
		expect(balance).toBe(5);
		const notice = await page(
			`/organiser?done=confirmed&undo=${encodeURIComponent(query.get("undo") ?? "")}`,
		);
		expect(notice.html).toContain(
			escapeHtml(de["organiser.done.confirmed"].replace("{names}", "Katrin")),
		);
		expect(notice.html).toContain('action="/organiser/requests/undo"');
	});

	it("confirms all of an event at once", async () => {
		await decide(technique, [KATRIN, EMIL, NORA], "confirm");
		expect((await attendees(technique)).map((a) => a.athlete_id)).toEqual(
			[KATRIN, EMIL, NORA].sort((a, b) => a - b),
		);
		expect(await reports(technique)).toEqual([]);
	});

	it("denies: the report gone, nothing recorded", async () => {
		const res = await decide(technique, [EMIL], "deny", "/organiser/riders");
		const { path, query } = locationOf(res);
		expect(path).toBe("/organiser/riders");
		expect(query.get("done")).toBe("denied");
		expect(await attendees(technique)).toEqual([]);
		expect((await reports(technique)).map((r) => r.athlete_id)).toEqual([
			KATRIN,
			NORA,
		]);
	});

	it("changes nothing for a request someone else settled", async () => {
		await env.DB.prepare(
			"DELETE FROM participation_reports WHERE athlete_id = ?",
		)
			.bind(EMIL)
			.run();
		const res = await decide(technique, [EMIL], "confirm");
		expect(locationOf(res).query.get("error")).toBe("request_settled");
		expect(await attendees(technique)).toEqual([]);
	});

	it("refuses an upcoming event", async () => {
		const res = await decide(upcoming, [EMIL], "confirm");
		expect(locationOf(res).query.get("error")).toBe("future_event");
		expect((await reports(upcoming)).length).toBe(2);
	});

	it("refuses a rider who isn't an organiser", async () => {
		const res = await decide(
			technique,
			[KATRIN],
			"confirm",
			"/organiser",
			EMIL,
		);
		expect(res.status).toBe(403);
		expect(await attendees(technique)).toEqual([]);
	});

	it("goes back only to the organiser pages", async () => {
		const res = await decide(technique, [EMIL], "deny", "https://evil.test/");
		expect(locationOf(res).path).toBe("/organiser");
	});
});

describe("POST /organiser/requests/undo (FR-032)", () => {
	it("takes a confirmation back: attendance removed, reports back as they were", async () => {
		const res = await decide(technique, [KATRIN, NORA], "confirm");
		const token = locationOf(res).query.get("undo") ?? "";
		const back = await undo(token);
		expect(locationOf(back).query.get("done")).toBe("undone");
		expect(await attendees(technique)).toEqual([]);
		expect(await reports(technique)).toEqual([
			{ athlete_id: KATRIN, reported_at: NOW - 30 },
			{ athlete_id: EMIL, reported_at: NOW - 20 },
			{ athlete_id: NORA, reported_at: NOW - 10 },
		]);
	});

	it("takes a denial back", async () => {
		const res = await decide(training, [KATRIN], "deny");
		await undo(locationOf(res).query.get("undo") ?? "");
		expect(await reports(training)).toEqual([
			{ athlete_id: KATRIN, reported_at: NOW - 40 },
		]);
	});

	it("refuses an expired or forged token and changes nothing", async () => {
		const old = await undoToken(
			{
				decision: "deny",
				eventId: training,
				reports: [{ athleteId: EMIL, reportedAt: NOW }],
			},
			NOW - 601,
			ctx.env.SESSION_SIGNING_KEY,
		);
		for (const token of [old, "forged"]) {
			const res = await undo(token);
			expect(locationOf(res).query.get("error")).toBe("undo_expired");
		}
		expect(await reports(training)).toEqual([
			{ athlete_id: KATRIN, reported_at: NOW - 40 },
		]);
	});
});
