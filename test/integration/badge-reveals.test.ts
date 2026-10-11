import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS } from "../../src/i18n/catalogs";
import { BADGE_NAMES } from "../../src/i18n/messages/badges.de";
import { handleFetch } from "../../src/index";
import {
	makeCtx,
	request,
	resetDb,
	seedRider,
	sessionCookie,
} from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { riderPage, seedBalance } from "../support/rider-view";
import { attendRaw, insertEvent } from "../support/rynke";

// Badges new for the rider are revealed once at the top of the badges page,
// their own and the team's (feature 013 US2, FR-031, research R16). Synthetic badges, stored straight in D1.

const ctx = makeCtx();
const { de } = CATALOGS;

async function earn(badges: [string, string][]) {
	await env.DB.batch(
		badges.map(([id, date]) =>
			env.DB.prepare(
				`INSERT INTO rider_badges (athlete_id, badge_id, earned_on) VALUES (?, ?, ?)
				ON CONFLICT (athlete_id, badge_id) DO UPDATE SET earned_on = excluded.earned_on`,
			).bind(ATHLETE_A, id, date),
		),
	);
}

async function takeBack(id: string) {
	await env.DB.prepare(
		"DELETE FROM rider_badges WHERE athlete_id = ? AND badge_id = ?",
	)
		.bind(ATHLETE_A, id)
		.run();
}

/** The reveal's text on a GET of `path`, or null when there is none. */
async function reveal(path = "/me/badges"): Promise<string | null> {
	const { status, html } = await riderPage(ctx, ATHLETE_A, path);
	expect(status).toBe(200);
	return (
		html.match(
			/<aside class="badges-reveal" role="status">([\s\S]*?)<\/aside>/,
		)?.[1] ?? null
	);
}

async function reveals() {
	const { results } = await env.DB.prepare(
		"SELECT badge_id, earned_on FROM badge_reveals WHERE athlete_id = ? ORDER BY badge_id",
	)
		.bind(ATHLETE_A)
		.all<{ badge_id: string; earned_on: string }>();
	return results.map((r) => [r.badge_id, r.earned_on]);
}

const one = (id: string) =>
	escapeHtml(
		de["badges.reveal.one"].replace("{name}", BADGE_NAMES[id] ?? "missing"),
	);

beforeEach(async () => {
	await resetDb();
	await seedRider(ctx);
	await seedBalance(ATHLETE_A, { trainingRynke: 30 });
});

describe("the badge reveal (US2)", () => {
	it("shows a new badge once and remembers it (SC-001)", async () => {
		await earn([["distance-100", "2026-05-03"]]);

		const shown = await reveal();
		expect(shown).toContain(`<p>${one("distance-100")}</p>`);
		expect(shown).toMatch(
			/<span class="badges-reveal-pictures" aria-hidden="true"><img src="\/badges\/[\w-]+\.svg" alt="" width="48" height="48"><\/span>/,
		);
		expect(await reveals()).toEqual([["distance-100", "2026-05-03"]]);

		expect(await reveal()).toBeNull();
	});

	it("sits at the top of the badges page, before the badges, and nowhere else", async () => {
		await earn([["distance-100", "2026-05-03"]]);
		for (const path of ["/me", "/team"]) {
			expect(await reveal(path), path).toBeNull();
		}
		const { html } = await riderPage(ctx, ATHLETE_A, "/me/badges");
		const at = html.indexOf('class="badges-reveal"');
		expect(at).toBeGreaterThan(0);
		expect(at).toBeLessThan(html.indexOf('class="badges"'));
	});

	it("writes nothing on a HEAD", async () => {
		await earn([["distance-100", "2026-05-03"]]);
		const res = await handleFetch(
			request("/me/badges", {
				method: "HEAD",
				cookies: await sessionCookie(ctx, ATHLETE_A),
			}),
			ctx,
		);
		expect(res.status).toBe(200);
		expect(await reveals()).toEqual([]);
		expect(await reveal()).not.toBeNull();
	});

	it("reveals a badge earned again on a later date, not on the same one", async () => {
		await earn([["distance-100", "2026-05-03"]]);
		await reveal();

		await takeBack("distance-100");
		await earn([["distance-100", "2026-05-03"]]);
		expect(await reveal()).toBeNull();

		await takeBack("distance-100");
		await earn([["distance-100", "2026-05-20"]]);
		expect(await reveal()).toContain(one("distance-100"));
		expect(await reveals()).toEqual([["distance-100", "2026-05-20"]]);
	});

	it("reveals every badge of the import at once (FR-031)", async () => {
		await earn([
			["distance-100", "2026-03-08"],
			["distance-500", "2026-05-01"],
			["elevation-1000", "2026-04-12"],
			["team-events-1", "2026-04-02"],
			["technique-1", "2026-04-02"],
			["training-rynke-1", "2026-03-01"],
		]);

		const shown = await reveal();
		expect(shown).toContain(
			`<p>${escapeHtml(de["badges.reveal.many"].replace("{n}", "6"))}</p>`,
		);
		// Five pictures at most; the text has the count.
		expect([...(shown ?? "").matchAll(/<img /g)]).toHaveLength(5);
		expect(await reveals()).toHaveLength(6);
		expect(await reveal()).toBeNull();
	});

	it("doesn't reveal a badge marked as revealed by a silent award", async () => {
		await earn([["distance-100", "2026-05-03"]]);
		await env.DB.prepare(
			"INSERT INTO badge_reveals (athlete_id, badge_id, earned_on) VALUES (?, 'distance-100', '2026-05-03')",
		)
			.bind(ATHLETE_A)
			.run();
		expect(await reveal()).toBeNull();
	});
});

describe("the team's badges in the reveal (US4 scenario 5)", () => {
	const TEAM = [900011, 900012, 900013, 900014, 900015];

	async function bigTraining(date: string) {
		for (const athleteId of TEAM) await seedRider(ctx, { athleteId });
		await attendRaw(await insertEvent("team_training", date), TEAM);
	}

	it("reveals a team badge earned after the rider connected, once", async () => {
		// The rider connected on 6 October 2026 (NOW).
		await bigTraining("2026-10-06");
		expect(await reveal()).toContain(one("big-training-5"));
		expect(await reveals()).toEqual([["big-training-5", "2026-10-06"]]);
		expect(await reveal()).toBeNull();
	});

	it("shows one earned before the rider connected without a reveal", async () => {
		await bigTraining("2026-04-11");
		expect(await reveal()).toBeNull();
		expect(await reveals()).toEqual([]);
	});
});
