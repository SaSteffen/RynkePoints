import { type SampleRider, sampleRider } from "./samples";
import { getActivity, listActivities } from "./store";
import {
	ACCESS_LIFETIME,
	type AccessGrant,
	bearer,
	decodeAccess,
	decodeCode,
	decodeRefresh,
	encodeAccess,
	encodeRefresh,
	type Grant,
} from "./tokens";

// The fake Strava: answers every request the app sends to www.strava.com
// (specs/006-local-frontend-dev contracts/fake-strava.md). No answer carries
// rate-limit headers, so fake answers never change the app's request budget
// (FR-006). Every request is logged without tokens (FR-010).

const NOT_FOUND = { message: "Record Not Found" };
const DEFAULT_PER_PAGE = 30;

interface Answer {
	response: Response;
	athleteId?: number;
}

function json(body: unknown, status = 200): Response {
	return Response.json(body, { status });
}

function answer(body: unknown, status = 200, athleteId?: number): Answer {
	return { response: json(body, status), athleteId };
}

/** Answers one request for `https://www.strava.com`. `now` is the app's clock. */
export async function answerStrava(
	request: Request,
	env: Env,
	db: D1Database,
	now: number,
): Promise<Response> {
	const url = new URL(request.url);
	const route = `${request.method} ${url.pathname}`;
	const result = await dispatch(request, url, env, db, now);
	if (!result) {
		console.log(`[fake-strava] UNANSWERED ${route}`);
		return json(NOT_FOUND, 404);
	}
	const athlete = result.athleteId ?? "unknown";
	console.log(
		`[fake-strava] ${route} → ${result.response.status} (athlete ${athlete})`,
	);
	return result.response;
}

async function dispatch(
	request: Request,
	url: URL,
	env: Env,
	db: D1Database,
	now: number,
): Promise<Answer | null> {
	const { pathname } = url;
	if (request.method === "POST") {
		if (pathname === "/oauth/token") return token(request, env, now);
		if (pathname === "/oauth/revoke") return revoke(request, env);
		return null;
	}
	if (request.method !== "GET") return null;
	if (pathname === "/api/v3/athlete/clubs")
		return clubs(request, url, env, now);
	if (pathname === "/api/v3/athlete/activities") {
		return activities(request, url, db, now);
	}
	const single = pathname.match(/^\/api\/v3\/activities\/(\d+)$/);
	if (single) return activity(request, Number(single[1]), db, now);
	return null;
}

function tokenBody(grant: Grant, rider: SampleRider, now: number) {
	const expiresAt = now + ACCESS_LIFETIME;
	return {
		token_type: "Bearer",
		access_token: encodeAccess({ ...grant, expiresAt }),
		refresh_token: encodeRefresh(grant),
		expires_at: expiresAt,
		expires_in: ACCESS_LIFETIME,
		athlete: { id: rider.athleteId, firstname: rider.firstName },
	};
}

async function token(request: Request, env: Env, now: number): Promise<Answer> {
	const form = new URLSearchParams(await request.text());
	if (
		form.get("client_id") !== env.STRAVA_CLIENT_ID ||
		form.get("client_secret") !== env.STRAVA_CLIENT_SECRET
	) {
		return answer({ message: "Bad Request" }, 400);
	}
	const grantType = form.get("grant_type");
	if (grantType === "authorization_code") {
		const grant = decodeCode(form.get("code") ?? "");
		const rider = grant && sampleRider(grant.athleteId);
		if (!grant || !rider) return answer({ message: "Bad Request" }, 400);
		return answer(tokenBody(grant, rider, now), 200, rider.athleteId);
	}
	if (grantType === "refresh_token") {
		const grant = decodeRefresh(form.get("refresh_token") ?? "");
		const rider = grant && sampleRider(grant.athleteId);
		if (!grant || !rider || rider.behaviour === "refused") {
			return answer({ message: "Bad Request" }, 400, grant?.athleteId);
		}
		return answer(tokenBody(grant, rider, now), 200, rider.athleteId);
	}
	return answer({ message: "Bad Request" }, 400);
}

function revoke(request: Request, env: Env): Answer {
	const expected = `Basic ${btoa(`${env.STRAVA_CLIENT_ID}:${env.STRAVA_CLIENT_SECRET}`)}`;
	if (request.headers.get("Authorization") !== expected) {
		return answer({ message: "Authorization Error" }, 401);
	}
	return answer({});
}

/** The sample rider behind a valid, unexpired bearer token, or null. */
function authorised(
	request: Request,
	now: number,
): { grant: AccessGrant; rider: SampleRider } | null {
	const grant = decodeAccess(bearer(request) ?? "");
	const rider = grant && sampleRider(grant.athleteId);
	if (!grant || !rider || grant.expiresAt <= now) return null;
	return { grant, rider };
}

const UNAUTHORISED = { message: "Authorization Error" };

function paging(url: URL): { page: number; perPage: number } {
	const page = Number(url.searchParams.get("page") ?? "1");
	const perPage = Number(url.searchParams.get("per_page") ?? DEFAULT_PER_PAGE);
	return {
		page: Number.isInteger(page) && page > 0 ? page : 1,
		perPage:
			Number.isInteger(perPage) && perPage > 0 ? perPage : DEFAULT_PER_PAGE,
	};
}

function clubs(request: Request, url: URL, env: Env, now: number): Answer {
	const auth = authorised(request, now);
	if (!auth) return answer(UNAUTHORISED, 401);
	// A `refused` rider is answered too, so their sign-in still works.
	const all = auth.rider.clubMember
		? [{ id: Number(env.STRAVA_CLUB_ID), name: "Team Rynkeby Hamburg (fake)" }]
		: [];
	const { page, perPage } = paging(url);
	return answer(
		all.slice((page - 1) * perPage, page * perPage),
		200,
		auth.rider.athleteId,
	);
}

/** The rider for an activity endpoint, or the refusal to answer with. */
function activityAuth(
	request: Request,
	now: number,
): { grant: AccessGrant; rider: SampleRider } | Answer {
	const auth = authorised(request, now);
	if (!auth) return answer(UNAUTHORISED, 401);
	if (auth.rider.behaviour === "refused") {
		return answer(UNAUTHORISED, 401, auth.rider.athleteId);
	}
	return auth;
}

function readsAll(grant: Grant): boolean {
	return grant.scopes.includes("activity:read_all");
}

async function activities(
	request: Request,
	url: URL,
	db: D1Database,
	now: number,
): Promise<Answer> {
	const auth = activityAuth(request, now);
	if ("response" in auth) return auth;
	const { rider, grant } = auth;
	if (rider.behaviour === "import-stuck") {
		return answer({ message: "Rate Limit Exceeded" }, 429, rider.athleteId);
	}
	const list = await listActivities(db, rider.athleteId, {
		after: Number(url.searchParams.get("after") ?? "0") || 0,
		...paging(url),
		includePrivate: readsAll(grant),
	});
	return answer(list, 200, rider.athleteId);
}

async function activity(
	request: Request,
	id: number,
	db: D1Database,
	now: number,
): Promise<Answer> {
	const auth = activityAuth(request, now);
	if ("response" in auth) return auth;
	const { rider, grant } = auth;
	const stored = await getActivity(db, id);
	if (
		!stored ||
		stored.athleteId !== rider.athleteId ||
		(stored.body.private && !readsAll(grant))
	) {
		return answer(NOT_FOUND, 404, rider.athleteId);
	}
	return answer(stored.body, 200, rider.athleteId);
}
