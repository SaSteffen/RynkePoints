import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	ORIGIN,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C } from "../support/fixtures";

// Organisers record the Tour de Paris (feature 021 US1, FR-001–FR-004): tour
// days are created after the qualification deadline, take attendance and
// reports, show no Rynke and earn none. The test season starts on 2026-01-01
// and ends on 2026-12-31; the deadline is moved to 2026-06-30 here, and the
// clock says 2026-10-06. Synthetic riders and events only.

const DEADLINE = "2026-06-30";
const TOUR_DAY = "2026-07-04";
const ORGANISER = ATHLETE_C;
const ANNA = ATHLETE_A;
const BEN = ATHLETE_B;
const { de } = CATALOGS;

const ctx: TestCtx = {
	...makeCtx(),
	env: { ...env, QUALIFICATION_DEADLINE: DEADLINE },
};

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

async function page(path: string, athleteId: number): Promise<string> {
	const res = await handleFetch(
		request(path, { cookies: await sessionCookie(ctx, athleteId) }),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

/** The organiser's attendance ticks for `athleteIds`, none shown ticked. */
async function recordAttendance(
	eventId: number,
	athleteIds: number[],
): Promise<Response> {
	const form = new FormData();
	for (const id of athleteIds) {
		form.append("attend", String(id));
		form.append("shown", `${id}:0`);
	}
	const cookies = Object.entries(await sessionCookie(ctx, ORGANISER))
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");
	return handleFetch(
		new Request(`${ORIGIN}/organiser/events/${eventId}/attendance`, {
			method: "POST",
			body: form,
			headers: { Origin: ORIGIN, Cookie: cookies },
		}),
		ctx,
	);
}

async function eventIds(kind: string): Promise<number[]> {
	const { results } = await env.DB.prepare(
		"SELECT event_id FROM team_events WHERE kind = ? ORDER BY event_id",
	)
		.bind(kind)
		.all<{ event_id: number }>();
	return results.map((r) => r.event_id);
}

async function balance(athleteId: number) {
	return env.DB.prepare(
		`SELECT training_rynke, team_rynke, qualified, team_event_breakdown
		FROM rynke_balances WHERE athlete_id = ?`,
	)
		.bind(athleteId)
		.first<{
			training_rynke: number;
			team_rynke: number;
			qualified: number;
			team_event_breakdown: string;
		}>();
}

/** The card of `eventId` on the Termine tab. */
function cardOf(html: string, eventId: number): string {
	return (
		html.match(
			new RegExp(
				`<li class="event-card[^"]*" id="event-${eventId}">[\\s\\S]*?</li>`,
			),
		)?.[0] ?? ""
	);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ORGANISER, organiser: true });
	await seedRider(ctx, { athleteId: ANNA, firstName: "Anna" });
	await seedRider(ctx, { athleteId: BEN, firstName: "Ben" });
});

/** Creates a tour day through the organiser form and returns its id. */
async function createTourDay(date = TOUR_DAY, name = "Hamburg – Bremen") {
	const res = await post("/organiser/events", {
		kind: "tour_de_paris",
		date,
		name,
	});
	const [eventId] = (await eventIds("tour_de_paris")).slice(-1);
	expect(res.status).toBe(303);
	expect(res.headers.get("Location")).toBe(
		`/organiser/events/${eventId}?done=created`,
	);
	return eventId as number;
}

describe("Tour de Paris days", () => {
	it("offers the kind in the organiser's form", async () => {
		const html = await page("/organiser", ORGANISER);
		expect(html).toContain(
			`<option value="tour_de_paris">${de["rynke.source.tour_de_paris"]}</option>`,
		);
	});

	it("takes a tour day after the deadline, and refuses other kinds then (FR-003)", async () => {
		await createTourDay();
		const res = await post("/organiser/events", {
			kind: "team_training",
			date: TOUR_DAY,
			name: "",
		});
		expect(res.headers.get("Location")).toBe("/organiser?error=outside_season");
		expect(await eventIds("team_training")).toEqual([]);
	});

	it("refuses a tour day after the season end", async () => {
		const res = await post("/organiser/events", {
			kind: "tour_de_paris",
			date: "2027-01-01",
			name: "",
		});
		expect(res.headers.get("Location")).toBe("/organiser?error=outside_season");
		expect(await eventIds("tour_de_paris")).toEqual([]);
	});

	it("records attendance that earns no Rynke and no qualification (FR-002)", async () => {
		const eventId = await createTourDay();
		const res = await recordAttendance(eventId, [ANNA, BEN]);
		expect(res.status).toBe(303);
		const { results } = await env.DB.prepare(
			"SELECT athlete_id FROM attendances WHERE event_id = ? ORDER BY athlete_id",
		)
			.bind(eventId)
			.all<{ athlete_id: number }>();
		expect(results.map((r) => r.athlete_id)).toEqual([ANNA, BEN]);
		for (const athleteId of [ANNA, BEN]) {
			const stored = await balance(athleteId);
			expect(stored).toMatchObject({
				training_rynke: 0,
				team_rynke: 0,
				qualified: 0,
			});
			const kinds = JSON.parse(stored?.team_event_breakdown ?? "[]") as {
				kind: string;
				attended: number;
			}[];
			expect(kinds.map((k) => k.kind)).not.toContain("tour_de_paris");
			expect(kinds.every((k) => k.attended === 0)).toBe(true);
		}
	});

	it("lists the tour day on the Termine tab with no amount (FR-004)", async () => {
		const eventId = await createTourDay();
		const card = cardOf(await page("/events", ANNA), eventId);
		expect(card).toContain(de["rynke.source.tour_de_paris"]);
		expect(card).toContain("Hamburg – Bremen");
		expect(card).not.toContain("event-amounts");
		expect(card).not.toContain("+0");
		// Taken place, no report yet: "Ich war dabei" (feature 019).
		expect(card).toContain(de["events.report"]);
		expect(card).toContain(`action="/events/${eventId}/report"`);
	});

	it("takes a rider's report and shows it to the organiser (FR-003, feature 019)", async () => {
		const eventId = await createTourDay();
		const res = await post(`/events/${eventId}/report`, {}, ANNA);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe(`/events#event-${eventId}`);
		const reported = await env.DB.prepare(
			"SELECT athlete_id FROM participation_reports WHERE event_id = ?",
		)
			.bind(eventId)
			.all<{ athlete_id: number }>();
		expect(reported.results.map((r) => r.athlete_id)).toEqual([ANNA]);
		// The open request appears on the organiser's list.
		const html = await page("/organiser", ORGANISER);
		expect(html).toContain(de["organiser.events.open"].replace("{count}", "1"));
	});
});
