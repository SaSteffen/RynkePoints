// What a rider sees at one team event and what their report counts as
// (feature 019 data-model.md "Derived state", research R1, R2). Pure: no
// bindings, no clock; `today` is the team's calendar day.

/**
 * - `join`: the event is still to come, no report: "Bin dabei".
 * - `intent`: still to come, reported: green, may be withdrawn.
 * - `report`: taken place, no report, no attendance: "Ich war dabei".
 * - `request`: taken place, reported, no attendance: locked, open request.
 * - `attended`: attendance recorded: "Du warst dabei".
 */
export type ReportState = "join" | "intent" | "report" | "request" | "attended";

/** An event has taken place from its date on (research R2). */
export function hasTakenPlace(date: string, today: string): boolean {
	return date <= today;
}

export function reportState(event: {
	date: string;
	today: string;
	attended: boolean;
	reported: boolean;
}): ReportState {
	if (event.attended) return "attended";
	if (hasTakenPlace(event.date, event.today)) {
		return event.reported ? "request" : "report";
	}
	return event.reported ? "intent" : "join";
}
