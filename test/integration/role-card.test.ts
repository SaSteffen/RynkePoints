import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { stepHref } from "../../src/http/tour";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_C, NOW } from "../support/fixtures";

// The role card on the Du page (feature 043 FR-017 to FR-020, data-model.md
// "Role card"): one card per unseen change, none after an undo; the new
// organiser's card stands in for the Orga-Rundgang's invitation. Synthetic
// riders only.

const ctx = makeCtx();
const de = CATALOGS.de;
const ADMIN = ATHLETE_C;
const RIDER = ATHLETE_A;

async function get(path: string, athleteId = RIDER) {
	return handleFetch(
		request(path, { cookies: await sessionCookie(ctx, athleteId) }),
		ctx,
	);
}

async function post(path: string, form: Record<string, string>, by: string) {
	return handleFetch(
		request(path, { form, cookies: await sessionCookie(ctx, by) }),
		ctx,
	);
}

const setRole = (role: string) =>
	post("/admin/roles", { athlete: RIDER, role }, ADMIN);
const du = async () => (await get("/me")).text();
const has = (page: string, key: keyof typeof de) =>
	page.includes(escapeHtml(de[key] as string));

async function cardColumns() {
	return env.DB.prepare(
		"SELECT role_seen, role_changed_by, role_changed_at, organiser_onboarded_at FROM riders WHERE athlete_id = ?",
	)
		.bind(RIDER)
		.first();
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, {
		athleteId: ADMIN,
		firstName: "Ada",
		administrator: true,
	});
	await seedRider(ctx, { athleteId: RIDER, firstName: "Fiona" });
	// The rider tour is done, so only the organiser tour can be pending.
	await env.DB.prepare("UPDATE riders SET onboarded_at = ?").bind(NOW).run();
});

describe("joining the Orga (US1)", () => {
	beforeEach(async () => {
		await setRole("orga");
	});

	it("shows the card with who, the consent line and both buttons", async () => {
		const page = await du();
		expect(has(page, "role.card.orga.title")).toBe(true);
		expect(page).toContain("Ada");
		expect(has(page, "role.card.orga.consent")).toBe(true);
		expect(has(page, "role.card.tour")).toBe(true);
		expect(has(page, "role.card.later")).toBe(true);
	});

	it("stands in for the Orga-Rundgang's invitation", async () => {
		const team = await (await get("/team")).text();
		expect(has(team, "tour.organiser.intro")).toBe(false);
	});

	it("starts the tour and goes away", async () => {
		const res = await post("/me/role-card", { action: "tour" }, RIDER);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe(
			stepHref("organiser", { organiser: true }, 0),
		);
		expect(await cardColumns()).toMatchObject({
			role_seen: null,
			role_changed_by: null,
			role_changed_at: null,
			organiser_onboarded_at: null,
		});
		expect(has(await du(), "role.card.orga.title")).toBe(false);
	});

	it("goes away on Später and counts the tour as skipped", async () => {
		const res = await post("/me/role-card", { action: "close" }, RIDER);
		expect(res.headers.get("Location")).toBe("/me");
		expect(await cardColumns()).toMatchObject({
			role_seen: null,
			organiser_onboarded_at: NOW,
		});
		expect(has(await du(), "role.card.orga.title")).toBe(false);
	});

	it("refuses a post from another origin", async () => {
		const res = await handleFetch(
			request("/me/role-card", {
				form: { action: "close" },
				origin: "https://elsewhere.test",
				cookies: await sessionCookie(ctx, RIDER),
			}),
			ctx,
		);
		expect(res.status).toBe(403);
		expect(await cardColumns()).toMatchObject({ role_seen: 0 });
	});
});

describe("becoming an admin (US2)", () => {
	it("offers the Orga-Rundgang while it isn't done", async () => {
		await setRole("admin");
		const page = await du();
		expect(has(page, "role.card.admin.title")).toBe(true);
		expect(has(page, "role.card.orgaTour")).toBe(true);
	});

	it("only closes once the Orga-Rundgang is done", async () => {
		await env.DB.prepare(
			"UPDATE riders SET organiser_onboarded_at = ? WHERE athlete_id = ?",
		)
			.bind(NOW, RIDER)
			.run();
		await setRole("admin");
		const page = await du();
		expect(has(page, "role.card.admin.title")).toBe(true);
		expect(has(page, "role.card.orgaTour")).toBe(false);
		expect(has(page, "role.card.ok")).toBe(true);
	});
});

describe("losing a role (US3)", () => {
	it("tells a former organiser", async () => {
		await env.DB.prepare(
			"UPDATE riders SET organiser = 1, organiser_onboarded_at = ? WHERE athlete_id = ?",
		)
			.bind(NOW, RIDER)
			.run();
		await setRole("none");
		const page = await du();
		expect(has(page, "role.card.none.title")).toBe(true);
		expect(has(page, "role.card.none.events")).toBe(true);
		expect(has(page, "role.card.ok")).toBe(true);
	});

	it("tells a former admin who stays in the Orga", async () => {
		await env.DB.prepare(
			"UPDATE riders SET organiser = 1, administrator = 1 WHERE athlete_id = ?",
		)
			.bind(RIDER)
			.run();
		await setRole("orga");
		expect(has(await du(), "role.card.notAdmin.title")).toBe(true);
	});

	it("shows nothing after an undo, and clears the leftover", async () => {
		await setRole("orga");
		await setRole("none");
		const page = await du();
		for (const key of [
			"role.card.orga.title",
			"role.card.none.title",
		] as const) {
			expect(has(page, key)).toBe(false);
		}
		expect(await cardColumns()).toMatchObject({ role_seen: null });
	});
});
