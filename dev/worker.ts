import { berlinDate, returnVia } from "../src/config";
import { CONSENT_VERSIONS, currentVersion } from "../src/consent";
import type { Ctx } from "../src/ctx";
import { clearSessionCookie } from "../src/http/session";
import { CATALOGS } from "../src/i18n/catalogs";
import { handleFetch, handleQueue, handleScheduled } from "../src/index";
import { STRAVA_ORIGIN } from "../src/strava/result";
import { teamFor } from "../src/teams";
import { sendAll } from "../src/work/messages";
import { devDay, isDay, onDevClock, pretendDay } from "./clock";
import { answerStrava } from "./fake-strava/api";
import { simulateEvent } from "./fake-strava/events";
import {
	activityPage,
	authorizePage,
	type IndexRow,
	indexPage,
	riderPage,
	type StoredState,
} from "./fake-strava/pages";
import { sampleRider, samplesFor } from "./fake-strava/sample-sets";
import { sampleFingerprint, seed } from "./fake-strava/seed";
import { badgesPage } from "./fake-strava/showcase";
import { getActivity, riderActivities, seededWith } from "./fake-strava/store";
import { encodeCode } from "./fake-strava/tokens";
import { type AccessSettings, accessRefusal, refuse } from "./sandbox-access";
import { withSandboxBar } from "./sandbox-bar";

// The dev entry of fake mode (specs/006-local-frontend-dev research R1, R2,
// R9): `pnpm dev` runs this instead of src/index.ts. It wraps the app's
// handlers, answers every request for www.strava.com from the fake, and serves
// the fake's own pages under `/_dev/`. Nothing under src/ imports it, and it
// refuses to run outside local fake mode or a release sandbox (feature 027),
// so it can't reach production.

/**
 * The marker comes from `pnpm dev`'s `--var` locally ("local-only") and from a
 * sandbox's Wrangler block ("sandbox", feature 027); production's types don't
 * declare it. So does RYNKE_FAKE_GATEWAY, the local gateway's webhook URL, when
 * `pnpm dev` runs every team behind it (feature 026 release 3): simulated events
 * then go through the gateway to every team, as Strava's do in production.
 *
 * A sandbox's block also sets its host and the Cloudflare Access application it
 * sits behind (027 contracts/access-check.md); its workflow passes the deployed
 * commit and where it came from with `--var`. src/ reads none of them.
 */
export type DevEnv = Env & {
	RYNKE_FAKE_STRAVA?: string;
	RYNKE_FAKE_GATEWAY?: string;
	/** The browser tests' fixed day, in days after the season start (dev/clock.ts). */
	RYNKE_FAKE_SEASON_DAY?: string;
	SANDBOX_HOST?: string;
	ACCESS_TEAM_DOMAIN?: string;
	ACCESS_AUD?: string;
	SANDBOX_COMMIT?: string;
	SANDBOX_SOURCE?: string;
};

/** A sandbox's host and Access application, all three non-empty. */
export type SandboxMode = AccessSettings;

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const AUTHORIZE_URL = `${STRAVA_ORIGIN}/oauth/authorize`;
const STAND_IN_PATH = "/_dev/strava/oauth/authorize";
const ACTIVITY_URL = `${STRAVA_ORIGIN}/activities/`;
const ACTIVITY_STAND_IN = "/_dev/strava/activities/";
/** The daily cron's expression in `wrangler.jsonc`, not the hourly usage one. */
const DAILY_CRON = "17 3 * * *";

/**
 * Runs only in local fake mode or a sandbox with its host and Access
 * application set; anything else throws before a request is answered.
 */
export function assertFakeMode(env: DevEnv): void {
	if (env.RYNKE_FAKE_STRAVA === "local-only") return;
	if (env.RYNKE_FAKE_STRAVA !== "sandbox") {
		throw new Error("fake Strava runs only in local fake mode or a sandbox");
	}
	if (!sandboxMode(env)) {
		throw new Error(
			"sandbox mode needs SANDBOX_HOST, ACCESS_TEAM_DOMAIN and ACCESS_AUD",
		);
	}
}

