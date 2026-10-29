import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRider, getRider } from "../../src/db/riders";
import { backoffSeconds } from "../../src/strava/rate-limit";
import {
	type HandlerResult,
	type Handlers,
	processBatch,
} from "../../src/work/consumer";
import { DRAIN_LIMIT } from "../../src/work/drain";
import {
	type ActivityEventMessage,
	STRAVA_TURN,
} from "../../src/work/messages";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";

// Feature 024 US1: Strava work waits in a table, one list per rider, and riders
// take turns (contracts/queue-messages.md, research R1–R4).

let ctx: TestCtx;
let seq = 0;

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
	seq = 0;
	for (const athleteId of [ATHLETE_A, ATHLETE_B, ATHLETE_C]) {
		await seedRider(ctx, { athleteId });
	}
});

afterEach(() => vi.restoreAllMocks());

/** Rider letters in the order the handler saw their events, with the id. */
const label = (m: ActivityEventMessage) =>
	`${{ [ATHLETE_A]: "A", [ATHLETE_B]: "B", [ATHLETE_C]: "C" }[m.athleteId]}${m.activityId}`;

function events(
	athleteId: number,
	ids: number[],
	aspect: ActivityEventMessage["aspect"] = "create",
): ActivityEventMessage[] {
	return ids.map((activityId) => ({
		kind: "activity-event",
		athleteId,
		activityId,
		aspect,
		changed: [],
	}));
}

const range = (from: number, to: number) =>
	Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * A handler for activity events that records the order and answers with
 * `answer`, by default `ok`.
 */
function recorder(
	answer: (m: ActivityEventMessage, call: number) => HandlerResult = () => ({
		kind: "ok",
	}),
) {
	const seen: string[] = [];
	const handler = vi.fn(async (m: ActivityEventMessage) => {
		seen.push(label(m));
		return answer(m, seen.length);
	});
	return { seen, handlers: { "activity-event": handler } as Handlers, handler };
}

const budget = (): HandlerResult => ({ kind: "budget", delaySeconds: 900 });

async function deliver(bodies: unknown[], handlers: Handlers, attempts = 1) {
	const batch = createMessageBatch(
		"rynke-points-work",
		bodies.map((body) => ({
			id: `m${++seq}`,
			timestamp: new Date(NOW * 1000),
			attempts,
			body,
		})),
	);
	await processBatch(batch, ctx, handlers);
	return getQueueResult(batch, createExecutionContext());
}

async function waiting(athleteId?: number): Promise<number> {
	const sql =
		athleteId === undefined
			? "SELECT COUNT(*) AS n FROM strava_work"
			: "SELECT COUNT(*) AS n FROM strava_work WHERE athlete_id = ?";
	const stmt = env.DB.prepare(sql);
	return (
		(await (athleteId === undefined
			? stmt
			: stmt.bind(athleteId)
		).first<number>("n")) ?? 0
	);
}

const queues = async () =>
	(await env.DB.prepare(
		"SELECT COUNT(*) AS n FROM strava_queues",
	).first<number>("n")) ?? 0;

// The fake queue types its bodies as WorkMessage; a turn isn't one (R4).
const turns = () =>
	ctx.queue.sent.filter(
		(m) => (m.body as { kind: string }).kind === "strava-turn",
	);

