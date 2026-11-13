import { createScheduledController, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleScheduled } from "../../src/index";
import { evaluateChange } from "../../src/rynke/apply";
import type { RecheckRiderMessage } from "../../src/work/messages";
import { recheckRun } from "../../src/work/recheck-run";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { activityRecord } from "../support/rynke";

// The hourly run of the ride edit re-check (feature 036
// contracts/hourly-run.md), with D1 and the queue. It asks Strava nothing: the
// deny-all fetch of test/setup.ts fails any test in which it would.

/** 2026-10-06T10:58:00Z: hour 10, whose share of 150 is 6. */
const NOW = Date.UTC(2026, 9, 6, 10, 58, 0) / 1000;
const DAY = "2026-10-06";
const HOUR = 3600;
const FIRST = 800_001;

let ctx: TestCtx;

/** `epoch` as a stored start. */
const iso = (epoch: number) =>
	new Date(epoch * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

/** A connected rider whose newest ride started `ago` seconds before now. */
async function rider(
	athleteId: number,
	ago = 2 * 24 * HOUR,
	options: Parameters<typeof seedRider>[1] = {},
) {
	await seedRider(makeCtx({ now: NOW - 3 * 24 * HOUR }), {
		athleteId,
		...options,
	});
	await insertRide(athleteId, athleteId * 10, ago);
}

async function insertRide(
	athleteId: number,
	id: number,
	ago: number,
	overrides: Parameters<typeof activityRecord>[1] = {},
) {
	await evaluateChange(ctx, athleteId, {
		kind: "upsert",
		records: [
			activityRecord(id, {
				athlete_id: athleteId,
				start_date: iso(NOW - ago),
				start_date_local: iso(NOW - ago),
				...overrides,
			}),
		],
	});
}

async function stampOf(athleteId: number): Promise<number | null> {
	return env.DB.prepare("SELECT rechecked_at FROM riders WHERE athlete_id = ?")
		.bind(athleteId)
		.first<number | null>("rechecked_at");
}

async function setStamp(athleteId: number, value: number | null) {
	await env.DB.prepare(
		"UPDATE riders SET rechecked_at = ? WHERE athlete_id = ?",
	)
		.bind(value, athleteId)
		.run();
}

async function day() {
	return env.DB.prepare("SELECT * FROM recheck_daily WHERE day = ?")
		.bind(DAY)
		.first<Record<string, number | string>>();
}

function sent(): { body: RecheckRiderMessage; delaySeconds?: number }[] {
	return ctx.queue.sent.filter((m) => m.body.kind === "recheck-rider") as {
		body: RecheckRiderMessage;
		delaySeconds?: number;
	}[];
}

const sentIds = () => sent().map((m) => m.body.athleteId);

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx({ now: NOW });
});

