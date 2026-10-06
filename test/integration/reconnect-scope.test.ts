import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seasonStartEpoch } from "../../src/config";
import { upsertActivity } from "../../src/db/activities";
import { getRider } from "../../src/db/riders";
import { toActivityRecord } from "../../src/strava/activity";
import { approve, SCOPES_ALL, SCOPES_SHARED } from "../support/callback";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";

// Reconnecting with a different choice of private activities (FR-007,
// data-model.md "Reconnect").

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	fake.addAthlete({ id: ATHLETE_A });
	ctx = makeCtx();
});

afterEach(() => fake.restore());

const PRIVATE_ID = 7_100_001;
const PUBLIC_ID = 7_100_002;

async function storeActivity(id: number, isPrivate: boolean) {
	const record = toActivityRecord(
		makeStravaActivity({ id, private: isPrivate }),
		ATHLETE_A,
		NOW,
	);
	if (!record) throw new Error("fixture is not a cycling activity");
	await upsertActivity(env.DB, record);
}

async function storedIds(): Promise<number[]> {
	const { results } = await env.DB.prepare(
		"SELECT strava_activity_id FROM activities ORDER BY strava_activity_id",
	).all<{ strava_activity_id: number }>();
	return results.map((r) => r.strava_activity_id);
}

describe("reconnect scope changes", () => {
	it("drops private activities when read_all is withdrawn", async () => {
		await seedRider(ctx, { scopeReadAll: true });
		await storeActivity(PRIVATE_ID, true);
		await storeActivity(PUBLIC_ID, false);

		const res = await approve(ctx, fake, ATHLETE_A, SCOPES_SHARED);

		expect(res.status).toBe(302);
		expect(await storedIds()).toEqual([PUBLIC_ID]);
		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			scopeReadAll: false,
			importStatus: "done",
		});
		expect(ctx.queue.sent).toEqual([]);
	});

	it("re-imports when read_all is newly granted", async () => {
		await seedRider(ctx, { scopeReadAll: false });

		await approve(ctx, fake, ATHLETE_A, SCOPES_ALL);

		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			scopeReadAll: true,
			importStatus: "pending",
		});
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{
				kind: "import-page",
				athleteId: ATHLETE_A,
				page: 1,
				after: seasonStartEpoch("2026-01-01"),
			},
		]);
	});

	it("changes nothing else when the scopes stay the same", async () => {
		await seedRider(ctx, { scopeReadAll: true });
		await storeActivity(PRIVATE_ID, true);

		await approve(ctx, fake, ATHLETE_A, SCOPES_ALL);

		expect(await storedIds()).toEqual([PRIVATE_ID]);
		expect(ctx.queue.sent).toEqual([]);
	});
});
