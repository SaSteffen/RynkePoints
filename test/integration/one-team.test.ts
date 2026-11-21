import { env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONSENT_VERSION } from "../../src/consent";
import { getRider } from "../../src/db/riders";
import { escapeHtml } from "../../src/http/html";
import { readOAuthState } from "../../src/http/session";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch } from "../../src/index";
import { approve, setCookies } from "../support/callback";
import {
	cookiePair,
	listGuest,
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
	withGateway,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, TEAM_CLUB } from "../support/fixtures";

// Feature 044: a person rides for one team at a time. A new person who rides
// for another team chooses: stay there, or switch here, which has that team
// let them go before this one stores anything (research R1, R3, R6).

const PERSON = ATHLETE_A;

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = withGateway(makeCtx());
	fake.addAthlete({ id: PERSON, clubs: [TEAM_CLUB.id] });
});

afterEach(() => fake.restore());

/** Another team holds the person as a rider. */
function ridesElsewhere(held: "connected" | "reconnect" = "connected") {
	fake.held.set(PERSON, held);
	fake.riders.add(PERSON);
}

async function pendingRevocations(): Promise<number[]> {
	const { results } = await env.DB.prepare(
		"SELECT athlete_id FROM pending_revocations",
	).all<{ athlete_id: number }>();
	return results.map((r) => r.athlete_id);
}

async function settled() {
	await Promise.all(ctx.pending);
}

describe("a new person who rides for another team", () => {
	it("is asked to choose, and nothing is kept", async () => {
		ridesElsewhere();
		const res = await approve(ctx, fake, PERSON);
		expect(res.status).toBe(303);
		expect(res.headers.get("Location")).toBe("/switch-team");
		expect(setCookies(res).rp_session).toBeUndefined();
		expect(await getRider(env.DB, PERSON)).toBeNull();
		expect(fake.letGo).toEqual([]);
		await settled();
		// The other team holds the grant: nothing revoked, nothing kept.
		expect(fake.revocations).toEqual([]);
		expect(await pendingRevocations()).toEqual([]);
	});

	it("is let in after choosing to switch, once the other team let them go", async () => {
		ridesElsewhere();
		const res = await approve(
			ctx,
			fake,
			PERSON,
			undefined,
			{},
			{
				switchTeam: true,
			},
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).not.toMatch(/^\/(switch-team|notice)/);
		expect(setCookies(res).rp_session).toMatch(/^rp_session=[^;]+;/);
		expect(fake.letGo).toEqual([PERSON]);
		expect(await getRider(env.DB, PERSON)).not.toBeNull();
		expect(ctx.queue.sent.map((m) => m.body.kind)).toEqual(["import-page"]);
		await settled();
		expect(fake.revocations).toEqual([]);
	});

	it("drops a token kept from the first pass once they switched (R5)", async () => {
		// Their team held them only with a broken connection, so the first
		// pass's token stays kept.
		ridesElsewhere("reconnect");
		await approve(ctx, fake, PERSON);
		await settled();
		expect(await pendingRevocations()).toEqual([PERSON]);
		await approve(ctx, fake, PERSON, undefined, {}, { switchTeam: true });
		expect(await pendingRevocations()).toEqual([]);
		expect(fake.revocations).toEqual([]);
	});

	it("stays where they were when the let-go isn't confirmed", async () => {
		ridesElsewhere();
		fake.letGoFails = true;
		const res = await approve(
			ctx,
			fake,
			PERSON,
			undefined,
			{},
			{
				switchTeam: true,
			},
		);
		expect(res.headers.get("Location")).toBe("/notice/strava-busy");
		expect(setCookies(res).rp_session).toBeUndefined();
		expect(await getRider(env.DB, PERSON)).toBeNull();
		await settled();
		expect(fake.revocations).toEqual([]);
	});

	it("is let in without a choice once no team holds them any more", async () => {
		ridesElsewhere();
		await approve(ctx, fake, PERSON);
		fake.held.delete(PERSON);
		fake.riders.delete(PERSON);
		const res = await approve(ctx, fake, PERSON);
		expect(res.status).toBe(302);
		expect(await getRider(env.DB, PERSON)).not.toBeNull();
		expect(fake.letGo).toEqual([]);
	});
});

