import { easterSunday, firstAdventSunday } from "../badges/easter";

// A team's holidays with seasonal quote monkeys (feature 035 research R2, R3,
// contracts/team-holidays.md; feature 038 research R1, R2). Each team lists its
// own in its team data; the Team page asks which ones hold the Berlin day it
// already computes.

/** A fixed day `"MM-DD"`, or `offset` days after an anchor of the year. */
export type DayRef =
	| `${string}-${string}`
	| { anchor: "first-advent" | "easter"; offset: number };

export interface Holiday {
	/** Lower-case words joined by dashes; unique in the team. */
	id: string;
	/**
	 * At least one; each a `seasonal: true` entry of art/quotes/monkeys.json;
	 * no duplicates. A quote shows one of them (feature 038 research R3).
	 */
	monkeys: readonly string[];
	/** The window's first day. */
	from: DayRef;
	/** Its last day, inclusive; before `from` in the year: over the year end. */
	to: DayRef;
	/** `short`: every quote shows a monkey of the set; `long`: about half of them. */
	kind: "short" | "long";
}

const DAY = 86_400_000;

/** `ref` in `year` as days since 1970-01-01 (UTC). */
function dayOf(ref: DayRef, year: number): number {
	if (typeof ref === "string")
		return Date.parse(`${year}-${ref}T00:00:00Z`) / DAY;
	const anchor =
		ref.anchor === "easter" ? easterSunday(year) : firstAdventSunday(year);
	return Date.parse(`${anchor}T00:00:00Z`) / DAY + ref.offset;
}

/**
 * The holidays whose window holds `today` (Berlin `YYYY-MM-DD`): of several the
 * ones with the fewest days, every one on a tie, in list order; none without
 * any (feature 038 research R2).
 */
export function holidaysOn(
	today: string,
	holidays: readonly Holiday[],
): readonly Holiday[] {
	const year = Number(today.slice(0, 4));
	const day = Date.parse(`${today}T00:00:00Z`) / DAY;
	let best: Holiday[] = [];
	let bestDays = Number.POSITIVE_INFINITY;
	for (const holiday of holidays) {
		// The window starting last year can still run into this one.
		for (const start of [year - 1, year]) {
			const from = dayOf(holiday.from, start);
			let to = dayOf(holiday.to, start);
			if (to < from) to = dayOf(holiday.to, start + 1);
			const days = to - from + 1;
			if (day < from || day > to || days > bestDays) continue;
			if (days < bestDays) {
				best = [];
				bestDays = days;
			}
			best.push(holiday);
			break;
		}
	}
	return best;
}