describe("storing", () => {
	it("acks Strava work and keeps it in the table while the budget is out", async () => {
		const { handlers } = recorder(budget);
		const result = await deliver(events(ATHLETE_A, [1, 2, 3]), handlers);
		expect(result.explicitAcks).toEqual(["m1", "m2", "m3"]);
		expect(result.retryMessages).toEqual([]);
		expect(await waiting(ATHLETE_A)).toBe(3);
	});

	it("runs a lone event at once and leaves nothing behind", async () => {
		const { seen, handlers } = recorder();
		await deliver(events(ATHLETE_A, [1]), handlers);
		expect(seen).toEqual(["A1"]);
		expect(await waiting()).toBe(0);
		expect(await queues()).toBe(0);
		expect(turns()).toEqual([]);
	});

	it("runs a deleted activity at once, past a waiting backlog (FR-011)", async () => {
		const { seen, handlers } = recorder((m) =>
			m.aspect === "delete" ? { kind: "ok" } : budget(),
		);
		await deliver(events(ATHLETE_A, [1, 2]), handlers);
		await deliver(events(ATHLETE_A, [9], "delete"), handlers);
		// The delete ran from the queue; then the batch's drain met the budget
		// again at A1.
		expect(seen).toEqual(["A1", "A9", "A1"]);
		expect(await waiting(ATHLETE_A)).toBe(2);
	});

	it("stores what needs Strava and runs the rest from the queue", async () => {
		const ran: string[] = [];
		const handler = (name: string) => async (): Promise<HandlerResult> => {
			ran.push(name);
			return budget();
		};
		await deliver(
			[
				{ kind: "import-page", athleteId: ATHLETE_A, page: 1, after: 0 },
				{ kind: "reread-page", athleteId: ATHLETE_B, page: 1, after: 0 },
				{ kind: "check-membership", athleteId: ATHLETE_C },
				{ kind: "evaluate-rider", athleteId: ATHLETE_A },
			],
			{
				"import-page": handler("import"),
				"reread-page": handler("reread"),
				"check-membership": handler("check"),
				"evaluate-rider": async () => {
					ran.push("evaluate");
					return { kind: "ok" };
				},
			},
		);
		// The evaluation ran from the queue; the first stored item met the budget.
		expect(ran).toEqual(["evaluate", "import"]);
		expect(await waiting()).toBe(3);
	});
});

describe("turns", () => {
	it("gives a rider whose queue was empty the next turn (FR-002a, SC-001)", async () => {
		// A's backlog: the first one is done, then the budget runs out.
		const first = recorder((_, call) =>
			call === 1 ? { kind: "ok" } : budget(),
		);
		await deliver(events(ATHLETE_A, range(1, 5)), first.handlers);
		expect(first.seen).toEqual(["A1", "A2"]);

		// B's single ride arrives; the budget is back.
		const next = recorder();
		await deliver(events(ATHLETE_B, [1]), next.handlers);
		expect(next.seen).toEqual(["B1", "A2", "A3", "A4", "A5"]);
	});

	it("serves several backlogs round robin, oldest first within each (FR-002, FR-003)", async () => {
		await deliver(
			[...events(ATHLETE_A, [1, 2, 3]), ...events(ATHLETE_C, [1, 2, 3])],
			recorder(budget).handlers,
		);
		const { seen, handlers } = recorder();
		await deliver([STRAVA_TURN], handlers);
		expect(seen).toEqual(["A1", "C1", "A2", "C2", "A3", "C3"]);
	});

	it("serves two riders who arrive fresh in their arrival order", async () => {
		await deliver(
			[...events(ATHLETE_C, [1]), ...events(ATHLETE_A, [1])],
			recorder(budget).handlers,
		);
		const { seen, handlers } = recorder();
		await deliver([STRAVA_TURN], handlers);
		expect(seen).toEqual(["C1", "A1"]);
	});

	it("doesn't move a rider's turn when more of their work arrives (FR-002b)", async () => {
		// A and C both served once, A first; then more for A arrives.
		const first = recorder((_, call) =>
			call <= 2 ? { kind: "ok" } : budget(),
		);
		await deliver(
			[...events(ATHLETE_A, [1, 2, 3]), ...events(ATHLETE_C, [1, 2, 3])],
			first.handlers,
		);
		expect(first.seen).toEqual(["A1", "C1", "A2"]);
		await deliver(events(ATHLETE_A, [4]), recorder(budget).handlers);

		const { seen, handlers } = recorder();
		await deliver([STRAVA_TURN], handlers);
		// A2 met the budget, so A was not served for it: A goes first again.
		expect(seen).toEqual(["A2", "C2", "A3", "C3", "A4"]);
	});

	it("lets a lone rider's backlog use the whole budget (FR-004)", async () => {
		const { seen, handlers } = recorder();
		await deliver(events(ATHLETE_A, range(1, 10)), handlers);
		expect(seen).toEqual(range(1, 10).map((i) => `A${i}`));
		expect(turns()).toEqual([]);
	});

	it("puts another rider's ride first while a 300-event backlog is worked through (SC-001)", async () => {
		// The first window: 20 of A's 300, then the budget.
		const first = recorder((_, call) =>
			call <= 20 ? { kind: "ok" } : budget(),
		);
		await deliver(events(ATHLETE_A, range(1, 300)), first.handlers);
		expect(await waiting(ATHLETE_A)).toBe(280);

		// B's ride arrives while the budget is still out.
		await deliver(events(ATHLETE_B, [1]), recorder(budget).handlers);

		// The next window opens: B's ride is the first one done.
		const next = recorder((_, call) =>
			call <= 20 ? { kind: "ok" } : budget(),
		);
		await deliver([STRAVA_TURN], next.handlers);
		expect(next.seen.slice(0, 3)).toEqual(["B1", "A21", "A22"]);
		expect(await waiting(ATHLETE_B)).toBe(0);
	}, 30_000);
});

