import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { toActivityRecord } from "../../src/strava/activity";
import { approve } from "../support/callback";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	ATHLETE_C,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import { seedUsageDay } from "../support/usage";

// Removing and blocking a rider (feature 025 US4, FR-021 to FR-024, FR-030, SC-005,
// SC-008). Synthetic riders only.

const de = CATALOGS.de;
const ADMIN = ATHLETE_A;
const TARGET = ATHLETE_B;
const BYSTANDER = ATHLETE_C;

let fake: FakeStrava;
let ctx: TestCtx;

const PATH = (id: number) => `/admin/riders/${id}/remove`;

async function confirmPage(id: number) {
	return handleFetch(
		request(PATH(id), { cookies: await sessionCookie(ctx, ADMIN) }),
		ctx,
	);
}

async function remove(id: number, by = ADMIN) {
	return handleFetch(
		request(PATH(id), { form: {}, cookies: await sessionCookie(ctx, by) }),
		ctx,
	);
}

/** Every table with a column naming a rider, and how many rows name this one. */
async function rowsNaming(athleteId: number): Promise<Record<string, number>> {
	const { results: tables } = await env.DB.prepare(
		`SELECT name FROM sqlite_master WHERE type = 'table'
		AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'`,
	).all<{ name: string }>();
	const found: Record<string, number> = {};
	for (const { name } of tables) {
		const { results: columns } = await env.DB.prepare(
			`PRAGMA table_info(${name})`,
		).all<{ name: string }>();
		for (const column of columns.map((c) => c.name)) {
			if (
				!/athlete_id|owner_id|recipient_id|changed_by|administrator_id/.test(
					column,
				)
			) {
				continue;
			}
			const n = await env.DB.prepare(
				`SELECT COUNT(*) AS n FROM ${name} WHERE ${column} = ?`,
			)
				.bind(athleteId)
				.first<number>("n");
			if (n) found[`${name}.${column}`] = n;
		}
	}
	return found;
}

async function seedTarget() {
	fake.addAthlete({ id: TARGET });
	await seedRider(ctx, { athleteId: TARGET, firstName: "Synthetica" });
	const record = toActivityRecord(makeStravaActivity(), TARGET, NOW);
	if (!record) throw new Error("fixture is not a cycling activity");
	await upsertActivity(env.DB, record);
	await seedSubscription(TARGET, pushEndpoint(1));
	await env.DB.prepare(
		`INSERT INTO strava_work (athlete_id, message, kind, attempts, not_before, stored_at)
		VALUES (?, '{}', 'import-page', 1, 0, ?)`,
	)
		.bind(TARGET, NOW)
		.run();
}

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	await seedRider(ctx, { athleteId: ADMIN, administrator: true });
	await seedRider(ctx, { athleteId: BYSTANDER });
});

afterEach(() => fake.restore());

describe("the confirmation (scenario 1, FR-021)", () => {
	it("says it can't be undone and the rider can't return, and changes nothing", async () => {
		await seedTarget();
		const res = await confirmPage(TARGET);
		expect(res.status).toBe(200);
		const text = await res.text();
		expect(text).toContain("Synthetica");
		expect(text).toContain(escapeHtml(de["admin.remove.explain"]));
		expect(text).toContain(`<form method="post" action="${PATH(TARGET)}">`);
		expect(await rowsNaming(TARGET)).toHaveProperty(["riders.athlete_id"]);
		expect(fake.revocations).toEqual([]);
	});

	it("refuses oneself, pointing to the normal way of leaving", async () => {
		const res = await confirmPage(ADMIN);
		expect(res.headers.get("Location")).toBe("/admin/riders?error=self");
		const page = await handleFetch(
			request("/admin/riders?error=self", {
				cookies: await sessionCookie(ctx, ADMIN),
			}),
			ctx,
		);
		expect(await page.text()).toContain('<a href="/me/disconnect">');
	});

	it("refuses an unknown ID", async () => {
		const res = await confirmPage(123456);
		expect(res.headers.get("Location")).toBe("/admin/riders?error=unknown");
	});

	it("refuses a rider the overview doesn't list", async () => {
		await seedRider(ctx, { athleteId: TARGET, consentVersion: null });
		const res = await confirmPage(TARGET);
		expect(res.headers.get("Location")).toBe("/admin/riders?error=unknown");
	});
});