/** The sandbox's settings, or null in local fake mode or when one is missing. */
export function sandboxMode(env: DevEnv): SandboxMode | null {
	const { SANDBOX_HOST, ACCESS_TEAM_DOMAIN, ACCESS_AUD } = env;
	if (
		env.RYNKE_FAKE_STRAVA !== "sandbox" ||
		!SANDBOX_HOST ||
		!ACCESS_TEAM_DOMAIN ||
		!ACCESS_AUD
	) {
		return null;
	}
	return {
		host: SANDBOX_HOST,
		teamDomain: ACCESS_TEAM_DOMAIN,
		aud: ACCESS_AUD,
	};
}

/** The Ctx the app's own entry builds (src/index.ts). */
export function makeDevCtx(env: Env, exec: ExecutionContext): Ctx {
	return {
		env,
		queue: env.WORK_QUEUE,
		now: () => Math.floor(Date.now() / 1000),
		catalogs: CATALOGS,
		team: teamFor(env),
		consentVersions: CONSENT_VERSIONS,
		waitUntil: (promise) => exec.waitUntil(promise),
	};
}

/** The installed wrapper, what it wrapped, and the Ctx of the latest call. */
let installed: {
	intercept: typeof fetch;
	inner: typeof fetch;
	ctx: Ctx;
} | null = null;

/**
 * Sends every request for www.strava.com to the fake, never to the network.
 * Checked on every handler call: it is installed again if something (a test's
 * fetch spy) replaced it, and answers with the DB and clock of the latest call.
 * Recognised by identity: a spy wrapping it may copy its properties.
 */
export function installStravaInterceptor(ctx: Ctx): void {
	if (installed && globalThis.fetch === installed.intercept) {
		installed.ctx = ctx;
		return;
	}
	const inner = globalThis.fetch;
	const intercept = async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		if (new URL(request.url).origin !== STRAVA_ORIGIN) {
			return inner(input, init);
		}
		const { env, now } = state.ctx;
		return answerStrava(request, env, env.DB, now());
	};
	const state = { intercept: intercept as typeof fetch, inner, ctx };
	installed = state;
	globalThis.fetch = state.intercept;
}

/** Puts back the fetch the interceptor wrapped, if it is installed. */
export function removeStravaInterceptor(): void {
	if (installed && globalThis.fetch === installed.intercept) {
		globalThis.fetch = installed.inner;
	}
	installed = null;
}

/**
 * Loopback only. `*.localhost` too: every team but the founding one runs on
 * `<id>.localhost` (feature 026 contracts/dev-commands.md), which browsers
 * resolve to the loopback address.
 */
function isLocal(url: URL): boolean {
	return (
		LOCAL_HOSTS.includes(url.hostname) || url.hostname.endsWith(".localhost")
	);
}

function text(body: string, status: number): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}

/** Sends the browser to the stand-in screen instead of Strava's. */
function rewriteAuthorize(response: Response): Response {
	const location = response.headers.get("Location");
	if (!location?.startsWith(AUTHORIZE_URL)) return response;
	const rewritten = new Response(response.body, response);
	rewritten.headers.set(
		"Location",
		STAND_IN_PATH + location.slice(AUTHORIZE_URL.length),
	);
	return rewritten;
}

/**
 * Points the rider page's links to Strava at the stand-in activity page: the
 * fake's IDs exist on the real Strava too (008 research R9).
 */
function rewriteActivityLinks(response: Response): Response {
	if (!response.headers.get("Content-Type")?.startsWith("text/html")) {
		return response;
	}
	return new HTMLRewriter()
		.on("a.strava-activity", {
			element(link) {
				const href = link.getAttribute("href");
				if (href?.startsWith(ACTIVITY_URL)) {
					link.setAttribute(
						"href",
						ACTIVITY_STAND_IN + href.slice(ACTIVITY_URL.length),
					);
				}
			},
		})
		.transform(response);
}

