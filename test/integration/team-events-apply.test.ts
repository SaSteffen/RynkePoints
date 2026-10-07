import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertActivity } from "../../src/db/activities";
import { readRynke } from "../../src/db/rynke";
import {
	applyAndEvaluate,
	applyTeamEventChange,
	type TeamEventChange,
	TeamEventRefused,
	teamEventChange,
} from "../../src/rynke/apply";
import {
	CURRENT_RULES,
	countingWindow,
	type RynkeRules,
	rulesForVersion,
} from "../../src/rynke/rules";
import { TEAM_EVENT_KINDS } from "../../src/rynke/team-events";
import {
	makeCtx,
	resetDb,
	seedRider,
	type TestCtx,
	tableCounts,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import {
	activityRecord,
	attendanceRows,
	attendRaw,
	expectConsistent,
	insertEvent,
	resultRows,
	snapshot,
} from "../support/rynke";

// Team-event changes store the change and every affected rider's balance in
// one batch (FR-014b, research R21, contracts/ride-evaluation.md "A team-event
// change"). `expectConsistent` checks data-model.md's invariants after every
// successful step. Synthetic riders and events only.

const db = env.DB;
const ATHLETE_D = 900004;
const UNKNOWN = 900999;
const NAME = "Synthetic team ride";

let fake: FakeStrava;
let ctx: TestCtx;

function change(c: TeamEventChange, now = NOW, rules = CURRENT_RULES) {
	return applyTeamEventChange(db, c, rules, countingWindow(env, rules), now);
}

function evaluate(athleteId: number, rules: RynkeRules = CURRENT_RULES) {
	return applyAndEvaluate(
		db,
		athleteId,
		{ kind: "none" },
		rules,
		countingWindow(env, rules),
		NOW,
	);
}

/** A and B connected with one counting 40 km ride each, C needs a reconnect. */
async function seed() {
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedRider(ctx, { athleteId: ATHLETE_B });
	await seedRider(ctx, { athleteId: ATHLETE_C, status: "needs_reconnect" });
	await upsertActivity(db, activityRecord(1));
	await upsertActivity(db, activityRecord(2, { athlete_id: ATHLETE_B }));
	await evaluate(ATHLETE_A);
	await evaluate(ATHLETE_B);
}

async function balance(athleteId: number) {
	const { balance } = await readRynke(db, athleteId);
	if (!balance) throw new Error(`no balance for ${athleteId}`);
	return balance;
}

async function snapshots() {
	return {
		a: await snapshot(ATHLETE_A),
		b: await snapshot(ATHLETE_B),
		attendances: await attendanceRows(),
	};
}

async function refusal(promise: Promise<unknown>) {
	const error = await promise.then(
		() => null,
		(e: unknown) => e,
	);
	expect(error).toBeInstanceOf(TeamEventRefused);
	return (error as TeamEventRefused).code;
}

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = makeCtx();
	await seed();
});

afterEach(() => {
	// No change here contacts Strava.
	expect(fake.calls).toEqual([]);
	fake.restore();
});

describe("create-event", () => {
	it("stores the event and writes no balance", async () => {
		const before = await snapshots();
		const result = await change({
			kind: "create-event",
			event: { kind: "team_training", date: "2026-05-02", name: NAME },
		});
		expect(result.affected).toEqual([]);
		expect(result.eventId).toBeGreaterThan(0);
		expect(
			await db
				.prepare(
					"SELECT kind, event_date, name FROM team_events WHERE event_id = ?",
				)
				.bind(result.eventId)
				.first(),
		).toEqual({ kind: "team_training", event_date: "2026-05-02", name: NAME });
		expect(await snapshots()).toEqual(before);
	});

	it("stores an event without a name", async () => {
		const { eventId } = await change({
			kind: "create-event",
			event: { kind: "technique_training", date: "2026-05-02", name: null },
		});
		expect(
			await db
				.prepare("SELECT name FROM team_events WHERE event_id = ?")
				.bind(eventId)
				.first("name"),
		).toBeNull();
	});

	it.each([
		["unknown_kind", { kind: "ride", date: "2026-05-02", name: null }],
		["invalid_date", { kind: "team_training", date: "2026-5-1", name: null }],
		["invalid_date", { kind: "team_training", date: "2026-02-30", name: null }],
		["invalid_name", { kind: "team_training", date: "2026-05-02", name: "" }],
		[
			"invalid_name",
			{ kind: "team_training", date: "2026-05-02", name: "x".repeat(101) },
		],
	])("is refused with %s for %j", async (code, event) => {
		const before = await tableCounts();
		expect(await refusal(change({ kind: "create-event", event }))).toBe(code);
		expect(await tableCounts()).toEqual(before);
	});
});

