import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { makeCtx, resetDb, seedRider } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { riderPage, seedBalance } from "../support/rider-view";

// The coin celebration on the Overview (feature 012 US2): new Rynke since the
// rider last opened the Overview show once, with the amount; the first visit,
// a visit without new Rynke and a fall show nothing.

const ctx = makeCtx();
const { de } = CATALOGS;

async function celebration(): Promise<string | null> {
	const { status, html } = await riderPage(ctx, ATHLETE_A);
	expect(status).toBe(200);
	return (
		html.match(
			/<aside class="celebrate" role="status">([\s\S]*?)<\/aside>/,
		)?.[1] ?? null
	);
}

async function seen() {
	return env.DB.prepare(
		"SELECT training_rynke, team_rynke FROM rynke_seen WHERE athlete_id = ?",
	)
		.bind(ATHLETE_A)
		.first();
}

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx);
});

describe("GET /me celebration", () => {
	it("shows nothing on the first visit and remembers the totals", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 17, teamRynke: 3 });
		expect(await celebration()).toBeNull();
		expect(await seen()).toEqual({ training_rynke: 17, team_rynke: 3 });
	});

	it("shows new Training Rynke once (US2-AS1, US2-AS3)", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 15, teamRynke: 3 });
		await celebration();
		await seedBalance(ATHLETE_A, { trainingRynke: 17, teamRynke: 3 });
		expect(await celebration()).toContain(
			`<p>${escapeHtml(de["celebrate.training"].replace("{n}", "2"))}</p>`,
		);
		expect(await celebration()).toBeNull();
	});

	it("names Team Rynke alone, and both kinds together", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 15, teamRynke: 3 });
		await celebration();
		await seedBalance(ATHLETE_A, { trainingRynke: 15, teamRynke: 4 });
		expect(await celebration()).toContain(
			escapeHtml(de["celebrate.team"].replace("{n}", "1")),
		);
		await seedBalance(ATHLETE_A, { trainingRynke: 20, teamRynke: 6 });
		expect(await celebration()).toContain(
			escapeHtml(
				de["celebrate.both"].replace("{training}", "5").replace("{team}", "2"),
			),
		);
	});

	it("shows nothing when the totals fall, and remembers the lower ones", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 17, teamRynke: 3 });
		await celebration();
		await seedBalance(ATHLETE_A, { trainingRynke: 12, teamRynke: 3 });
		expect(await celebration()).toBeNull();
		await seedBalance(ATHLETE_A, { trainingRynke: 14, teamRynke: 3 });
		expect(await celebration()).toContain(
			escapeHtml(de["celebrate.training"].replace("{n}", "2")),
		);
	});

	it("writes the amount like the totals", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 0, teamRynke: 0 });
		await celebration();
		await seedBalance(ATHLETE_A, { trainingRynke: 1200, teamRynke: 0 });
		expect(await celebration()).toContain(
			escapeHtml(de["celebrate.training"].replace("{n}", "1.200")),
		);
	});

	it("drops the coins as decoration", async () => {
		await seedBalance(ATHLETE_A, { trainingRynke: 15 });
		await celebration();
		await seedBalance(ATHLETE_A, { trainingRynke: 16 });
		const shown = await celebration();
		expect(shown).toMatch(
			/^\n<span class="celebrate-coins" aria-hidden="true">/,
		);
	});
});
