import { createScheduledController, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleScheduled } from "../../src/index";
import {
	type ActivityEventMessage,
	serializeWorkMessage,
} from "../../src/work/messages";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, NOW } from "../support/fixtures";

const DAY = 86400;

const RECENT: ActivityEventMessage = {
	kind: "activity-event",
	athleteId: ATHLETE_A,
	activityId: 7_300_001,
	aspect: "create",
	changed: [],
};
const STALE: ActivityEventMessage = { ...RECENT, activityId: 7_300_002 };

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => {
	vi.restoreAllMocks();
	fake.restore();
});

async function insertFailedWork(
	message: ActivityEventMessage,
	firstFailedAt: number,
	failedAt: number,
) {
	await env.DB.prepare(
		`INSERT INTO failed_work (athlete_id, message, last_error, first_failed_at,
			failed_at, failures) VALUES (?, ?, 'GET /activities/{id}: HTTP 503', ?, ?, 2)`,
	)
		.bind(
			message.athleteId,
			serializeWorkMessage(message),
			firstFailedAt,
			failedAt,
		)
		.run();
}

async function failedWorkMessages() {
	const { results } = await env.DB.prepare(
		"SELECT message FROM failed_work ORDER BY id",
	).all<{ message: string }>();
	return results.map((r) => r.message);
}

describe("scheduled: failed_work", () => {
	it("re-enqueues failures younger than 7 days and gives up older ones", async () => {
		await seedRider(ctx);
		await insertFailedWork(RECENT, NOW - DAY, NOW - DAY);
		// Failed again yesterday, but first failed 8 days ago: the first failure
		// counts (R7).
		await insertFailedWork(STALE, NOW - 8 * DAY, NOW - DAY);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await handleScheduled(
			createScheduledController({
				scheduledTime: new Date(NOW * 1000),
				cron: "17 3 * * *",
			}),
			ctx,
		);

		// The daily membership fan-out (US3) queues other kinds; only the
		// re-enqueued failures matter here.
		const requeued = ctx.queue.sent.filter(
			(m) => m.body.kind === "activity-event",
		);
		expect(requeued.map((m) => m.body)).toEqual([RECENT]);
		expect(await failedWorkMessages()).toEqual([serializeWorkMessage(RECENT)]);

		const givingUp = error.mock.calls.filter(([line]) =>
			/giving up/i.test(String(line)),
		);
		expect(givingUp).toHaveLength(1);
		expect(String(givingUp[0]?.[0])).toContain(String(ATHLETE_A));
		expect(fake.calls).toEqual([]);
	});

	it("does nothing without failed work", async () => {
		await handleScheduled(createScheduledController(), ctx);
		expect(ctx.queue.sent).toEqual([]);
		expect(fake.calls).toEqual([]);
	});
});
