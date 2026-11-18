import { hasEvents } from "../teams";
import type { TeamData } from "../teams/types";
import type { MessageId } from "./catalogs";

// Texts that mention Team Rynke or events inside a sentence a team without
// them still needs have a sibling `<id>.noEvents` (feature 039 research R7,
// contracts/messages.md). The base key stays the founding team's text.

/** The ids with a `.noEvents` variant in every catalog. */
export type NoEventsId = {
	[K in MessageId]: `${K}.noEvents` extends MessageId ? K : never;
}[MessageId];

/** `id` for a team with events, else its `.noEvents` variant. */
export function eventsText(
	team: Pick<TeamData, "eventKinds">,
	id: NoEventsId,
): MessageId {
	return hasEvents(team) ? id : `${id}.noEvents`;
}
