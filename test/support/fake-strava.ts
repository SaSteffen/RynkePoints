import { type MockInstance, vi } from "vitest";
import {
	firstNameFor,
	NOW,
	type StravaActivityFixture,
	TEAM_CLUB,
} from "./fixtures";

// An in-memory Strava, installed by spying on global fetch. Tests never reach
// the real Strava (constitution Principle V); any other host is recorded as
// unexpected and fails the test on restore().

const CLIENT_ID = "10001";
const CLIENT_SECRET = "test-client-secret";
const TOKEN_LIFETIME = 6 * 3600;

export type FakeEndpoint =
	| "token"
	| "revoke"
	| "clubs"
	| "activity"
	| "activities";

export interface FakeAthlete {
	id: number;
	firstname: string;
	accessToken: string;
	refreshToken: string;
	expiresAt: number;
	scopes: string[];
	clubs: number[];
	tokenGeneration: number;
}

export interface FakeCall {
	endpoint: FakeEndpoint;
	method: string;
	url: URL;
	headers: Headers;
	form: URLSearchParams;
}

export interface FakeRevocation {
	token: string;
	kind: "access" | "refresh" | "unknown";
}

export interface RateHeaders {
	usage: string;
	limit: string;
	readUsage: string;
	readLimit: string;
}

type Override =
	| { status: number; headers?: Record<string, string> }
	| "network";

export interface FakeStrava {
	/** The fake's clock in epoch seconds (token expiry). */
	now: number;
	athletes: Map<number, FakeAthlete>;
	activities: Map<number, StravaActivityFixture & { ownerId: number }>;
	/** Authorization codes accepted by the token exchange. */
	codes: Map<string, number>;
	calls: FakeCall[];
	revocations: FakeRevocation[];
	unexpected: string[];
	/** Rate headers on every /api/v3 response; `null` sends none. */
	rateHeaders: RateHeaders | null;
	addAthlete(athlete: Partial<FakeAthlete> & { id: number }): FakeAthlete;
	addActivity(ownerId: number, activity: StravaActivityFixture): void;
	/** Answers the next call to `endpoint` with `status` (or a network error). */
	failNext(endpoint: FakeEndpoint, override: Override): void;
	callsTo(endpoint: FakeEndpoint): FakeCall[];
	restore(): void;
}

export const DEFAULT_SCOPES = [
	"read",
	"activity:read",
	"activity:read_all",
	"activity:write",
];

export function initialTokens(athleteId: number) {
	return {
		accessToken: `access-${athleteId}-0`,
		refreshToken: `refresh-${athleteId}-0`,
	};
}

