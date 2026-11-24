import {
	createMessageBatch,
	createScheduledController,
	env,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { keepToken } from "../../src/db/pending-revocations";
import { getRider } from "../../src/db/riders";
import { handleFetch, handleQueue, handleScheduled } from "../../src/index";
import { getActivity, getAthleteClubs } from "../../src/strava/client";
import type { WorkMessage } from "../../src/work/messages";
import { pruneUsage } from "../../src/work/scheduled";
import { approve } from "../support/callback";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import {
	ATHLETE_A,
	ATHLETE_B,
	makeStravaActivity,
	NOW,
} from "../support/fixtures";

// Strava call counts (feature 047 contracts/counting.md): every answered call
// counts under the action that made it, every call the budget refused counts
// as held back, and counting never changes a call's result. Counts only.

const TODAY = "2026-10-06";
const ACTIVITY = "8888888";

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => fake.restore());

/** Every counted row as `[action, endpoint, calls, held back]`. */
async function counts(): Promise<[string, string, number, number][]> {
	const { results } = await env.DB.prepare(
		`SELECT day, action, endpoint, calls, held_back FROM strava_calls_daily
		ORDER BY action, endpoint`,
	).all<{
		day: string;
		action: string;
		endpoint: string;
		calls: number;
		held_back: number;
	}>();
	for (const r of results) expect(r.day).toBe(TODAY);
	return results.map((r) => [r.action, r.endpoint, r.calls, r.held_back]);
}

async function seen(): Promise<number | null> {
	return env.DB.prepare("SELECT seen FROM strava_seen_daily WHERE day = ?")
		.bind(TODAY)
		.first<number>("seen");
}

async function process(...messages: WorkMessage[]): Promise<void> {
	const batch = createMessageBatch(
		"rynke-points-work",
		messages.map((body, i) => ({
			id: `m${i}`,
			timestamp: new Date(NOW * 1000),
			attempts: 1,
			body,
		})),
	);
	await handleQueue(batch, ctx);
}

/** This 15-minute window's reads and calls so far. */
async function useWindow(n: number) {
	await env.DB.prepare(
		"UPDATE strava_rate_limit SET observed_at = ?1, read_15m = ?2, all_15m = ?2 WHERE id = 1",
	)
		.bind(NOW, n)
		.run();
}

/** Today's reads so far. */
async function useDay(n: number) {
	await env.DB.prepare(
		"UPDATE strava_rate_limit SET observed_at = ?, read_daily = ? WHERE id = 1",
	)
		.bind(NOW, n)
		.run();
}

/** A rider on Strava and here. */
async function rider(options: Parameters<typeof seedRider>[1] = {}) {
	const athleteId = options.athleteId ?? ATHLETE_A;
	fake.addAthlete({
		id: athleteId,
		...(options.expiresAt === undefined
			? {}
			: { expiresAt: options.expiresAt }),
	});
	await seedRider(ctx, options);
}

