import {
	createExecutionContext,
	createMessageBatch,
	env,
	getQueueResult,
} from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteRider } from "../../src/db/riders";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { handleFetch, handleQueue } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A, ATHLETE_B, ATHLETE_C, NOW } from "../support/fixtures";
import { attendRaw, expectConsistent, insertEvent } from "../support/rynke";

// Organisers correct a rider's balance (feature 014 Story 3, FR-030, FR-031,
// research R8; feature 003 FR-010). Synthetic riders only.

const ctx = makeCtx();
const { de } = CATALOGS;
const ORGANISER = ATHLETE_C;
const OTHER_ORGANISER = 900004;
const RIDER = ATHLETE_A;
const NOT_LISTED = ATHLETE_B;

const ridersPath = (id: number) => `/organiser/riders/${id}`;

const VALID = {
	training: "10",
	team: "",
	reason: "Ride lost, broken device",
	date: "2026-10-06",
};

async function add(
	form: Record<string, string>,
	athleteId = RIDER,
	by = ORGANISER,
): Promise<Response> {
	return handleFetch(
		request(`${ridersPath(athleteId)}/corrections`, {
			form,
			cookies: await sessionCookie(ctx, by),
		}),
		ctx,
	);
}

async function remove(correctionId: number): Promise<Response> {
	return handleFetch(
		request(`/organiser/corrections/${correctionId}/delete`, {
			form: {},
			cookies: await sessionCookie(ctx, ORGANISER),
		}),
		ctx,
	);
}

async function get(path: string, athleteId = ORGANISER): Promise<Response> {
	return handleFetch(
		request(path, { cookies: await sessionCookie(ctx, athleteId) }),
		ctx,
	);
}

async function page(path: string, athleteId = ORGANISER): Promise<string> {
	const res = await get(path, athleteId);
	expect(res.status).toBe(200);
	return res.text();
}

interface CorrectionRow {
	correction_id: number;
	athlete_id: number;
	training: number;
	team: number;
	reason: string;
	correction_date: string;
	changed_by: number | null;
	changed_at: number;
}

async function corrections(): Promise<CorrectionRow[]> {
	const { results } = await env.DB.prepare(
		"SELECT * FROM corrections ORDER BY correction_id",
	).all<CorrectionRow>();
	return results;
}

async function balance(
	athleteId = RIDER,
): Promise<{ training: number; team: number }> {
	const row = await env.DB.prepare(
		`SELECT training_rynke AS training, team_rynke AS team
		FROM rynke_balances WHERE athlete_id = ?`,
	)
		.bind(athleteId)
		.first<{ training: number; team: number }>();
	return row ?? { training: 0, team: 0 };
}

function expectRedirect(res: Response, location: string): void {
	expect(res.status).toBe(303);
	expect(res.headers.get("Location")).toBe(location);
}

async function evaluateRider(athleteId = RIDER): Promise<void> {
	const batch = createMessageBatch("rynke-points-work", [
		{
			id: "m1",
			timestamp: new Date(NOW * 1000),
			attempts: 1,
			body: { kind: "evaluate-rider", athleteId },
		},
	]);
	await handleQueue(batch, ctx);
	await getQueueResult(batch, createExecutionContext());
}

beforeEach(async () => {
	await resetDb();
	ctx.queue.sent.length = 0;
	await seedRider(ctx, { athleteId: ORGANISER, organiser: true });
	await seedRider(ctx, { athleteId: OTHER_ORGANISER, organiser: true });
	await seedRider(ctx, { athleteId: RIDER, firstName: "Anna" });
	await seedRider(ctx, {
		athleteId: NOT_LISTED,
		firstName: "Nora",
		consentVersion: null,
	});
});

