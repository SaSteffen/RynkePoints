import { describe, expect, it } from "vitest";
import { evaluateRides } from "../../src/rynke/rides";
import { CURRENT_RULES } from "../../src/rynke/rules";
import { extrasFromAttendance, tally } from "../../src/rynke/tally";
import {
	type Attendance,
	evaluateAttendance,
} from "../../src/rynke/team-events";
import { RIDERS, WINDOW } from "../support/reference-riders";
import { makeRide } from "../support/rides";

describe("reference riders (SC-001)", () => {
	it("has at least 20 riders", () => {
		expect(RIDERS.length).toBeGreaterThanOrEqual(20);
	});

	it("has at least 6 riders with attendance", () => {
		expect(RIDERS.filter((r) => r.attendance).length).toBeGreaterThanOrEqual(6);
	});

	it.each(RIDERS)(
		"$name",
		({ rides, attendance = [], team = 0, training, teamRynke, qualified }) => {
			const evaluation = evaluateRides(
				rides.map(makeRide),
				CURRENT_RULES,
				WINDOW,
			);
			const events = evaluateAttendance(
				attendance.map(
					(a, i): Attendance => ({
						eventId: a.eventId ?? 100 + i,
						kind: a.kind,
						date: a.date,
					}),
				),
				CURRENT_RULES,
				WINDOW,
			);
			const extras = extrasFromAttendance(events);
			const balance = tally(
				evaluation.riding,
				{ ...extras, team: extras.team + team },
				CURRENT_RULES,
			);
			expect({
				trainingRynke: balance.trainingRynke,
				teamRynke: balance.teamRynke,
				qualified: balance.qualified,
			}).toEqual({
				trainingRynke: training,
				teamRynke: teamRynke ?? team,
				qualified,
			});
		},
	);
});
