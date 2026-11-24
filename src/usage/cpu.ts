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
				quantiles { cpuTimeP99 cpuTimeP50 }
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
	/**
	 * The CPU time half the runs stayed under, in microseconds (feature 049).
	 * NULL: none recorded, never 0.
	 */
	p50Us: number | null;
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
	p50Us: number;
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
			found = { day, script, runs: 0, cutOff: 0, p99Us: 0, p50Us: 0 };
			byKey.set(key, found);
		}
		return found;
	};
	for (const group of runs) {
		if (!isRecord(group) || !isRecord(group.dimensions)) return null;
		if (!isRecord(group.sum) || !isRecord(group.quantiles)) return null;
		const { date, scriptName } = group.dimensions;
		const { requests } = group.sum;
		const { cpuTimeP99, cpuTimeP50 } = group.quantiles;
		if (typeof date !== "string" || typeof scriptName !== "string") return null;
		if (
			typeof requests !== "number" ||
			typeof cpuTimeP99 !== "number" ||
			typeof cpuTimeP50 !== "number"
		) {
			return null;
		}
		const found = entry(date, scriptName);
		found.runs += requests;
		found.p99Us = Math.max(found.p99Us, Math.round(cpuTimeP99));
		found.p50Us = Math.max(found.p50Us, Math.round(cpuTimeP50));
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
 * and the median the highest of its Workers. A Worker of no team, such as a sandbox, is left out.
 */
export function cpuByOwner(
	scripts: readonly ScriptDay[],
	teams: readonly TeamResources[],
): CpuDay[] {
	const byKey = new Map<string, CpuDay>();
	for (const { day, script, runs, cutOff, p99Us, p50Us } of scripts) {
		const owner = ownerOf("worker", script, teams);
		if (owner === null) continue;
		const key = `${day} ${owner}`;
		const found = byKey.get(key);
		if (found) {
			found.runs += runs;
			found.cutOff += cutOff;
			found.p99Us = Math.max(found.p99Us, p99Us);
			found.p50Us = higher(found.p50Us, p50Us);
		} else {
			byKey.set(key, { day, owner, runs, cutOff, p99Us, p50Us });
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

/** A day of the usage view's CPU table: this team, the other teams together, the gateway. */
export interface CpuRow {
	day: string;
	own: CpuDay | null;
	others: CpuDay | null;
	shared: CpuDay | null;
}

/** The higher of two medians; null only when neither was recorded. */
function higher(a: number | null, b: number | null): number | null {
	if (a === null) return b;
	if (b === null) return a;
	return Math.max(a, b);
}

/**
 * The days' records by owner, other teams added up (the slowest runs and the
 * median the highest of them), newest first.
 */
export function cpuRows(days: readonly CpuDay[], self: string): CpuRow[] {
	const rows = new Map<string, CpuRow>();
	for (const record of days) {
		let row = rows.get(record.day);
		if (!row) {
			row = { day: record.day, own: null, others: null, shared: null };
			rows.set(record.day, row);
		}
		if (record.owner === self) row.own = record;
		else if (record.owner === SHARED) row.shared = record;
		else if (row.others === null) row.others = { ...record };
		else {
			row.others.runs += record.runs;
			row.others.cutOff += record.cutOff;
			row.others.p99Us = Math.max(row.others.p99Us, record.p99Us);
			row.others.p50Us = higher(row.others.p50Us, record.p50Us);
		}
	}
	return [...rows.values()].sort((a, b) => b.day.localeCompare(a.day));
}

// The season graph (feature 049): the medians by week over the season.

/** A season's first and last UTC day, `YYYY-MM-DD`. */
export interface Season {
	from: string;
	to: string;
}

/**
 * The season `day` falls in: 1 September to 31 August, the same for every team
 * (feature 049 FR-020), not the team's counting window.
 */
export function seasonOf(day: string): Season {
	const year = Number(day.slice(0, 4));
	const start = day.slice(5) >= "09-01" ? year : year - 1;
	return { from: `${start}-09-01`, to: `${start + 1}-08-31` };
}

/** A week of the season graph, Monday to Sunday, cut at the season's edges. */
export interface WeekSlot {
	from: string;
	to: string;
	/** Each owner group's highest daily median that week, µs; null: none. */
	own: number | null;
	others: number | null;
	shared: number | null;
	/** Starts after today: no value, no tip. */
	toCome: boolean;
}

const DAY_MS = 86_400_000;
const dayAt = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const msOf = (day: string) => Date.parse(`${day}T00:00:00Z`);

/**
 * The season of `today` in week slots, each owner group's value the highest
 * daily median of its days (the max strategy, FR-005); days without a median
 * count for nothing, so a week without any is a gap, never zero. The owners
 * are grouped as the table groups them (`cpuRows`).
 */
export function weekSlots(
	days: readonly CpuDay[],
	self: string,
	today: string,
): WeekSlot[] {
	const season = seasonOf(today);
	const end = msOf(season.to);
	const slots: WeekSlot[] = [];
	for (let at = msOf(season.from); at <= end; ) {
		// Sunday ends a week: 0 is Sunday, so 6 days on from Monday (1).
		const toSunday = (7 - new Date(at).getUTCDay()) % 7;
		const last = Math.min(at + toSunday * DAY_MS, end);
		const from = dayAt(at);
		slots.push({
			from,
			to: dayAt(last),
			own: null,
			others: null,
			shared: null,
			toCome: from > today,
		});
		at = last + DAY_MS;
	}
	const inSeason = days.filter(
		(d) => d.day >= season.from && d.day <= season.to && d.day <= today,
	);
	for (const row of cpuRows(inSeason, self)) {
		const slot = slots.find((s) => s.from <= row.day && row.day <= s.to);
		if (!slot) continue;
		slot.own = higher(slot.own, row.own?.p50Us ?? null);
		slot.others = higher(slot.others, row.others?.p50Us ?? null);
		slot.shared = higher(slot.shared, row.shared?.p50Us ?? null);
	}
	return slots;
}
