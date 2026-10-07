// Team events earn fixed Team and Training Rynke per kind (FR-006, FR-007,
// research R17–R19). Pure like `rides.ts`: no bindings, no clock. `rules.ts`
// imports the kinds from here at runtime, so this file imports from it with
// `import type` only.

import type { CountingWindow, RynkeRules } from "./rules";

/** The kind codes of contracts/ride-evaluation.md, in contract order. */
export const TEAM_EVENT_KINDS = [
	"team_training",
	"training_weekend_day",
	"technique_training",
] as const;

export type TeamEventKind = (typeof TEAM_EVENT_KINDS)[number];

export function isTeamEventKind(value: string): value is TeamEventKind {
	return (TEAM_EVENT_KINDS as readonly string[]).includes(value);
}

/** One attended event, from `attendances` joined with `team_events`. */
export interface Attendance {
	eventId: number;
	kind: TeamEventKind;
	/** `YYYY-MM-DD` */
	date: string;
}

/** What a rider's events of one kind earn (the balance's breakdown entry). */
export interface TeamEventSum {
	kind: TeamEventKind;
	attended: number;
	team: number;
	training: number;
}

export interface AttendanceEvaluation {
	/** One entry per kind, in `TEAM_EVENT_KINDS` order. */
	byKind: TeamEventSum[];
	team: number;
	training: number;
}

/**
 * Counts each event inside the window once and multiplies by the rules'
 * amounts (research R19). The clock is never read: an event dated in the
 * future counts like any other (FR-002).
 */
export function evaluateAttendance(
	attendance: readonly Attendance[],
	rules: RynkeRules,
	window: CountingWindow,
): AttendanceEvaluation {
	const events = new Map<TeamEventKind, Set<number>>(
		TEAM_EVENT_KINDS.map((kind) => [kind, new Set()]),
	);
	for (const { eventId, kind, date } of attendance) {
		if (
			date >= window.seasonStart &&
			(window.deadline === null || date <= window.deadline)
		) {
			events.get(kind)?.add(eventId);
		}
	}
	const byKind = TEAM_EVENT_KINDS.map((kind) => {
		const attended = events.get(kind)?.size ?? 0;
		const amounts = rules.teamEvents[kind];
		return {
			kind,
			attended,
			team: attended * amounts.team,
			training: attended * amounts.training,
		};
	});
	return {
		byKind,
		team: byKind.reduce((n, s) => n + s.team, 0),
		training: byKind.reduce((n, s) => n + s.training, 0),
	};
}
