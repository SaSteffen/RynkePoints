import type { Ctx } from "../src/ctx";
import { CATALOGS } from "../src/i18n/catalogs";
import { handleFetch, handleQueue, handleScheduled } from "../src/index";
import { STRAVA_ORIGIN } from "../src/strava/result";
import { answerStrava } from "./fake-strava/api";

// The dev entry of fake mode (specs/006-local-frontend-dev research R1, R2,
// R9): `pnpm dev` runs this instead of src/index.ts. It wraps the app's
// handlers, answers every request for www.strava.com from the fake, and serves
// the fake's own pages under `/_dev/`. Nothing under src/ imports it, and it
// refuses to run outside local fake mode, so it can't reach production.

/** The marker comes from dev/fake.env only; it isn't a declared binding. */
export type DevEnv = Env & { RYNKE_FAKE_STRAVA?: string };

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "[::1]"];
const AUTHORIZE_URL = `${STRAVA_ORIGIN}/oauth/authorize`;
const STAND_IN_PATH = "/_dev/strava/oauth/authorize";
const INTERCEPTOR = Symbol("rynke-points fake Strava interceptor");

export function assertFakeMode(env: DevEnv): void {
	if (env.RYNKE_FAKE_STRAVA !== "local-only") {
		throw new Error("fake Strava runs only in local fake mode");
	}
}

/** The Ctx the app's own entry builds (src/index.ts). */
export function makeDevCtx(env: Env): Ctx {
	return {
		env,
		queue: env.WORK_QUEUE,
		now: () => Math.floor(Date.now() / 1000),
		catalogs: CATALOGS,
	};
}

type Interceptor = typeof fetch & {
	[INTERCEPTOR]: { inner: typeof fetch; ctx: Ctx };
};

function isInterceptor(f: typeof fetch): f is Interceptor {
	return INTERCEPTOR in f;
}

/**
 * Sends every request for www.strava.com to the fake, never to the network.
 * Checked on every handler call: it is installed again if something (a test's
 * fetch spy) replaced it, and answers with the DB and clock of the latest call.
 */
export function installStravaInterceptor(ctx: Ctx): void {
	const current = globalThis.fetch;
	if (isInterceptor(current)) {
		current[INTERCEPTOR].ctx = ctx;
		return;
	}
	const state = { inner: current, ctx };
	const intercept = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);
		if (new URL(request.url).origin !== STRAVA_ORIGIN) {
			return state.inner(input, init);
		}
		const { env, now } = state.ctx;
		return answerStrava(request, env, env.DB, now());
	}) as Interceptor;
	intercept[INTERCEPTOR] = state;
	globalThis.fetch = intercept;
}

/** Puts back the fetch the interceptor wrapped, if it is installed. */
export function removeStravaInterceptor(): void {
	const current = globalThis.fetch;
	if (isInterceptor(current)) globalThis.fetch = current[INTERCEPTOR].inner;
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

async function devRoute(_request: Request, _ctx: Ctx): Promise<Response> {
	return text("Not Found", 404);
}

export async function devFetch(request: Request, ctx: Ctx): Promise<Response> {
	assertFakeMode(ctx.env);
	installStravaInterceptor(ctx);
	const url = new URL(request.url);
	if (!isLocal(url)) return text("Fake mode answers localhost only", 403);
	if (url.pathname.startsWith("/_dev/")) return devRoute(request, ctx);
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
	fetch(request, env) {
		return devFetch(request, makeDevCtx(env));
	},
	queue(batch, env) {
		return devQueue(batch, makeDevCtx(env));
	},
	scheduled(controller, env) {
		return devScheduled(controller, makeDevCtx(env));
	},
} satisfies ExportedHandler<DevEnv, unknown>;
