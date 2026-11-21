import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { handleFetch, handleQueue } from "../../src/index";
import { approve, SCOPES_ALL } from "../support/callback";
import {
	makeCtx,
	ORIGIN,
	request,
	resetDb,
	sessionCookie,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	LARGE_ACTIVITY,
	LARGE_ATHLETE,
	makeStravaActivity,
} from "../support/fixtures";

// Feature 042: after June 1, 2027 Strava's activity and athlete IDs may use
// the full 64-bit range. A rider and rides with IDs past 2^53 go through the
// whole app, from connecting to deletion, with every digit kept. The fake
// sends them as Strava does: JSON numbers, no `id_str`.

/** Differs from `LARGE_ACTIVITY` only past 2^53: a number would merge them. */
const NEIGHBOUR = "9007199254740992";

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => fake.restore());

/** Runs the queued work until none is left. */
async function drain(): Promise<void> {
	for (let round = 0; ctx.queue.sent.length > 0; round++) {
		if (round > 20) throw new Error("the work never settles");
		const messages = ctx.queue.sent.splice(0);
		const batch = createMessageBatch(
			"rynke-points-work",
			messages.map((m, i) => ({
				id: `m${round}-${i}`,
				timestamp: new Date(ctx.now() * 1000),
				attempts: 1,
				body: m.body,
			})),
		);
		await handleQueue(batch, ctx);
		await getQueueResult(batch, createExecutionContext());
	}
}

async function storedActivityIds(): Promise<string[]> {
	const { results } = await env.DB.prepare(
		`SELECT CAST(strava_activity_id AS TEXT) AS id FROM activities
		ORDER BY activities.strava_activity_id`,
	).all<{ id: string }>();
	return results.map((r) => r.id);
}

describe("a rider and rides with IDs past 2^53", () => {
	beforeEach(() => {
		fake.addAthlete({ id: LARGE_ATHLETE });
		for (const [id, start] of [
			[NEIGHBOUR, "2026-10-04T07:30:00Z"],
			[LARGE_ACTIVITY, "2026-10-05T07:30:00Z"],
		] as const) {
			fake.addActivity(
				LARGE_ATHLETE,
				makeStravaActivity({
					id,
					athlete: { id: LARGE_ATHLETE },
					start_date: start,
					start_date_local: start,
				}),
			);
		}
	});

	it("connects, imports, shows and deletes them exactly", async () => {
		const res = await approve(ctx, fake, LARGE_ATHLETE, SCOPES_ALL);
		expect(res.status).toBe(302);
		expect(
			res.headers.getSetCookie().find((c) => c.startsWith("rp_session=")),
		).toMatch(new RegExp(`^rp_session=${LARGE_ATHLETE}:`));
		expect(await getRider(env.DB, LARGE_ATHLETE)).toMatchObject({
			athleteId: LARGE_ATHLETE,
			status: "connected",
		});

		await drain();
		// Two rides, not one: their IDs differ only past 2^53.
		expect(await storedActivityIds()).toEqual([NEIGHBOUR, LARGE_ACTIVITY]);
		expect(await getRider(env.DB, LARGE_ATHLETE)).toMatchObject({
			importStatus: "done",
		});

		const cookies = await sessionCookie(ctx, LARGE_ATHLETE);
		const page = await handleFetch(request("/me/rides", { cookies }), ctx);
		expect(page.status).toBe(200);
		const html = await page.text();
		expect(html).toContain(`www.strava.com/activities/${LARGE_ACTIVITY}"`);
		expect(html).toContain(`www.strava.com/activities/${NEIGHBOUR}"`);

		const gone = await handleFetch(
			request("/me/disconnect", { method: "POST", cookies }),
			ctx,
		);
		expect(gone.status).toBeLessThan(400);
		await drain();
		expect(await tableCounts()).toMatchObject({
			riders: 0,
			strava_credentials: 0,
			activities: 0,
		});
	});

	it("follows a webhook delete of one of the two rides", async () => {
		await approve(ctx, fake, LARGE_ATHLETE, SCOPES_ALL);
		await drain();
		fake.activities.delete(LARGE_ACTIVITY);
		const res = await handleFetch(
			new Request(`${ORIGIN}/strava/webhook/test-verify-token`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				// As Strava sends it: numbers with every digit.
				body: `{"object_type":"activity","object_id":${LARGE_ACTIVITY},"aspect_type":"delete","updates":{},"owner_id":${LARGE_ATHLETE},"subscription_id":777,"event_time":${ctx.now()}}`,
			}),
			ctx,
		);
		expect(res.status).toBe(200);
		await drain();
		expect(await storedActivityIds()).toEqual([NEIGHBOUR]);
	});
});
