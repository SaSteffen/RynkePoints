// A setting listing teams by ID and origin, `[{"id": …, "origin": …}]`: the
// gateway's `TEAMS` (feature 026 contracts/gateway.md) and each team's
// `USAGE_PEERS` (contracts/usage-exchange.md).

export interface TeamOrigin {
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

/** Parses `raw`; throws, naming `setting`, on anything but a valid list. */
export function parseTeamOrigins(raw: string, setting: string): TeamOrigin[] {
	const json: unknown = JSON.parse(raw);
	if (!Array.isArray(json)) throw new Error(`${setting} is not a list`);
	const teams: TeamOrigin[] = [];
	for (const entry of json) {
		const id = (entry as { id?: unknown })?.id;
		const origin = originOf((entry as { origin?: unknown })?.origin);
		if (typeof id !== "string" || !TEAM_ID.test(id) || origin === null) {
			throw new Error(`${setting} has an invalid entry`);
		}
		if (teams.some((team) => team.id === id)) {
			throw new Error(`${setting} repeats a team`);
		}
		teams.push({ id, origin });
	}
	return teams;
}
