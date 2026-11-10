import {
	CLOUDFLARE_LIMITS,
	type CloudflareAllowance,
} from "../src/usage/allowances";
import type { CloudflareResult } from "../src/usage/cloudflare";

// The usage check before a sandbox deployment writes anything (feature 027
// contracts/sandbox-workflow.md "Usage check", FR-033, FR-034): sandboxes share
// the account's free allowances with production, so a deployment stops while
// the account is past half of one, when Cloudflare's figures can't be read, or
// when the sandboxes' own writes today would pass their budget.
// `scripts/sandbox-usage.mjs` runs it on CI. Nothing under src/ imports it.

/** The share of a daily allowance above which no sandbox deploys. */
export const SANDBOX_USAGE_THRESHOLD = 0.5;

/** Rows the sandbox databases may write in a day, seeds included. */
export const SANDBOX_DAILY_BUDGET = 40_000;

export type SandboxVerdict = { go: boolean; lines: string[] };

const CHECKED: [CloudflareAllowance, string][] = [
	["cf_d1_rows_written", "D1 rows written with the seed"],
	["cf_d1_rows_read", "D1 rows read"],
	["cf_queue_operations", "Queue operations"],
];

/**
 * Whether a deployment that writes `seedRows` may go, with one line per
 * figure. Today's rows written count the seed; values Cloudflare hasn't
 * reported yet count as zero; exactly at a limit still goes.
 */
export function sandboxUsageVerdict(
	result: CloudflareResult,
	seedRows: number,
	sandboxDatabaseIds: readonly string[],
): SandboxVerdict {
	if (result.kind === "unavailable") {
		return {
			go: false,
			lines: [`Cloudflare's figures are unavailable (${result.reason})`],
		};
	}
	const today = result.days.get(result.today) ?? {};
	let go = true;
	const lines: string[] = [];
	for (const [allowance, name] of CHECKED) {
		const value =
			(today[allowance] ?? 0) +
			(allowance === "cf_d1_rows_written" ? seedRows : 0);
		const limit = CLOUDFLARE_LIMITS[allowance];
		const above = value > limit * SANDBOX_USAGE_THRESHOLD;
		if (above) go = false;
		lines.push(
			`${name} at ${value} of ${limit} today${above ? `, above ${SANDBOX_USAGE_THRESHOLD * 100} %` : ""}`,
		);
	}
	const sandboxRows =
		seedRows +
		result.parts
			.filter(
				(part) =>
					part.day === result.today &&
					part.kind === "database" &&
					part.allowance === "cf_d1_rows_written" &&
					sandboxDatabaseIds.includes(part.id),
			)
			.reduce((sum, part) => sum + part.value, 0);
	const overBudget = sandboxRows > SANDBOX_DAILY_BUDGET;
	if (overBudget) go = false;
	lines.push(
		`Sandbox databases' rows written with the seed at ${sandboxRows} of ${SANDBOX_DAILY_BUDGET} today${overBudget ? ", above the budget" : ""}`,
	);
	return { go, lines };
}
