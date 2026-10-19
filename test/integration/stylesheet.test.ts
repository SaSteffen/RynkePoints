import { beforeEach, describe, expect, it } from "vitest";
import type { Ctx } from "../../src/ctx";
import { createSessionCookie } from "../../src/http/session";
import { STYLE } from "../../src/http/style";
import { STYLESHEET_PATH } from "../../src/http/stylesheet";
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

// The stylesheet as its own cached file instead of inline in every page
// (issue #183).

const ctx = makeCtx();

/** A context whose D1 throws on any use, to prove a route never reads it. */
function withoutDb(base: Ctx): Ctx {
	const db = new Proxy(
		{},
		{
			get() {
				throw new Error("this route must not use D1");
			},
		},
	) as D1Database;
	return { ...base, env: { ...base.env, DB: db } };
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
});

describe("GET /style-<hash>.css", () => {
	it("answers the rules as CSS, cached for good", async () => {
		const res = await handleFetch(request(STYLESHEET_PATH), ctx);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/css; charset=utf-8");
		expect(res.headers.get("Cache-Control")).toBe(
			"public, max-age=31536000, immutable",
		);
		expect(await res.text()).toBe(STYLE);
	});

	it("is the same with a session, renews none and never reads D1", async () => {
		// Issued 10 days ago, so a page would renew it.
		const cookies = cookiePair(
			await createSessionCookie(ATHLETE_A, NOW - 10 * 86400, ctx.env),
		);
		const noDb = withoutDb(ctx);
		const anonymous = await handleFetch(request(STYLESHEET_PATH), noDb);
		const signedIn = await handleFetch(
			request(STYLESHEET_PATH, { cookies }),
			noDb,
		);
		expect(await signedIn.text()).toBe(await anonymous.text());
		expect([...signedIn.headers]).toEqual([...anonymous.headers]);
		expect(signedIn.headers.get("Set-Cookie")).toBeNull();
		expect(signedIn.headers.get("Vary")).toBeNull();
	});

	it("answers HEAD too", async () => {
		const res = await handleFetch(
			request(STYLESHEET_PATH, { method: "HEAD" }),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/css; charset=utf-8");
	});

	it("serves another deploy's address the current rules, uncached", async () => {
		const other = STYLESHEET_PATH.endsWith("0.css")
			? "/style-1.css"
			: "/style-0.css";
		const res = await handleFetch(request(other), ctx);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("text/css; charset=utf-8");
		expect(res.headers.get("Cache-Control")).toBe("no-cache");
		expect(await res.text()).toBe(STYLE);
	});

	it.each(["/style.css", "/style-XYZ.css", "/style-abc.css/x"])(
		"%s is not a stylesheet",
		async (path) => {
			const res = await handleFetch(request(path), ctx);
			expect(res.headers.get("Content-Type")).not.toMatch(/^text\/css/);
		},
	);
});

describe("a signed-in page", () => {
	it("links the stylesheet instead of carrying it", async () => {
		const cookies = await sessionCookie(ctx, ATHLETE_A);
		const res = await handleFetch(request("/me", { cookies }), ctx);
		const page = await res.text();
		expect(page).toContain(`<link rel="stylesheet" href="${STYLESHEET_PATH}">`);
		expect(page).not.toContain("<style>");
	});
});
