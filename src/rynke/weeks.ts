// Each rider's Training and Team Rynke at the end of every week (feature 016
// research R1, R3). Pure like `tally.ts`: the inputs come from one read, the
// figures from 003's own functions, and the last point is the stored balance.

import type { RidingSums } from "./rides";
import { CURRENT_RULES, rulesForVersion } from "./rules";
import { type Balance, extrasFrom, tally } from "./tally";
import { type Attendance, evaluateAttendance } from "./team-events";

/** A rider's counting rides of one week, summed in SQL (research R2). */
export interface WeeklyRideSum {
	/** `YYYY-MM-DD`, the Sunday ending the week. */
	weekEnd: string;
	distanceRynke: number;
	/** Unfloored, so the total is floored once (003 FR-004a). */
	elevationDm: number;
}

export interface DatedCorrection {
	/** `YYYY-MM-DD` */
	date: string;
	training: number;
	team: number;
}

export interface RiderInputs {
	rides: readonly WeeklyRideSum[];
	attendance: readonly Attendance[];
	corrections: readonly DatedCorrection[];
}

export interface WeekPoint {
	/** `YYYY-MM-DD`: the week's Sunday, or the last day for the current week. */
	weekEnd: string;
	training: number;
	team: number;
}

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 of a `YYYY-MM-DD` date; differences are whole days. */
export function dayNumber(date: string): number {
	return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

function fromDayNumber(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** The Sunday ending the Monday-to-Sunday week that holds `date`. */
function sundayOf(date: string): number {
	const day = dayNumber(date);
	// 1970-01-01 was a Thursday: (day + 4) % 7 is 0 on Sundays.
	return day + ((7 - ((day + 4) % 7)) % 7);
}

/**
 * The Sundays from the season start up to the week holding `last`, ending on
 * `last` itself; one entry before the season starts (research R3).
 */
export function weekEnds(seasonStart: string, last: string): string[] {
	const ends: string[] = [];
	const lastDayNumber = dayNumber(last);
	for (
		let sunday = sundayOf(seasonStart);
		sunday < lastDayNumber;
		sunday += 7
	) {
		ends.push(fromDayNumber(sunday));
	}
	ends.push(last);
	return ends;
}

/** Today, or the deadline once it has passed (research R3). */
export function lastDay(today: string, deadline: string | null): string {
	return deadline !== null && today > deadline ? deadline : today;
}

/**
 * One `WeekPoint` per entry of `ends`, under the rules of the balance's version.
 * Earlier points are rebuilt with `tally`; the last is the stored balance, so
 * anything dated after today lands in the current week (research R1).
 */
export function riderWeeks(
	inputs: RiderInputs,
	seasonStart: string,
	ends: readonly string[],
	balance: Balance | null,
): WeekPoint[] {
	const rules =
		(balance && rulesForVersion(balance.rulesVersion)) ?? CURRENT_RULES;
	const window = { seasonStart, deadline: rules.qualificationDeadline };
	const stepDm = rules.elevationStepM * 10;
	return ends.map((weekEnd, i) => {
		if (i === ends.length - 1) {
			return {
				weekEnd,
				training: balance?.trainingRynke ?? 0,
				team: balance?.teamRynke ?? 0,
			};
		}
		let distanceRynke = 0;
		let elevationDm = 0;
		for (const ride of inputs.rides) {
			if (ride.weekEnd > weekEnd) continue;
			distanceRynke += ride.distanceRynke;
			elevationDm += ride.elevationDm;
		}
		const riding: RidingSums = {
			distanceRynke,
			elevationDm,
			elevationRynke:
				Math.floor(elevationDm / stepDm) * rules.elevationStepRynke,
		};
		// Only Training and Team are read, so the outdoor split doesn't matter.
		const week = tally(
			{ ...riding, withoutVirtual: riding },
			extrasFrom(
				evaluateAttendance(
					inputs.attendance.filter((a) => a.date <= weekEnd),
					rules,
					window,
				),
				inputs.corrections.filter((c) => c.date <= weekEnd),
			),
			rules,
		);
		return { weekEnd, training: week.trainingRynke, team: week.teamRynke };
	});
}
