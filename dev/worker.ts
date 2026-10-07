import { berlinDate } from "../src/config";
import { CONSENT_VERSION } from "../src/consent";
import type { Ctx } from "../src/ctx";
import { CATALOGS } from "../src/i18n/catalogs";
import { handleFetch, handleQueue, handleScheduled } from "../src/index";
import { STRAVA_ORIGIN } from "../src/strava/result";
import { answerStrava } from "./fake-strava/api";
import { authorizePage, type IndexRow, indexPage } from "./fake-strava/pages";
import { SAMPLE_RIDERS, sampleRider } from "./fake-strava/samples";
import { seed } from "./fake-strava/seed";
import { tableExists } from "./fake-strava/store";
import { encodeCode } from "./fake-strava/tokens";

// The dev entry of fake mode (specs/006-local-frontend-dev research R1, R2,
// R9): `pnpm dev` runs this instead of src/index.ts. It wraps the app's
// handlers, answers every request for www.strava.com from the fake, and serves
// the fake's own pages under `/_dev/`. Nothing under src/ imports it, and it
// refuses to run outside local fake mode, so it can't reach production.

/** The marker comes from `pnpm dev`'s `--var` only; it isn't a declared binding. */
export type DevEnv = Env & { RYNKE_FAKE_STRAVA?: string };

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const AUTHORIZE_URL = `${STRAVA_ORIGIN}/oauth/authorize`;
const STAND_IN_PATH = "/_dev/strava/oauth/authorize";

export function assertFakeMode(env: DevEnv): void {
	if (env.RYNKE_FAKE_STRAVA !== "local-only") {
		throw new Error("fake Strava runs only in local fake mode");
	}
}

/** The Ctx the app's own entry builds (src/index.ts). */
export function makeDevCtx(env: Env, exec: ExecutionContext): Ctx {
	return {
		env,
		queue: env.WORK_QUEUE,
		now: () => Math.floor(Date.now() / 1000),
		catalogs: CATALOGS,
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

function isLocal(url: URL): boolean {
	return LOCAL_HOSTS.includes(url.hostname);
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
 * Seeds on the first request after start, when the fake's table doesn't exist
 * yet. A failed seed drops the table again, so the next request retries.
 */
async function seedIfNeeded(ctx: Ctx, origin: string): Promise<void> {
	if (!seeding) {
		if (await tableExists(ctx.env.DB)) return;
		seeding = reseed(ctx, origin).finally(() => {
			seeding = null;
		});
	}
	await seeding;
}

async function reseed(ctx: Ctx, origin: string): Promise<void> {
	try {
		await seed(ctx, origin, berlinDate(ctx.now()));
	} catch (err) {
		await ctx.env.DB.prepare(
			"DROP TABLE IF EXISTS fake_strava_activities",
		).run();
		throw err;
	}
}

async function indexRows(ctx: Ctx): Promise<IndexRow[]> {
	const { results } = await ctx.env.DB.prepare(
		"SELECT athlete_id, status, import_status FROM riders",
	).all<{ athlete_id: number; status: string; import_status: string }>();
	const stored = new Map(results.map((r) => [r.athlete_id, r]));
	return SAMPLE_RIDERS.map((rider) => {
		const row = stored.get(rider.athleteId);
		return {
			rider,
			stored: row
				? { status: row.status, importStatus: row.import_status }
				: null,
		};
	});
}

/** `POST /_dev/connect`: the app's connect flow, ending on the stand-in screen. */
async function connectAs(request: Request, ctx: Ctx, url: URL) {
	const athleteId = Number((await form(request)).get("athleteId"));
	if (!sampleRider(athleteId)) return text("Unknown sample rider", 400);
	const connect = rewriteAuthorize(
		await handleFetch(
			new Request(`${url.origin}/connect`, {
				method: "POST",
				headers: {
					Origin: url.origin,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: `consent=${CONSENT_VERSION}`,
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

/** `POST /_dev/strava/oauth/authorize`: back to the app, as Strava would. */
async function decide(request: Request, url: URL) {
	const fields = await form(request);
	const redirectUri = String(fields.get("redirect_uri") ?? "");
	// Only back to this app, so the screen is no open redirect.
	if (
		!URL.canParse(redirectUri) ||
		new URL(redirectUri).origin !== url.origin
	) {
		return text("redirect_uri must point to this app", 400);
	}
	const back = new URL(redirectUri);
	back.searchParams.set("state", String(fields.get("state") ?? ""));
	if (fields.get("action") === "cancel") {
		back.searchParams.set("error", "access_denied");
		return redirect(back.href, 302);
	}
	const athleteId = Number(fields.get("athlete"));
	if (!sampleRider(athleteId)) return text("Unknown sample rider", 400);
	const scopes = fields.getAll("scope").map(String);
	back.searchParams.set("code", encodeCode({ athleteId, scopes }));
	back.searchParams.set("scope", scopes.join(","));
	return redirect(back.href, 302);
}

async function devRoute(
	request: Request,
	ctx: Ctx,
	url: URL,
): Promise<Response> {
	const route = `${request.method} ${url.pathname}`;
	switch (route) {
		case "GET /_dev/":
			return indexPage(await indexRows(ctx), url.searchParams.get("flash"));
		case "POST /_dev/connect":
			return connectAs(request, ctx, url);
		case `GET ${STAND_IN_PATH}`:
			if (url.searchParams.get("client_id") !== ctx.env.STRAVA_CLIENT_ID) {
				return text("Unknown client_id", 400);
			}
			return authorizePage(url.searchParams, SAMPLE_RIDERS);
		case `POST ${STAND_IN_PATH}`:
			return decide(request, url);
	}
	return text("Not Found", 404);
}

export async function devFetch(request: Request, ctx: Ctx): Promise<Response> {
	assertFakeMode(ctx.env);
	installStravaInterceptor(ctx);
	const url = new URL(request.url);
	if (!isLocal(url)) return text("Fake mode answers localhost only", 403);
	await seedIfNeeded(ctx, url.origin);
	if (url.pathname.startsWith("/_dev/")) return devRoute(request, ctx, url);
	return rewriteAuthorize(await handleFetch(request, ctx));
}

export async function devQueue(
	batch: MessageBatch<unknown>,
	ctx: Ctx,
): Promise<void> {
	assertFakeMode(ctx.env);
	installStravaInterceptor(ctx);
	return handleQueue(batch, ctx);
}

export async function devScheduled(
	controller: ScheduledController,
	ctx: Ctx,
): Promise<void> {
	assertFakeMode(ctx.env);
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