describe("add-attendance", () => {
	it("adds the event's Rynke to every listed rider and changes no ride result", async () => {
		const eventId = await insertEvent("team_training", "2026-05-02");
		const before = {
			a: await balance(ATHLETE_A),
			b: await balance(ATHLETE_B),
			results: [await resultRows(ATHLETE_A), await resultRows(ATHLETE_B)],
		};

		const result = await change(
			{ kind: "add-attendance", eventId, athleteIds: [ATHLETE_B, ATHLETE_A] },
			NOW + 60,
		);

		expect(result).toEqual({
			eventId: null,
			affected: [ATHLETE_A, ATHLETE_B],
			rose: [ATHLETE_A, ATHLETE_B],
		});
		for (const [athleteId, was] of [
			[ATHLETE_A, before.a],
			[ATHLETE_B, before.b],
		] as const) {
			expect(await balance(athleteId)).toMatchObject({
				teamRynke: was.teamRynke + 1,
				trainingRynke: was.trainingRynke + 5,
				computedAt: NOW + 60,
			});
			await expectConsistent(athleteId);
		}
		expect([await resultRows(ATHLETE_A), await resultRows(ATHLETE_B)]).toEqual(
			before.results,
		);
	});

	it("US3-4: adding a rider who already attends writes nothing", async () => {
		const eventId = await insertEvent("team_training", "2026-05-02");
		await change({ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] });
		const before = await snapshots();

		const result = await change(
			{ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] },
			NOW + 3600,
		);

		expect(result.affected).toEqual([]);
		expect(await snapshots()).toEqual(before);
	});

	it.each([
		["a needs_reconnect rider", ATHLETE_C],
		["an unknown rider", UNKNOWN],
	])("refuses %s and writes nothing for the others", async (_case, other) => {
		const eventId = await insertEvent("team_training", "2026-05-02");
		const before = await snapshots();
		expect(
			await refusal(
				change({
					kind: "add-attendance",
					eventId,
					athleteIds: [ATHLETE_A, other],
				}),
			),
		).toBe("rider_not_connected");
		expect(await snapshots()).toEqual(before);
	});

	it("counts an event dated before the rider connected (FR-006a)", async () => {
		const eventId = await insertEvent("team_training", "2026-02-01");
		const connectedAt = await db
			.prepare("SELECT connected_at FROM riders WHERE athlete_id = ?")
			.bind(ATHLETE_A)
			.first<number>("connected_at");
		expect(Date.UTC(2026, 1, 1) / 1000).toBeLessThan(connectedAt as number);

		await change({ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] });

		expect((await balance(ATHLETE_A)).teamRynke).toBe(1);
		await expectConsistent(ATHLETE_A);
	});
});

describe("update-event", () => {
	async function attended() {
		const eventId = await insertEvent("team_training", "2026-05-02", NAME);
		await change({
			kind: "add-attendance",
			eventId,
			athleteIds: [ATHLETE_A, ATHLETE_B],
		});
		return eventId;
	}

	it("a new kind re-evaluates every attendee", async () => {
		const eventId = await attended();
		const riding = (await balance(ATHLETE_A)).trainingRynke - 5;

		const result = await change({
			kind: "update-event",
			eventId,
			event: { kind: "technique_training", date: "2026-05-02", name: NAME },
		});

		expect(result).toEqual({
			eventId: null,
			affected: [ATHLETE_A, ATHLETE_B],
			rose: [ATHLETE_A, ATHLETE_B],
		});
		expect(await balance(ATHLETE_A)).toMatchObject({
			teamRynke: 5,
			trainingRynke: riding + 5,
		});
		await expectConsistent(ATHLETE_A);
		await expectConsistent(ATHLETE_B);
	});

	it("a new name affects no one and writes no balance", async () => {
		const eventId = await attended();
		const before = await snapshots();

		const result = await change(
			{
				kind: "update-event",
				eventId,
				event: { kind: "team_training", date: "2026-05-02", name: "Renamed" },
			},
			NOW + 60,
		);

		expect(result.affected).toEqual([]);
		expect(await snapshots()).toEqual(before);
		expect(
			await db
				.prepare("SELECT name FROM team_events WHERE event_id = ?")
				.bind(eventId)
				.first("name"),
		).toBe("Renamed");
	});

	it("moving the event before the season start takes its Rynke away, moving it back restores them", async () => {
		const eventId = await attended();
		const withEvent = await balance(ATHLETE_A);
		const move = (date: string) =>
			change({
				kind: "update-event",
				eventId,
				event: { kind: "team_training", date, name: NAME },
			});

		await move("2025-12-31");
		expect(await balance(ATHLETE_A)).toMatchObject({
			teamRynke: 0,
			trainingRynke: withEvent.trainingRynke - 5,
		});
		await expectConsistent(ATHLETE_A);

		await move("2026-05-02");
		expect(await balance(ATHLETE_A)).toMatchObject({
			teamRynke: 1,
			trainingRynke: withEvent.trainingRynke,
		});
		await expectConsistent(ATHLETE_A);
	});

	it("moving the event past the deadline takes its Rynke away", async () => {
		const rules: RynkeRules = {
			...CURRENT_RULES,
			qualificationDeadline: "2026-08-31",
		};
		const eventId = await insertEvent("team_training", "2026-08-31");
		await change(
			{ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] },
			NOW,
			rules,
		);
		expect((await balance(ATHLETE_A)).teamRynke).toBe(1);

		await change(
			{
				kind: "update-event",
				eventId,
				event: { kind: "team_training", date: "2026-09-01", name: null },
			},
			NOW,
			rules,
		);

		expect((await balance(ATHLETE_A)).teamRynke).toBe(0);
		await expectConsistent(ATHLETE_A, rules);
	});

	it("is refused for invalid input", async () => {
		const eventId = await attended();
		expect(
			await refusal(
				change({
					kind: "update-event",
					eventId,
					event: { kind: "ride", date: "2026-05-02", name: NAME },
				}),
			),
		).toBe("unknown_kind");
	});
});

