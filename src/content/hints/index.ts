import type { TeamData } from "../../teams/types";
import { phraseSet } from "../index";
import { HINTS_DE } from "./de";
import { HINTS_EN } from "./en";
import type { HintLines } from "./types";

/**
 * The team's hint lines (FR-014, research R6): in the language of its quotes,
 * whatever the rider picked. German for a team with German phrases, English
 * for every other.
 */
export function hintLinesFor(team: Pick<TeamData, "phrases">): HintLines {
	return phraseSet(team).locale === "de" ? HINTS_DE : HINTS_EN;
}