describe("budget and retries", () => {
	it("stops at the budget, keeps the item and asks for one wake (FR-009)", async () => {
		const { seen, handlers } = recorder((_, call) =>
			call <= 3 ? { kind: "ok" } : budget(),
		);
		await deliver(events(ATHLETE_A, range(1, 10)), handlers);
		expect(seen).toEqual(["A1", "A2", "A3", "A4"]);
		expect(await waiting(ATHLETE_A)).toBe(7);
		expect(turns()).toEqual([{ body: STRAVA_TURN, delaySeconds: 900 }]);

		// More arrives while the wake is pending: no second wake.
		await deliver(events(ATHLETE_A, [11]), recorder(budget).handlers);
		expect(turns()).toHaveLength(1);
	});

	it("backs off one rider after a transient error while the others go on", async () => {
		const { seen, handlers } = recorder((m) =>
			m.athleteId === ATHLETE_A
				? { kind: "transient", reason: "HTTP 503" }
				: { kind: "ok" },
		);
		await deliver(
			[...events(ATHLETE_A, [1, 2]), ...events(ATHLETE_C, [1, 2])],
			handlers,
		);
		expect(seen).toEqual(["A1", "C1", "C2"]);
		const row = await env.DB.prepare(
			"SELECT attempts, not_before FROM strava_work ORDER BY id LIMIT 1",
		).first();
		expect(row).toEqual({ attempts: 2, not_before: NOW + backoffSeconds(1) });
		expect(turns()).toEqual([
			{ body: STRAVA_TURN, delaySeconds: backoffSeconds(1) },
		]);
	});

	it("runs a backed-off item once its time has come", async () => {
		const failing = recorder(() => ({ kind: "transient", reason: "HTTP 503" }));
		await deliver(events(ATHLETE_A, [1]), failing.handlers);
		ctx = makeCtx({ now: NOW + backoffSeconds(1) });
		const { seen, handler } = recorder();
		await deliver([STRAVA_TURN], { "activity-event": handler });
		expect(seen).toEqual(["A1"]);
		expect(handler).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			expect.anything(),
			{ attempts: 2, isLastAttempt: false },
		);
		expect(await waiting()).toBe(0);
	});

	it("drops a rider's waiting work when their refresh is refused (FR-010)", async () => {
		const { seen, handlers } = recorder(() => ({ kind: "refresh-refused" }));
		await deliver(events(ATHLETE_A, [1, 2, 3]), handlers);
		expect(seen).toEqual(["A1"]);
		expect(await getRider(env.DB, ATHLETE_A)).toMatchObject({
			status: "needs_reconnect",
		});
		expect(await waiting()).toBe(0);
		expect(await queues()).toBe(0);
	});

	it("removes a deleted rider's waiting work with them (FR-010)", async () => {
		await deliver(events(ATHLETE_A, [1, 2]), recorder(budget).handlers);
		await deleteRider(env.DB, ATHLETE_A);
		expect(await waiting()).toBe(0);
		expect(await queues()).toBe(0);
	});

	it("continues at once after DRAIN_LIMIT items", async () => {
		const { seen, handlers } = recorder();
		await deliver(events(ATHLETE_A, range(1, DRAIN_LIMIT + 5)), handlers);
		expect(seen).toHaveLength(DRAIN_LIMIT);
		expect(await waiting(ATHLETE_A)).toBe(5);
		expect(turns()).toEqual([{ body: STRAVA_TURN, delaySeconds: undefined }]);
	});
});

describe("messages", () => {
	it("acks a strava-turn and drains", async () => {
		await deliver(events(ATHLETE_A, [1]), recorder(budget).handlers);
		const { seen, handlers } = recorder();
		const result = await deliver([STRAVA_TURN], handlers);
		expect(result.explicitAcks).toEqual([`m${seq}`]);
		expect(seen).toEqual(["A1"]);
	});
});
