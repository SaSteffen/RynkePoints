import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { readViewer, requireRider, type Viewer } from "../../src/http/viewer";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B } from "../support/fixtures";

// Who is asking, decided from the rider row on every request (004 US2,
// contracts/viewer-and-visibility.md, research R4).

const ctx = makeCtx();

async function viewerOf(athleteId: number): Promise<Viewer> {
	return readViewer(
		request("/me", { cookies: await sessionCookie(ctx, athleteId) }),
		ctx,
	);
}

function riderOf(viewer: Viewer) {
	if (viewer.kind !== "rider") throw new Error(`Not a rider: ${viewer.kind}`);
	return viewer;
}

beforeEach(resetDb);

describe("readViewer", () => {
	it("treats a request without a cookie as a visitor", async () => {
		expect(await readViewer(request("/me"), ctx)).toEqual({ kind: "visitor" });
	});

	it("treats an invalid cookie as a visitor", async () => {
		await seedRider(ctx);
		const viewer = await readViewer(
			request("/me", { cookies: { rp_session: `${ATHLETE_A}.forged` } }),
			ctx,
		);
		expect(viewer).toEqual({ kind: "visitor" });
	});

	it("treats a session whose rider was deleted as a visitor", async () => {
		expect(await viewerOf(ATHLETE_A)).toEqual({ kind: "visitor" });
	});

	it("recognises an organiser from the flag (US2 scenario 1)", async () => {
		await seedRider(ctx, { organiser: true });
		const viewer = riderOf(await viewerOf(ATHLETE_A));
		expect(viewer.rider.athleteId).toBe(ATHLETE_A);
		expect(viewer.rider.organiser).toBe(true);
	});

	it("keeps an unflagged rider a rider (US2 scenario 2)", async () => {
		await seedRider(ctx);
		expect(riderOf(await viewerOf(ATHLETE_A)).rider.organiser).toBe(false);
	});

	it("follows the flag on the next request (US2 scenario 4, FR-003, SC-006)", async () => {
		await seedRider(ctx, { organiser: true });
		const cookies = await sessionCookie(ctx, ATHLETE_A);
		const first = await readViewer(request("/me", { cookies }), ctx);
		expect(riderOf(first).rider.organiser).toBe(true);
		await env.DB.prepare("UPDATE riders SET organiser = 0 WHERE athlete_id = ?")
			.bind(ATHLETE_A)
			.run();
		const second = await readViewer(request("/me", { cookies }), ctx);
		expect(riderOf(second).rider.organiser).toBe(false);
	});

	it("keeps a flagged rider who must reconnect an organiser", async () => {
		await seedRider(ctx, { organiser: true, status: "needs_reconnect" });
		const viewer = riderOf(await viewerOf(ATHLETE_A));
		expect(viewer.rider.status).toBe("needs_reconnect");
		expect(viewer.rider.organiser).toBe(true);
	});

	it("carries the highest accepted consent version", async () => {
		await seedRider(ctx, { consentVersion: null });
		await seedRider(ctx, { athleteId: ATHLETE_B, consentVersion: 1 });
		expect(riderOf(await viewerOf(ATHLETE_A)).consentVersion).toBeNull();
		expect(riderOf(await viewerOf(ATHLETE_B)).consentVersion).toBe(1);
		await env.DB.prepare(
			"INSERT INTO consent_records (athlete_id, version, accepted_at) VALUES (?, 2, ?)",
		)
			.bind(ATHLETE_B, ctx.now())
			.run();
		expect(riderOf(await viewerOf(ATHLETE_B)).consentVersion).toBe(2);
	});

	it("serves /me when nobody is flagged (US2 scenario 5, FR-006)", async () => {
		await seedRider(ctx);
		const res = await handleFetch(
			request("/me", { cookies: await sessionCookie(ctx, ATHLETE_A) }),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(await res.text()).toContain("Hallo Testrider A!");
	});
});

describe("requireRider", () => {
	it("sends a visitor to the start page (US3 scenario 5)", () => {
		const res = requireRider({ kind: "visitor" });
		expect(res?.status).toBe(302);
		expect(res?.headers.get("Location")).toBe("/");
	});

	it("lets a rider through", async () => {
		await seedRider(ctx);
		expect(requireRider(await viewerOf(ATHLETE_A))).toBeNull();
	});
});
