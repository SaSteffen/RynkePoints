// Each rider's Training and Team Rynke at the end of every week (feature 016
// research R1, R3). Pure like `tally.ts`: the inputs come from one read, the
// figures from 003's own functions, and the last point is the stored balance.

import type { RidingSums } from "./rides";
import {
	type CountingWindow,
	CURRENT_RULES,
	type RynkeRules,
	rulesForVersion,
} from "./rules";
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
export function lastDay(today: string, deadline: string): string {
	return today > deadline ? deadline : today;
}

/**
 * One `WeekPoint` per entry of `ends`, under the rules of the balance's version.
 * Earlier points are rebuilt with `tally`; the last is the stored balance, so
 * anything dated after today lands in the current week (research R1).
 */
export function riderWeeks(
	inputs: RiderInputs,
	window: CountingWindow,
	ends: readonly string[],
	balance: Balance | null,
): WeekPoint[] {
	const rules =
		(balance && rulesForVersion(balance.rulesVersion)) ?? CURRENT_RULES;
	return ends.map((weekEnd, i) => {
		if (i === ends.length - 1) {
			return {
				weekEnd,
				training: balance?.trainingRynke ?? 0,
				team: balance?.teamRynke ?? 0,
			};
		}
		const { training, team } = tallyUpTo(
			weekEnd,
			inputs.rides.filter((ride) => ride.weekEnd <= weekEnd),
			inputs,
			rules,
			window,
		);
		return { weekEnd, training, team };
	});
}

/** A rider's counting rides of one day (feature 013 research R14). */
export interface DailyRideSum {
	/** `YYYY-MM-DD`, the ride's local start date. */
	date: string;
	distanceRynke: number;
	/** Unfloored, so the total is floored once (003 FR-004a). */
	elevationDm: number;
}

export interface DailyInputs {
	rides: readonly DailyRideSum[];
	attendance: readonly Attendance[];
	corrections: readonly DatedCorrection[];
}

export interface DayPoint {
	/** `YYYY-MM-DD` */
	date: string;
	training: number;
	team: number;
}

/**
 * The rider's Training and Team Rynke after each day that has an input (a
 * ride, an attended event or a correction), in date order, so a badge knows
 * the day its threshold was reached (feature 013 research R14).
 */
export function riderDays(
	inputs: DailyInputs,
	window: CountingWindow,
	rules: RynkeRules,
): DayPoint[] {
	const dates = [
		...new Set([
			...inputs.rides.map((r) => r.date),
			...inputs.attendance.map((a) => a.date),
			...inputs.corrections.map((c) => c.date),
		]),
	].sort();
	// The rides add up as the dates go, rather than again for every date.
	const rides = [...inputs.rides].sort((a, b) =>
		a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
	);
	const sum = { distanceRynke: 0, elevationDm: 0 };
	let next = 0;
	return dates.map((date) => {
		for (
			let ride = rides[next];
			ride && ride.date <= date;
			ride = rides[++next]
		) {
			sum.distanceRynke += ride.distanceRynke;
			sum.elevationDm += ride.elevationDm;
		}
		const { training, team } = tallyUpTo(date, [sum], inputs, rules, window);
		return { date, training, team };
	});
}

/**
 * Training and Team Rynke from these rides plus the extras dated up to `date`,
 * and the Training Rynke with only `outdoor` of the rides (003 FR-013a).
 */
function tallyUpTo(
	date: string,
	rides: readonly RideTotal[],
	extras: Pick<RiderInputs, "attendance" | "corrections">,
	rules: RynkeRules,
	window: CountingWindow,
	outdoor: readonly RideTotal[] = rides,
): { training: number; team: number; outside: number } {
	const point = tally(
		{ ...riding(rides, rules), withoutVirtual: riding(outdoor, rules) },
		extrasFrom(
			evaluateAttendance(
				extras.attendance.filter((a) => a.date <= date),
				rules,
				window,
			),
			extras.corrections.filter((c) => c.date <= date),
		),
		rules,
	);
	return {
		training: point.trainingRynke,
		team: point.teamRynke,
		outside: point.trainingWithoutVirtual,
	};
}

type RideTotal = { distanceRynke: number; elevationDm: number };

/** The rides' sums, with the elevation floored once on the total (FR-004a). */
function riding(rides: readonly RideTotal[], rules: RynkeRules): RidingSums {
	let distanceRynke = 0;
	let elevationDm = 0;
	for (const ride of rides) {
		distanceRynke += ride.distanceRynke;
		elevationDm += ride.elevationDm;
	}
	return {
		distanceRynke,
		elevationDm,
		elevationRynke:
			Math.floor(elevationDm / (rules.elevationStepM * 10)) *
			rules.elevationStepRynke,
	};
}

/** A rider's counting rides of one local day and kind (feature 009 R3). */
export interface CurveRideSum {
	/** `YYYY-MM-DD`, the rides' local start date. */
	date: string;
	virtual: boolean;
	distanceRynke: number;
	/** Unfloored, so the total is floored once (003 FR-004a). */
	elevationDm: number;
}

export interface CurveInputs {
	rides: readonly CurveRideSum[];
	attendance: readonly Attendance[];
	corrections: readonly DatedCorrection[];
}

export interface CurvePoint {
	/** `YYYY-MM-DD` */
	date: string;
	training: number;
	team: number;
	/** Training Rynke without virtual rides (003 FR-013a). */
	outside: number;
}

/**
 * The rider's totals at the end of every day from the season start to `last`
 * (feature 009 research R1, R2). Anything dated after `last` counts on `last`,
 * so the last point is the stored balance; should it still differ, the
 * balance wins, as in `riderWeeks`, and the mismatch is logged.
 */
export function riderCurve(
	inputs: CurveInputs,
	window: CountingWindow,
	last: string,
	balance: Balance,
	rules: RynkeRules,
): CurvePoint[] {
	const onOrBefore = <T extends { date: string }>(items: readonly T[]) =>
		items.map((item) => (item.date > last ? { ...item, date: last } : item));
	const extras = {
		attendance: onOrBefore(inputs.attendance),
		corrections: onOrBefore(inputs.corrections),
	};
	// The rides add up as the days go, as in `riderDays`.
	const rides = onOrBefore(inputs.rides).sort((a, b) =>
		a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
	);
	const all = { distanceRynke: 0, elevationDm: 0 };
	const outdoor = { distanceRynke: 0, elevationDm: 0 };
	let next = 0;
	const points: CurvePoint[] = [];
	for (let day = dayNumber(window.seasonStart); day <= dayNumber(last); day++) {
		const date = fromDayNumber(day);
		for (
			let ride = rides[next];
			ride && ride.date <= date;
			ride = rides[++next]
		) {
			for (const sum of ride.virtual ? [all] : [all, outdoor]) {
				sum.distanceRynke += ride.distanceRynke;
				sum.elevationDm += ride.elevationDm;
			}
		}
		points.push({
			date,
			...tallyUpTo(date, [all], extras, rules, window, [outdoor]),
		});
	}
	const end = points.at(-1);
	if (
		end &&
		(end.training !== balance.trainingRynke ||
			end.team !== balance.teamRynke ||
			end.outside !== balance.trainingWithoutVirtual)
	) {
		console.error("Progress curve disagrees with the stored balance");
		end.training = balance.trainingRynke;
		end.team = balance.teamRynke;
		end.outside = balance.trainingWithoutVirtual;
	}
	return points;
}