describe("remove-attendance", () => {
	it("takes the event's Rynke from the rider; removing again writes nothing", async () => {
		const eventId = await insertEvent("team_training", "2026-05-02");
		await change({
			kind: "add-attendance",
			eventId,
			athleteIds: [ATHLETE_A, ATHLETE_B],
		});
		const withEvent = await balance(ATHLETE_A);
		const other = await snapshot(ATHLETE_B);

		const result = await change({
			kind: "remove-attendance",
			eventId,
			athleteIds: [ATHLETE_A],
		});

		expect(result).toEqual({ eventId: null, affected: [ATHLETE_A], rose: [] });
		expect(await balance(ATHLETE_A)).toMatchObject({
			teamRynke: 0,
			trainingRynke: withEvent.trainingRynke - 5,
		});
		expect(await snapshot(ATHLETE_B)).toEqual(other);
		await expectConsistent(ATHLETE_A);

		const before = await snapshots();
		const again = await change(
			{ kind: "remove-attendance", eventId, athleteIds: [ATHLETE_A] },
			NOW + 60,
		);
		expect(again.affected).toEqual([]);
		expect(await snapshots()).toEqual(before);
	});

	it("can end a rider's qualification", async () => {
		await seedRider(ctx, { athleteId: ATHLETE_D });
		// 9 rides of 250 km in 9 h on separate days: 9 × 25 = 225 Training.
		for (let i = 0; i < 9; i++) {
			await upsertActivity(
				db,
				activityRecord(400 + i, {
					athlete_id: ATHLETE_D,
					start_date: new Date(Date.UTC(2026, 4, 1 + i, 8)).toISOString(),
					distance_m: 250000,
					moving_time_s: 9 * 3600,
					elapsed_time_s: 9 * 3600,
					elevation_gain_m: 0,
				}),
			);
		}
		// 5 technique trainings: 25 Team, 25 Training, 250 in all.
		const events: number[] = [];
		for (let i = 0; i < 5; i++) {
			const eventId = await insertEvent(
				"technique_training",
				`2026-07-0${i + 1}`,
			);
			events.push(eventId);
			await change({
				kind: "add-attendance",
				eventId,
				athleteIds: [ATHLETE_D],
			});
		}
		expect(await balance(ATHLETE_D)).toMatchObject({
			trainingRynke: 250,
			teamRynke: 25,
			qualified: true,
		});

		await change({
			kind: "remove-attendance",
			eventId: events[0] as number,
			athleteIds: [ATHLETE_D],
		});

		expect(await balance(ATHLETE_D)).toMatchObject({
			teamRynke: 20,
			teamMissing: 5,
			qualified: false,
		});
		await expectConsistent(ATHLETE_D);
	});
});

