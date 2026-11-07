import { createMessageBatch, env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SAMPLE_RIDERS } from "../../dev/fake-strava/samples";
import {
	type DevEnv,
	devFetch,
	devQueue,
	removeStravaInterceptor,
} from "../../dev/worker";
import { TEAMS } from "../../src/teams";
import { makeCtx, resetDb, sessionCookie, type TestCtx } from "../support/ctx";
import { NOW } from "../support/fixtures";
import PINNED_VARS from "../support/pinned.json";

// The synthetic sample season recalculated with today's code (feature 026
// T036, SC-002): Rynke, badges and the rider and Team page texts of every
// sample rider, compared with a committed snapshot. Release 2 moves settings,
// rules and art behind team data; none of it may change a figure or a word
// for the founding team, so this file stays byte-identical through it. A
// deliberate change of figures or texts updates it with `vitest -u`.
//
// Deterministic: the clock is the tests' fixed NOW, the database starts empty,
// and the page's two random picks (the hero coin's portrait and the Team
// page's phrase) always take the first choice.

const LOCAL = "http://localhost:8789";
const PAGES = ["/me", "/me/rides", "/me/badges", "/team"] as const;

let ctx: TestCtx;

/** Runs the queued messages through the dev entry until none are ready. */
async function drain(): Promise<void> {
	for (let round = 0; round < 100; round++) {
		const ready = ctx.queue.sent.filter((m) => m.delaySeconds === undefined);
		if (ready.length === 0) return;
		const delayed = ctx.queue.sent.filter((m) => m.delaySeconds !== undefined);
		ctx.queue.sent.splice(0, ctx.queue.sent.length, ...delayed);
		await devQueue(
			createMessageBatch(
				"rynke-points-work",
				ready.map((m, i) => ({
					id: `m${round}-${i}`,
					timestamp: new Date(NOW * 1000),
					attempts: 1,
					body: m.body,
				})),
			),
			ctx,
		);
	}
	throw new Error("the queue didn't drain in 100 rounds");
}

/** A page's visible text, one block per line: no markup, scripts or styles. */
function pageText(markup: string): string {
	return markup
		.replace(/<(script|style|template)\b[\s\S]*?<\/\1>/gi, "")
		.replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
		.replace(/<img\b[^>]*\bsrc="([^"]*)"[^>]*>/gi, " [img $1] ")
		.replace(
			/<\/(p|li|h[1-6]|div|section|tr|dt|dd|figcaption|header|footer|button|a)>/gi,
			"\n",
		)
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.split("\n")
		.map((line) => line.replace(/\s+/g, " ").trim())
		.filter((line) => line !== "")
		.join("\n");
}

async function rows(sql: string, ...params: unknown[]): Promise<unknown[]> {
	const { results } = await env.DB.prepare(sql)
		.bind(...params)
		.all();
	return results;
}

// The founding team's season; the other teams' samples are their own (T053).
describe.skipIf(env.TEAM_ID !== TEAMS[0]?.id)(
	"the sample season (SC-002)",
	() => {
		beforeAll(async () => {
			await resetDb();
			await env.DB.batch([
				env.DB.prepare("DROP TABLE IF EXISTS fake_strava_activities"),
				env.DB.prepare("DROP TABLE IF EXISTS fake_strava_seed"),
				env.DB.prepare("DROP TABLE IF EXISTS fake_dev_clock"),
			]);
			vi.spyOn(Math, "random").mockReturnValue(0);
			vi.spyOn(crypto, "getRandomValues").mockImplementation((array) => {
				if (array instanceof DataView || array === null) return array;
				(array as Uint8Array).fill(0);
				return array;
			});
			vi.spyOn(console, "log").mockImplementation(() => {});
			// The suite's settings pinned, so a deploy setting never changes the snapshot.
			const devEnv: DevEnv = {
				...env,
				...PINNED_VARS,
				RYNKE_FAKE_STRAVA: "local-only",
			};
			ctx = { ...makeCtx(), env: devEnv };
			// The first request seeds the sample riders through the app's connect flow.
			const index = await devFetch(new Request(`${LOCAL}/_dev/`), ctx);
			expect(index.status).toBe(200);
			await index.text();
			await drain();
		}, 120_000);

		afterAll(() => {
			removeStravaInterceptor();
			vi.restoreAllMocks();
		});

		it("recalculates to the committed snapshot", async () => {
			const parts: string[] = [];
			const riders = [...SAMPLE_RIDERS].sort(
				(a, b) => a.athleteId - b.athleteId,
			);
			for (const rider of riders) {
				const id = rider.athleteId;
				parts.push(`=== ${id} ${rider.firstName}`);
				const stored = await rows(
					"SELECT status, import_status FROM riders WHERE athlete_id = ?",
					id,
				);
				parts.push(`rider ${JSON.stringify(stored)}`);
				if (stored.length === 0) continue;
				parts.push(
					`balance ${JSON.stringify(
						await rows("SELECT * FROM rynke_balances WHERE athlete_id = ?", id),
					)}`,
					`rides ${JSON.stringify(
						await rows(
							`SELECT strava_activity_id, counts, reasons, overlaps_activity_id,
							distance_rynke, elevation_dm, is_virtual, unknown_figures,
							rules_version
						FROM ride_results WHERE athlete_id = ? ORDER BY strava_activity_id`,
							id,
						),
					)}`,
					`badges ${JSON.stringify(
						await rows(
							"SELECT badge_id, earned_on FROM rider_badges WHERE athlete_id = ? ORDER BY badge_id",
							id,
						),
					)}`,
				);
				const cookies = await sessionCookie(ctx, id);
				const cookie = Object.entries(cookies)
					.map(([k, v]) => `${k}=${v}`)
					.join("; ");
				for (const path of PAGES) {
					const response = await devFetch(
						new Request(`${LOCAL}${path}`, { headers: { Cookie: cookie } }),
						ctx,
					);
					const body = await response.text();
					parts.push(`--- ${path} ${response.status}`, pageText(body));
				}
			}
			await expect(`${parts.join("\n")}\n`).toMatchFileSnapshot(
				"./__snapshots__/season-snapshot.txt",
			);
		}, 120_000);
	},
);
