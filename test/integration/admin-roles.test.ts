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

// Admin › Rollen (feature 043 US1–US4, US6; contracts/http-routes.md): own
// administrators give and take Orga and Admin; nobody changes their own role;
// guests look but don't change. Synthetic riders only.

const ctx = makeCtx();
const de = CATALOGS.de;
const ADMIN = ATHLETE_C;
const RIDER = ATHLETE_A;
const ORGA = ATHLETE_B;
const GUEST = "900009";
const UNLISTED = "900010";

async function get(path: string, athleteId: string) {
	return handleFetch(
		request(path, { cookies: await sessionCookie(ctx, athleteId) }),
		ctx,
	);
}

async function setRole(
	athlete: string,
	role: string,
	by = ADMIN,
	origin?: string,
) {
	return handleFetch(
		request("/admin/roles", {
			form: { athlete, role },
			origin,
			cookies: await sessionCookie(ctx, by),
		}),
		ctx,
	);
}

interface Row {
	organiser: number;
	administrator: number;
	role_since: number | null;
	role_seen: number | null;
	role_changed_by: string | null;
	role_changed_at: number | null;
}

async function row(athleteId: string): Promise<Row | null> {
	return env.DB.prepare(
		`SELECT organiser, administrator, role_since, role_seen, role_changed_by,
			role_changed_at FROM riders WHERE athlete_id = ?`,
	)
		.bind(athleteId)
		.first<Row>();
}

async function allRows() {
	return (
		await env.DB.prepare(
			"SELECT * , CAST(athlete_id AS TEXT) AS athlete_id FROM riders ORDER BY riders.athlete_id",
		).all()
	).results;
}

function section(page: string, heading: string): string {
	const start = page.indexOf(`<h2>${escapeHtml(heading)}</h2>`);
	expect(start).toBeGreaterThan(-1);
	const end = page.indexOf("</section>", start);
	return page.slice(start, end);
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, {
		athleteId: ADMIN,
		firstName: "Ada",
		administrator: true,
	});
	await seedRider(ctx, { athleteId: RIDER, firstName: "Fiona" });
	await seedRider(ctx, {
		athleteId: ORGA,
		firstName: "Olga",
		organiser: true,
	});
	await seedRider(ctx, { athleteId: GUEST, firstName: "Quirin", guest: true });
	await seedRider(ctx, {
		athleteId: UNLISTED,
		firstName: "Uwe",
		consentVersion: null,
	});
});

describe("the Rollen page", () => {
	it("is the third admin view", async () => {
		const page = await (await get("/admin", ADMIN)).text();
		expect(page).toContain('href="/admin/roles"');
		expect(page).toContain(escapeHtml(de["admin.switch.roles"]));
	});

	it("lists administrators, the Orga and riders without a role", async () => {
		const res = await get("/admin/roles", ADMIN);
		expect(res.status).toBe(200);
		const page = await res.text();
		const admins = section(page, de["admin.roles.admins"]);
		expect(admins).toContain("Ada");
		expect(admins).toContain(escapeHtml(de["admin.roles.you"]));
		expect(admins).not.toContain(escapeHtml(de["admin.roles.change"]));
		expect(admins).toContain(escapeHtml(de["admin.roles.onlyAdmin"]));
		const orga = section(page, de["admin.roles.orga"]);
		expect(orga).toContain("Olga");
		expect(orga).not.toContain("Ada");
		expect(orga).toContain(`data-athlete="${ORGA}"`);
		const give = section(page, de["admin.roles.give.heading"]);
		expect(give).toContain("Fiona");
		expect(give).toContain(`data-athlete="${RIDER}"`);
		for (const name of ["Quirin", "Uwe"]) expect(page).not.toContain(name);
		expect(page).toContain('<dialog class="role-sheet"');
	});

	it("shows since when once a role was set in the app", async () => {
		await setRole(RIDER, "orga");
		const page = await (await get("/admin/roles", ADMIN)).text();
		const date = new Intl.DateTimeFormat("de-DE", {
			timeZone: "Europe/Berlin",
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		}).format(new Date(NOW * 1000));
		expect(section(page, de["admin.roles.orga"])).toContain(
			escapeHtml(de["admin.roles.orgaSince"].replace("{date}", date)),
		);
	});
});