describe("delete-event", () => {
	it("re-evaluates every attendee and removes the event's attendances", async () => {
		const eventId = await insertEvent("training_weekend_day", "2026-06-13");
		const kept = await insertEvent("team_training", "2026-05-02");
		await change({
			kind: "add-attendance",
			eventId,
			athleteIds: [ATHLETE_A, ATHLETE_B],
		});
		await change({
			kind: "add-attendance",
			eventId: kept,
			athleteIds: [ATHLETE_A],
		});
		const before = await balance(ATHLETE_A);

		const result = await change({ kind: "delete-event", eventId });

		expect(result).toEqual({
			eventId: null,
			affected: [ATHLETE_A, ATHLETE_B],
			rose: [],
		});
		expect(await attendanceRows()).toEqual([
			{ event_id: kept, athlete_id: ATHLETE_A },
		]);
		expect(await balance(ATHLETE_A)).toMatchObject({
			teamRynke: before.teamRynke - 5,
			trainingRynke: before.trainingRynke - 10,
		});
		expect((await balance(ATHLETE_B)).teamRynke).toBe(0);
		await expectConsistent(ATHLETE_A);
		await expectConsistent(ATHLETE_B);
	});
});

describe("a missing event", () => {
	it.each<TeamEventChange>([
		{
			kind: "update-event",
			eventId: 4242,
			event: { kind: "team_training", date: "2026-05-02", name: null },
		},
		{ kind: "delete-event", eventId: 4242 },
		{ kind: "add-attendance", eventId: 4242, athleteIds: [ATHLETE_A] },
		{ kind: "remove-attendance", eventId: 4242, athleteIds: [ATHLETE_A] },
	])("refuses $kind with event_missing", async (c) => {
		const before = { counts: await tableCounts(), rows: await snapshots() };
		expect(await refusal(change(c))).toBe("event_missing");
		expect({ counts: await tableCounts(), rows: await snapshots() }).toEqual(
			before,
		);
	});
});

describe("scenarios for rider D (one ride of 60 km, 2.5 h and 1000 m)", () => {
	beforeEach(async () => {
		await seedRider(ctx, { athleteId: ATHLETE_D });
		await upsertActivity(
			db,
			activityRecord(500, {
				athlete_id: ATHLETE_D,
				distance_m: 60000,
				moving_time_s: 2.5 * 3600,
				elapsed_time_s: 2.5 * 3600,
				elevation_gain_m: 1000,
			}),
		);
		await evaluate(ATHLETE_D);
	});

	it("US3-6: without attendance, 0 Team and 11 Training Rynke", async () => {
		const b = await balance(ATHLETE_D);
		expect(b).toMatchObject({ teamRynke: 0, trainingRynke: 11 });
		expect(b.teamEvents).toEqual(
			TEAM_EVENT_KINDS.map((kind) => ({
				kind,
				attended: 0,
				team: 0,
				training: 0,
			})),
		);
		await expectConsistent(ATHLETE_D);
	});

	it("US3-5: with a team training, 1 Team and 16 Training Rynke", async () => {
		const eventId = await insertEvent("team_training", "2026-05-01");
		await change({ kind: "add-attendance", eventId, athleteIds: [ATHLETE_D] });
		expect(await balance(ATHLETE_D)).toMatchObject({
			teamRynke: 1,
			trainingRynke: 16,
		});
		await expectConsistent(ATHLETE_D);
	});

	it("S4-9: the breakdown lists every kind, the training weekend with 0", async () => {
		for (const [kind, date] of [
			["team_training", "2026-05-01"],
			["team_training", "2026-05-08"],
			["technique_training", "2026-05-15"],
		] as const) {
			const eventId = await insertEvent(kind, date);
			await change({
				kind: "add-attendance",
				eventId,
				athleteIds: [ATHLETE_D],
			});
		}
		expect((await balance(ATHLETE_D)).teamEvents).toEqual([
			{ kind: "team_training", attended: 2, team: 2, training: 10 },
			{ kind: "training_weekend_day", attended: 0, team: 0, training: 0 },
			{ kind: "technique_training", attended: 1, team: 5, training: 5 },
		]);
		await expectConsistent(ATHLETE_D);
	});
});

describe("order independence (SC-003)", () => {
	/** Balances without `computed_at`, and every ride result. */
	async function state() {
		const out: unknown[] = [];
		for (const athleteId of [ATHLETE_A, ATHLETE_B]) {
			const { computedAt: _computedAt, ...fields } = await balance(athleteId);
			out.push(fields, await resultRows(athleteId));
		}
		return out;
	}

	it("gives the same balances for the same final attendance", async () => {
		let eventId = await insertEvent("team_training", "2026-05-02");
		await change({
			kind: "add-attendance",
			eventId,
			athleteIds: [ATHLETE_A, ATHLETE_B],
		});
		await change({
			kind: "remove-attendance",
			eventId,
			athleteIds: [ATHLETE_B],
		});
		await change({ kind: "add-attendance", eventId, athleteIds: [ATHLETE_B] });
		const first = await state();

		await resetDb();
		await seed();
		eventId = await insertEvent("team_training", "2026-05-02");
		await change({ kind: "add-attendance", eventId, athleteIds: [ATHLETE_B] });
		await change({ kind: "add-attendance", eventId, athleteIds: [ATHLETE_B] });
		await change({ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] });

		expect(await state()).toEqual(first);
	});
});

