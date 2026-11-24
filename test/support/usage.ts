import { env } from "cloudflare:test";
import { vi } from "vitest";
import type { StravaAction, StravaEndpoint } from "../../src/strava/calls";

// Synthetic usage for the admin view's tests (feature 025): figures straight into
// D1, and a stubbed Cloudflare. No test reaches Cloudflare (FR-028).

export async function setStravaUsage(values: {
	observedAt: number;
	readDaily?: number;
	allDaily?: number;
	read15m?: number;
	all15m?: number;
	limitReadDaily?: number;
	limitAllDaily?: number;
	limitRead15m?: number;
	limitAll15m?: number;
	ownReadDaily?: number;
	ownAllDaily?: number;
	ownRead15m?: number;
	ownAll15m?: number;
	peakRead15m?: number;
	peakAll15m?: number;
}): Promise<void> {
	await env.DB.prepare(
		`UPDATE strava_rate_limit SET observed_at = ?, read_daily = ?, all_daily = ?,
			read_15m = ?, all_15m = ?, limit_read_daily = ?, limit_all_daily = ?,
			limit_read_15m = ?, limit_all_15m = ?, own_read_daily = ?, own_all_daily = ?,
			own_read_15m = ?, own_all_15m = ?, peak_read_15m = ?, peak_all_15m = ?
		WHERE id = 1`,
	)
		.bind(
			values.observedAt,
			values.readDaily ?? 0,
			values.allDaily ?? 0,
			values.read15m ?? 0,
			values.all15m ?? 0,
			values.limitReadDaily ?? 3000,
			values.limitAllDaily ?? 6000,
			values.limitRead15m ?? 300,
			values.limitAll15m ?? 600,
			values.ownReadDaily ?? 0,
			values.ownAllDaily ?? 0,
			values.ownRead15m ?? 0,
			values.ownAll15m ?? 0,
			values.peakRead15m ?? 0,
			values.peakAll15m ?? 0,
		)
		.run();
}

export async function seedUsageDay(
	day: string,
	allowance: string,
	used: number,
	limit: number,
	options: {
		team?: number | null;
		peak?: number | null;
		recordedAt?: number;
	} = {},
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO usage_daily (day, allowance, team, used, limit_value, team_used,
			peak_15m, recorded_at) VALUES (?, ?, 'synthetic', ?, ?, ?, ?, ?)`,
	)
		.bind(
			day,
			allowance,
			used,
			limit,
			options.team ?? null,
			options.peak ?? null,
			options.recordedAt ?? 0,
		)
		.run();
}

export async function setCloudflareState(
	success: number | null,
	failure: number | null,
): Promise<void> {
	await env.DB.prepare(
		`INSERT OR REPLACE INTO usage_source_state (source, last_success_at,
			last_failure_at) VALUES ('cloudflare', ?, ?)`,
	)
		.bind(success, failure)
		.run();
}

/** A day's Strava calls under one action and endpoint (feature 047). */
export async function seedCalls(
	day: string,
	action: StravaAction,
	endpoint: StravaEndpoint,
	calls: number,
	heldBack = 0,
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO strava_calls_daily (day, action, endpoint, calls, held_back)
		VALUES (?, ?, ?, ?, ?)`,
	)
		.bind(day, action, endpoint, calls, heldBack)
		.run();
}

/** The highest daily total Strava reported to this team on `day`. */
export async function seedSeen(day: string, seen: number): Promise<void> {
	await env.DB.prepare(
		"INSERT INTO strava_seen_daily (day, seen) VALUES (?, ?)",
	)
		.bind(day, seen)
		.run();
}

export interface CloudflareFigures {
	requests?: number;
	operations?: number;
	rowsRead?: number;
	rowsWritten?: number;
	storage?: number;
}

