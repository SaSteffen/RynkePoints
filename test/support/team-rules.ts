import {
	currentRules,
	type RynkeRules,
	rulesForVersion as versionIn,
} from "../../src/rynke/rules";
import { TEAMS } from "../../src/teams";

// The founding team's rule history, for the suites that run as it (the `app`
// project). The app reads a team's rules from `ctx.team.rules` (feature 026
// T045); test/teams/ uses the team it runs as.

const founding = TEAMS[0];
if (!founding) throw new Error("No team registered");

/** Every version ever in effect, `CURRENT_RULES` being the last. */
export const RULES_HISTORY: readonly RynkeRules[] = founding.rules;

export const CURRENT_RULES: RynkeRules = currentRules(RULES_HISTORY);

/** The founding team's rules of a stored version; `null` for an unknown one. */
export function rulesForVersion(version: number): RynkeRules | null {
	return versionIn(RULES_HISTORY, version);
}
