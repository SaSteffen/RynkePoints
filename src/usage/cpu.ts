import { isRecord, queryCloudflare } from "./cloudflare";
import { ownerOf, SHARED, type TeamResources } from "./split";

// The Workers' CPU time (feature 025 User Story 6, FR-041 to FR-045). Each run
// of a Worker may use `CPU_LIMIT_MS` of CPU on the free plan; a run that goes
// over is cut off. The limit is per run, not per day, so nothing here is a
// percentage of it: a day is marked by the runs cut off against all runs, and the
// slowest runs' CPU time is shown beside the limit unmarked, since Cloudflare
// forgives occasional overruns. Asked in a query of its own, so its failure
// never touches the other Cloudflare figures (FR-045).

/** Workers Free: CPU per run. */
export const CPU_LIMIT_MS = 10;

/** Cloudflare's status of a run cut off for going over a limit, mostly CPU. */
export const CUT_OFF_STATUS = "exceededResources";

/** Runs, CPU time and cut-off runs per Worker and day. */
export const CPU_QUERY = `query Cpu($accountTag: string!, $from: Date!, $to: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			runs: workersInvocationsAdaptive(limit: 10000, filter: { date_geq: $from, date_leq: $to }) {
				sum { requests }
				quantiles { cpuTimeP99 }
				dimensions { date scriptName }
			}
			outcomes: workersInvocationsAdaptive(limit: 10000, filter: { date_geq: $from, date_leq: $to }) {
				sum { requests }
				dimensions { date scriptName status }
			}
		}
	}
}`;

/** One owner's day: a team ID or `SHARED` for the gateway. */
export interface CpuDay {
	day: string;
	owner: string;
	runs: number;
	cutOff: number;
	/** The CPU time the slowest 1 in 100 runs reached, in microseconds. */
	p99Us: number;
}

export type CpuResult =
	| { kind: "ok"; days: CpuDay[] }
	| { kind: "unavailable"; reason: string };

export type CpuLevel = "ok" | "warning" | "critical";

/** Warning for any run cut off, critical above 1 in 100 (FR-043). */
export function cpuLevel(runs: number, cutOff: number): CpuLevel {
	if (cutOff <= 0) return "ok";
	return cutOff * 100 > runs ? "critical" : "warning";
}

interface ScriptDay {
	day: string;
	script: string;
	runs: number;
	cutOff: number;
	p99Us: number;
}

/**
 * Each Worker's days in `body`, or null when it isn't what `CPU_QUERY` asks
 * for. Cloudflare reports CPU time in microseconds.
 */
export function parseCpu(body: unknown): ScriptDay[] | null {
	if (!isRecord(body) || !isRecord(body.data)) return null;
	const { viewer } = body.data;
	if (!isRecord(viewer) || !Array.isArray(viewer.accounts)) return null;
	const account: unknown = viewer.accounts[0];
	if (!isRecord(account)) return null;
	const { runs, outcomes } = account;
	if (!Array.isArray(runs) || !Array.isArray(outcomes)) return null;
	const byKey = new Map<string, ScriptDay>();
	const entry = (day: string, script: string) => {
		const key = `${day} ${script}`;
		let found = byKey.get(key);
		if (!found) {
			found = { day, script, runs: 0, cutOff: 0, p99Us: 0 };
			byKey.set(key, found);
		}
		return found;
	};
	for (const group of runs) {
		if (!isRecord(group) || !isRecord(group.dimensions)) return null;
		if (!isRecord(group.sum) || !isRecord(group.quantiles)) return null;
		const { date, scriptName } = group.dimensions;
		const { requests } = group.sum;
		const { cpuTimeP99 } = group.quantiles;
		if (typeof date !== "string" || typeof scriptName !== "string") return null;
		if (typeof requests !== "number" || typeof cpuTimeP99 !== "number") {
			return null;
		}
		const found = entry(date, scriptName);
		found.runs += requests;
		found.p99Us = Math.max(found.p99Us, Math.round(cpuTimeP99));
	}
	for (const group of outcomes) {
		if (!isRecord(group) || !isRecord(group.dimensions)) return null;
		if (!isRecord(group.sum)) return null;
		const { date, scriptName, status } = group.dimensions;
		const { requests } = group.sum;
		if (typeof date !== "string" || typeof scriptName !== "string") return null;
		if (typeof requests !== "number") return null;
		if (status === CUT_OFF_STATUS) entry(date, scriptName).cutOff += requests;
	}
	return [...byKey.values()];
}

/**
 * Each owner's days: runs and cut-off runs added up, the slowest runs' CPU time
 * the highest of its Workers. A Worker of no team, such as a sandbox, is left out.
 */
export function cpuByOwner(
	scripts: readonly ScriptDay[],
	teams: readonly TeamResources[],
): CpuDay[] {
	const byKey = new Map<string, CpuDay>();
	for (const { day, script, runs, cutOff, p99Us } of scripts) {
		const owner = ownerOf("worker", script, teams);
		if (owner === null) continue;
		const key = `${day} ${owner}`;
		const found = byKey.get(key);
		if (found) {
			found.runs += runs;
			found.cutOff += cutOff;
			found.p99Us = Math.max(found.p99Us, p99Us);
		} else {
			byKey.set(key, { day, owner, runs, cutOff, p99Us });
		}
	}
	return [...byKey.values()];
}

/** Yesterday's and today's CPU days by owner. Never throws. */
export async function fetchCpuUsage(
	env: object,
	now: number,
	teams: readonly TeamResources[],
): Promise<CpuResult> {
	const answer = await queryCloudflare(env, now, CPU_QUERY);
	if (answer.kind !== "ok") return answer;
	const scripts = parseCpu(answer.body);
	if (!scripts) return { kind: "unavailable", reason: "unexpected response" };
	return { kind: "ok", days: cpuByOwner(scripts, teams) };
}

/** The owners whose marks notify this team's administrators (FR-044). */
export function notifiesThisTeam(owner: string, self: string): boolean {
	return owner === self || owner === SHARED;
}
