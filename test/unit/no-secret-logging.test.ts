import { createMessageBatch, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleQueue } from "../../src/index";
import { getAccessToken, revokeToken } from "../../src/strava/tokens";
import {
	type Handlers,
	MAX_ATTEMPTS,
	processBatch,
} from "../../src/work/consumer";
import type { WorkMessage } from "../../src/work/messages";
import { approve } from "../support/callback";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, makeStravaActivity, NOW } from "../support/fixtures";

// No log line may carry a credential (constitution Principle I, FR-027):
// tokens, authorization codes, the client secret or the encryption key. The
// failure paths are where a careless log would quote a request or response.

const CLIENT_SECRET = "test-client-secret";
const SECRETS = [
	CLIENT_SECRET,
	btoa(`10001:${CLIENT_SECRET}`),
	env.TOKEN_ENCRYPTION_KEY,
	env.SESSION_SIGNING_KEY,
];
// Every token and code the fake Strava issues (fake-strava.ts, callback.ts).
const SECRET_PATTERNS = [/(access|refresh)-\d+-\d+/, /synthetic-code-\d+/];

const METHODS = ["log", "info", "warn", "error", "debug"] as const;
let logged: string[];
let fake: FakeStrava;
let ctx: TestCtx;

function text(arg: unknown): string {
	if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack}`;
	if (typeof arg === "string") return arg;
	try {
		return JSON.stringify(arg) ?? String(arg);
	} catch {
		return String(arg);
	}
}

beforeEach(async () => {
	await resetDb();
	logged = [];
	for (const method of METHODS) {
		vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
			logged.push(args.map(text).join(" "));
		});
	}
	fake = installFakeStrava();
	ctx = makeCtx();
});

afterEach(() => {
	fake.restore();
	vi.restoreAllMocks();
	for (const line of logged) {
		for (const secret of SECRETS) expect(line).not.toContain(secret);
		for (const pattern of SECRET_PATTERNS) expect(line).not.toMatch(pattern);
	}
});

/** Guards against a vacuous pass: the path under test did log something. */
function expectLogged(fragment: string) {
	expect(logged.join("\n")).toContain(fragment);
}

async function runQueue(body: WorkMessage, attempts = MAX_ATTEMPTS) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts, body },
	]);
	await handleQueue(batch, ctx);
}

describe("logging never includes credentials", () => {
	it.each([
		["a server error", { status: 500 }, "HTTP 500"],
		["a refused code", { status: 400 }, "HTTP 400"],
		["a network error", "network", "network error"],
	] as const)("callback: token exchange with %s", async (_, override, log) => {
		fake.failNext("token", override);
		await approve(ctx, fake, ATHLETE_A);
		expectLogged(log);
	});

	it("callback: club check fails after the token exchange", async () => {
		fake.failNext("clubs", { status: 503 });
		await approve(ctx, fake, ATHLETE_A);
		expectLogged("HTTP 503");
	});

	it.each([
		["a server error", { status: 500 }, "HTTP 500"],
		["a refusal", { status: 401 }, "HTTP 401"],
		["a network error", "network", "network error"],
	] as const)("refresh fails with %s", async (_, override, log) => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx, { expiresAt: NOW - 1 });
		fake.failNext("token", override);
		await getAccessToken(ctx, ATHLETE_A);
		expectLogged(log);
	});

	it.each([
		["a server error", { status: 502 }, "HTTP 502"],
		["a network error", "network", "network error"],
	] as const)("revoke fails with %s", async (_, override, log) => {
		const athlete = fake.addAthlete({ id: ATHLETE_A });
		fake.failNext("revoke", override);
		await revokeToken(ctx, athlete.refreshToken);
		expectLogged(log);
	});

	it("revoke of an unreadable stored token", async () => {
		await seedRider(ctx);
		await env.DB.prepare(
			"UPDATE strava_credentials SET refresh_token_enc = 'v1:broken:broken'",
		).run();
		await runQueue({
			kind: "delete-rider",
			athleteId: ATHLETE_A,
			reason: "left-club",
			revoke: true,
		});
		expectLogged("stored token unreadable");
	});

	it("consumer: activity-event moves to failed_work after a refresh failure", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		fake.addActivity(ATHLETE_A, makeStravaActivity());
		await seedRider(ctx, { expiresAt: NOW - 1 });
		fake.failNext("token", { status: 500 });
		await runQueue({
			kind: "activity-event",
			athleteId: ATHLETE_A,
			activityId: 7_300_001,
			aspect: "create",
			changed: [],
		});
		expectLogged("moved to failed_work");
	});

	it("consumer: delete-rider on its last attempt with revoke failing", async () => {
		fake.addAthlete({ id: ATHLETE_A });
		await seedRider(ctx);
		fake.failNext("revoke", { status: 500 });
		await runQueue({
			kind: "delete-rider",
			athleteId: ATHLETE_A,
			reason: "deauthorized",
			revoke: true,
		});
		expectLogged("revoke: HTTP 500");
	});

	it("consumer: a handler exception quoting a token", async () => {
		const rider = await seedRider(ctx);
		const handlers: Handlers = {
			"check-membership": async () => {
				throw new Error(
					`token ${rider.accessToken} / ${rider.refreshToken} rejected`,
				);
			},
		};
		const batch = createMessageBatch("rynke-points-work", [
			{
				id: "m1",
				timestamp: new Date(NOW * 1000),
				attempts: MAX_ATTEMPTS,
				body: { kind: "check-membership", athleteId: ATHLETE_A },
			},
		]);
		await processBatch(batch, ctx, handlers);
		expectLogged("moved to failed_work: exception: Error");
	});
});
