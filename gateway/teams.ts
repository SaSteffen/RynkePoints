// The gateway's teams, from the `TEAMS` setting (contracts/gateway.md).

export interface GatewayTeam {
	id: string;
	origin: string;
}

const TEAM_ID = /^[a-z][a-z0-9-]{0,30}$/;
const LOCAL_HOST = /^(localhost|[a-z0-9-]+\.localhost|127\.0\.0\.1)$/;

function originOf(value: unknown): string | null {
	if (typeof value !== "string") return null;
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}
	// A bare origin only: no path, query or credentials.
	if (url.origin !== value) return null;
	if (url.protocol === "https:") return value;
	if (url.protocol === "http:" && LOCAL_HOST.test(url.hostname)) return value;
	return null;
}

/** Parses `TEAMS`; throws on anything but a valid list. */
export function parseTeams(raw: string): GatewayTeam[] {
	const json: unknown = JSON.parse(raw);
	if (!Array.isArray(json)) throw new Error("TEAMS is not a list");
	const teams: GatewayTeam[] = [];
	for (const entry of json) {
		const id = (entry as { id?: unknown })?.id;
		const origin = originOf((entry as { origin?: unknown })?.origin);
		if (typeof id !== "string" || !TEAM_ID.test(id) || origin === null) {
			throw new Error("TEAMS has an invalid entry");
		}
		if (teams.some((team) => team.id === id)) {
			throw new Error("TEAMS repeats a team ID");
		}
		teams.push({ id, origin });
	}
	return teams;
}

/** The secret name holding a team's webhook token, e.g. TEAM_WEBHOOK_TOKEN_HAMBURG. */
export function webhookTokenName(teamId: string): string {
	return `TEAM_WEBHOOK_TOKEN_${teamId.toUpperCase().replaceAll("-", "_")}`;
}
