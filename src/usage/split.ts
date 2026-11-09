import type { CloudflareResources } from "../teams/types";
import type { CloudflareAllowance } from "./allowances";
import type { CloudflarePart, ResourceKind } from "./cloudflare";

// Cloudflare's figures split by team (feature 026 FR-040,
// contracts/usage-exchange.md › Cloudflare). The account's answer names each
// value's Worker, queue or database, and every team's data names its own, so any
// team can split the whole account without asking another. The Strava gateway
// serves every team, so its usage counts as shared. Anything else, such as a
// sandbox, stays not attributed.

/** The gateway's Worker name, as in `gateway/wrangler.jsonc`. */
export const GATEWAY_WORKER = "rynke-points-gateway";

/** The owner of usage no single team causes. Never a team ID (`[a-z]…`). */
export const SHARED = "shared";

export interface TeamResources {
	id: string;
	cloudflare: CloudflareResources;
}

const KIND_OF: Record<CloudflareAllowance, ResourceKind> = {
	cf_worker_requests: "worker",
	cf_queue_operations: "queue",
	cf_d1_rows_read: "database",
	cf_d1_rows_written: "database",
	cf_d1_storage_bytes: "database",
};

/**
 * Whether this team's share of `allowance` is known. Workers and databases are
 * always named in team data; queue operations only once its queue IDs are.
 */
export function isSplit(
	allowance: CloudflareAllowance,
	self: CloudflareResources,
): boolean {
	return KIND_OF[allowance] !== "queue" || self.queueIds.length > 0;
}

/** The team (or `SHARED`) a resource belongs to, or null for none. */
export function ownerOf(
	kind: ResourceKind,
	id: string,
	teams: readonly TeamResources[],
): string | null {
	if (kind === "worker" && id === GATEWAY_WORKER) return SHARED;
	for (const team of teams) {
		const own =
			kind === "worker"
				? team.cloudflare.worker === id
				: kind === "database"
					? team.cloudflare.databaseId === id
					: team.cloudflare.queueIds.includes(id);
		if (own) return team.id;
	}
	return null;
}

/**
 * Each owner's value of each allowance on `day`, for every team and `SHARED`,
 * zero where nothing of theirs was used. Only allowances `isSplit` for `self`.
 */
export function splitDay(
	parts: readonly CloudflarePart[],
	day: string,
	teams: readonly TeamResources[],
	self: TeamResources,
): Map<CloudflareAllowance, Map<string, number>> {
	const split = new Map<CloudflareAllowance, Map<string, number>>();
	for (const allowance of Object.keys(KIND_OF) as CloudflareAllowance[]) {
		if (!isSplit(allowance, self.cloudflare)) continue;
		split.set(
			allowance,
			new Map([...teams.map((team) => team.id), SHARED].map((id) => [id, 0])),
		);
	}
	for (const part of parts) {
		const owners = split.get(part.allowance);
		if (part.day !== day || !owners) continue;
		const owner = ownerOf(part.kind, part.id, teams);
		if (owner !== null)
			owners.set(owner, (owners.get(owner) ?? 0) + part.value);
	}
	return split;
}
