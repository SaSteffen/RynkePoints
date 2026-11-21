import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getRider } from "../../src/db/riders";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch, handleQueue } from "../../src/index";
import { settleWithdrawals } from "../../src/strava/withdraw";
import type { WorkMessage } from "../../src/work/messages";
import { approve, SCOPES_ALL } from "../support/callback";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
	type TestCtx,
	withGateway,
} from "../support/ctx";
import { type FakeStrava, installFakeStrava } from "../support/fake-strava";
import { ATHLETE_A, ATHLETE_B, NOW, OTHER_CLUB } from "../support/fixtures";

// Feature 041 FR-009, research R14, contracts/withdrawal.md: every team shares
// one Strava app, and a revoke ends the grant at every team. So whenever a
// team lets a person go or turns them away, it withdraws the grant unless
// another team holds them, and keeps the token until it knows.

const PERSON = ATHLETE_A;
const ADMIN = ATHLETE_B;

let fake: FakeStrava;
let ctx: TestCtx;

beforeEach(async () => {
	await resetDb();
	fake = installFakeStrava();
	ctx = withGateway(makeCtx());
});

afterEach(() => fake.restore());

async function settled() {
	await Promise.all(ctx.pending);
}

async function pending(): Promise<string[]> {
	const { results } = await env.DB.prepare(
		"SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM pending_revocations",
	).all<{ athlete_id: string }>();
	return results.map((r) => r.athlete_id);
}

async function deliver(body: WorkMessage) {
	const batch = createMessageBatch("rynke-points-work", [
		{ id: "m1", timestamp: new Date(NOW * 1000), attempts: 1, body },
	]);
	await handleQueue(batch, ctx);
	return getQueueResult(batch, createExecutionContext());
}

const REFUSALS: [string, () => Promise<Response>, string][] = [
	[
		"a blocked person",
		async () => {
			await env.DB.prepare(
				"INSERT INTO blocked_athletes (athlete_id) VALUES (?)",
			)
				.bind(PERSON)
				.run();
			return approve(ctx, fake, PERSON);
		},
		"/notice/blocked",
	],
	[
		"missing scopes",
		() => approve(ctx, fake, PERSON, "read"),
		"/notice/denied",
	],
	[
		"a new person without the current consent",
		() => approve(ctx, fake, PERSON, SCOPES_ALL, {}, { consentVersion: 1 }),
		"/notice/consent-required",
	],
	[
		"a new person not in the club",
		() => {
			fake.addAthlete({ id: PERSON, clubs: [OTHER_CLUB.id] });
			return approve(ctx, fake, PERSON);
		},
		"/notice/not-member",
	],
	[
		"an existing rider who left the club",
		async () => {
			await seedRider(ctx, { athleteId: PERSON });
			fake.addAthlete({ id: PERSON, clubs: [OTHER_CLUB.id] });
			return approve(ctx, fake, PERSON);
		},
		"/notice/not-member-deleted",
	],
	[
		"a new person when the club check is inconclusive",
		() => {
			fake.failNext("clubs", { status: 503 });
			return approve(ctx, fake, PERSON);
		},
		"/notice/strava-busy",
	],
];

describe("a refusal at sign-in", () => {
	it.each(REFUSALS)(
		"withdraws the grant of %s whom no team holds",
		async (_, refuse, location) => {
			const res = await refuse();
			expect(res.headers.get("Location")).toBe(location);
			await settled();
			expect(fake.gatewayCalls).toEqual([
				{
					team: ctx.team.id,
					athleteId: PERSON,
					auth: `Bearer ${env.STRAVA_WEBHOOK_VERIFY_TOKEN}`,
				},
			]);
			expect(fake.revocations).toHaveLength(1);
			expect(await pending()).toEqual([]);
		},
	);

	it.each(REFUSALS)(
		"leaves the grant of %s whom another team holds",
		async (_, refuse) => {
			fake.held.set(PERSON, "connected");
			await refuse();
			await settled();
			expect(fake.revocations).toEqual([]);
			expect(await pending()).toEqual([]);
		},
	);
});

