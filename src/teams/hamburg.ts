import { BADGE_NAMES } from "../content/badge-names/hamburg.de";
import { HAMBURG_PHRASES } from "../content/phrases/hamburg.de";
import type { TeamData } from "./types";

/** The founding team: German by default, its own German phrases and badge names. */
export const hamburg: TeamData = {
	id: "hamburg",
	defaultLocale: "de",
	foreignLocale: "en",
	phrases: { kind: "own", locale: "de", set: HAMBURG_PHRASES },
	badgeNames: { kind: "own", locale: "de", names: BADGE_NAMES },
};
