import { env } from "cloudflare:test";
import { CURRENT_RULES } from "../../src/rynke/rules";
import type { Balance } from "../../src/rynke/tally";
import type { TeamEventKind } from "../../src/rynke/team-events";
import type { CurveInputs, CurveRideSum } from "../../src/rynke/weeks";
import { NOW } from "./fixtures";
import { seedBalance, seedRide } from "./rider-view";
import { attendRaw, insertEvent } from "./rynke";

// The example rider of feature 009 (tasks.md "The example rider as test
// data"): its figures were worked out by hand from the rules of version 3,
// never by running the code. Synthetic, like every fixture (Principle I).

export const EXAMPLE_WINDOW = {
	seasonStart: "2026-09-01",
	deadline: "2027-06-30",
};

export const EXAMPLE_TODAY = "2026-10-07";

/** Its rides: one a day, 10 km = 1 Rynke, 1000 m of the summed gain = 5. */
const RIDES: { date: string; km: number; m: number }[] = [
	{ date: "2026-09-03", km: 55, m: 600 },
	{ date: "2026-09-05", km: 65, m: 500 },
	{ date: "2026-09-12", km: 95, m: 300 },
	{ date: "2026-09-19", km: 64, m: 300 },
	{ date: "2026-09-20", km: 80, m: 400 },
	{ date: "2026-09-26", km: 60, m: 200 },
	{ date: "2026-10-03", km: 120, m: 800 },
];

/** Its team events, each attended. */
const EVENTS: { kind: TeamEventKind; date: string }[] = [
	{ kind: "team_training", date: "2026-09-02" },
	{ kind: "training_weekend_day", date: "2026-09-19" },
	{ kind: "training_weekend_day", date: "2026-09-20" },
	{ kind: "technique_training", date: "2026-09-23" },
	{ kind: "team_training", date: "2026-09-30" },
];

/** Its one correction. */
const CORRECTION = {
	date: "2026-10-04",
	training: 10,
	team: 0,
	reason: "Synthetic lost ride",
};

export const EXAMPLE_INPUTS: CurveInputs = {
	rides: RIDES.map(
		(ride): CurveRideSum => ({
			date: ride.date,
			virtual: false,
			distanceRynke: Math.floor(ride.km / 10),
			elevationDm: ride.m * 10,
		}),
	),
	attendance: EVENTS.map((event, i) => ({ eventId: 701 + i, ...event })),
	corrections: [
		{
			date: CORRECTION.date,
			training: CORRECTION.training,
			team: CORRECTION.team,
		},
	],
};

export const EXAMPLE_BALANCE: Balance = {
	distanceRynke: 52,
	elevationDm: 31000,
	elevationRynke: 15,
	elevationToNextStepDm: 9000,
	trainingRynke: 112,
	teamRynke: 17,
	trainingMissing: 138,
	teamMissing: 8,
	trainingWithoutVirtual: 112,
	virtualShareMissing: 55,
	qualified: false,
	rulesVersion: CURRENT_RULES.version,
	rulesEffectiveDate: CURRENT_RULES.effectiveDate,
	teamEvents: [
		{ kind: "team_training", attended: 2, team: 2, training: 10 },
		{ kind: "training_weekend_day", attended: 2, team: 10, training: 20 },
		{ kind: "technique_training", attended: 1, team: 5, training: 5 },
	],
};

/** A correction written with plain SQL, as an organiser's form stores it. */
export async function insertCorrection(
	athleteId: number,
	correction: { date: string; training: number; team: number; reason: string },
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO corrections (athlete_id, training, team, reason,
			correction_date, changed_by, changed_at)
		VALUES (?, ?, ?, ?, ?, NULL, ?)`,
	)
		.bind(
			athleteId,
			correction.training,
			correction.team,
			correction.reason,
			correction.date,
			NOW,
		)
		.run();
}

/**
 * Stores the example rider's rides with their counting results, its team
 * events and attendance, its correction and its balance for `athleteId`, a
 * rider already seeded. Ride ids start at `firstRideId`, so two riders can
 * hold the same rides.
 */
export async function seedExampleRider(
	athleteId: number,
	firstRideId = 7_100_001,
): Promise<void> {
	for (const [i, ride] of RIDES.entries()) {
		await seedRide(athleteId, {
			id: firstRideId + i,
			start_date: `${ride.date}T07:00:00Z`,
			start_date_local: `${ride.date}T09:00:00Z`,
			distance_m: ride.km * 1000,
			elevation_gain_m: ride.m,
			result: {
				counts: true,
				distanceRynke: Math.floor(ride.km / 10),
				elevationDm: ride.m * 10,
			},
		});
	}
	for (const event of EVENTS) {
		await attendRaw(await insertEvent(event.kind, event.date), [athleteId]);
	}
	await insertCorrection(athleteId, CORRECTION);
	await seedBalance(athleteId, EXAMPLE_BALANCE);
}
