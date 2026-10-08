import { beforeEach, describe, expect, it } from "vitest";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";

// The ride list moved from `/me?page=N` to `/me/rides?page=N` (feature 011
// FR-006, research R2, contracts/http-routes.md).

const ctx = makeCtx();

beforeEach(resetDb);

describe("GET /me?page=…", () => {
	it.each([
		["/me?page=3", "/me/rides?page=3"],
		["/me?page=x", "/me/rides?page=x"],
		["/me?page=", "/me/rides?page="],
	])("redirects %s to %s permanently", async (from, to) => {
		await seedRider(ctx);
		const res = await handleFetch(
			request(from, { cookies: await sessionCookie(ctx, ATHLETE_A) }),
			ctx,
		);
		expect(res.status).toBe(301);
		expect(res.headers.get("Location")).toBe(to);
	});

	it("redirects without a session and without reading D1", async () => {
		const res = await handleFetch(request("/me?page=3"), ctx);
		expect(res.status).toBe(301);
		expect(res.headers.get("Location")).toBe("/me/rides?page=3");
		// A deleted rider's session would be sent to `/` after a D1 read.
		const gone = await handleFetch(
			request("/me?page=3", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
			ctx,
		);
		expect(gone.status).toBe(301);
		expect(gone.headers.get("Set-Cookie")).toBeNull();
	});

	it("shows the Overview at /me without page", async () => {
		await seedRider(ctx);
		const res = await handleFetch(
			request("/me", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toContain('<p class="greeting">');
	});
});