function redirect(location: string, status: number, cookies: string[] = []) {
	const headers = new Headers({ Location: location });
	for (const cookie of cookies) headers.append("Set-Cookie", cookie);
	return new Response(null, { status, headers });
}

async function form(request: Request): Promise<FormData> {
	try {
		return await request.formData();
	} catch {
		return new FormData();
	}
}

/** The seeding in progress, shared by every request that arrives meanwhile. */
let seeding: Promise<void> | null = null;

/**
 * Seeds on the first request after start, unless the database was seeded from
 * the current sample data. A failed seed isn't recorded, so the next request
 * retries.
 */
async function seedIfNeeded(ctx: Ctx, origin: string): Promise<void> {
	if (!seeding) {
		if (
			(await seededWith(ctx.env.DB)) === (await sampleFingerprint(ctx.team.id))
		)
			return;
		seeding = reseed(ctx, origin).finally(() => {
			seeding = null;
		});
	}
	await seeding;
}

/** Reset sample data: seeds again, or waits for the seeding in progress. */
async function resetAll(ctx: Ctx, origin: string): Promise<void> {
	if (!seeding) {
		seeding = reseed(ctx, origin).finally(() => {
			seeding = null;
		});
	}
	await seeding;
}

function reseed(ctx: Ctx, origin: string): Promise<void> {
	return seed(ctx, origin, berlinDate(ctx.now()));
}

/** The app's stored state of every sample rider, in one query. */
async function storedStates(ctx: Ctx): Promise<Map<number, StoredState>> {
	const { results } = await ctx.env.DB.prepare(
		"SELECT athlete_id, status, import_status FROM riders",
	).all<{ athlete_id: number; status: string; import_status: string }>();
	return new Map(
		results.map((r) => [
			r.athlete_id,
			{ status: r.status, importStatus: r.import_status },
		]),
	);
}

/** The overview's rows: no rides read (feature 027 FR-051). */
async function indexRows(ctx: Ctx): Promise<IndexRow[]> {
	const stored = await storedStates(ctx);
	return samplesFor(ctx.team.id).riders.map((rider) => ({
		rider,
		stored: stored.get(rider.athleteId) ?? null,
	}));
}

/** `GET /_dev/riders/<athleteId>`: one sample rider's events and rides. */
async function showRider(ctx: Ctx, url: URL, athleteId: number) {
	const rider = sampleRider(ctx.team.id, athleteId);
	if (!rider) return text("Not Found", 404);
	const stored = (await storedStates(ctx)).get(athleteId) ?? null;
	return riderPage(
		rider,
		stored,
		stored ? await riderActivities(ctx.env.DB, athleteId) : [],
		url.searchParams.get("flash"),
		berlinDate(ctx.now()),
	);
}

/**
 * `POST /_dev/scheduled`: the daily cron's work, on demand (feature 027
 * research R9). Sandboxes have no cron, and the hourly usage run isn't offered:
 * a sandbox mustn't record usage or send usage alerts (FR-036).
 */
async function runDailyWork(ctx: Ctx): Promise<Response> {
	await handleScheduled(
		{
			cron: DAILY_CRON,
			scheduledTime: ctx.now() * 1000,
			noRetry() {},
		},
		ctx,
	);
	const flash = "Ran the daily work. Its messages are queued.";
	return redirect(`/_dev/?${new URLSearchParams({ flash })}`, 303);
}

