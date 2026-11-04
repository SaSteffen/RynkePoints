import { cloudflareAnalytics } from "../config";
import { type CloudflareAllowance, daysBefore, utcDay } from "./allowances";

// Cloudflare's figures for the account, once per hourly run (feature 025
// contracts/cloudflare-analytics.md, research R3). Results come per Worker,
// database and queue and are summed here, so feature 026 can split them with no
// new query. The token is never logged, and of a response only Cloudflare's own
// error message is, which holds no rider data.

const GRAPHQL_URL = "https://api.cloudflare.com/client/v4/graphql";

/** Each part was run against Cloudflare's API on 2026-11-04 (research R3). */
export const USAGE_QUERY = `query Usage($accountTag: string!, $from: Date!, $to: Date!) {
	viewer {
		accounts(filter: { accountTag: $accountTag }) {
			workers: workersInvocationsAdaptive(limit: 10000, filter: { date_geq: $from, date_leq: $to }) {
				sum { requests }
				dimensions { date scriptName }
			}
			queues: queueMessageOperationsAdaptiveGroups(limit: 10000, filter: { date_geq: $from, date_leq: $to }) {
				sum { billableOperations }
				dimensions { date queueId }
			}
			databases: d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $from, date_leq: $to }) {
				sum { rowsRead rowsWritten }
				dimensions { date databaseId }
			}
			storage: d1StorageAdaptiveGroups(limit: 10000, filter: { date_geq: $from, date_leq: $to }) {
				max { databaseSizeBytes }
				dimensions { date databaseId }
			}
		}
	}
}`;

/** Per UTC day, the values Cloudflare returned for that day. */
export type CloudflareDays = Map<
	string,
	Partial<Record<CloudflareAllowance, number>>
>;

export type CloudflareResult =
	| { kind: "ok"; today: string; yesterday: string; days: CloudflareDays }
	| { kind: "unavailable"; reason: string };

function unavailable(reason: string): CloudflareResult {
	return { kind: "unavailable", reason };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Why Cloudflare refused the query, in a line short enough for a log. */
function errorReason(errors: unknown[]): string {
	const first = errors[0];
	const message = isRecord(first) ? first.message : undefined;
	return typeof message === "string"
		? `errors in the response: ${message.slice(0, 200)}`
		: "errors in the response";
}

/** Adds each group's field to its day; false on an unexpected shape. */
function collect(
	days: CloudflareDays,
	groups: unknown,
	block: "sum" | "max",
	fields: readonly [string, CloudflareAllowance][],
): boolean {
	if (!Array.isArray(groups)) return false;
	for (const group of groups) {
		if (!isRecord(group) || !isRecord(group.dimensions)) return false;
		const values = group[block];
		const { date } = group.dimensions;
		if (!isRecord(values) || typeof date !== "string") return false;
		const day = days.get(date) ?? {};
		for (const [field, allowance] of fields) {
			const value = values[field];
			if (typeof value !== "number") return false;
			day[allowance] = (day[allowance] ?? 0) + value;
		}
		days.set(date, day);
	}
	return true;
}

/** The days in `body`, or null when it isn't what the query asks for. */
export function parseUsage(body: unknown): CloudflareDays | null {
	if (!isRecord(body) || !isRecord(body.data)) return null;
	const { viewer } = body.data;
	if (!isRecord(viewer) || !Array.isArray(viewer.accounts)) return null;
	const account: unknown = viewer.accounts[0];
	if (!isRecord(account)) return null;
	const days: CloudflareDays = new Map();
	const parsed =
		collect(days, account.workers, "sum", [
			["requests", "cf_worker_requests"],
		]) &&
		collect(days, account.queues, "sum", [
			["billableOperations", "cf_queue_operations"],
		]) &&
		collect(days, account.databases, "sum", [
			["rowsRead", "cf_d1_rows_read"],
			["rowsWritten", "cf_d1_rows_written"],
		]) &&
		collect(days, account.storage, "max", [
			["databaseSizeBytes", "cf_d1_storage_bytes"],
		]);
	return parsed ? days : null;
}

/**
 * Yesterday's and today's figures, so Cloudflare's later corrections reach
 * yesterday's record. Never throws: any failure just reads as unavailable, and
 * without the secrets it asks nobody (FR-028).
 */
export async function fetchCloudflareUsage(
	env: object,
	now: number,
): Promise<CloudflareResult> {
	const analytics = cloudflareAnalytics(env);
	if (!analytics) return unavailable("not configured");
	const today = utcDay(now);
	const yesterday = daysBefore(today, 1);
	let response: Response;
	try {
		response = await fetch(GRAPHQL_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${analytics.token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: USAGE_QUERY,
				variables: {
					accountTag: analytics.accountId,
					from: yesterday,
					to: today,
				},
			}),
		});
	} catch {
		return unavailable("network error");
	}
	if (!response.ok) return unavailable(`HTTP ${response.status}`);
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		return unavailable("unreadable response");
	}
	if (isRecord(body) && Array.isArray(body.errors) && body.errors.length > 0) {
		return unavailable(errorReason(body.errors));
	}
	const days = parseUsage(body);
	if (!days) return unavailable("unexpected response");
	return { kind: "ok", today, yesterday, days };
}
