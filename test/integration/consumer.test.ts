import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { upsertFailedWork } from "../../src/db/failed-work";
import { getRider } from "../../src/db/riders";
import { backoffSeconds } from "../../src/strava/rate-limit";
import {
	type HandlerResult,
	type Handlers,
	MAX_ATTEMPTS,
	processBatch,
} from "../../src/work/consumer";
import {
	serializeWorkMessage,
	type WorkMessage,
} from "../../src/work/messages";
import {
	makeCtx,
	resetDb,
	seedRider,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, NOW } from "../support/fixtures";

const CHECK: WorkMessage = { kind: "check-membership", athleteId: ATHLETE_A };
const DELETE: WorkMessage = {
	kind: "delete-rider",
	athleteId: ATHLETE_A,
	reason: "left-club",
	revoke: true,
};

async function run(
	body: unknown,
	result: HandlerResult | (() => Promise<HandlerResult>),
	attempts = 1,
	ctx: TestCtx = makeCtx(),
) {
	const handler = vi.fn(
		typeof result === "function" ? result : async () => result,
	);
	const handlers: Handlers = {
		"check-membership": handler,
		"delete-rider": handler,
	};
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts, body },
	]);
	// The pool's getQueueResult drops retry options, so spy for delaySeconds.
	const [message] = batch.messages;
	const retry = message ? vi.spyOn(message, "retry") : vi.fn();
	await processBatch(batch, ctx, handlers);
	const queueResult = await getQueueResult(batch, createExecutionContext());
	return { ctx, handler, queueResult, retry };
}

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

