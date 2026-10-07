// Team events earn fixed Team and Training Rynke per kind (FR-006, FR-007,
// research R17–R19). Pure like `rides.ts`: no bindings, no clock. `rules.ts`
// imports the kinds from here at runtime, so this file imports from it with
// `import type` only.

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
