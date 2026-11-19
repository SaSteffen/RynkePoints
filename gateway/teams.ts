// The gateway's teams, from the `TEAMS` setting (contracts/gateway.md).

import { parseTeamOrigins, type TeamOrigin } from "../src/team-origins";

export type GatewayTeam = TeamOrigin;

/** Parses `TEAMS`; throws on anything but a valid list. */
export function parseTeams(raw: string): GatewayTeam[] {
	return parseTeamOrigins(raw, "TEAMS");
}

/** The secret name holding a team's webhook token, e.g. TEAM_WEBHOOK_TOKEN_HAMBURG. */
export function webhookTokenName(teamId: string): string {
	return `TEAM_WEBHOOK_TOKEN_${teamId.toUpperCase().replaceAll("-", "_")}`;
}

/** The service binding to a team's Worker, e.g. TEAM_SERVICE_HAMBURG. */
export function serviceBindingName(teamId: string): string {
	return `TEAM_SERVICE_${teamId.toUpperCase().replaceAll("-", "_")}`;
}