/** A GraphQL body with one group per listed day; each split over two resources. */
export function cloudflareBody(
	days: Record<string, CloudflareFigures>,
): unknown {
	const half = (n: number) => [Math.floor(n / 2), Math.ceil(n / 2)];
	const entries = Object.entries(days);
	return {
		data: {
			viewer: {
				accounts: [
					{
						workers: entries.flatMap(([date, f]) =>
							half(f.requests ?? 0).map((requests, i) => ({
								sum: { requests },
								dimensions: { date, scriptName: `worker-${i}` },
							})),
						),
						queues: entries.flatMap(([date, f]) =>
							half(f.operations ?? 0).map((billableOperations, i) => ({
								sum: { billableOperations },
								dimensions: { date, queueId: `queue-${i}` },
							})),
						),
						databases: entries.flatMap(([date, f]) => [
							{
								sum: {
									rowsRead: f.rowsRead ?? 0,
									rowsWritten: f.rowsWritten ?? 0,
								},
								dimensions: { date, databaseId: "db-0" },
							},
						]),
						storage: entries.flatMap(([date, f]) =>
							half(f.storage ?? 0).map((databaseSizeBytes, i) => ({
								max: { databaseSizeBytes },
								dimensions: { date, databaseId: `db-${i}` },
							})),
						),
					},
				],
			},
		},
		errors: null,
	};
}

export interface CloudflareCall {
	authorization: string | null;
	variables: { accountTag: string; from: string; to: string };
	query: string;
}

/** One Worker's day in a CPU answer (feature 025 User Story 6). */
export interface CpuFigures {
	date: string;
	scriptName: string;
	runs: number;
	cutOff?: number;
	/** Microseconds, as Cloudflare reports them. */
	cpuTimeP99?: number;
}

/** A body for `CPU_QUERY`: one group per Worker and day, split by status. */
export function cpuBody(workers: readonly CpuFigures[]): unknown {
	return {
		data: {
			viewer: {
				accounts: [
					{
						runs: workers.map((w) => ({
							sum: { requests: w.runs },
							quantiles: { cpuTimeP99: w.cpuTimeP99 ?? 0 },
							dimensions: { date: w.date, scriptName: w.scriptName },
						})),
						outcomes: workers.flatMap((w) => [
							{
								sum: { requests: w.runs - (w.cutOff ?? 0) },
								dimensions: {
									date: w.date,
									scriptName: w.scriptName,
									status: "success",
								},
							},
							...((w.cutOff ?? 0) > 0
								? [
										{
											sum: { requests: w.cutOff },
											dimensions: {
												date: w.date,
												scriptName: w.scriptName,
												status: "exceededResources",
											},
										},
									]
								: []),
						]),
					},
				],
			},
		},
		errors: null,
	};
}

/**
 * Answers Cloudflare's GraphQL endpoint; everything else goes to the earlier
 * mock. The CPU query gets `cpu` (no Workers by default) and isn't in `calls`.
 */
export function installCloudflare(
	answer: () => Response | "throw",
	cpu: () => Response | "throw" = () => Response.json(cpuBody([])),
): CloudflareCall[] {
	const spy = vi.mocked(globalThis.fetch);
	const previous = spy.getMockImplementation();
	const calls: CloudflareCall[] = [];
	spy.mockImplementation(async (input, init) => {
		const request = new Request(input, init);
		if (request.url !== "https://api.cloudflare.com/client/v4/graphql") {
			if (!previous) throw new Error(`Unexpected fetch to ${request.url}`);
			return previous(input, init);
		}
		const body = (await request.json()) as {
			query: string;
			variables: CloudflareCall["variables"];
		};
		if (body.query.startsWith("query Cpu")) {
			const response = cpu();
			if (response === "throw") throw new TypeError("Network connection lost");
			return response;
		}
		calls.push({
			authorization: request.headers.get("Authorization"),
			variables: body.variables,
			query: body.query,
		});
		const response = answer();
		if (response === "throw") throw new TypeError("Network connection lost");
		return response;
	});
	return calls;
}

export const WITH_ANALYTICS = {
	CLOUDFLARE_ANALYTICS_TOKEN: "synthetic-analytics-token",
	CLOUDFLARE_ANALYTICS_ACCOUNT_ID: "synthetic-account",
};