describe("giving the Orga role (US1)", () => {
	it("stores it with the card's starting point", async () => {
		const res = await setRole(RIDER, "orga");
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe(
			`/admin/roles?done=orga&athlete=${RIDER}&from=none`,
		);
		expect(await row(RIDER)).toEqual({
			organiser: 1,
			administrator: 0,
			role_since: NOW,
			role_seen: 0,
			role_changed_by: "Ada",
			role_changed_at: NOW,
		});
		expect((await get("/organiser/riders", RIDER)).status).toBe(200);
	});

	it("changes nothing more when sent again", async () => {
		await setRole(RIDER, "orga");
		const before = await allRows();
		const res = await setRole(RIDER, "orga");
		expect(res.status).toBe(303);
		expect(await allRows()).toEqual(before);
	});

	it("shows a notice with Rückgängig", async () => {
		const page = await (
			await get(`/admin/roles?done=orga&athlete=${RIDER}&from=none`, ADMIN)
		).text();
		expect(page).toContain(
			escapeHtml(de["admin.roles.done.orga"].replace("{name}", "Fiona")),
		);
		expect(page).toContain('<input type="hidden" name="role" value="none">');
		expect(page).toContain(escapeHtml(de["admin.roles.undo"]));
	});
});

describe("giving the Admin role (US2)", () => {
	it("makes the rider administrator and organiser", async () => {
		await setRole(RIDER, "admin");
		expect(await row(RIDER)).toMatchObject({ organiser: 1, administrator: 1 });
		expect((await get("/admin", RIDER)).status).toBe(200);
		expect((await get("/organiser/riders", RIDER)).status).toBe(200);
	});
});

describe("taking a role away (US3)", () => {
	it("takes the Orga role", async () => {
		const res = await setRole(ORGA, "none");
		expect(res.headers.get("Location")).toBe(
			`/admin/roles?done=none&athlete=${ORGA}&from=orga`,
		);
		expect(await row(ORGA)).toMatchObject({
			organiser: 0,
			administrator: 0,
			role_seen: 1,
		});
		expect((await get("/organiser/riders", ORGA)).status).toBe(403);
	});

	it("takes an administrator down to Orga", async () => {
		await seedRider(ctx, {
			athleteId: "900011",
			firstName: "Anna",
			administrator: true,
		});
		await setRole("900011", "orga");
		expect(await row("900011")).toMatchObject({
			organiser: 1,
			administrator: 0,
			role_seen: 2,
		});
		const page = await (
			await get("/admin/roles?done=orga&athlete=900011&from=admin", ADMIN)
		).text();
		expect(page).toContain(
			escapeHtml(de["admin.roles.done.notAdmin"].replace("{name}", "Anna")),
		);
	});

	it("keeps the starting point across an undo", async () => {
		await setRole(ORGA, "none");
		await setRole(ORGA, "orga");
		expect(await row(ORGA)).toMatchObject({ organiser: 1, role_seen: 1 });
	});
});

describe("refusals (US4, US6)", () => {
	it("refuses a change of one's own role", async () => {
		const before = await allRows();
		const res = await setRole(ADMIN, "none");
		expect(res.headers.get("Location")).toBe("/admin/roles?error=self");
		expect(await allRows()).toEqual(before);
	});

	it.each([GUEST, UNLISTED, "123"])(
		"refuses a rider who isn't listed (%s)",
		async (athlete) => {
			const before = await allRows();
			const res = await setRole(athlete, "orga");
			expect(res.headers.get("Location")).toBe("/admin/roles?error=unknown");
			expect(await allRows()).toEqual(before);
		},
	);

	it("answers 400 for another role", async () => {
		expect((await setRole(RIDER, "owner")).status).toBe(400);
	});

	it.each([
		["a rider", RIDER],
		["an organiser", ORGA],
		["a guest", GUEST],
	])("answers 403 to %s and changes nothing", async (_who, by) => {
		const before = await allRows();
		expect((await setRole(RIDER, "orga", by)).status).toBe(403);
		expect(await allRows()).toEqual(before);
	});

	it("answers 403 from another origin", async () => {
		const before = await allRows();
		expect(
			(await setRole(RIDER, "orga", ADMIN, "https://elsewhere.test")).status,
		).toBe(403);
		expect(await allRows()).toEqual(before);
	});

	it("shows a guest the lists without controls", async () => {
		const res = await get("/admin/roles", GUEST);
		expect(res.status).toBe(200);
		const page = await res.text();
		expect(page).toContain("Olga");
		expect(page).not.toContain(escapeHtml(de["admin.roles.change"]));
		expect(page).not.toContain(escapeHtml(de["admin.roles.give.heading"]));
		expect(page).not.toContain("role-sheet");
	});

	it("refuses the page to a rider", async () => {
		expect((await get("/admin/roles", RIDER)).status).toBe(403);
	});
});