describe("a call counts under the action that made it", () => {
	it("counts the token exchange and the club check under connecting", async () => {
		await approve(ctx, fake, ATHLETE_A);
		expect(await counts()).toEqual([
			["connect", "GET /athlete/clubs", 1, 0],
			["connect", "POST /oauth/token", 1, 0],
		]);
	});

	it("counts the activity lists under the season import", async () => {
		await rider({ importStatus: "running" });
		await process({
			kind: "import-page",
			athleteId: ATHLETE_A,
			page: 1,
			after: 0,
		});
		expect(await counts()).toEqual([
			["import", "GET /athlete/activities", 1, 0],
		]);
	});

	it("counts a refresh and the ride's read both under the ride event (US1 scenario 2)", async () => {
		await rider({ expiresAt: NOW - 1 });
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: ACTIVITY }));
		await process({
			kind: "activity-event",
			athleteId: ATHLETE_A,
			activityId: ACTIVITY,
			aspect: "create",
			changed: [],
		});
		expect(await counts()).toEqual([
			["ride-event", "GET /activities/{id}", 1, 0],
			["ride-event", "POST /oauth/token", 1, 0],
		]);
	});

	it("counts the daily club check, the re-check and the re-read", async () => {
		await rider();
		await process({ kind: "check-membership", athleteId: ATHLETE_A });
		await process({
			kind: "recheck-rider",
			athleteId: ATHLETE_A,
			stamp: NOW - 600,
			previous: null,
		});
		await process({
			kind: "reread-page",
			athleteId: ATHLETE_A,
			page: 1,
			after: 0,
		});
		expect(await counts()).toEqual([
			["club-check", "GET /athlete/clubs", 1, 0],
			["recheck", "GET /athlete/activities", 1, 0],
			["reread", "GET /athlete/activities", 1, 0],
		]);
	});

	it("counts the revocation when a rider leaves under leaving", async () => {
		await rider();
		const res = await handleFetch(
			request("/me/disconnect", {
				method: "POST",
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(res.status).toBe(303);
		expect(await counts()).toEqual([["leave", "POST /oauth/revoke", 1, 0]]);
	});

	it("counts the revocation when an admin removes a rider under leaving", async () => {
		await rider({ athleteId: ATHLETE_B, administrator: true });
		await rider();
		const res = await handleFetch(
			request(`/admin/riders/${ATHLETE_A}/remove`, {
				form: {},
				cookies: await sessionCookie(ctx, ATHLETE_B),
			}),
			ctx,
		);
		expect(res.status).toBe(303);
		expect(await counts()).toEqual([["leave", "POST /oauth/revoke", 1, 0]]);
	});

	it("counts the deletions after the club check under leaving", async () => {
		await rider();
		await process({
			kind: "delete-rider",
			athleteId: ATHLETE_A,
			reason: "left-club",
			revoke: true,
		});
		expect(await counts()).toEqual([["leave", "POST /oauth/revoke", 1, 0]]);
	});

	it("counts Strava's disconnect report's check under the disconnect report", async () => {
		await rider();
		fake.deauthorize(ATHLETE_A);
		await process({
			kind: "delete-rider",
			athleteId: ATHLETE_A,
			reason: "deauthorized",
			revoke: false,
		});
		expect(await getRider(env.DB, ATHLETE_A)).toBeNull();
		expect(await counts()).toEqual([["disconnect", "POST /oauth/token", 1, 0]]);
	});

	it("counts the daily retry of a kept token under leaving", async () => {
		await keepToken(env, ATHLETE_B, `refresh-${ATHLETE_B}-0`, NOW);
		await handleScheduled(
			createScheduledController({
				scheduledTime: new Date(NOW * 1000),
				cron: "17 3 * * *",
			}),
			ctx,
		);
		expect(await counts()).toEqual([["leave", "POST /oauth/revoke", 1, 0]]);
	});

	it("counts a call made outside every action as unassigned (FR-003)", async () => {
		await rider();
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: ACTIVITY }));
		await getActivity(makeCtx(), { athleteId: ATHLETE_A }, ACTIVITY);
		expect(await counts()).toEqual([
			["unassigned", "GET /activities/{id}", 1, 0],
		]);
	});
});