function json(
	body: unknown,
	status = 200,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

export function installFakeStrava(): FakeStrava {
	const overrides = new Map<FakeEndpoint, Override[]>();

	const fake: FakeStrava = {
		now: NOW,
		athletes: new Map(),
		activities: new Map(),
		codes: new Map(),
		calls: [],
		revocations: [],
		unexpected: [],
		rateHeaders: {
			usage: "1,1",
			limit: "200,2000",
			readUsage: "1,1",
			readLimit: "100,1000",
		},
		addAthlete(athlete) {
			const full: FakeAthlete = {
				firstname: firstNameFor(athlete.id),
				...initialTokens(athlete.id),
				expiresAt: fake.now + TOKEN_LIFETIME,
				scopes: [...DEFAULT_SCOPES],
				clubs: [TEAM_CLUB.id],
				tokenGeneration: 0,
				...athlete,
			};
			fake.athletes.set(full.id, full);
			return full;
		},
		addActivity(ownerId, activity) {
			fake.activities.set(activity.id, { ...activity, ownerId });
		},
		failNext(endpoint, override) {
			overrides.set(endpoint, [...(overrides.get(endpoint) ?? []), override]);
		},
		callsTo(endpoint) {
			return fake.calls.filter((c) => c.endpoint === endpoint);
		},
		restore() {
			spy.mockRestore();
			if (fake.unexpected.length > 0) {
				throw new Error(
					`Unexpected outbound fetch: ${fake.unexpected.join(", ")}`,
				);
			}
		},
	};

	function rotate(athlete: FakeAthlete) {
		athlete.tokenGeneration += 1;
		athlete.accessToken = `access-${athlete.id}-${athlete.tokenGeneration}`;
		athlete.refreshToken = `refresh-${athlete.id}-${athlete.tokenGeneration}`;
		athlete.expiresAt = fake.now + TOKEN_LIFETIME;
	}

	function apiHeaders(): Record<string, string> {
		const h = fake.rateHeaders;
		if (!h) return {};
		return {
			"X-RateLimit-Usage": h.usage,
			"X-RateLimit-Limit": h.limit,
			"X-ReadRateLimit-Usage": h.readUsage,
			"X-ReadRateLimit-Limit": h.readLimit,
		};
	}

	function bearer(headers: Headers): FakeAthlete | undefined {
		const token = headers.get("Authorization")?.replace(/^Bearer /, "");
		const athlete = [...fake.athletes.values()].find(
			(a) => a.accessToken === token,
		);
		return athlete && athlete.expiresAt > fake.now ? athlete : undefined;
	}

	function paginate<T>(items: T[], url: URL): T[] {
		const page = Number(url.searchParams.get("page") ?? "1");
		const perPage = Number(url.searchParams.get("per_page") ?? "30");
		return items.slice((page - 1) * perPage, page * perPage);
	}

	function visible(
		activity: StravaActivityFixture,
		athlete: FakeAthlete,
	): boolean {
		return !activity.private || athlete.scopes.includes("activity:read_all");
	}

	function strip({
		ownerId: _,
		...activity
	}: StravaActivityFixture & { ownerId: number }) {
		return activity;
	}

	function token(form: URLSearchParams): Response {
		if (
			form.get("client_id") !== CLIENT_ID ||
			form.get("client_secret") !== CLIENT_SECRET
		) {
			return json({ message: "Bad Request" }, 400);
		}
		const grant = form.get("grant_type");
		if (grant === "authorization_code") {
			const athleteId = fake.codes.get(form.get("code") ?? "");
			const athlete =
				athleteId === undefined ? undefined : fake.athletes.get(athleteId);
			if (!athlete) return json({ message: "Bad Request" }, 400);
			fake.codes.delete(form.get("code") ?? "");
			rotate(athlete);
			return json({
				token_type: "Bearer",
				expires_at: athlete.expiresAt,
				expires_in: TOKEN_LIFETIME,
				refresh_token: athlete.refreshToken,
				access_token: athlete.accessToken,
				athlete: {
					id: athlete.id,
					firstname: athlete.firstname,
					lastname: "Synthetic",
					city: "Synthetic City",
					sex: "M",
					profile: "https://example.invalid/synthetic.jpg",
				},
			});
		}
		if (grant === "refresh_token") {
			const athlete = [...fake.athletes.values()].find(
				(a) => a.refreshToken === form.get("refresh_token"),
			);
			if (!athlete) return json({ message: "Bad Request" }, 400);
			rotate(athlete);
			return json({
				token_type: "Bearer",
				access_token: athlete.accessToken,
				refresh_token: athlete.refreshToken,
				expires_at: athlete.expiresAt,
				expires_in: TOKEN_LIFETIME,
			});
		}
		return json({ message: "Bad Request" }, 400);
	}

	function revoke(headers: Headers, form: URLSearchParams): Response {
		if (
			headers.get("Authorization") !==
			`Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`
		) {
			return json({ message: "Authorization Error" }, 401);
		}
		const value = form.get("token") ?? "";
		const athlete = [...fake.athletes.values()].find(
			(a) => a.accessToken === value || a.refreshToken === value,
		);
		const kind = !athlete
			? "unknown"
			: athlete.accessToken === value
				? "access"
				: "refresh";
		fake.revocations.push({ token: value, kind });
		if (athlete) {
			athlete.accessToken = `revoked-${athlete.id}`;
			athlete.refreshToken = `revoked-${athlete.id}`;
		}
		return new Response(null, { status: 200 });
	}

	function api(endpoint: FakeEndpoint, url: URL, headers: Headers): Response {
		const athlete = bearer(headers);
		if (!athlete) {
			return json({ message: "Authorization Error" }, 401, apiHeaders());
		}
		if (endpoint === "clubs") {
			const clubs = athlete.clubs.map((id) => ({ id, name: `Club ${id}` }));
			return json(paginate(clubs, url), 200, apiHeaders());
		}
		if (endpoint === "activity") {
			const id = Number(url.pathname.split("/").at(-1));
			const activity = fake.activities.get(id);
			if (
				!activity ||
				activity.ownerId !== athlete.id ||
				!visible(activity, athlete)
			) {
				return json({ message: "Record Not Found" }, 404, apiHeaders());
			}
			return json(strip(activity), 200, apiHeaders());
		}
		const after = Number(url.searchParams.get("after") ?? "0");
		const list = [...fake.activities.values()]
			.filter(
				(a) =>
					a.ownerId === athlete.id &&
					visible(a, athlete) &&
					Date.parse(a.start_date) / 1000 > after,
			)
			.sort((a, b) => Date.parse(a.start_date) - Date.parse(b.start_date))
			.map(strip);
		return json(paginate(list, url), 200, apiHeaders());
	}

	function endpointOf(method: string, url: URL): FakeEndpoint | null {
		const path = url.pathname;
		if (method === "POST" && path === "/oauth/token") return "token";
		if (method === "POST" && path === "/oauth/revoke") return "revoke";
		if (method === "GET" && path === "/api/v3/athlete/clubs") return "clubs";
		if (method === "GET" && path === "/api/v3/athlete/activities")
			return "activities";
		if (method === "GET" && /^\/api\/v3\/activities\/\d+$/.test(path))
			return "activity";
		return null;
	}

	const spy: MockInstance<typeof fetch> = vi
		.spyOn(globalThis, "fetch")
		.mockImplementation(async (input, init) => {
			const request = new Request(input, init);
			const url = new URL(request.url);
			if (url.origin !== "https://www.strava.com") {
				fake.unexpected.push(url.href);
				throw new Error(`Unexpected outbound fetch to ${url.href}`);
			}
			const endpoint = endpointOf(request.method, url);
			if (!endpoint) {
				fake.unexpected.push(`${request.method} ${url.href}`);
				throw new Error(`Unknown Strava endpoint ${request.method} ${url}`);
			}
			const body = request.method === "POST" ? await request.text() : "";
			const form = new URLSearchParams(body);
			fake.calls.push({
				endpoint,
				method: request.method,
				url,
				headers: request.headers,
				form,
			});

			const override = overrides.get(endpoint)?.shift();
			if (override === "network")
				throw new TypeError("Network connection lost");
			if (override) {
				return json({ message: "Synthetic failure" }, override.status, {
					...(endpoint === "token" || endpoint === "revoke"
						? {}
						: apiHeaders()),
					...override.headers,
				});
			}

			if (endpoint === "token") return token(form);
			if (endpoint === "revoke") return revoke(request.headers, form);
			return api(endpoint, url, request.headers);
		});

	return fake;
}