/** `POST /_dev/connect`: the app's connect flow, ending on the stand-in screen. */
async function connectAs(request: Request, ctx: Ctx, url: URL) {
	const athleteId = Number((await form(request)).get("athleteId"));
	if (!sampleRider(ctx.team.id, athleteId))
		return text("Unknown sample rider", 400);
	const connect = rewriteAuthorize(
		await handleFetch(
			new Request(`${url.origin}/connect`, {
				method: "POST",
				headers: {
					Origin: url.origin,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `consent=${currentVersion(ctx.consentVersions).version}`,
			}),
			ctx,
		),
	);
	const location = connect.headers.get("Location") ?? "";
	if (!location.startsWith(STAND_IN_PATH)) {
		return text(`POST /connect answered ${connect.status}`, 500);
	}
	return redirect(
		`${location}&athlete=${athleteId}`,
		303,
		connect.headers.getSetCookie(),
	);
}

function backToThisApp(redirectUri: string, ctx: Ctx, url: URL): boolean {
	if (!URL.canParse(redirectUri)) return false;
	if (new URL(redirectUri).origin === url.origin) return true;
	const via = returnVia(ctx.env);
	return (
		via !== null &&
		redirectUri === `${via}/auth/return/${encodeURIComponent(ctx.team.id)}`
	);
}

/** `POST /_dev/strava/oauth/authorize`: back to the app, as Strava would. */
async function decide(request: Request, ctx: Ctx, url: URL) {
	const fields = await form(request);
	const redirectUri = String(fields.get("redirect_uri") ?? "");
	// Only back to this app, directly or through its gateway return address, so
	// the screen is no open redirect.
	if (!backToThisApp(redirectUri, ctx, url)) {
		return text("redirect_uri must point to this app", 400);
	}
	const back = new URL(redirectUri);
	back.searchParams.set("state", String(fields.get("state") ?? ""));
	if (fields.get("action") === "cancel") {
		back.searchParams.set("error", "access_denied");
		return redirect(back.href, 302);
	}
	const athleteId = Number(fields.get("athlete"));
	if (!sampleRider(ctx.team.id, athleteId))
		return text("Unknown sample rider", 400);
	const scopes = fields.getAll("scope").map(String);
	back.searchParams.set("code", encodeCode({ athleteId, scopes }));
	back.searchParams.set("scope", scopes.join(","));
	return redirect(back.href, 302);
}

/** `POST /_dev/clock`: pretends today is the form's day, or goes back. */
async function setClock(request: Request, ctx: Ctx): Promise<Response> {
	const fields = await form(request);
	const day = fields.has("real") ? "" : String(fields.get("day") ?? "");
	if (day !== "" && !isDay(day)) return text("day must be YYYY-MM-DD", 400);
	await pretendDay(ctx.env.DB, day === "" ? null : day);
	// Stored personal badges only count up to the day they were worked out on,
	// tour days among them: every rider again on the new day.
	const { results } = await ctx.env.DB.prepare(
		"SELECT athlete_id FROM riders WHERE status = 'connected' ORDER BY athlete_id",
	).all<{ athlete_id: number }>();
	await sendAll(
		ctx,
		results.map((r) => ({ kind: "evaluate-rider", athleteId: r.athlete_id })),
	);
	const flash =
		day === ""
			? "The clock is the real one again."
			: `The app now pretends today is ${day}. Run the daily work for its notices.`;
	return redirect(`/_dev/?${new URLSearchParams({ flash })}`, 303);
}

async function devRoute(
	request: Request,
	ctx: Ctx,
	url: URL,
): Promise<Response> {
	const route = `${request.method} ${url.pathname}`;
	const activityId = url.pathname.match(
		/^\/_dev\/strava\/activities\/(\d+)$/,
	)?.[1];
	if (request.method === "GET" && activityId !== undefined) {
		const stored = await getActivity(ctx.env.DB, Number(activityId));
		return stored ? activityPage(stored.body) : text("Not Found", 404);
	}
	const riderId = url.pathname.match(/^\/_dev\/riders\/(\d+)$/)?.[1];
	if (request.method === "GET" && riderId !== undefined) {
		return showRider(ctx, url, Number(riderId));
	}
	switch (route) {
		case "GET /_dev/":
			return indexPage(
				await indexRows(ctx),
				url.searchParams.get("flash"),
				berlinDate(ctx.now()),
				(await devDay(ctx.env)) !== null,
			);
		case "GET /_dev/badges":
			return badgesPage(
				ctx.team,
				url.searchParams.get("lang"),
				berlinDate(ctx.now()),
			);
		case "POST /_dev/events": {
			const fields = await form(request);
			const flash = await simulateEvent(ctx, url.origin, fields);
			// Back to the rider's page (feature 027 FR-051).
			const athleteId = Number(fields.get("athleteId"));
			const back = sampleRider(ctx.team.id, athleteId)
				? `/_dev/riders/${athleteId}`
				: "/_dev/";
			return redirect(`${back}?${new URLSearchParams({ flash })}`, 303);
		}
		case "POST /_dev/scheduled":
			return runDailyWork(ctx);
		case "POST /_dev/connect":
			return connectAs(request, ctx, url);
		case "POST /_dev/clock":
			return setClock(request, ctx);
		case `GET ${STAND_IN_PATH}`:
			if (url.searchParams.get("client_id") !== ctx.env.STRAVA_CLIENT_ID) {
				return text("Unknown client_id", 400);
			}
			return authorizePage(url.searchParams, samplesFor(ctx.team.id).riders);
		case `POST ${STAND_IN_PATH}`:
			return decide(request, ctx, url);
		case "POST /_dev/reset":
			// A sandbox's data comes from its deployment, never from the Worker
			// (feature 027 research R6, FR-019).
			if (sandboxMode(ctx.env)) {
				return text(
					"Deploy again to reset the sandbox (docs/sandboxes.md)",
					409,
				);
			}
			await resetAll(ctx, url.origin);
			// Any session belongs to a rider who was just deleted.
			return redirect("/_dev/", 303, [clearSessionCookie()]);
	}
	return text("Not Found", 404);
}

export async function devFetch(
	request: Request,
	realCtx: Ctx,
): Promise<Response> {
	assertFakeMode(realCtx.env);
	const url = new URL(request.url);
	// A sandbox checks its Access token before anything else runs (027
	// contracts/access-check.md); local fake mode answers loopback only.
	const sandbox = sandboxMode(realCtx.env);
	if (sandbox) {
		const reason = await accessRefusal(request, sandbox, realCtx.now());
		if (reason) return refuse(reason);
	} else if (!isLocal(url)) {
		return text("Fake mode answers localhost only", 403);
	}
	const ctx = await onDevClock(realCtx);
	installStravaInterceptor(ctx);
	// A sandbox's database is seeded by its deployment (research R6).
	if (!sandbox) await seedIfNeeded(ctx, url.origin);
	const response = await answer(request, ctx, url);
	return sandbox ? withSandboxBar(response, realCtx.env as DevEnv) : response;
}

async function answer(request: Request, ctx: Ctx, url: URL) {
	if (url.pathname === "/_dev") return redirect("/_dev/", 308);
	if (url.pathname.startsWith("/_dev/")) return devRoute(request, ctx, url);
	return rewriteActivityLinks(
		rewriteAuthorize(await handleFetch(request, ctx)),
	);
}

export async function devQueue(
	batch: MessageBatch<unknown>,
	realCtx: Ctx,
): Promise<void> {
	assertFakeMode(realCtx.env);
	const ctx = await onDevClock(realCtx);
	installStravaInterceptor(ctx);
	return handleQueue(batch, ctx);
}

export async function devScheduled(
	controller: ScheduledController,
	realCtx: Ctx,
): Promise<void> {
	assertFakeMode(realCtx.env);
	const ctx = await onDevClock(realCtx);
	installStravaInterceptor(ctx);
	return handleScheduled(controller, ctx);
}

export default {
	fetch(request, env, exec) {
		return devFetch(request, makeDevCtx(env, exec));
	},
	queue(batch, env, exec) {
		return devQueue(batch, makeDevCtx(env, exec));
	},
	scheduled(controller, env, exec) {
		return devScheduled(controller, makeDevCtx(env, exec));
	},
} satisfies ExportedHandler<DevEnv, unknown>;