describe("a token that can't be settled yet", () => {
	it("is kept while the gateway doesn't answer, and withdrawn once nobody holds them", async () => {
		fake.gatewayDown = true;
		fake.addAthlete({ id: PERSON, clubs: [OTHER_CLUB.id] });
		await approve(ctx, fake, PERSON);
		await settled();
		expect(fake.revocations).toEqual([]);
		expect(await pending()).toEqual([PERSON]);

		fake.gatewayDown = false;
		await settleWithdrawals(ctx);
		expect(fake.revocations).toHaveLength(1);
		expect(await pending()).toEqual([]);
	});

	it("is kept while another team holds them only with a broken connection", async () => {
		fake.held.set(PERSON, "reconnect");
		fake.addAthlete({ id: PERSON, clubs: [OTHER_CLUB.id] });
		await approve(ctx, fake, PERSON);
		await settled();
		await settleWithdrawals(ctx);
		expect(fake.revocations).toEqual([]);
		expect(await pending()).toEqual([PERSON]);

		fake.held.set(PERSON, "connected");
		await settleWithdrawals(ctx);
		expect(fake.revocations).toEqual([]);
		expect(await pending()).toEqual([]);
	});

	it("is kept while Strava can't take the revoke", async () => {
		fake.addAthlete({ id: PERSON, clubs: [OTHER_CLUB.id] });
		fake.failNext("revoke", { status: 503 });
		await approve(ctx, fake, PERSON);
		await settled();
		expect(await pending()).toEqual([PERSON]);
		await settleWithdrawals(ctx);
		expect(await pending()).toEqual([]);
	});
});

describe("letting a guest go", () => {
	async function seedGuest() {
		fake.addAthlete({ id: PERSON, clubs: [OTHER_CLUB.id] });
		await seedRider(ctx, { athleteId: PERSON, guest: true });
	}

	const LEAVES: [string, () => Promise<unknown>][] = [
		[
			"they disconnect",
			async () =>
				handleFetch(
					request("/me/disconnect", {
						method: "POST",
						cookies: await sessionCookie(ctx, PERSON),
					}),
					ctx,
				),
		],
		[
			"an administrator removes them",
			async () => {
				await seedRider(ctx, { athleteId: ADMIN, administrator: true });
				return handleFetch(
					request(`/admin/riders/${PERSON}/remove`, {
						form: {},
						cookies: await sessionCookie(ctx, ADMIN),
					}),
					ctx,
				);
			},
		],
		[
			"they are taken off the guest list",
			() =>
				deliver({
					kind: "delete-rider",
					athleteId: PERSON,
					reason: "guest-removed",
					revoke: true,
				}),
		],
	];

	it.each(LEAVES)(
		"keeps the grant when %s while their home team holds them",
		async (_, leave) => {
			await seedGuest();
			fake.held.set(PERSON, "connected");
			await leave();
			expect(await getRider(env.DB, PERSON)).toBeNull();
			expect(fake.revocations).toEqual([]);
			expect(await pending()).toEqual([]);
		},
	);

	it.each(LEAVES)(
		"withdraws the grant when %s and no team holds them",
		async (_, leave) => {
			await seedGuest();
			await leave();
			expect(await getRider(env.DB, PERSON)).toBeNull();
			expect(fake.revocations).toHaveLength(1);
		},
	);

	it("tells them on the disconnect page that the grant may stay", async () => {
		await seedGuest();
		const page = await handleFetch(
			request("/me/disconnect", { cookies: await sessionCookie(ctx, PERSON) }),
			ctx,
		);
		const text = await page.text();
		expect(text).toContain(escapeHtml(CATALOGS.de["disconnect.explain.guest"]));
	});
});

describe("without a gateway", () => {
	it("nobody else can hold them: a refusal withdraws at once", async () => {
		ctx = makeCtx();
		fake.addAthlete({ id: PERSON, clubs: [OTHER_CLUB.id] });
		await approve(ctx, fake, PERSON);
		await settled();
		expect(fake.gatewayCalls).toEqual([]);
		expect(fake.revocations).toHaveLength(1);
	});
});