describe("the run", () => {
	it("stamps the chosen riders, counts them and sends one message each, spread over the hour", async () => {
		for (let i = 0; i < 8; i++) await rider(FIRST + i);
		await setStamp(FIRST, NOW - 5 * HOUR);
		await setStamp(FIRST + 1, NOW - 21 * HOUR);

		expect(await recheckRun(ctx)).toBe(6);

		const messages = sent();
		expect(messages).toHaveLength(6);
		// Never checked first, then the longest ago.
		expect(messages.map((m) => m.body.athleteId)).toEqual([
			FIRST + 2,
			FIRST + 3,
			FIRST + 4,
			FIRST + 5,
			FIRST + 6,
			FIRST + 7,
		]);
		expect(messages.map((m) => m.delaySeconds)).toEqual([
			0, 550, 1100, 1650, 2200, 2750,
		]);
		for (const m of messages) {
			expect(m.body).toEqual({
				kind: "recheck-rider",
				athleteId: m.body.athleteId,
				stamp: NOW,
				previous: null,
			});
			expect(await stampOf(m.body.athleteId)).toBe(NOW);
		}
		expect(await stampOf(FIRST)).toBe(NOW - 5 * HOUR);
		// Never checked and connected 3 days ago: those 6 waited over 24 hours.
		expect(await day()).toMatchObject({ sent: 6, over_24h: 6, runs_held: 0 });
	});

	it("carries the stamp before as `previous`", async () => {
		await rider(FIRST);
		await setStamp(FIRST, NOW - 21 * HOUR);
		await recheckRun(ctx);
		expect(sent().map((m) => m.body.previous)).toEqual([NOW - 21 * HOUR]);
	});

	it("holds while more than half of the day's reads are used", async () => {
		await rider(FIRST);
		await rider(FIRST + 1);
		await setStamp(FIRST + 1, NOW - HOUR);
		await env.DB.prepare(
			"UPDATE strava_rate_limit SET observed_at = ?, read_daily = 501 WHERE id = 1",
		)
			.bind(NOW - 60)
			.run();
		expect(await recheckRun(ctx)).toBe(0);
		expect(sent()).toEqual([]);
		expect(await stampOf(FIRST)).toBeNull();
		expect(await day()).toMatchObject({ sent: 0, runs_held: 1, over_24h: 1 });
		await recheckRun(ctx);
		expect(await day()).toMatchObject({ runs_held: 2, over_24h: 1 });
	});

	it("keeps the day's largest number of riders who waited over 24 hours", async () => {
		await env.DB.prepare(
			"INSERT INTO recheck_daily (day, sent, over_24h) VALUES (?, 4, 9)",
		)
			.bind(DAY)
			.run();
		await rider(FIRST);
		await recheckRun(ctx);
		expect(await day()).toMatchObject({ sent: 5, over_24h: 9 });
	});

	it("sends nothing when run a second time in the same hour", async () => {
		for (let i = 0; i < 10; i++) await rider(FIRST + i);
		await recheckRun(ctx);
		ctx.queue.sent.length = 0;
		expect(await recheckRun(makeCtx({ now: NOW + 60 }))).toBe(0);
		expect(sent()).toEqual([]);
	});

	it("asks nothing and sends nothing without eligible riders", async () => {
		expect(await recheckRun(ctx)).toBe(0);
		expect(ctx.queue.sent).toEqual([]);
	});
});

// FR-024: the fake mode's and the sandboxes' button, to watch the check without
// waiting hours.
describe("by hand", () => {
	it("checks every eligible rider at once, again and again, without delays", async () => {
		for (let i = 0; i < 12; i++) await rider(FIRST + i);
		await env.DB.prepare(
			"UPDATE strava_rate_limit SET observed_at = ?, read_daily = 501 WHERE id = 1",
		)
			.bind(NOW - 60)
			.run();
		expect(await recheckRun(ctx, true)).toBe(12);
		expect(await recheckRun(ctx, true)).toBe(12);
		expect(sent()).toHaveLength(24);
		expect(sent().every((m) => m.delaySeconds === undefined)).toBe(true);
		expect(await day()).toMatchObject({ sent: 24, runs_held: 0 });
	});
});

// FR-014, FR-027, research R13.
describe("who is eligible", () => {
	it("takes a rider whose only recent activity is a run", async () => {
		await seedRider(ctx, { athleteId: FIRST });
		await evaluateChange(ctx, FIRST, {
			kind: "upsert",
			records: [],
			runs: [
				{
					strava_activity_id: 1,
					athlete_id: FIRST,
					start_date: iso(NOW - 5 * 24 * HOUR),
					start_date_local: iso(NOW - 5 * 24 * HOUR),
					distance_m: 8000,
					is_private: 0,
					refreshed_at: NOW,
				},
			],
		});
		await recheckRun(ctx);
		expect(sentIds()).toEqual([FIRST]);
	});

	it("leaves out a rider whose newest activity is 31 days old, also from the run's size", async () => {
		await rider(FIRST, 31 * 24 * HOUR);
		await rider(FIRST + 1, 29 * 24 * HOUR);
		await recheckRun(ctx);
		expect(sentIds()).toEqual([FIRST + 1]);
	});

	it.each<[string, Parameters<typeof seedRider>[1]]>([
		["needs to reconnect", { status: "needs_reconnect" }],
		["is importing", { importStatus: "running" }],
	])("leaves out a rider who %s", async (_label, options) => {
		await rider(FIRST, 2 * 24 * HOUR, options);
		await recheckRun(ctx);
		expect(sent()).toEqual([]);
	});

	it("takes a newly connected rider with a finished import at the next run (US4 scenario 4)", async () => {
		await seedRider(ctx, { athleteId: FIRST });
		await insertRide(FIRST, 1, 2 * HOUR);
		await recheckRun(ctx);
		expect(sentIds()).toEqual([FIRST]);
	});

	it("counts a rider as waiting over 24 hours only when active for longer", async () => {
		// Connected 3 days ago, never checked, but only a ride from 2 hours ago:
		// back from a pause, not waiting.
		await seedRider(makeCtx({ now: NOW - 3 * 24 * HOUR }), {
			athleteId: FIRST,
		});
		await insertRide(FIRST, 1, 2 * HOUR);
		await rider(FIRST + 1);
		await recheckRun(ctx);
		expect(await day()).toMatchObject({ over_24h: 1 });
	});
});

