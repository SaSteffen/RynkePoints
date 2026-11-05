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
import { ATHLETE_A, ATHLETE_B, ATHLETE_C } from "../support/fixtures";

// Who may use the admin pages (feature 025 FR-001 to FR-004, SC-004): a visitor,
// a rider who hasn't agreed to the current consent, a rider without the flag and
// an organiser without it change and see nothing. Synthetic riders only.

const ctx = makeCtx();
const ADMIN = ATHLETE_C;
const RIDER = ATHLETE_A;
const TARGET = ATHLETE_B;

const PAGES = ["/admin", "/admin/riders", `/admin/riders/${TARGET}/remove`];

const POSTS: { path: string; form: Record<string, string> }[] = [
	{ path: "/admin/alerts", form: { admin_alerts: "off" } },
	{ path: "/admin/refresh", form: {} },
	{ path: `/admin/riders/${TARGET}/remove`, form: {} },
];

async function get(path: string, athleteId: number | null) {
	return handleFetch(
		request(path, {
			cookies: athleteId ? await sessionCookie(ctx, athleteId) : undefined,
		}),
		ctx,
	);
}

async function post(
	path: string,
	form: Record<string, string>,
	athleteId: number | null,
	origin?: string,
) {
	return handleFetch(
		request(path, {
			form,
			origin,
			cookies: athleteId ? await sessionCookie(ctx, athleteId) : undefined,
		}),
		ctx,
	);
}

async function stored() {
	const riders = await env.DB.prepare(
		"SELECT athlete_id, admin_alerts FROM riders ORDER BY athlete_id",
	).all();
	const blocked = await env.DB.prepare("SELECT * FROM blocked_athletes").all();
	const log = await env.DB.prepare("SELECT * FROM removal_log").all();
	return [riders.results, blocked.results, log.results];
}

/** The generic 403, with nothing that gives the pages away (FR-003). */
async function expectForbidden(res: Response) {
	expect(res.status).toBe(403);
	const text = await res.text();
	expect(text).toContain(escapeHtml(CATALOGS.de["error.forbidden.title"]));
	expect(text).not.toContain('action="/admin');
	expect(text).not.toContain('href="/admin');
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
	await seedRider(ctx, { athleteId: RIDER });
	await seedRider(ctx, { athleteId: TARGET });
});

describe("a visitor", () => {
	it.each(PAGES)("is sent to / from GET %s", async (path) => {
		const res = await get(path, null);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it.each(POSTS)("gets 403 on POST $path", async ({ path, form }) => {
		const before = await stored();
		await expectForbidden(await post(path, form, null));
		expect(await stored()).toEqual(before);
	});
});

describe("an administrator without the current consent", () => {
	beforeEach(async () => {
		await env.DB.prepare("DELETE FROM consent_records WHERE athlete_id = ?")
			.bind(ADMIN)
			.run();
	});

	it.each(PAGES)("meets the consent gate on GET %s", async (path) => {
		const res = await get(path, ADMIN);
		expect(res.status).toBe(200);
		const page = await res.text();
		expect(page).toContain(
			`<h1>${escapeHtml(CATALOGS.de["me.consent.renew.heading"])}</h1>`,
		);
		expect(page).not.toContain('action="/admin');
	});

	it.each(POSTS)("gets 403 on POST $path", async ({ path, form }) => {
		const before = await stored();
		await expectForbidden(await post(path, form, ADMIN));
		expect(await stored()).toEqual(before);
	});
});

describe("a rider without the flag", () => {
	it.each(PAGES)("gets the generic 403 on GET %s", async (path) => {
		await expectForbidden(await get(path, RIDER));
	});

	it.each(POSTS)("gets 403 on POST $path", async ({ path, form }) => {
		const before = await stored();
		await expectForbidden(await post(path, form, RIDER));
		expect(await stored()).toEqual(before);
	});
});

describe("an organiser without the flag (FR-001)", () => {
	beforeEach(async () => {
		await env.DB.prepare("UPDATE riders SET organiser = 1 WHERE athlete_id = ?")
			.bind(RIDER)
			.run();
	});

	it.each(PAGES)("gets 403 on GET %s", async (path) => {
		await expectForbidden(await get(path, RIDER));
	});

	it.each(POSTS)("gets 403 on POST $path", async ({ path, form }) => {
		const before = await stored();
		await expectForbidden(await post(path, form, RIDER));
		expect(await stored()).toEqual(before);
	});
});

describe("an administrator", () => {
	it("gets each page", async () => {
		for (const path of ["/admin", "/admin/riders"]) {
			expect((await get(path, ADMIN)).status).toBe(200);
		}
		expect((await get(`/admin/riders/${TARGET}/remove`, ADMIN)).status).toBe(
			200,
		);
	});

	it.each(POSTS)(
		"gets 403 on POST $path from another origin",
		async ({ path, form }) => {
			const before = await stored();
			await expectForbidden(
				await post(path, form, ADMIN, "https://elsewhere.test"),
			);
			expect(await stored()).toEqual(before);
		},
	);

	it.each(POSTS)(
		"gets 403 on POST $path once the flag is cleared",
		async ({ path, form }) => {
			expect((await get("/admin", ADMIN)).status).toBe(200);
			await env.DB.prepare(
				"UPDATE riders SET administrator = 0 WHERE athlete_id = ?",
			)
				.bind(ADMIN)
				.run();
			const before = await stored();
			await expectForbidden(await post(path, form, ADMIN));
			expect(await stored()).toEqual(before);
			await expectForbidden(await get("/admin", ADMIN));
		},
	);
});

describe("the Admin tab (T007)", () => {
	const hasTab = async (athleteId: number) =>
		(await (await get("/team", athleteId)).text()).includes('<a href="/admin"');

	it("shows only for administrators", async () => {
		expect(await hasTab(ADMIN)).toBe(true);
		expect(await hasTab(RIDER)).toBe(false);
	});

	it("doesn't show for an organiser, and shows beside Orga with both roles", async () => {
		await env.DB.prepare("UPDATE riders SET organiser = 1 WHERE athlete_id = ?")
			.bind(RIDER)
			.run();
		expect(await hasTab(RIDER)).toBe(false);
		await env.DB.prepare("UPDATE riders SET organiser = 1 WHERE athlete_id = ?")
			.bind(ADMIN)
			.run();
		const page = await (await get("/team", ADMIN)).text();
		expect(page).toContain('<a href="/admin"');
		expect(page).toContain('<a href="/organiser/riders"');
	});

	it("is current on the admin pages", async () => {
		expect(await (await get("/admin", ADMIN)).text()).toContain(
			'<a href="/admin" aria-current="page"',
		);
	});
});
