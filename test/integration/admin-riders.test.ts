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
import { seedBalance } from "../support/rider-view";

// The rider overview (feature 025 US3, FR-018, FR-019, FR-031, FR-038).

const NOW = Date.UTC(2026, 10, 4, 12, 0, 0) / 1000;
const de = CATALOGS.de;
const ctx = makeCtx({ now: NOW });
const ADMIN = ATHLETE_A;

async function page(query = "", athleteId = ADMIN) {
	const res = await handleFetch(
		request(`/admin/riders${query}`, {
			cookies: await sessionCookie(ctx, athleteId),
		}),
		ctx,
	);
	expect(res.status).toBe(200);
	return res.text();
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, {
		athleteId: ADMIN,
		administrator: true,
		firstName: "Ada",
	});
});

describe("a rider's row", () => {
	it("shows first name, status, dates and import state (scenario 1)", async () => {
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			firstName: "Bo",
			status: "needs_reconnect",
			importStatus: "running",
		});
		const text = await page();
		const card = text
			.split('<li class="card admin-rider">')
			.find((c) => c.includes("<h3>Bo</h3>"));
		expect(card).toContain(de["admin.riders.status.needs_reconnect"]);
		expect(card).toContain(`${de["admin.riders.import.running"]}`);
		expect(card?.match(/04\.11\.2026/g)).toHaveLength(2);
		expect(card).toContain(`href="/admin/riders/${ATHLETE_B}/remove"`);
	});

	it("offers no remove link for oneself", async () => {
		expect(await page()).not.toContain(`/admin/riders/${ADMIN}/remove`);
	});

	it("shows no rides, Rynke, tokens or displayed IDs (FR-019)", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B, firstName: "Bo" });
		await seedBalance(ATHLETE_B, { trainingRynke: 4321, teamRynke: 765 });
		const text = await page();
		expect(text).not.toContain("4321");
		expect(text).not.toContain("4.321");
		expect(text).not.toContain("765");
		const withoutLinks = text.replaceAll(
			`/admin/riders/${ATHLETE_B}/remove`,
			"",
		);
		expect(withoutLinks).not.toContain(String(ATHLETE_B));
		expect(text).not.toContain("access-");
		expect(text).not.toContain("refresh-");
	});
});

describe("the consent filter (FR-038)", () => {
	beforeEach(async () => {
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			firstName: "OnlyOlder",
			consentVersion: 1,
		});
		await seedRider(ctx, {
			athleteId: ATHLETE_C,
			firstName: "Nothing",
			consentVersion: null,
		});
	});

	it("lists a rider on an older version, and only counts one without any (scenario 2)", async () => {
		const text = await page();
		expect(text).toContain("<h3>OnlyOlder</h3>");
		expect(text).toContain(`href="/admin/riders/${ATHLETE_B}/remove"`);
		expect(text).not.toContain("Nothing");
		expect(text).toContain(
			escapeHtml(
				de["admin.riders.counts"]
					.replace("{listed}", "2")
					.replace("{unlisted}", "1")
					.replace("{blocked}", "0"),
			),
		);
	});

	it("doesn't change the team's own lists for them", async () => {
		await seedBalance(ATHLETE_B, { trainingRynke: 10 });
		const { results } = await env.DB.prepare(
			"SELECT athlete_id FROM consent_records WHERE version >= 1 ORDER BY athlete_id",
		).all<{ athlete_id: number }>();
		expect(results.map((r) => r.athlete_id)).toContain(ATHLETE_B);
		const team = await handleFetch(
			request("/organiser/riders", {
				cookies: await sessionCookie(ctx, ADMIN),
			}),
			ctx,
		);
		expect(team.status).toBe(403);
	});
});

describe("the block list (FR-031)", () => {
	it("shows only how many", async () => {
		await env.DB.prepare(
			"INSERT INTO blocked_athletes (athlete_id) VALUES (777123), (777124)",
		).run();
		const text = await page();
		expect(text).toContain("Gesperrt: 2.");
		expect(text).not.toContain("777123");
	});
});

describe("the results of a removal", () => {
	it.each([
		["?done=removed", "admin.remove.done.removed"],
		["?done=removed-revoke-failed", "admin.remove.done.removed-revoke-failed"],
		["?error=unknown", "admin.remove.error.unknown"],
	] as const)("%s", async (query, id) => {
		expect(await page(query)).toContain(escapeHtml(de[id]));
	});

	it("ignores unknown codes", async () => {
		const text = await page("?done=%3Cscript%3E");
		expect(text).not.toContain('class="notice"');
		expect(text).not.toContain("&lt;script");
	});
});