// FR-012, research R6, US3 scenarios 1 to 3.
describe("the fast lane", () => {
	const SLOW = { distance_m: 15000 };

	async function fastLaneOf(build: () => Promise<void>): Promise<boolean> {
		// Four riders checked an hour ago, the one under test longest ago of
		// them but after the others in the regular order: a run of one takes
		// it only from the fast lane.
		for (let i = 1; i <= 3; i++) {
			await rider(FIRST + i);
			await setStamp(FIRST + i, NOW - 2 * HOUR);
		}
		await seedRider(ctx, { athleteId: FIRST });
		await build();
		await setStamp(FIRST, NOW - HOUR);
		const run = makeCtx({
			now: NOW,
			team: { ...ctx.team, recheckAllowance: 24 },
		});
		await recheckRun(run);
		return run.queue.sent.some(
			(m) => (m.body as RecheckRiderMessage).athleteId === FIRST,
		);
	}

	it("holds a rider with a ride from yesterday too slow to count", async () => {
		expect(await fastLaneOf(() => insertRide(FIRST, 1, 24 * HOUR, SLOW))).toBe(
			true,
		);
	});

	it("holds one beside a reason that isn't fixable", async () => {
		expect(
			await fastLaneOf(() =>
				insertRide(FIRST, 1, 24 * HOUR, { ...SLOW, is_flagged: 1 }),
			),
		).toBe(true);
	});

	it.each<[string, () => Promise<void>]>([
		[
			"only reasons that aren't fixable",
			() => insertRide(FIRST, 1, 24 * HOUR, { is_manual: 1 }),
		],
		["a ride 8 days old", () => insertRide(FIRST, 1, 8 * 24 * HOUR, SLOW)],
		["a ride that counts", () => insertRide(FIRST, 1, 24 * HOUR)],
		[
			"a deleted ride",
			async () => {
				await insertRide(FIRST, 1, 24 * HOUR, SLOW);
				await insertRide(FIRST, 2, 2 * 24 * HOUR);
				await evaluateChange(ctx, FIRST, { kind: "delete", activityIds: [1] });
			},
		],
	])("doesn't hold a rider with %s", async (_label, build) => {
		expect(await fastLaneOf(build)).toBe(false);
	});
});

// The hourly cron records usage, then runs the re-check; neither failing stops
// the other, and the invocation fails either way.
describe("the hourly cron", () => {
	const hourly = () =>
		createScheduledController({
			scheduledTime: new Date(NOW * 1000),
			cron: "58 * * * *",
		});

	function failing(sql: RegExp): TestCtx {
		const db = new Proxy(env.DB, {
			get(target, prop) {
				if (prop === "prepare") {
					return (query: string) => {
						if (sql.test(query)) throw new Error("D1 down");
						return target.prepare(query);
					};
				}
				const value = Reflect.get(target, prop, target);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		return { ...ctx, env: { ...ctx.env, DB: db } };
	}

	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});
	afterEach(() => vi.restoreAllMocks());

	it("runs the re-check after recording usage", async () => {
		await rider(FIRST);
		await handleScheduled(hourly(), ctx);
		expect(sentIds()).toEqual([FIRST]);
		expect(
			await env.DB.prepare("SELECT COUNT(*) AS n FROM usage_daily").first("n"),
		).toBeGreaterThan(0);
	});

	it("still records usage when the run fails, and fails", async () => {
		await rider(FIRST);
		await expect(
			handleScheduled(hourly(), failing(/rechecked_at/)),
		).rejects.toThrow("D1 down");
		expect(
			await env.DB.prepare("SELECT COUNT(*) AS n FROM usage_daily").first("n"),
		).toBeGreaterThan(0);
	});

	it("still runs when recording usage fails, and fails", async () => {
		await rider(FIRST);
		const broken = failing(/usage_daily/);
		await expect(handleScheduled(hourly(), broken)).rejects.toThrow("D1 down");
		expect(
			broken.queue.sent.map((m) => (m.body as RecheckRiderMessage).athleteId),
		).toEqual([FIRST]);
	});
});
