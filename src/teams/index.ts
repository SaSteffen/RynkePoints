import { europe } from "./europe";
import { hamburg } from "./hamburg";
import type { TeamData } from "./types";

// The team registry (feature 026 research R1). A deployment serves the team its
// `TEAM_ID` names. The founding team comes first.

export const TEAMS: readonly TeamData[] = [hamburg, europe];

/** The deployment's team; an unknown `TEAM_ID` is a configuration error. */
export function teamFor(env: Pick<Env, "TEAM_ID">): TeamData {
	const team = TEAMS.find((candidate) => candidate.id === env.TEAM_ID);
	if (!team) throw new Error(`Unknown TEAM_ID "${env.TEAM_ID}"`);
	return team;
}
