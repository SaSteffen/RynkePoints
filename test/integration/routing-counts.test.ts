import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleFetch, handleQueue } from "../../src/index";
import { exchangeRoutingCounts } from "../../src/routing/report";
import { evaluateChange } from "../../src/rynke/apply";
import { toActivityRecord } from "../../src/strava/activity";
import { processBatch } from "../../src/work/consumer";
import type { WorkMessage } from "../../src/work/messages";
import { recheckRider } from "../../src/work/recheck-rider";
import { handleScheduled } from "../../src/work/scheduled";
import {
	makeCtx,
	resetDb,
	seedRider,
	type TestCtx,
	withGateway,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";

// Feature 046 contracts/team-side.md › Event counts, Re-check finds, Exchange:
// what a team counts itself and how the gateway's figures reach it.

const TODAY = new Date(NOW * 1000).toISOString().slice(0, 10);

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

async function rows(): Promise<Record<string, number>> {
	const { results } = await env.DB.prepare(
		"SELECT day, team, figure, count FROM routing_daily ORDER BY team, figure",
	).all<{ day: string; team: string; figure: string; count: number }>();
	return Object.fromEntries(
		results.map((r) => [
			`${r.day} ${r.team || "gateway"} ${r.figure}`,
			r.count,
		]),
	);
}

function webhook(body: object, route?: string) {
	return handleFetch(
		new Request("https://rynke.test/strava/webhook/test-verify-token", {
			method: "POST",
			headers: route ? { "X-Rynke-Route": route } : {},
			body: JSON.stringify(body),
		}),
		ctx,
	);
}

const EVENT = {
	object_type: "activity",
	object_id: 800001,
	aspect_type: "delete",
	owner_id: Number(ATHLETE_A),
	subscription_id: 777,
	event_time: 1_790_000_000,
	updates: {},
};

async function deliver(body: WorkMessage, attempts = 1) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts, body },
	]);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

const deleted = (route?: "plain" | "chosen" | "not-chosen"): WorkMessage => ({
	kind: "activity-event",
	athleteId: ATHLETE_A,
	activityId: "800001",
	aspect: "delete",
	changed: [],
	...(route ? { route } : {}),
});

describe("the webhook", () => {
	it("passes the trial's mark on, and plain without one", async () => {
		await webhook(EVENT, "chosen");
		await webhook(EVENT, "not-chosen");
		await webhook(EVENT);
		await webhook(EVENT, "something");
		expect(ctx.queue.sent.map((m) => m.body)).toEqual(
			["chosen", "not-chosen", "plain", "plain"].map((route) => ({
				kind: "activity-event",
				athleteId: ATHLETE_A,
				activityId: "800001",
				aspect: "delete",
				changed: [],
				route,
			})),
		);
	});
});

describe("the consumer's counts", () => {
	it("counts a dropped event, and a wasted one when it came chosen", async () => {
		await deliver(deleted("plain"));
		await deliver(deleted("chosen"));
		expect(await rows()).toEqual({
			[`${TODAY} hamburg dropped`]: 2,
			[`${TODAY} hamburg wasted`]: 1,
		});
	});

	it("counts a would-be miss and still processes the event", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [
				toActivityRecord(
					makeStravaActivity({ id: "800001" }),
					ATHLETE_A,
					NOW,
				) ?? [],
			].flat(),
		});
		const result = await deliver(deleted("not-chosen"));
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(await rows()).toEqual({ [`${TODAY} hamburg missed`]: 1 });
		const left = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM activities WHERE strava_activity_id = '800001'",
		).first<number>("n");
		expect(left).toBe(0);
	});

	it("counts nothing for a held rider's chosen or plain event", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await deliver(deleted("chosen"));
		await deliver(deleted("plain"));
		expect(await rows()).toEqual({});
	});

	it("counts only the first delivery, and no message from the app itself", async () => {
		await deliver(deleted("chosen"), 2);
		await deliver(deleted());
		await deliver({
			kind: "delete-rider",
			athleteId: ATHLETE_B,
			reason: "left-club",
			revoke: true,
		});
		expect(await rows()).toEqual({});
	});

	it("counts a deauthorization like any event", async () => {
		await deliver({
			kind: "delete-rider",
			athleteId: ATHLETE_B,
			reason: "deauthorized",
			revoke: false,
			route: "chosen",
		});
		expect(await rows()).toEqual({
			[`${TODAY} hamburg dropped`]: 1,
			[`${TODAY} hamburg wasted`]: 1,
		});
	});
});

describe("the ride re-check", () => {
	it("counts what it stores that no event brought", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { athleteId: ATHLETE_A });
		const known = makeStravaActivity({
			id: "700001",
			start_date: "2026-10-04T07:30:00Z",
		});
		fake.addActivity(ATHLETE_A, known);
		await evaluateChange(ctx, ATHLETE_A, {
			kind: "upsert",
			records: [toActivityRecord(known, ATHLETE_A, NOW - 3600) ?? []].flat(),
		});
		fake.addActivity(
			ATHLETE_A,
			makeStravaActivity({ id: "700002", start_date: "2026-10-05T07:30:00Z" }),
		);
		const batch = createMessageBatch("rynke-points-work", [
			{
				id: "m1",
				timestamp: new Date(NOW * 1000),
				attempts: 1,
				body: {
					kind: "recheck-rider",
					athleteId: ATHLETE_A,
					stamp: NOW - 600,
					previous: null,
				},
			},
		]);
		await processBatch(batch, ctx, { "recheck-rider": recheckRider });
		expect(await rows()).toEqual({ [`${TODAY} hamburg found`]: 1 });
	});
});

describe("the exchange", () => {
	it("hands this team's counts over and stores everything else it gets", async () => {
		ctx = withGateway(ctx);
		await deliver(deleted("chosen"));
		fake.routing.counts = [
			{ day: TODAY, team: "", figure: "copy", count: 5 },
			{ day: TODAY, team: "hamburg", figure: "added", count: 2 },
			// This team's own: what is counted here wins.
			{ day: TODAY, team: "hamburg", figure: "dropped", count: 99 },
			{ day: TODAY, team: "europe", figure: "missed", count: 1 },
		];
		await exchangeRoutingCounts(ctx);
		expect(fake.routing.exchanges).toEqual([
			{
				team: "hamburg",
				days: [
					{ day: TODAY, figure: "dropped", count: 1 },
					{ day: TODAY, figure: "wasted", count: 1 },
				],
			},
		]);
		expect(await rows()).toEqual({
			[`${TODAY} gateway copy`]: 5,
			[`${TODAY} europe missed`]: 1,
			[`${TODAY} hamburg added`]: 2,
			[`${TODAY} hamburg dropped`]: 1,
			[`${TODAY} hamburg wasted`]: 1,
		});
	});

	it("keeps what is stored when the answer is wrong or missing", async () => {
		ctx = withGateway(ctx);
		await deliver(deleted("plain"));
		fake.routing.counts = [{ day: TODAY, team: "", figure: "nope", count: 1 }];
		await exchangeRoutingCounts(ctx);
		fake.routing.status = 503;
		await exchangeRoutingCounts(ctx);
		expect(await rows()).toEqual({ [`${TODAY} hamburg dropped`]: 1 });
	});

	it("runs with the hourly recording, and not without a gateway", async () => {
		await handleScheduled({ cron: "58 * * * *" } as ScheduledController, ctx);
		expect(fake.routing.exchanges).toEqual([]);
		ctx = withGateway(ctx);
		await handleScheduled({ cron: "58 * * * *" } as ScheduledController, ctx);
		expect(fake.routing.exchanges).toHaveLength(1);
	});
});