describe("the removal (scenario 2, FR-022 to FR-024, SC-005)", () => {
	it("revokes and deletes everything but the block list entry", async () => {
		await seedTarget();
		await seedUsageDay("2026-10-06", "strava_read_daily", 5, 100);
		const usage = await env.DB.prepare("SELECT * FROM usage_daily").all();
		const res = await remove(TARGET);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/admin/riders?done=removed");
		expect(fake.revocations).toHaveLength(1);
		expect(await rowsNaming(TARGET)).toEqual({
			"blocked_athletes.athlete_id": 1,
		});
		expect(
			(await env.DB.prepare("SELECT * FROM blocked_athletes").all()).results,
		).toEqual([{ athlete_id: TARGET }]);
		expect(
			(await env.DB.prepare("SELECT * FROM usage_daily").all()).results,
		).toEqual(usage.results);
		// Others are unchanged.
		expect(await rowsNaming(BYSTANDER)).toMatchObject({
			"riders.athlete_id": 1,
			"consent_records.athlete_id": 1,
		});
	});

	it("records the time and administrator only (FR-023)", async () => {
		await seedTarget();
		await remove(TARGET);
		expect(
			(await env.DB.prepare("SELECT * FROM removal_log").all()).results,
		).toEqual([
			{ id: expect.any(Number), removed_at: NOW, administrator_id: ADMIN },
		]);
	});

	it("clears the record's administrator when they leave", async () => {
		await seedTarget();
		await remove(TARGET);
		await env.DB.prepare("DELETE FROM riders WHERE athlete_id = ?")
			.bind(ADMIN)
			.run();
		expect(
			await env.DB.prepare("SELECT administrator_id FROM removal_log").first(
				"administrator_id",
			),
		).toBeNull();
	});

	it("retries a transient revoke once", async () => {
		await seedTarget();
		fake.failNext("revoke", { status: 503 });
		const res = await remove(TARGET);
		expect(res.headers.get("Location")).toBe("/admin/riders?done=removed");
		expect(fake.callsTo("revoke")).toHaveLength(2);
	});

	it("deletes regardless, and says so, when the revoke keeps failing", async () => {
		await seedTarget();
		fake.failNext("revoke", { status: 503 });
		fake.failNext("revoke", { status: 503 });
		const res = await remove(TARGET);
		expect(res.headers.get("Location")).toBe(
			"/admin/riders?done=removed-revoke-failed",
		);
		expect(await rowsNaming(TARGET)).toEqual({
			"blocked_athletes.athlete_id": 1,
		});
	});

	it("gives the removed rider's session the visitor's page (scenario 3)", async () => {
		await seedTarget();
		const cookies = await sessionCookie(ctx, TARGET);
		await remove(TARGET);
		const res = await handleFetch(request("/me", { cookies }), ctx);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
	});

	it("refuses an unknown ID, with nothing changed (scenario 4)", async () => {
		const res = await remove(123456);
		expect(res.headers.get("Location")).toBe("/admin/riders?error=unknown");
		expect(
			(await env.DB.prepare("SELECT * FROM blocked_athletes").all()).results,
		).toEqual([]);
		expect(
			(await env.DB.prepare("SELECT * FROM removal_log").all()).results,
		).toEqual([]);
		expect(fake.revocations).toEqual([]);
	});

	it("refuses an unlisted rider, with nothing changed", async () => {
		fake.addAthlete({ id: TARGET });
		await seedRider(ctx, { athleteId: TARGET, consentVersion: null });
		const res = await remove(TARGET);
		expect(res.headers.get("Location")).toBe("/admin/riders?error=unknown");
		expect(await rowsNaming(TARGET)).toHaveProperty(["riders.athlete_id"]);
		expect(fake.revocations).toEqual([]);
	});

	it("refuses oneself, with nothing changed (scenario 5)", async () => {
		const res = await remove(ADMIN);
		expect(res.headers.get("Location")).toBe("/admin/riders?error=self");
		expect(await rowsNaming(ADMIN)).toHaveProperty(["riders.athlete_id"]);
		expect(fake.revocations).toEqual([]);
	});

	it("removes a rider who hasn't agreed to the current version yet", async () => {
		fake.addAthlete({ id: TARGET });
		await seedRider(ctx, { athleteId: TARGET, consentVersion: 1 });
		expect((await remove(TARGET)).headers.get("Location")).toBe(
			"/admin/riders?done=removed",
		);
	});

	it("lets one administrator remove another", async () => {
		fake.addAthlete({ id: TARGET });
		await seedRider(ctx, { athleteId: TARGET, administrator: true });
		expect((await remove(TARGET)).headers.get("Location")).toBe(
			"/admin/riders?done=removed",
		);
	});
});

describe("after a removal", () => {
	it("connecting is refused, keeping nothing else (scenario 6, SC-008)", async () => {
		await seedTarget();
		await remove(TARGET);
		fake.revocations.length = 0;
		const res = await approve(ctx, fake, TARGET);
		expect(res.headers.get("Location")).toBe("/notice/blocked");
		expect(fake.revocations).toHaveLength(1);
		expect(await rowsNaming(TARGET)).toEqual({
			"blocked_athletes.athlete_id": 1,
		});
	});

	it("the notice says they can't take part", async () => {
		const res = await handleFetch(request("/notice/blocked"), ctx);
		expect(res.status).toBe(200);
		expect(await res.text()).toContain(escapeHtml(de["notice.blocked.body"]));
	});
});

describe("leaving by oneself (FR-024)", () => {
	it("doesn't block, and the rider can return", async () => {
		await seedTarget();
		const res = await handleFetch(
			request("/me/disconnect", {
				form: {},
				cookies: await sessionCookie(ctx, TARGET),
			}),
			ctx,
		);
		expect(res.status).toBe(303);
		expect(
			(await env.DB.prepare("SELECT * FROM blocked_athletes").all()).results,
		).toEqual([]);
		const back = await approve(ctx, fake, TARGET);
		expect(back.headers.get("Location")).toBe("/me");
	});

	it("a membership ending doesn't block either", async () => {
		await seedTarget();
		const { deleteRider } = await import("../../src/db/riders");
		await deleteRider(env.DB, TARGET);
		expect(
			(await env.DB.prepare("SELECT * FROM blocked_athletes").all()).results,
		).toEqual([]);
	});
});
