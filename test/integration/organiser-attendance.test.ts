import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { attendanceSection } from "../../src/http/organiser/attendance";
import { CATALOGS } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	ORIGIN,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import { attendRaw, insertEvent } from "../support/rynke";

// Organisers record who attended an event (feature 014 Story 2, FR-020–FR-022,
// SC-003, research R6, R10). The clock says 2026-10-06; riders connected then,
// so every past event here lies before their `connected_at`. Synthetic riders
// only.

const ctx = makeCtx();
const { de } = CATALOGS;
const ORGANISER = ATHLETE_C;
const OTHER_ORGANISER = 900004;

let eventId: number;

/** `form` as repeated fields: `attend` ids and `shown` `id:0|1` pairs. */
function attendanceForm(attend: number[], shown: [number, 0 | 1][]): FormData {
	const form = new FormData();
	for (const id of attend) form.append("attend", String(id));
	for (const [id, state] of shown) form.append("shown", `${id}:${state}`);
	return form;
}

/** POSTs `form` to the event's attendance as `athleteId`. */
async function postForm(
	form: FormData,
	athleteId = ORGANISER,
	id = eventId,
): Promise<Response> {
	const cookies = Object.entries(await sessionCookie(ctx, athleteId))
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");
	return handleFetch(
		new Request(`${ORIGIN}/organiser/events/${id}/attendance`, {
			method: "POST",
			body: form,
			headers: { Origin: ORIGIN, Cookie: cookies },
		}),
		ctx,
	);
}

function save(
	attend: number[],
	shown: [number, 0 | 1][],
	athleteId = ORGANISER,
	id = eventId,
): Promise<Response> {
	return postForm(attendanceForm(attend, shown), athleteId, id);
}