describe("POST /organiser/riders/{id}/corrections", () => {
	it("adds a correction with its change record and the balance follows (FR-031, FR-040)", async () => {
		const res = await add(VALID);
		expectRedirect(res, `${ridersPath(RIDER)}?done=added`);
		expect(await corrections()).toEqual([
			{
				correction_id: expect.any(Number),
				athlete_id: RIDER,
				training: 10,
				team: 0,
				reason: "Ride lost, broken device",
				correction_date: "2026-10-06",
				changed_by: ORGANISER,
				changed_at: NOW,
			},
		]);
		expect(await balance()).toEqual({ training: 10, team: 0 });
		expect(ctx.queue.sent.map((m) => m.body)).toEqual([
			{ kind: "evaluate-rider", athleteId: RIDER },
		]);
		await expectConsistent(RIDER);
	});

	it("trims the reason", async () => {
		await add({ ...VALID, reason: "  Lost ride  " });
		expect((await corrections())[0]?.reason).toBe("Lost ride");
	});

	it.each([
		["both amounts 0", { training: "0", team: "" }, "invalid_amount"],
		["a fraction", { training: "1.5" }, "invalid_amount"],
		["text", { team: "abc" }, "invalid_amount"],
		["more than 10000", { training: "10001" }, "invalid_amount"],
		["an empty reason", { reason: "" }, "invalid_reason"],
		["a blank reason", { reason: "   " }, "invalid_reason"],
		["a 201-character reason", { reason: "x".repeat(201) }, "invalid_reason"],
		["a bad date", { date: "2026-02-30" }, "invalid_date"],
	] as [string, Record<string, string>, string][])(
		"refuses %s, nothing written",
		async (_name, fields, code) => {
			const res = await add({ ...VALID, ...fields });
			expectRedirect(res, `${ridersPath(RIDER)}?error=${code}`);
			expect(await corrections()).toEqual([]);
			expect(ctx.queue.sent).toEqual([]);
		},
	);

	it("refuses a rider who isn't listed, nothing written", async () => {
		const res = await add(VALID, NOT_LISTED);
		expectRedirect(res, "/organiser/riders?error=rider_not_listed");
		expect(await corrections()).toEqual([]);
	});

	it("takes Team Rynke off down to 0 (003 FR-010)", async () => {
		for (let i = 0; i < 5; i++) {
			await attendRaw(await insertEvent("team_training", "2026-09-01"), [
				RIDER,
			]);
		}
		await evaluateRider();
		expect((await balance()).team).toBe(5);
		const res = await add({ ...VALID, training: "", team: "-20" });
		expectRedirect(res, `${ridersPath(RIDER)}?done=added`);
		expect((await corrections())[0]).toMatchObject({ training: 0, team: -20 });
		expect((await balance()).team).toBe(0);
		await expectConsistent(RIDER);
	});

	it("keeps the correction through a later evaluate-rider", async () => {
		await add(VALID);
		await evaluateRider();
		expect(await balance()).toEqual({ training: 10, team: 0 });
		await expectConsistent(RIDER);
	});
});

describe("POST /organiser/corrections/{id}/delete", () => {
	it("removes the correction and the balance follows (FR-031)", async () => {
		await add(VALID);
		const [row] = await corrections();
		const id = row?.correction_id ?? 0;
		expectRedirect(await remove(id), `${ridersPath(RIDER)}?done=removed`);
		expect(await corrections()).toEqual([]);
		expect(await balance()).toEqual({ training: 0, team: 0 });
		await expectConsistent(RIDER);
		expectRedirect(
			await remove(id),
			"/organiser/riders?error=correction_missing",
		);
	});
});

describe("the riders pages", () => {
	it("lists the listed riders only (016 FR-033 shows their balances)", async () => {
		await add({ ...VALID, training: "4321" });
		const html = await page("/organiser/riders");
		expect(html).toContain(`href="${ridersPath(RIDER)}"`);
		expect(html).toContain("Anna");
		expect(html).toContain(">4.321<");
		expect(html).not.toContain("Nora");
		expect(html).not.toContain(ridersPath(NOT_LISTED));
	});

	it.each(["rider_not_listed", "correction_missing"] as const)(
		"shows the %s refusal on the overview",
		async (code) => {
			const html = await page(`/organiser/riders?error=${code}`);
			expect(html).toContain(
				`<p class="notice notice-error" role="alert">${escapeHtml(de[`organiser.error.${code}`])}</p>`,
			);
		},
	);

	it("leads back from a rider's corrections to the overview", async () => {
		expect(await page(ridersPath(RIDER))).toContain(
			`<a href="/organiser/riders">${escapeHtml(de["organiser.riders.back"])}</a>`,
		);
	});

	it("gives 404 for a rider who isn't listed", async () => {
		expect((await get(ridersPath(NOT_LISTED))).status).toBe(404);
		expect((await get(ridersPath(123456))).status).toBe(404);
	});

	it("shows a rider's corrections, each removable only after confirming (FR-030, FR-031)", async () => {
		await add(VALID);
		const id = (await corrections())[0]?.correction_id;
		const html = await page(ridersPath(RIDER));
		expect(html).toContain("Ride lost, broken device");
		expect(html).toContain("+10");
		expect(html).toMatch(
			new RegExp(
				`<details[^>]*>(?:(?!</details>)[\\s\\S])*action="/organiser/corrections/${id}/delete"`,
			),
		);
		expect(html).toContain(
			`<form method="post" action="${ridersPath(RIDER)}/corrections"`,
		);
		expect(html).toContain('value="2026-10-06"');
	});

	it("says so when a rider has no corrections", async () => {
		const html = await page(ridersPath(RIDER));
		expect(html).toContain(escapeHtml(de["organiser.corrections.none"]));
	});

	it("shows a former organiser once the organiser has left (R9)", async () => {
		await add(VALID);
		await deleteRider(env.DB, ORGANISER);
		const html = await page(ridersPath(RIDER), OTHER_ORGANISER);
		expect(html).toContain(escapeHtml(de["organiser.formerOrganiser"]));
		expect(await corrections()).toHaveLength(1);
	});

	it("deletes a rider's corrections with the rider", async () => {
		await add(VALID);
		await deleteRider(env.DB, RIDER);
		expect(await corrections()).toEqual([]);
	});

	it("switches to the team overview from /organiser", async () => {
		expect(await page("/organiser")).toContain(
			`<a class="segmented" href="/organiser/riders">`,
		);
	});
});
