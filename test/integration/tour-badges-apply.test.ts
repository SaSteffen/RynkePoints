import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import {
	applyTeamEventChange,
	type TeamEventChange,
} from "../../src/rynke/apply";
import { CURRENT_RULES, countingWindow } from "../../src/rynke/rules";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";

// The tour badges are personal and follow the numbering of the season's tour
// days (feature 021 US2, FR-011, FR-012): recording a rider stores the badge
// of that day, and adding, moving or deleting a tour day renumbers every
// rider's. The tests' season starts on 1 January 2026 and NOW is 6 October
// 2026, so a July tour is over. Synthetic riders and events only.

const db = env.DB;

function change(c: TeamEventChange) {
	return applyTeamEventChange(db, c, CURRENT_RULES, countingWindow(env), NOW);
}

async function day(date: string, kind = "tour_de_paris"): Promise<number> {
	const { eventId } = await change({
		kind: "create-event",
		event: { kind, date, name: null },
	});
	if (eventId === null) throw new Error("no event id");
	return eventId;
}

function attend(eventId: number, athleteIds: number[]) {
	return change({ kind: "add-attendance", eventId, athleteIds });
}

/** The rider's stored tour badges, `id@date`, in id order. */
async function tour(athleteId: number): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT badge_id, earned_on FROM rider_badges
			WHERE athlete_id = ? AND badge_id LIKE 'tour-de-paris-%'
			ORDER BY badge_id`,
		)
		.bind(athleteId)
		.all<{ badge_id: string; earned_on: string }>();
	return results.map((r) => `${r.badge_id}@${r.earned_on}`);
}

let days: number[];

beforeEach(async () => {
	await resetDb();
	const ctx = makeCtx();
	for (const athleteId of [ATHLETE_A, ATHLETE_B, ATHLETE_C]) {
		await seedRider(ctx, { athleteId });
	}
	days = [
		await day("2026-07-04"),
		await day("2026-07-05"),
		await day("2026-07-06"),
	];
	await attend(days[0] as number, [ATHLETE_A]);
	await attend(days[1] as number, [ATHLETE_A]);
	await attend(days[2] as number, [ATHLETE_B]);
});

describe("tour badges (021 US2)", () => {
	it("stores each rider the badges of the days they were recorded at", async () => {
		expect(await tour(ATHLETE_A)).toEqual([
			"tour-de-paris-1@2026-07-04",
			"tour-de-paris-2@2026-07-05",
		]);
		expect(await tour(ATHLETE_B)).toEqual(["tour-de-paris-3@2026-07-06"]);
		expect(await tour(ATHLETE_C)).toEqual([]);
	});

	it("takes a badge back with the attendance", async () => {
		await change({
			kind: "remove-attendance",
			eventId: days[1] as number,
			athleteIds: [ATHLETE_A],
		});
		expect(await tour(ATHLETE_A)).toEqual(["tour-de-paris-1@2026-07-04"]);
	});

	it("renumbers every rider's days when one is added before them", async () => {
		const result = await change({
			kind: "create-event",
			event: { kind: "tour_de_paris", date: "2026-07-03", name: null },
		});
		expect(result.affected).toEqual(
			[ATHLETE_A, ATHLETE_B].sort((a, b) => a - b),
		);
		expect(await tour(ATHLETE_A)).toEqual([
			"tour-de-paris-2@2026-07-04",
			"tour-de-paris-3@2026-07-05",
		]);
		expect(await tour(ATHLETE_B)).toEqual(["tour-de-paris-4@2026-07-06"]);
	});

	it("leaves the badges alone when another kind of event is added", async () => {
		const result = await change({
			kind: "create-event",
			event: { kind: "team_training", date: "2026-07-03", name: null },
		});
		expect(result.affected).toEqual([]);
		expect(await tour(ATHLETE_B)).toEqual(["tour-de-paris-3@2026-07-06"]);
	});

	it("renumbers when a day is deleted", async () => {
		await change({ kind: "delete-event", eventId: days[0] as number });
		expect(await tour(ATHLETE_A)).toEqual(["tour-de-paris-1@2026-07-05"]);
		expect(await tour(ATHLETE_B)).toEqual(["tour-de-paris-2@2026-07-06"]);
	});

	it("renumbers when a day moves, or stops being a tour day", async () => {
		await change({
			kind: "update-event",
			eventId: days[2] as number,
			event: { kind: "tour_de_paris", date: "2026-07-01", name: null },
		});
		expect(await tour(ATHLETE_B)).toEqual(["tour-de-paris-1@2026-07-01"]);
		expect(await tour(ATHLETE_A)).toEqual([
			"tour-de-paris-2@2026-07-04",
			"tour-de-paris-3@2026-07-05",
		]);
		await change({
			kind: "update-event",
			eventId: days[2] as number,
			event: { kind: "team_training", date: "2026-07-01", name: null },
		});
		expect(await tour(ATHLETE_B)).toEqual([]);
		expect(await tour(ATHLETE_A)).toEqual([
			"tour-de-paris-1@2026-07-04",
			"tour-de-paris-2@2026-07-05",
		]);
	});
});