async function eventPage(id = eventId): Promise<string> {
	const res = await handleFetch(
		request(`/organiser/events/${id}`, {
			cookies: await sessionCookie(ctx, ORGANISER),
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

interface AttendanceRow {
	athlete_id: number;
	changed_by: number | null;
	changed_at: number | null;
}

async function attendances(id = eventId): Promise<AttendanceRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT athlete_id, changed_by, changed_at FROM attendances
		WHERE event_id = ? ORDER BY athlete_id`,
	)
		.bind(id)
		.all<AttendanceRow>();
	return results;
}

async function teamRynke(athleteId: number): Promise<number> {
	return (
		(await env.DB.prepare(
			"SELECT team_rynke FROM rynke_balances WHERE athlete_id = ?",
		)
			.bind(athleteId)
			.first<number>("team_rynke")) ?? 0
	);
}

function expectRedirect(res: Response, location: string): void {
	expect(res.status).toBe(303);
	expect(res.headers.get("Location")).toBe(location);
}

/** Whether the page has the rider's checkbox, ticked or not. */
function checkbox(
	html: string,
	athleteId: number,
): "ticked" | "unticked" | null {
	const match = html.match(
		new RegExp(
			`<input type="checkbox" name="attend" value="${athleteId}"( checked)?>`,
		),
	);
	if (!match) return null;
	return match[1] ? "ticked" : "unticked";
}

const profileLink = (athleteId: number) =>
	`href="https://www.strava.com/athletes/${athleteId}"`;

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ORGANISER, organiser: true });
	await seedRider(ctx, { athleteId: OTHER_ORGANISER, organiser: true });
	await seedRider(ctx, { athleteId: ATHLETE_A, firstName: "Anna" });
	await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "anna" });
	eventId = await insertEvent("team_training", "2026-09-01");
});

describe("POST /organiser/events/{id}/attendance", () => {
	it("records the ticked riders with the change record (FR-020, FR-040)", async () => {
		const res = await save(
			[ATHLETE_A, ATHLETE_B],
			[
				[ATHLETE_A, 0],
				[ATHLETE_B, 0],
				[ORGANISER, 0],
			],
		);
		expectRedirect(res, `/organiser/events/${eventId}?done=attendance`);
		expect(await attendances()).toEqual([
			{ athlete_id: ATHLETE_A, changed_by: ORGANISER, changed_at: NOW },
			{ athlete_id: ATHLETE_B, changed_by: ORGANISER, changed_at: NOW },
		]);
		const html = await eventPage();
		expect(checkbox(html, ATHLETE_A)).toBe("ticked");
		expect(checkbox(html, ATHLETE_B)).toBe("ticked");
		expect(checkbox(html, ORGANISER)).toBe("unticked");
		expect(html).toContain(`name="shown" value="${ATHLETE_A}:1"`);
		expect(html).toContain(`name="shown" value="${ORGANISER}:0"`);
	});

	it("credits the same ticks once however often they're saved (SC-003)", async () => {
		await save([ATHLETE_A], [[ATHLETE_A, 0]]);
		const once = await teamRynke(ATHLETE_A);
		expect(once).toBeGreaterThan(0);
		await save([ATHLETE_A], [[ATHLETE_A, 0]], OTHER_ORGANISER);
		await save([ATHLETE_A], [[ATHLETE_A, 1]]);
		expect(await attendances()).toEqual([
			{ athlete_id: ATHLETE_A, changed_by: ORGANISER, changed_at: NOW },
		]);
		expect(await teamRynke(ATHLETE_A)).toBe(once);
	});

	it("removes an unticked rider and the balance follows (FR-021)", async () => {
		await save(
			[ATHLETE_A, ATHLETE_B],
			[
				[ATHLETE_A, 0],
				[ATHLETE_B, 0],
			],
		);
		expect(await teamRynke(ATHLETE_B)).toBeGreaterThan(0);
		const res = await save(
			[ATHLETE_A],
			[
				[ATHLETE_A, 1],
				[ATHLETE_B, 1],
			],
		);
		expectRedirect(res, `/organiser/events/${eventId}?done=attendance`);
		expect((await attendances()).map((r) => r.athlete_id)).toEqual([ATHLETE_A]);
		expect(await teamRynke(ATHLETE_B)).toBe(0);
	});

	it("leaves a rider another organiser ticked meanwhile (R6)", async () => {
		// Organiser A loaded the page with nobody ticked.
		await save([ATHLETE_B], [[ATHLETE_B, 0]], OTHER_ORGANISER);
		await save(
			[ATHLETE_A],
			[
				[ATHLETE_A, 0],
				[ATHLETE_B, 0],
			],
		);
		expect((await attendances()).map((r) => r.athlete_id)).toEqual([
			ATHLETE_A,
			ATHLETE_B,
		]);
	});

	it("leaves the attendance of a rider without consent untouched", async () => {
		await attendRaw(eventId, [ATHLETE_A]);
		await env.DB.prepare("DELETE FROM consent_records WHERE athlete_id = ?")
			.bind(ATHLETE_A)
			.run();
		const html = await eventPage();
		expect(checkbox(html, ATHLETE_A)).toBeNull();
		await save([ATHLETE_B], [[ATHLETE_B, 0]]);
		expect((await attendances()).map((r) => r.athlete_id)).toEqual([
			ATHLETE_A,
			ATHLETE_B,
		]);
	});

	it.each([
		["a ticked id", [ATHLETE_A, 123456], [[ATHLETE_A, 0]]],
		[
			"a shown id",
			[ATHLETE_A],
			[
				[ATHLETE_A, 0],
				[123456, 1],
			],
		],
	] as [string, number[], [number, 0 | 1][]][])(
		"refuses %s that isn't listed, nothing written",
		async (_name, attend, shown) => {
			await seedRider(ctx, { athleteId: 123456, consentVersion: null });
			const res = await save(attend, shown);
			expectRedirect(
				res,
				`/organiser/events/${eventId}?error=rider_not_listed`,
			);
			expect(await attendances()).toEqual([]);
		},
	);

	it("refuses a malformed shown value, nothing written", async () => {
		const form = attendanceForm([ATHLETE_A], []);
		form.append("shown", "nonsense");
		const res = await postForm(form);
		expectRedirect(res, `/organiser/events/${eventId}?error=rider_not_listed`);
		expect(await attendances()).toEqual([]);
	});

	it("refuses an event in the future, nothing written (FR-022)", async () => {
		const later = await insertEvent("team_training", "2026-10-07");
		const res = await save([ATHLETE_A], [[ATHLETE_A, 0]], ORGANISER, later);
		expectRedirect(res, `/organiser/events/${later}?error=future_event`);
		expect(await attendances(later)).toEqual([]);
	});

	it("records today's event", async () => {
		const today = await insertEvent("team_training", "2026-10-06");
		const res = await save([ATHLETE_A], [[ATHLETE_A, 0]], ORGANISER, today);
		expectRedirect(res, `/organiser/events/${today}?done=attendance`);
		expect(await attendances(today)).toHaveLength(1);
	});

	it("sends a save for an event deleted meanwhile to the list", async () => {
		await env.DB.prepare("DELETE FROM team_events").run();
		const res = await save([ATHLETE_A], [[ATHLETE_A, 0]]);
		expectRedirect(res, "/organiser?error=event_missing");
	});
});

describe("the attendance checklist", () => {
	it("lists the riders by first name with one form (FR-020)", async () => {
		const html = await eventPage();
		expect(html).toContain(
			`<form method="post" action="/organiser/events/${eventId}/attendance"`,
		);
		expect(html).toContain(escapeHtml(de["organiser.attendance.save"]));
		const order = [ATHLETE_A, ATHLETE_B, ORGANISER, OTHER_ORGANISER].map((id) =>
			html.indexOf(`value="${id}:0"`),
		);
		expect(order.every((i) => i > 0)).toBe(true);
		expect(order[0]).toBeLessThan(order[1] ?? 0);
	});

	it("links clashing first names to Strava, a unique name not (004 FR-022)", async () => {
		const html = await eventPage();
		expect(html).toContain(profileLink(ATHLETE_A));
		expect(html).toContain(profileLink(ATHLETE_B));
		expect(html).not.toContain(profileLink(ORGANISER));
	});

	it("shows a future event's list without a form (FR-022)", async () => {
		const later = await insertEvent("team_training", "2026-10-07");
		const html = await eventPage(later);
		expect(html).toContain(escapeHtml(de["organiser.attendance.future"]));
		expect(html).not.toContain(
			`action="/organiser/events/${later}/attendance"`,
		);
		expect(html).toContain("Anna");
		expect(checkbox(html, ATHLETE_A)).toBeNull();
	});

	it("says so when nobody is listed", () => {
		const i18n = createI18n("de", CATALOGS);
		const html = String(
			attendanceSection(i18n, { eventId, future: false }, [], new Set()),
		);
		expect(html).toContain(escapeHtml(de["organiser.attendance.none"]));
		expect(html).not.toContain("<form");
	});
});