describe("what counts as a call", () => {
	it("counts an answer of too many requests: Strava counted it", async () => {
		await rider();
		fake.failNext("clubs", { status: 429 });
		await process({ kind: "check-membership", athleteId: ATHLETE_A });
		expect(await counts()).toEqual([
			["club-check", "GET /athlete/clubs", 1, 0],
		]);
	});

	it("counts nothing without an answer (US1 scenario 5)", async () => {
		await rider();
		fake.failNext("activity", "network");
		const result = await getActivity(
			{ ...ctx, stravaAction: "ride-event" },
			{ athleteId: ATHLETE_A },
			ACTIVITY,
		);
		expect(result.kind).toBe("transient");
		expect(await counts()).toEqual([]);
	});

	it("returns the answer when counting fails, and logs no ID (FR-006)", async () => {
		await rider();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const db = env.DB;
		const broken = new Proxy(db, {
			get(target, prop) {
				if (prop === "prepare") {
					return (sql: string) => {
						if (sql.includes("strava_calls_daily")) throw new Error("D1 down");
						return target.prepare(sql);
					};
				}
				const value = Reflect.get(target, prop, target);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		const result = await getAthleteClubs(
			{ ...ctx, env: { ...ctx.env, DB: broken } },
			{ athleteId: ATHLETE_A },
			1,
		);
		expect(result.kind).toBe("ok");
		const lines = warn.mock.calls.map((c) => String(c[0]));
		expect(lines).toContain(
			"Strava GET /athlete/clubs: could not count the call",
		);
		for (const line of lines) expect(line).not.toContain(ATHLETE_A);
		warn.mockRestore();
	});

	it("keeps the highest daily total Strava reported", async () => {
		await rider();
		const call = async (usage: string) => {
			if (fake.rateHeaders) fake.rateHeaders.usage = usage;
			await getAthleteClubs(ctx, { athleteId: ATHLETE_A }, 1);
		};
		await call("5,300");
		expect(await seen()).toBe(300);
		await call("6,200");
		expect(await seen()).toBe(300);
		await call("7,301");
		expect(await seen()).toBe(301);
	});

	it("keeps no Strava count without the header, as from the fake Strava", async () => {
		await rider();
		fake.rateHeaders = null;
		await getAthleteClubs(ctx, { athleteId: ATHLETE_A }, 1);
		expect(await seen()).toBeNull();
		expect(await counts()).toEqual([
			["unassigned", "GET /athlete/clubs", 1, 0],
		]);
	});

	it("keeps no rider or activity ID (FR-016)", async () => {
		await rider({ expiresAt: NOW - 1 });
		fake.addActivity(ATHLETE_A, makeStravaActivity({ id: ACTIVITY }));
		await process({
			kind: "activity-event",
			athleteId: ATHLETE_A,
			activityId: ACTIVITY,
			aspect: "create",
			changed: [],
		});
		const { results: calls } = await env.DB.prepare(
			"SELECT * FROM strava_calls_daily",
		).all();
		const { results: days } = await env.DB.prepare(
			"SELECT * FROM strava_seen_daily",
		).all();
		const stored = JSON.stringify([calls, days]);
		expect(calls.length).toBeGreaterThan(0);
		expect(stored).not.toContain(ATHLETE_A);
		expect(stored).not.toContain(ACTIVITY);
	});
});

describe("a call held back by the budget (FR-005)", () => {
	it("counts a background read refused, and no call; the work waits", async () => {
		await rider();
		await useWindow(85);
		await process({ kind: "check-membership", athleteId: ATHLETE_A });
		expect(fake.callsTo("clubs")).toEqual([]);
		expect(await counts()).toEqual([
			["club-check", "GET /athlete/clubs", 0, 1],
		]);
		const waiting = await env.DB.prepare(
			"SELECT COUNT(*) AS n FROM strava_work",
		).first<number>("n");
		expect(waiting).toBe(1);
	});

	it("counts one held back under connecting when the budget is used up (US1 scenario 4)", async () => {
		await useWindow(90);
		const res = await approve(ctx, fake, ATHLETE_A);
		expect(res.headers.get("Location")).toBe("/notice/strava-busy");
		expect(fake.callsTo("token")).toEqual([]);
		expect(await counts()).toEqual([["connect", "POST /oauth/token", 0, 1]]);
	});

	it("counts a revocation refused when a rider leaves; they are deleted anyway", async () => {
		await rider();
		await useWindow(90);
		const res = await handleFetch(
			request("/me/disconnect", {
				method: "POST",
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(res.status).toBe(303);
		expect(await getRider(env.DB, ATHLETE_A)).toBeNull();
		expect(await counts()).toEqual([["leave", "POST /oauth/revoke", 0, 1]]);
	});

	it.each<[string, () => Promise<unknown>]>([
		["more than half of the day's reads are used", () => useDay(501)],
		["the background budget is used", () => useWindow(80)],
	])(
		"counts the ride re-check standing back when %s (US1 scenario 3)",
		async (_, gate) => {
			await rider();
			await gate();
			await process({
				kind: "recheck-rider",
				athleteId: ATHLETE_A,
				stamp: NOW - 600,
				previous: null,
			});
			expect(fake.callsTo("activities")).toEqual([]);
			expect(await counts()).toEqual([
				["recheck", "GET /athlete/activities", 0, 1],
			]);
		},
	);

	it("counts nothing when the re-check stands back for another reason", async () => {
		await rider({ importStatus: "running" });
		await process({
			kind: "recheck-rider",
			athleteId: ATHLETE_A,
			stamp: NOW - 600,
			previous: null,
		});
		expect(await counts()).toEqual([]);
	});

	it("counts a refresh before a call held back as a call", async () => {
		// A first page of clubs that is full and reports the budget used, so
		// the second page is held back after the refresh and the first.
		const clubs = Array.from({ length: 200 }, (_, i) => 5_000_000 + i);
		fake.addAthlete({ id: ATHLETE_A, clubs, expiresAt: NOW - 1 });
		await seedRider(ctx, { expiresAt: NOW - 1 });
		if (fake.rateHeaders) fake.rateHeaders.readUsage = "85,85";
		await process({ kind: "check-membership", athleteId: ATHLETE_A });
		expect(await counts()).toEqual([
			["club-check", "GET /athlete/clubs", 1, 1],
			["club-check", "POST /oauth/token", 1, 0],
		]);
	});
});

describe("retention (US1 scenario 6)", () => {
	it("deletes days before the last 30 and keeps the 30th", async () => {
		for (const day of ["2026-09-06", "2026-09-07"]) {
			await env.DB.batch([
				env.DB.prepare(
					`INSERT INTO strava_calls_daily (day, action, endpoint, calls)
					VALUES (?, 'import', 'GET /athlete/activities', 3)`,
				).bind(day),
				env.DB.prepare(
					"INSERT INTO strava_seen_daily (day, seen) VALUES (?, 10)",
				).bind(day),
			]);
		}
		await pruneUsage(ctx);
		const days = async (table: string) =>
			(
				await env.DB.prepare(`SELECT day FROM ${table} ORDER BY day`).all<{
					day: string;
				}>()
			).results.map((r) => r.day);
		expect(await days("strava_calls_daily")).toEqual(["2026-09-07"]);
		expect(await days("strava_seen_daily")).toEqual(["2026-09-07"]);
	});
});
