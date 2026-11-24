import {
	type ListFigure,
	type RoutingCount,
	TEAM_FIGURES,
	type TeamFigure,
} from "./figures";

// The rows of the usage view's gateway routing table (feature 046
// contracts/usage-view.md) and FR-025's warning mark. Pure.

type PerTeam = Record<TeamFigure | ListFigure, number>;

export interface RoutingDay {
	day: string;
	copy: number;
	everyone: number;
	allRouting: number;
	allRoutingEveryone: number;
	/** This team's figures. */
	own: PerTeam;
	/** Every other team's, summed. */
	others: PerTeam;
	/** Whether any other team has a count this day. */
	hasOthers: boolean;
}

const PER_TEAM = [...TEAM_FIGURES, "added", "removed", "possible"] as const;

function zero(): PerTeam {
	return Object.fromEntries(PER_TEAM.map((f) => [f, 0])) as PerTeam;
}

/** One row per day with a count, newest first. */
export function routingDays(
	counts: readonly RoutingCount[],
	ownTeam: string,
): RoutingDay[] {
	const days = new Map<string, RoutingDay>();
	for (const { day, team, figure, count } of counts) {
		let row = days.get(day);
		if (!row) {
			row = {
				day,
				copy: 0,
				everyone: 0,
				allRouting: 0,
				allRoutingEveryone: 0,
				own: zero(),
				others: zero(),
				hasOthers: false,
			};
			days.set(day, row);
		}
		if (team === "") {
			if (
				figure === "copy" ||
				figure === "everyone" ||
				figure === "allRouting" ||
				figure === "allRoutingEveryone"
			) {
				row[figure] += count;
			}
		} else if ((PER_TEAM as readonly string[]).includes(figure)) {
			const key = figure as keyof PerTeam;
			if (team === ownTeam) row.own[key] += count;
			else {
				row.others[key] += count;
				row.hasOthers = true;
			}
		}
	}
	return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

/**
 * FR-025: a would-be miss or a possible miss on any team, or more than 1% of
 * the events that came while every team routed sent to every team.
 */
export function isWarningDay(d: RoutingDay): boolean {
	return (
		d.own.missed + d.others.missed > 0 ||
		d.own.possible + d.others.possible > 0 ||
		(d.allRouting > 0 && d.allRoutingEveryone * 100 > d.allRouting)
	);
}
