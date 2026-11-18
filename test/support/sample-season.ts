import { createMessageBatch, env } from "cloudflare:test";
import { expect, vi } from "vitest";
import {
	type DevEnv,
	devFetch,
	devQueue,
	removeStravaInterceptor,
} from "../../dev/worker";
import { makeCtx, resetDb, sessionCookie, type TestCtx } from "./ctx";
import { NOW } from "./fixtures";
import PINNED_VARS from "./pinned.json";

// A team's synthetic sample season, seeded through fake mode's connect flow
// and read back as the visible text of its pages (feature 039 research R11).
// Deterministic: the tests' fixed NOW, an empty database, the suite's
// settings pinned and the first choice for every random pick.

export const LOCAL = "http://localhost:8789";

/** The sample season's context; set by `seedSampleSeason`. */
let seasonCtx: TestCtx;

/** Runs the queued messages through the dev entry until none are ready. */
async function drain(ctx: TestCtx): Promise<void> {
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

/** Seeds the team's sample riders on an empty database; for `beforeAll`. */
export async function seedSampleSeason(): Promise<TestCtx> {
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
	const devEnv: DevEnv = {
		...env,
		...PINNED_VARS,
		// The team's own clubs: the pinned ones are the founding team's, which
		// another team's riders would see as another team's club.
		STRAVA_CLUB_ID: env.STRAVA_CLUB_ID,
		STRAVA_EXTRA_CLUB_IDS: env.STRAVA_EXTRA_CLUB_IDS,
		RYNKE_FAKE_STRAVA: "local-only",
	};
	seasonCtx = { ...makeCtx(), env: devEnv };
	const index = await devFetch(new Request(`${LOCAL}/_dev/`), seasonCtx);
	expect(index.status).toBe(200);
	await index.text();
	await drain(seasonCtx);
	return seasonCtx;
}

/** Undoes `seedSampleSeason`'s mocks; for `afterAll`. */
export function endSampleSeason(): void {
	removeStravaInterceptor();
	vi.restoreAllMocks();
}

/** A page's visible text, one block per line: no markup, scripts or styles. */
export async function pageText(markup: string): Promise<string> {
	// The runtime's HTML parser drops the elements no rider reads as text.
	const text = await new HTMLRewriter()
		.on("script, style, template, svg", {
			element(element) {
				element.remove();
			},
		})
		.transform(new Response(markup))
		.text();
	return text
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

/** The session cookie header of a seeded rider. */
export async function riderCookie(athleteId: number): Promise<string> {
	const cookies = await sessionCookie(seasonCtx, athleteId);
	return Object.entries(cookies)
		.map(([k, v]) => `${k}=${v}`)
		.join("; ");
}

/** A GET of `path` (`?lang=` set to `lang`), as `cookie`'s rider or signed out. */
export async function getPage(
	path: string,
	lang: string,
	cookie?: string,
): Promise<{ status: number; markup: string }> {
	const url = new URL(path, LOCAL);
	url.searchParams.set("lang", lang);
	const response = await devFetch(
		new Request(url, cookie ? { headers: { Cookie: cookie } } : {}),
		seasonCtx,
	);
	return { status: response.status, markup: await response.text() };
}

export async function rows(
	sql: string,
	...params: unknown[]
): Promise<unknown[]> {
	const { results } = await env.DB.prepare(sql)
		.bind(...params)
		.all();
	return results;
}
