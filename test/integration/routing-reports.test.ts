import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleFetch, handleQueue } from "../../src/index";
import { MAX_ATTEMPTS } from "../../src/work/handler";
import type { WorkMessage } from "../../src/work/messages";
import { handleScheduled } from "../../src/work/scheduled";
import { approve } from "../support/callback";
import {
	listGuest,
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
	withGateway,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	ATHLETE_C,
	NOW,
	TEAM_CLUB,
} from "../support/fixtures";

// Feature 046 contracts/team-side.md › Reports and Full list: a team tells the
// gateway when it stores or deletes a person, and sends everyone it holds once
// a day (FR-004 to FR-006).

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = withGateway(makeCtx());
});

afterEach(() => {
	vi.restoreAllMocks();
	fake.restore();
});

const reportsQueued = () =>
	ctx.queue.sent
		.map((m) => m.body)
		.filter((b) => b.kind === "report-hold")
		.map((b) => b.athleteId);

async function deliver(body: WorkMessage, attempts = 1) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts, body },
	]);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

describe("reports are queued", () => {
	it("when a new rider is stored", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [TEAM_CLUB.id] });
		await approve(ctx, fake, ATHLETE_A);
		expect(reportsQueued()).toEqual([ATHLETE_A]);
	});

	it("when a new guest is stored", async () => {
		await listGuest(ctx, ATHLETE_A);
		fake.addAthlete({ id: ATHLETE_A, clubs: [] });
		await approve(ctx, fake, ATHLETE_A);
		expect(reportsQueued()).toEqual([ATHLETE_A]);
	});

	it("when a sign-in that is refused deletes the rider", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		fake.addAthlete({ id: ATHLETE_A, clubs: [] });
		await approve(ctx, fake, ATHLETE_A);
		expect(reportsQueued()).toEqual([ATHLETE_A]);
	});

	it("when a rider leaves", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await handleFetch(
			request("/me/disconnect", {
				method: "POST",
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(reportsQueued()).toEqual([ATHLETE_A]);
	});

	it("when an administrator removes a rider", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A, administrator: true });
		await seedRider(ctx, { athleteId: ATHLETE_B });
		await handleFetch(
			request(`/admin/riders/${ATHLETE_B}/remove`, {
				form: {},
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(reportsQueued()).toEqual([ATHLETE_B]);
	});

	it("when another team has the rider let go", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await handleFetch(
			new Request(`https://rynke.test/strava/let-go/test-verify-token`, {
				method: "POST",
				body: `{"athleteId":${ATHLETE_A}}`,
			}),
			ctx,
		);
		expect(reportsQueued()).toEqual([ATHLETE_A]);
	});

	it("when a rider is deleted", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await deliver({
			kind: "delete-rider",
			athleteId: ATHLETE_A,
			reason: "left-club",
			revoke: true,
		});
		expect(reportsQueued()).toEqual([ATHLETE_A]);
	});

	it("never without a gateway", async () => {
		ctx = makeCtx();
		fake.addAthlete({ id: ATHLETE_A, clubs: [TEAM_CLUB.id] });
		await approve(ctx, fake, ATHLETE_A);
		await handleFetch(
			request("/me/disconnect", {
				method: "POST",
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(reportsQueued()).toEqual([]);
	});

	it("without holding up the sign-in when queueing fails", async () => {
		fake.addAthlete({ id: ATHLETE_A, clubs: [TEAM_CLUB.id] });
		const send = ctx.queue.send.bind(ctx.queue);
		ctx.queue.send = async (body, options) => {
			if (body.kind === "report-hold") throw new Error("queue down");
			return send(body, options);
		};
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(res.status).toBe(302);
	});
});

describe("a queued report", () => {
	it("sends whether the team holds the person now", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, { athleteId: ATHLETE_C, guest: true });
		await deliver({ kind: "report-hold", athleteId: ATHLETE_A });
		await deliver({ kind: "report-hold", athleteId: ATHLETE_B });
		await deliver({ kind: "report-hold", athleteId: ATHLETE_C });
		expect(fake.routing.reports).toEqual([
			{ team: "hamburg", athleteId: ATHLETE_A, held: true },
			{ team: "hamburg", athleteId: ATHLETE_B, held: false },
			{ team: "hamburg", athleteId: ATHLETE_C, held: true },
		]);
	});

	it("is done when the gateway takes no reports (404)", async () => {
		fake.routing.status = 404;
		const result = await deliver({ kind: "report-hold", athleteId: ATHLETE_A });
		expect(result.explicitAcks).toEqual(["m1"]);
		expect(result.retryMessages).toEqual([]);
	});

	it("is retried while the gateway fails, and dropped on the last attempt", async () => {
		fake.routing.status = 503;
		const first = await deliver({ kind: "report-hold", athleteId: ATHLETE_A });
		expect(first.retryMessages.map((m) => m.msgId)).toEqual(["m1"]);
		const last = await deliver(
			{ kind: "report-hold", athleteId: ATHLETE_A },
			MAX_ATTEMPTS,
		);
		expect(last.explicitAcks).toEqual(["m1"]);
		expect(last.retryMessages).toEqual([]);
		const { results } = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM failed_work",
		).all<{ n: number }>();
		expect(results[0]?.n).toBe(0);
	});
});

describe("the daily full list", () => {
	const daily = () =>
		handleScheduled({ cron: "17 3 * * *" } as ScheduledController, ctx);

	it("sends every person the team holds, whatever their state", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await seedRider(ctx, {
			athleteId: ATHLETE_B,
			status: "needs_reconnect",
		});
		await seedRider(ctx, { athleteId: ATHLETE_C, guest: true });
		await daily();
		expect(fake.routing.lists).toEqual([
			{ team: "hamburg", athleteIds: [ATHLETE_A, ATHLETE_B, ATHLETE_C].sort() },
		]);
	});

	it("is fine with a gateway that takes no lists (404)", async () => {
		fake.routing.status = 404;
		await expect(daily()).resolves.toBeUndefined();
	});

	it("fails the run when the gateway fails, after every other step", async () => {
		fake.routing.status = 503;
		await expect(daily()).rejects.toThrow();
	});

	it("isn't sent without a gateway", async () => {
		ctx = makeCtx();
		await seedRider(ctx, { athleteId: ATHLETE_A });
		await daily();
		expect(fake.routing.lists).toEqual([]);
	});
});
