import {
	createExecutionContext,
	createMessageBatch,
	createScheduledController,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { handleQueue, handleScheduled } from "../../src/index";
import type { WorkMessage } from "../../src/work/messages";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";

// Feature 041 FR-004, FR-006, research R6: the daily run never checks a
// guest's club, and deletes a guest the maintainer took off the list, without
// revoking their grant.

const RIDER = ATHLETE_A;
const GUEST = ATHLETE_B;
const FORMER_GUEST = ATHLETE_C;

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	await seedRider(ctx, { athleteId: RIDER });
	await seedRider(ctx, { athleteId: GUEST, guest: true });
	await seedRider(ctx, {
		athleteId: FORMER_GUEST,
		guest: true,
		onGuestList: false,
	});
	for (const id of [RIDER, GUEST, FORMER_GUEST]) fake.addAthlete({ id });
});

afterEach(() => fake.restore());

async function daily() {
	await handleScheduled(
		createScheduledController({
			scheduledTime: new Date(NOW * 1000),
			cron: "17 3 * * *",
		}),
		ctx,
	);
}

function sent(kind: WorkMessage["kind"]) {
	return ctx.queue.sent.map((m) => m.body).filter((b) => b.kind === kind);
}

describe("the daily run and guests", () => {
	it("checks the club of the team's riders only", async () => {
		await daily();
		expect(sent("check-membership")).toEqual([
			{ kind: "check-membership", athleteId: RIDER },
		]);
	});

	it("deletes a guest taken off the list, withdrawing unless held elsewhere", async () => {
		await daily();
		expect(sent("delete-rider")).toEqual([
			{
				kind: "delete-rider",
				athleteId: FORMER_GUEST,
				reason: "guest-removed",
				revoke: true,
			},
		]);
	});

	it("leaves the grant when the deletion runs", async () => {
		const batch = createMessageBatch("rynke-points-work", [
			{
				id: "m1",
				timestamp: new Date(NOW * 1000),
				attempts: 1,
				body: {
					kind: "delete-rider",
					athleteId: FORMER_GUEST,
					reason: "guest-removed",
					revoke: false,
				},
			},
		]);
		await handleQueue(batch, ctx);
		await getQueueResult(batch, createExecutionContext());
		expect(await getRider(env.DB, FORMER_GUEST)).toBeNull();
		expect(await getRider(env.DB, GUEST)).not.toBeNull();
		expect(fake.revocations).toEqual([]);
	});
});
