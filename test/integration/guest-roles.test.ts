import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { getRider, listAlertRecipients } from "../../src/db/riders";
import { currentAlertStatement } from "../../src/db/usage";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";

// Feature 041 FR-004, research R4: a guest is an organiser and an
// administrator for as long as they are on the list; off it, every request is
// a visitor's. The stored flags stay the maintainer's.

const GUEST = ATHLETE_A;
const ctx = makeCtx();

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: GUEST, guest: true });
});

async function me() {
	return handleFetch(
		request("/me", { cookies: await sessionCookie(ctx, GUEST) }),
		ctx,
	);
}

describe("a guest's roles", () => {
	it("are organiser and administrator while the stored flags stay 0", async () => {
		expect(await getRider(env.DB, GUEST)).toMatchObject({
			organiser: true,
			administrator: true,
			onGuestList: true,
		});
		const row = await env.DB.prepare(
			"SELECT organiser, administrator FROM riders WHERE athlete_id = ?",
		)
			.bind(GUEST)
			.first();
		expect(row).toEqual({ organiser: 0, administrator: 0 });
	});

	it("end with the next request once the ID leaves the list", async () => {
		expect((await me()).status).toBe(200);
		await env.DB.prepare("DELETE FROM guests").run();
		const res = await me();
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe("/");
		// Deleted by the daily run, not by the request.
		expect(await getRider(env.DB, GUEST)).not.toBeNull();
	});
});

describe("a guest's usage alerts", () => {
	it("reach them like an administrator", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_B });
		expect(await listAlertRecipients(env.DB)).toEqual([GUEST]);
	});

	it("show on their pages", async () => {
		await env.DB.prepare(
			`INSERT INTO usage_alerts (allowance, period, level, fired_at)
			VALUES ('cf_worker_requests', '2026-10-06', 80, ?)`,
		)
			.bind(NOW)
			.run();
		const { results } = await currentAlertStatement(
			env.DB,
			GUEST,
			NOW - 3600,
			"2026-10-06",
		).all();
		expect(results).toHaveLength(1);
	});
});
