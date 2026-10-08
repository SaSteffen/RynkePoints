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
import { ATHLETE_A, ATHLETE_C } from "../support/fixtures";
import { attendRaw, insertEvent } from "../support/rynke";

// Who may use the organiser pages (feature 014 FR-001, SC-002, research R1):
// a visitor, a rider who hasn't agreed to the current consent and a rider
// without the organiser flag change nothing. Each story adds its routes to the
// tables below. Synthetic riders only.

const ctx = makeCtx();
const ORGANISER = ATHLETE_C;
const RIDER = ATHLETE_A;

let eventId: number;

/** The GET pages, `{id}` being a stored event. */
const PAGES = ["/organiser", "/organiser/events/{id}"];

/** The changes, with a form that would succeed for an organiser. */
const POSTS: { path: string; form: Record<string, string> }[] = [
	{
		path: "/organiser/events",
		form: { kind: "team_training", date: "2026-10-01", name: "" },
	},
	{
		path: "/organiser/events/{id}",
		form: { kind: "technique_training", date: "2026-10-02", name: "Changed" },
	},
	{ path: "/organiser/events/{id}/delete", form: {} },
];

const at = (path: string) => path.replace("{id}", String(eventId));

/** Every stored event and attendance, to show nothing changed. */
async function stored(): Promise<unknown[]> {
	const events = await env.DB.prepare(
		"SELECT * FROM team_events ORDER BY event_id",
	).all();
	const attendances = await env.DB.prepare(
		"SELECT * FROM attendances ORDER BY event_id, athlete_id",
	).all();
	return [events.results, attendances.results];
}

async function post(
	path: string,
	form: Record<string, string>,
	athleteId: number | null,
	origin?: string,
): Promise<Response> {
	return handleFetch(
		request(at(path), {
			form,
			origin,
			cookies: athleteId ? await sessionCookie(ctx, athleteId) : undefined,
		}),
		ctx,
	);
}

async function get(path: string, athleteId: number | null): Promise<Response> {
	return handleFetch(
		request(at(path), {
			cookies: athleteId ? await sessionCookie(ctx, athleteId) : undefined,
		}),
		ctx,
	);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ORGANISER, organiser: true });
	await seedRider(ctx, { athleteId: RIDER });
	eventId = await insertEvent("team_training", "2026-09-10");
	await attendRaw(eventId, [RIDER]);
});

describe("a visitor", () => {
	it.each(PAGES)("is sent to / from GET %s", async (path) => {
		const res = await get(path, null);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it.each(POSTS)(
		"gets 403 on POST $path, nothing changes",
		async ({ path, form }) => {
			const before = await stored();
			expect((await post(path, form, null)).status).toBe(403);
			expect(await stored()).toEqual(before);
		},
	);
});

describe("an organiser without the current consent", () => {
	beforeEach(async () => {
		await env.DB.prepare("DELETE FROM consent_records WHERE athlete_id = ?")
			.bind(ORGANISER)
			.run();
	});

	it.each(PAGES)("meets the consent gate on GET %s", async (path) => {
		const res = await get(path, ORGANISER);
		expect(res.status).toBe(200);
		const page = await res.text();
		expect(page).toContain(
			`<h1>${escapeHtml(CATALOGS.de["me.consent.renew.heading"])}</h1>`,
		);
		expect(page).not.toContain('action="/organiser');
	});

	it.each(POSTS)(
		"gets 403 on POST $path, nothing changes",
		async ({ path, form }) => {
			const before = await stored();
			expect((await post(path, form, ORGANISER)).status).toBe(403);
			expect(await stored()).toEqual(before);
		},
	);
});

describe("a rider without the organiser flag", () => {
	it.each(PAGES)("gets 403 on GET %s", async (path) => {
		const res = await get(path, RIDER);
		expect(res.status).toBe(403);
		expect(await res.text()).not.toContain('action="/organiser');
	});

	it.each(POSTS)(
		"gets 403 on POST $path, nothing changes",
		async ({ path, form }) => {
			const before = await stored();
			expect((await post(path, form, RIDER)).status).toBe(403);
			expect(await stored()).toEqual(before);
		},
	);
});

describe("an organiser", () => {
	it.each(PAGES)("gets GET %s", async (path) => {
		expect((await get(path, ORGANISER)).status).toBe(200);
	});

	it.each(POSTS)(
		"gets 403 on POST $path from another origin",
		async ({ path, form }) => {
			const before = await stored();
			expect(
				(await post(path, form, ORGANISER, "https://elsewhere.test")).status,
			).toBe(403);
			expect(await stored()).toEqual(before);
		},
	);

	it.each(POSTS)(
		"gets 403 on POST $path once the flag is cleared after the page loaded",
		async ({ path, form }) => {
			expect((await get("/organiser", ORGANISER)).status).toBe(200);
			await env.DB.prepare(
				"UPDATE riders SET organiser = 0 WHERE athlete_id = ?",
			)
				.bind(ORGANISER)
				.run();
			const before = await stored();
			expect((await post(path, form, ORGANISER)).status).toBe(403);
			expect(await stored()).toEqual(before);
		},
	);
});
