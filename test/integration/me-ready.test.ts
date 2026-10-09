import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookie } from "../../src/http/session";
import { handleFetch } from "../../src/index";
import {
	cookiePair,
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";
import { seedBalance } from "../support/rider-view";

// Whether the rider's first data is there, for the waiting state's poll
// (015 contracts/http-routes.md, FR-004, FR-006, SC-005).

const ctx = makeCtx();

beforeEach(resetDb);
afterEach(() => {
	vi.restoreAllMocks();
});

async function ready(
	options: { method?: string; cookies?: Record<string, string> } = {},
) {
	return handleFetch(
		request("/me/ready", {
			method: options.method,
			cookies: options.cookies ?? (await sessionCookie(ctx, ATHLETE_A)),
		}),
		ctx,
	);
}

describe("GET /me/ready", () => {
	it("refuses a request without a session", async () => {
		const res = await handleFetch(request("/me/ready"), ctx);
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("");
	});

	it("refuses a session whose rider is gone", async () => {
		const res = await ready();
		expect(res.status).toBe(401);
		expect(await res.text()).toBe("");
	});

	it("is not ready before the first balance", async () => {
		await seedRider(ctx, { importStatus: "running" });
		const res = await ready();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ready: false });
	});

	it("is ready once a balance exists, also a zero one", async () => {
		await seedRider(ctx, { importStatus: "running" });
		await seedBalance(ATHLETE_A);
		const res = await ready();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ready: true });
	});

	it("is JSON, never cached and never renews the session", async () => {
		await seedRider(ctx);
		// Issued 10 days ago, so a page would renew it.
		const cookies = cookiePair(
			await createSessionCookie(ATHLETE_A, NOW - 10 * 86400, ctx.env),
		);
		const res = await ready({ cookies });
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toMatch(/^application\/json/);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(res.headers.get("Set-Cookie")).toBeNull();
	});

	it("answers HEAD with the same status and no body", async () => {
		await seedRider(ctx);
		await seedBalance(ATHLETE_A);
		const res = await ready({ method: "HEAD" });
		expect(res.status).toBe(200);
		expect(res.headers.get("Cache-Control")).toBe("no-store");
		expect(await res.text()).toBe("");
		const anonymous = await handleFetch(
			request("/me/ready", { method: "HEAD" }),
			ctx,
		);
		expect(anonymous.status).toBe(401);
	});

	it("never calls out (FR-006)", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");
		await seedRider(ctx);
		await ready();
		await seedBalance(ATHLETE_A);
		await ready();
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
