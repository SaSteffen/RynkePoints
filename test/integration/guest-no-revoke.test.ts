import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch, handleQueue } from "../../src/index";
import type { WorkMessage } from "../../src/work/messages";
import { approve, SCOPES_ALL } from "../support/callback";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B, NOW, OTHER_CLUB } from "../support/fixtures";

// Feature 041 US3, FR-009: Strava's grant belongs to the one app every team
// shares, so a team never revokes it where that could end the person's
// connection at another team: not for a guest, and not at any sign-in refusal.

const GUEST = ATHLETE_A;
const ADMIN = ATHLETE_B;

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => fake.restore());

async function deliver(body: WorkMessage) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

async function seedGuest() {
	fake.addAthlete({ id: GUEST, clubs: [OTHER_CLUB.id] });
	await seedRider(ctx, { athleteId: GUEST, guest: true });
}

describe("sign-in refusals revoke nothing", () => {
	it("for a blocked person", async () => {
		await env.DB.prepare("INSERT INTO blocked_athletes (athlete_id) VALUES (?)")
			.bind(GUEST)
			.run();
		await approve(ctx, fake, GUEST);
		expect(fake.revocations).toEqual([]);
	});

	it("for missing scopes", async () => {
		await approve(ctx, fake, GUEST, "read");
		expect(fake.revocations).toEqual([]);
	});

	it("for a new person without the current consent", async () => {
		await approve(ctx, fake, GUEST, SCOPES_ALL, {}, { consentVersion: 1 });
		expect(fake.revocations).toEqual([]);
	});

	it("for a new person not in the club", async () => {
		fake.addAthlete({ id: GUEST, clubs: [OTHER_CLUB.id] });
		const res = await approve(ctx, fake, GUEST);
		expect(res.headers.get("Location")).toBe("/notice/not-member");
		expect(fake.revocations).toEqual([]);
	});

	it("for an existing rider who left the club", async () => {
		await seedRider(ctx, { athleteId: GUEST });
		fake.addAthlete({ id: GUEST, clubs: [OTHER_CLUB.id] });
		const res = await approve(ctx, fake, GUEST);
		expect(res.headers.get("Location")).toBe("/notice/not-member-deleted");
		expect(fake.revocations).toEqual([]);
	});

	it("for a new person when the club check is inconclusive", async () => {
		fake.failNext("clubs", { status: 503 });
		const res = await approve(ctx, fake, GUEST);
		expect(res.headers.get("Location")).toBe("/notice/strava-busy");
		expect(fake.revocations).toEqual([]);
	});
});

describe("a guest's grant stays", () => {
	it("as the disconnect page tells them", async () => {
		await seedGuest();
		const page = await handleFetch(
			request("/me/disconnect", { cookies: await sessionCookie(ctx, GUEST) }),
			ctx,
		);
		const text = await page.text();
		expect(text).toContain(escapeHtml(CATALOGS.de["disconnect.explain.guest"]));
		expect(text).not.toContain(escapeHtml(CATALOGS.de["disconnect.explain"]));
	});

	it("when they disconnect", async () => {
		await seedGuest();
		const res = await handleFetch(
			request("/me/disconnect", {
				method: "POST",
				cookies: await sessionCookie(ctx, GUEST),
			}),
			ctx,
		);
		expect(res.status).toBe(303);
		expect(await getRider(env.DB, GUEST)).toBeNull();
		expect(fake.revocations).toEqual([]);
	});

	it("when an administrator removes them", async () => {
		await seedGuest();
		await seedRider(ctx, { athleteId: ADMIN, administrator: true });
		await handleFetch(
			request(`/admin/riders/${GUEST}/remove`, {
				form: {},
				cookies: await sessionCookie(ctx, ADMIN),
			}),
			ctx,
		);
		expect(await getRider(env.DB, GUEST)).toBeNull();
		expect(fake.revocations).toEqual([]);
	});

	it("when a deletion asks for a revoke", async () => {
		await seedGuest();
		await deliver({
			kind: "delete-rider",
			athleteId: GUEST,
			reason: "reconnect-expired",
			revoke: true,
		});
		expect(await getRider(env.DB, GUEST)).toBeNull();
		expect(fake.revocations).toEqual([]);
	});

	it("while a rider of the team still revokes on disconnect", async () => {
		fake.addAthlete({ id: ADMIN });
		await seedRider(ctx, { athleteId: ADMIN });
		await handleFetch(
			request("/me/disconnect", {
				method: "POST",
				cookies: await sessionCookie(ctx, ADMIN),
			}),
			ctx,
		);
		expect(fake.revocations).toHaveLength(1);
	});
});