describe("processBatch", () => {
	it("acks and drops an invalid body", async () => {
		const { handler, queueResult } = await run(
			{ kind: "poll" },
			{ kind: "ok" },
		);
		expect(handler).not.toHaveBeenCalled();
		expect(queueResult.explicitAcks).toEqual(["m1"]);
	});

	it("acks and drops work for an unknown rider", async () => {
		const { handler, queueResult } = await run(CHECK, { kind: "ok" });
		expect(handler).not.toHaveBeenCalled();
		expect(queueResult.explicitAcks).toEqual(["m1"]);
	});

	it("drops everything but delete-rider for a needs_reconnect rider", async () => {
		await seedRider(makeCtx(), { status: "needs_reconnect" });
		const dropped = await run(CHECK, { kind: "ok" });
		expect(dropped.handler).not.toHaveBeenCalled();
		expect(dropped.queueResult.explicitAcks).toEqual(["m1"]);

		const deleted = await run(DELETE, { kind: "ok" });
		expect(deleted.handler).toHaveBeenCalledOnce();
		expect(deleted.queueResult.explicitAcks).toEqual(["m1"]);
	});

	it("passes the message, rider and attempt info to the handler", async () => {
		await seedRider(makeCtx());
		const { handler } = await run(CHECK, { kind: "ok" }, 3);
		expect(handler).toHaveBeenCalledWith(
			CHECK,
			expect.objectContaining({ athleteId: ATHLETE_A, status: "connected" }),
			expect.anything(),
			{ attempts: 3, isLastAttempt: false },
		);
	});

	it.each([1, MAX_ATTEMPTS])(
		"defers on budget by re-sending and acking (attempt %i)",
		async (attempts) => {
			await seedRider(makeCtx());
			const { ctx, queueResult } = await run(
				CHECK,
				{ kind: "budget", delaySeconds: 50_000 },
				attempts,
			);
			expect(ctx.queue.sent).toEqual([{ body: CHECK, delaySeconds: 43200 }]);
			expect(queueResult.explicitAcks).toEqual(["m1"]);
			expect(queueResult.retryMessages).toEqual([]);
			expect((await tableCounts()).failed_work).toBe(0);
		},
	);

	it("retries transient errors with backoff", async () => {
		await seedRider(makeCtx());
		const { queueResult, retry } = await run(
			CHECK,
			{ kind: "transient", reason: "HTTP 503" },
			3,
		);
		expect(queueResult.retryMessages).toEqual([{ msgId: "m1" }]);
		expect(retry).toHaveBeenCalledWith({ delaySeconds: backoffSeconds(3) });
		expect(queueResult.explicitAcks).toEqual([]);
	});

	it("treats a thrown error as transient", async () => {
		await seedRider(makeCtx());
		const { queueResult, retry } = await run(
			CHECK,
			async () => {
				throw new Error("D1 hiccup");
			},
			2,
		);
		expect(queueResult.retryMessages).toEqual([{ msgId: "m1" }]);
		expect(retry).toHaveBeenCalledWith({ delaySeconds: backoffSeconds(2) });
	});

	it("counts max_retries plus the first delivery as attempts", () => {
		expect(MAX_ATTEMPTS).toBe(11);
	});

	it("still retries on the attempt before the last", async () => {
		await seedRider(makeCtx());
		const { queueResult } = await run(
			CHECK,
			{ kind: "transient", reason: "HTTP 503" },
			MAX_ATTEMPTS - 1,
		);
		expect(queueResult.retryMessages).toEqual([{ msgId: "m1" }]);
		expect((await tableCounts()).failed_work).toBe(0);
	});

	it("records failed_work on the last transient attempt", async () => {
		await seedRider(makeCtx());
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const { queueResult } = await run(
			CHECK,
			{ kind: "transient", reason: "HTTP 503" },
			MAX_ATTEMPTS,
		);
		expect(queueResult.explicitAcks).toEqual(["m1"]);
		expect(queueResult.retryMessages).toEqual([]);
		const rows = await env.DB.prepare("SELECT * FROM failed_work").all();
		expect(rows.results).toEqual([
			expect.objectContaining({
				athlete_id: ATHLETE_A,
				message: serializeWorkMessage(CHECK),
				last_error: "HTTP 503",
				first_failed_at: NOW,
				failures: 1,
			}),
		]);
		expect(log).toHaveBeenCalledOnce();
		expect(String(log.mock.calls[0]?.[0])).toMatch(/failed_work/);
		expect(String(log.mock.calls[0]?.[0])).not.toMatch(/access-|refresh-/);
	});

	it("stores only the error name when a handler throws", async () => {
		await seedRider(makeCtx());
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		await run(
			CHECK,
			async () => {
				throw new TypeError("secret-looking detail access-900001-0");
			},
			MAX_ATTEMPTS,
		);
		const row = await env.DB.prepare(
			"SELECT last_error FROM failed_work",
		).first();
		expect(row).toEqual({ last_error: "exception: TypeError" });
		expect(JSON.stringify(log.mock.calls)).not.toContain("access-900001-0");
	});

	it("deletes the rider when delete-rider runs out of retries", async () => {
		await seedRider(makeCtx());
		vi.spyOn(console, "error").mockImplementation(() => {});
		const { queueResult } = await run(
			DELETE,
			async () => {
				throw new Error("revoke blew up");
			},
			MAX_ATTEMPTS,
		);
		expect(queueResult.explicitAcks).toEqual(["m1"]);
		expect(await getRider(env.DB, ATHLETE_A)).toBeNull();
		expect((await tableCounts()).failed_work).toBe(0);
	});

	it.each<HandlerResult>([
		{ kind: "refresh-refused" },
		{ kind: "budget", delaySeconds: 600 },
	])("never stops or defers delete-rider ($kind)", async (result) => {
		await seedRider(makeCtx());
		const { ctx, queueResult, retry } = await run(DELETE, result, 2);
		expect(retry).toHaveBeenCalledWith({ delaySeconds: backoffSeconds(2) });
		expect(queueResult.explicitAcks).toEqual([]);
		expect(ctx.queue.sent).toEqual([]);
		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			status: "connected",
		});
	});

	it("records failed_work when the budget re-send fails on the last attempt", async () => {
		await seedRider(makeCtx());
		vi.spyOn(console, "error").mockImplementation(() => {});
		const ctx = makeCtx();
		ctx.queue.send = async () => {
			throw new Error("queue unavailable");
		};
		const { queueResult } = await run(
			CHECK,
			{ kind: "budget", delaySeconds: 600 },
			MAX_ATTEMPTS,
			ctx,
		);
		expect(queueResult.explicitAcks).toEqual(["m1"]);
		expect(
			await env.DB.prepare("SELECT last_error FROM failed_work").first(),
		).toEqual({ last_error: "re-send failed" });
	});

	it("retries the original when the budget re-send fails", async () => {
		await seedRider(makeCtx());
		const ctx = makeCtx();
		ctx.queue.send = async () => {
			throw new Error("queue unavailable");
		};
		const { queueResult, retry } = await run(
			CHECK,
			{ kind: "budget", delaySeconds: 600 },
			3,
			ctx,
		);
		expect(queueResult.explicitAcks).toEqual([]);
		expect(retry).toHaveBeenCalledWith({ delaySeconds: backoffSeconds(3) });
	});

	it("retries one message on a D1 error and goes on with the batch", async () => {
		await seedRider(makeCtx());
		vi.spyOn(console, "error").mockImplementation(() => {});
		const ctx = makeCtx();
		const db = ctx.env.DB;
		ctx.env = {
			...ctx.env,
			DB: {
				...db,
				prepare(sql: string) {
					if (sql.includes("failed_work")) throw new Error("D1 unavailable");
					return db.prepare(sql);
				},
			} as D1Database,
		};
		const handler = vi.fn(async (): Promise<HandlerResult> => ({ kind: "ok" }));
		const batch = createMessageBatch("rynke-points-work", [
			{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 2, body: CHECK },
			{
				id: "m2",
				timestamp: new Date(NOW * 1000),
				attempts: 1,
				body: { kind: "check-membership", athleteId: ATHLETE_B },
			},
		]);
		await processBatch(batch, ctx, { "check-membership": handler });
		const result = await getQueueResult(batch, createExecutionContext());
		expect(result.retryMessages).toEqual([{ msgId: "m1" }]);
		expect(result.explicitAcks).toEqual(["m2"]);
	});

	it("clears a matching failed_work row on success", async () => {
		await seedRider(makeCtx());
		await upsertFailedWork(env.DB, {
			athleteId: ATHLETE_A,
			message: serializeWorkMessage(CHECK),
			lastError: "HTTP 503",
			now: NOW - 3600,
		});
		const { queueResult } = await run(
			{ athleteId: ATHLETE_A, kind: "check-membership" },
			{ kind: "ok" },
		);
		expect(queueResult.explicitAcks).toEqual(["m1"]);
		expect((await tableCounts()).failed_work).toBe(0);
	});

	it("marks the rider needs_reconnect when the refresh is refused", async () => {
		await seedRider(makeCtx());
		const { queueResult } = await run(CHECK, { kind: "refresh-refused" });
		expect(queueResult.explicitAcks).toEqual(["m1"]);
		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			status: "needs_reconnect",
			reconnectRequestedAt: NOW,
		});
	});
});
