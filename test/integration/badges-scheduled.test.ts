import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { handleQueue } from "../../src/index";
import { fanOutEvaluations } from "../../src/work/scheduled";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";
import { pushEndpoint, seedSubscription } from "../support/push";
import { activityRecord } from "../support/rynke";

// Riders stored before the badge catalog get their badges once, silently,
// through the daily cron (feature 013 FR-012, FR-031, research R18).

let fake: FakeStrava;
let ctx: TestCtx;

const sent = (kind: string) =>
	ctx.queue.sent.map((m) => m.body).filter((b) => b.kind === kind);

async function deliver(body: unknown) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
	for (const day of [1, 2, 3]) {
		await upsertActivity(
			env.DB,
			activityRecord(day, { start_date: `2026-05-0${day}T08:00:00Z` }),
		);
	}
});

afterEach(() => fake.restore());

describe("the badge catalog's cron evaluation", () => {
	it("evaluates riders on an older catalog once, silently", async () => {
		// Both evaluated; then A as stored before badges existed.
		await deliver({ kind: "evaluate-rider", athleteId: ATHLETE_A });
		await deliver({ kind: "evaluate-rider", athleteId: ATHLETE_B });
		await env.DB.batch([
			env.DB.prepare("DELETE FROM rider_badges"),
			env.DB.prepare("DELETE FROM badge_rises"),
			env.DB.prepare(
				"UPDATE riders SET badges_version = 0 WHERE athlete_id = ?",
			).bind(ATHLETE_A),
		]);
		await seedSubscription(ATHLETE_A, pushEndpoint(1));
		ctx.queue.sent.length = 0;

		await fanOutEvaluations(ctx);
		expect(sent("evaluate-rider")).toEqual([
			{ kind: "evaluate-rider", athleteId: ATHLETE_A },
		]);

		ctx.queue.sent.length = 0;
		expect(
			(await deliver({ kind: "evaluate-rider", athleteId: ATHLETE_A }))
				.explicitAcks,
		).toEqual(["m1"]);
		const { results } = await env.DB.prepare(
			`SELECT b.badge_id FROM rider_badges b JOIN badge_reveals r
				USING (athlete_id, badge_id, earned_on)
			WHERE b.athlete_id = ?`,
		)
			.bind(ATHLETE_A)
			.all();
		expect(results.map((r) => r.badge_id)).toContain("distance-100");
		expect(
			await env.DB.prepare("SELECT count(*) AS n FROM badge_rises").first("n"),
		).toBe(0);
		expect(sent("send-notification")).toEqual([]);

		ctx.queue.sent.length = 0;
		await fanOutEvaluations(ctx);
		expect(sent("evaluate-rider")).toEqual([]);
	});
});