describe("stale rows", () => {
	it("an affected rider evaluated under version 1 gets every row at the current version", async () => {
		await upsertActivity(
			db,
			activityRecord(3, { start_date: "2026-05-03T08:00:00Z" }),
		);
		await evaluate(ATHLETE_A, rulesForVersion(1) as RynkeRules);
		expect((await resultRows()).map((r) => r.rules_version)).toEqual([1, 1]);

		const eventId = await insertEvent("team_training", "2026-05-02");
		await change({ kind: "add-attendance", eventId, athleteIds: [ATHLETE_A] });

		expect((await resultRows()).map((r) => r.rules_version)).toEqual([
			CURRENT_RULES.version,
			CURRENT_RULES.version,
		]);
		expect((await balance(ATHLETE_A)).rulesVersion).toBe(CURRENT_RULES.version);
		await expectConsistent(ATHLETE_A);
	});
});

describe("many attendees", () => {
	it("deletes an event of ten riders with three rides each in one batch", async () => {
		const riders = Array.from({ length: 10 }, (_, i) => 900_101 + i);
		for (const [r, athleteId] of riders.entries()) {
			await seedRider(ctx, { athleteId });
			for (let d = 0; d < 3; d++) {
				await upsertActivity(
					db,
					activityRecord(10_000 + r * 10 + d, {
						athlete_id: athleteId,
						start_date: new Date(Date.UTC(2026, 4, 1 + d, 8)).toISOString(),
					}),
				);
			}
		}
		const eventId = await insertEvent("training_weekend_day", "2026-06-13");
		await change({ kind: "add-attendance", eventId, athleteIds: riders });
		for (const athleteId of riders) {
			expect((await balance(athleteId)).teamRynke).toBe(5);
		}

		const batch = env.DB.batch.bind(env.DB);
		let batches = 0;
		const counting = new Proxy(db, {
			get(target, prop) {
				if (prop === "batch") {
					return (statements: D1PreparedStatement[]) => {
						batches++;
						return batch(statements);
					};
				}
				const value = Reflect.get(target, prop);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		const result = await applyTeamEventChange(
			counting,
			{ kind: "delete-event", eventId },
			CURRENT_RULES,
			countingWindow(env, CURRENT_RULES),
			NOW,
		);

		expect(result.affected).toEqual(riders);
		// One read of the event, one of the riders, one write.
		expect(batches).toBe(3);
		for (const athleteId of riders) {
			expect((await balance(athleteId)).teamRynke).toBe(0);
			await expectConsistent(athleteId);
		}
	});
});

describe("teamEventChange", () => {
	function evaluations() {
		return ctx.queue.sent.map((m) => m.body);
	}

	it("sends one evaluate-rider per affected rider, ascending, after its batch", async () => {
		const eventId = await insertEvent("team_training", "2026-05-02");
		const result = await teamEventChange(ctx, {
			kind: "add-attendance",
			eventId,
			athleteIds: [ATHLETE_B, ATHLETE_A],
		});
		expect(result.affected).toEqual([ATHLETE_A, ATHLETE_B]);
		expect(evaluations()).toEqual([
			{ kind: "evaluate-rider", athleteId: ATHLETE_A },
			{ kind: "evaluate-rider", athleteId: ATHLETE_B },
		]);
		expect((await balance(ATHLETE_A)).teamRynke).toBe(1);
	});

	it("sends nothing for a create, a new name or a refusal", async () => {
		const { eventId } = await teamEventChange(ctx, {
			kind: "create-event",
			event: { kind: "team_training", date: "2026-05-02", name: null },
		});
		await attendRaw(eventId as number, [ATHLETE_A]);
		await teamEventChange(ctx, {
			kind: "update-event",
			eventId: eventId as number,
			event: { kind: "team_training", date: "2026-05-02", name: NAME },
		});
		expect(
			await refusal(
				teamEventChange(ctx, {
					kind: "add-attendance",
					eventId: eventId as number,
					athleteIds: [ATHLETE_C],
				}),
			),
		).toBe("rider_not_connected");
		expect(evaluations()).toEqual([]);
	});
});
