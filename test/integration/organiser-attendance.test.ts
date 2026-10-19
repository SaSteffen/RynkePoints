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
import { attendRaw, insertEvent, reportRaw } from "../support/rynke";

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

// Feature 019 US5 (FR-040–FR-044, research R5): reports as grey boxes.
describe("tri-state boxes", () => {
	const NORA = 900_005;
	const EMIL = 900_006;

	/** POSTs `shown` ids and `decide-{id}` values as one form. */
	function decideForm(
		decisions: [number, "open" | "yes" | "no"][],
		shown: [number, 0 | 1][] = [],
	): FormData {
		const form = attendanceForm([], shown);
		for (const [id, value] of decisions) {
			form.append("shown", `${id}:r`);
			form.append(`decide-${id}`, value);
		}
		return form;
	}

	async function reported(id = eventId): Promise<number[]> {
		const { results } = await env.DB.prepare(
			"SELECT athlete_id FROM participation_reports WHERE event_id = ? ORDER BY athlete_id",
		)
			.bind(id)
			.all<{ athlete_id: number }>();
		return results.map((r) => r.athlete_id);
	}

	beforeEach(async () => {
		await seedRider(ctx, { athleteId: NORA, firstName: "Nora" });
		await seedRider(ctx, { athleteId: EMIL, firstName: "Emil" });
		await reportRaw(eventId, ATHLETE_A);
		await reportRaw(eventId, NORA);
		await reportRaw(eventId, EMIL);
	});

	it("lists requested riders first with a grey box, the legend and the hint", async () => {
		const html = await eventPage();
		const list =
			html.match(/<ul class="attendance-list">[\s\S]*?<\/ul>/)?.[0] ?? "";
		const firstChecklistRow = list.indexOf('type="checkbox"');
		for (const id of [ATHLETE_A, NORA, EMIL]) {
			const at = list.indexOf(
				`<input type="hidden" name="shown" value="${id}:r">`,
			);
			expect(at).toBeGreaterThan(0);
			expect(at).toBeLessThan(firstChecklistRow);
			expect(list).toContain(
				`<input type="hidden" name="decide-${id}" value="open">`,
			);
			expect(list).toContain(
				`<button type="button" class="tri-toggle" role="checkbox" aria-checked="mixed" data-state="open"><span class="tri-box" aria-hidden="true"></span>`,
			);
			expect(checkbox(html, id)).toBeNull();
		}
		expect(html).toContain('<ul class="tri-legend"');
		expect(html).toContain(escapeHtml(de["organiser.attendance.legend.grey"]));
		expect(html).toContain(escapeHtml(de["organiser.attendance.tag.open"]));
		expect(html).toContain(
			escapeHtml(de["organiser.attendance.confirmAll"].replace("{n}", "3")),
		);
	});

	it("confirms yes, denies no, keeps open, and counts them in the notice (FR-042)", async () => {
		const res = await postForm(
			decideForm([
				[ATHLETE_A, "yes"],
				[NORA, "no"],
				[EMIL, "open"],
			]),
		);
		expectRedirect(
			res,
			`/organiser/events/${eventId}?done=attendance&yes=1&no=1&open=1`,
		);
		expect((await attendances()).map((a) => a.athlete_id)).toEqual([ATHLETE_A]);
		expect(await reported()).toEqual([EMIL]);
		const notice = await handleFetch(
			request(
				`/organiser/events/${eventId}?done=attendance&yes=1&no=1&open=1`,
				{
					cookies: await sessionCookie(ctx, ORGANISER),
				},
			),
			ctx,
		);
		expect(await notice.text()).toContain(
			escapeHtml(
				de["organiser.done.attendance.reports"]
					.replace("{yes}", "1")
					.replace("{no}", "1")
					.replace("{open}", "1"),
			),
		);
	});

	it("changes nothing for a request settled meanwhile", async () => {
		await env.DB.prepare(
			"DELETE FROM participation_reports WHERE athlete_id = ?",
		)
			.bind(NORA)
			.run();
		await postForm(decideForm([[NORA, "yes"]]));
		expect(await attendances()).toEqual([]);
	});

	it("still applies ticks and unticks of other riders (014)", async () => {
		const form = decideForm([[EMIL, "open"]], [[ATHLETE_B, 0]]);
		form.append("attend", String(ATHLETE_B));
		await postForm(form);
		expect((await attendances()).map((a) => a.athlete_id)).toEqual([ATHLETE_B]);
		expect(await reported()).toEqual(
			[ATHLETE_A, NORA, EMIL].sort((a, b) => a - b),
		);
	});

	it("shows an upcoming event's intents as locked grey boxes (FR-043)", async () => {
		const later = await insertEvent("team_training", "2026-10-10");
		await reportRaw(later, NORA);
		const html = await eventPage(later);
		expect(html).toContain(
			escapeHtml(de["organiser.attendance.headingFuture"]),
		);
		expect(html).toContain(
			escapeHtml(
				de["organiser.attendance.countFuture"].replace("{count}", "1"),
			),
		);
		expect(html).toContain(
			escapeHtml(de["organiser.attendance.legend.greyFuture"]),
		);
		expect(html).toContain(escapeHtml(de["organiser.attendance.tag.intent"]));
		expect(html).not.toContain('type="radio"');
		expect(html).not.toContain(
			`action="/organiser/events/${later}/attendance"`,
		);
	});
});