describe("everyone else", () => {
	it("lets in a person no other team holds, without a choice", async () => {
		const res = await approve(ctx, fake, PERSON);
		expect(res.status).toBe(302);
		expect(await getRider(env.DB, PERSON)).not.toBeNull();
		expect(fake.gatewayCalls.map((c) => c.team)).toEqual(["hamburg"]);
	});

	it("lets in a person another team holds only as a guest", async () => {
		fake.held.set(PERSON, "connected");
		const res = await approve(ctx, fake, PERSON);
		expect(res.status).toBe(302);
		expect(await getRider(env.DB, PERSON)).not.toBeNull();
		expect(fake.letGo).toEqual([]);
	});

	it("never asks about a person the team holds already", async () => {
		await seedRider(ctx);
		ridesElsewhere();
		const res = await approve(ctx, fake, PERSON, undefined, {
			...(await sessionCookie(ctx, PERSON)),
		});
		expect(res.status).toBe(302);
		expect(fake.gatewayCalls).toEqual([]);
	});

	it("never asks about a guest", async () => {
		await listGuest(ctx, PERSON);
		ridesElsewhere();
		const res = await approve(ctx, fake, PERSON);
		expect(res.status).toBe(302);
		expect(fake.gatewayCalls).toEqual([]);
	});

	it("asks nobody without a gateway", async () => {
		ctx = makeCtx();
		ridesElsewhere();
		const res = await approve(ctx, fake, PERSON);
		expect(res.status).toBe(302);
		expect(await getRider(env.DB, PERSON)).not.toBeNull();
		expect(fake.gatewayCalls).toEqual([]);
	});

	it("turns a new person away while the question has no answer", async () => {
		fake.gatewayDown = true;
		const res = await approve(ctx, fake, PERSON);
		expect(res.headers.get("Location")).toBe("/notice/strava-busy");
		expect(await getRider(env.DB, PERSON)).toBeNull();
		await settled();
		expect(fake.revocations).toEqual([]);
	});

	it("asks only after the club check", async () => {
		fake.addAthlete({ id: PERSON, clubs: [] });
		ridesElsewhere();
		const res = await approve(ctx, fake, PERSON);
		expect(res.headers.get("Location")).toBe("/notice/not-member");
	});
});

describe("GET /switch-team", () => {
	async function page() {
		const res = await handleFetch(
			request("/switch-team", { acceptLanguage: "en" }),
			ctx,
		);
		expect(res.status).toBe(200);
		return res.text();
	}

	it("offers both choices and says what switching costs", async () => {
		const html = await page();
		const en = CATALOGS.en;
		expect(html).toContain(`<h1>${escapeHtml(en["switchTeam.title"])}</h1>`);
		expect(html).toContain(escapeHtml(en["switchTeam.cost"]));
		expect(html).toContain('<form method="post" action="/connect">');
		expect(html).toContain(
			`<input type="hidden" name="consent" value="${CONSENT_VERSION}">`,
		);
		expect(html).toContain('<input type="hidden" name="switch" value="1">');
		// A new person came from the start page: no section to return to.
		expect(html.match(/name="next"/g)).toHaveLength(1);
		expect(html).toContain(
			`<button>${escapeHtml(en["switchTeam.switch"])}</button>`,
		);
		expect(html).toContain(
			`<a class="button-outlined" href="/">${escapeHtml(en["switchTeam.stay"])}</a>`,
		);
	});
});

describe("POST /connect with switch=1", () => {
	async function connect(form: Record<string, string>) {
		const res = await handleFetch(
			request("/connect", { method: "POST", form }),
			ctx,
		);
		expect(res.status).toBe(302);
		const location = new URL(res.headers.get("Location") ?? "");
		const back = request("/auth/callback", {
			cookies: cookiePair(res.headers.get("Set-Cookie") ?? ""),
		});
		return {
			prompt: location.searchParams.get("approval_prompt"),
			state: await readOAuthState(back, ctx.env, ctx.now()),
		};
	}

	it("asks Strava not to show its screen again and marks the switch", async () => {
		const { prompt, state } = await connect({
			consent: String(CONSENT_VERSION),
			switch: "1",
			next: "/team",
		});
		expect(prompt).toBe("auto");
		expect(state).toMatchObject({ switchTeam: true, next: "/team" });
	});

	it("keeps Strava's screen and no switch without it", async () => {
		const { prompt, state } = await connect({
			consent: String(CONSENT_VERSION),
		});
		expect(prompt).toBe("force");
		expect(state?.switchTeam).toBe(false);
	});
});
