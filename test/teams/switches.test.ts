import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { type AlbumFiles, handleAlbumRequest } from "../../album/routes";
import { BADGES } from "../../src/badges/catalog";
import { phraseSet } from "../../src/content";
import { upsertBadgeRiseStatement } from "../../src/db/badges";
import { escapeHtml } from "../../src/http/html";
import { homeOf } from "../../src/http/redirect";
import { hiddenSections } from "../../src/http/shell";
import { tourSteps } from "../../src/http/tour";
import { createI18n } from "../../src/i18n/i18n";
import { type ActivityChange, evaluateChange } from "../../src/rynke/apply";
import { teamBadgeNews } from "../../src/work/team-badge-news";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { ATHLETE_A, NOW } from "../support/fixtures";
import { riderPage, seedBalance } from "../support/rider-view";
import { activityRecord } from "../support/rynke";

// The feature switches per team (feature 026 US3 scenario 3, FR-018):
// `BADGES`, `PHRASES`, `SEASON_ALBUM` and `FUN_THEMES`, each "on" by default.
// With one "off", no page, menu entry, text, notification or scheduled work
// for the feature; with it "on", the feature is there, so each check below
// has its counterpart.

type Switch = "BADGES" | "PHRASES" | "SEASON_ALBUM" | "FUN_THEMES";

let ctx: TestCtx;

/** `ctx` with one switch set. */
function switched(name: Switch, value: "on" | "off"): TestCtx {
	return { ...ctx, env: { ...ctx.env, [name]: value } };
}

async function count(table: string): Promise<number> {
	return (
		(await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<number>(
			"n",
		)) ?? 0
	);
}

/** Three counting 40 km rides at the season start, which earn badges. */
function rides(): ActivityChange {
	const start = env.SEASON_START_DATE;
	return {
		kind: "upsert",
		records: [1, 2, 3].map((day) => {
			const date = `${start.slice(0, 8)}0${day}T08:00:00Z`;
			return activityRecord(day, { start_date: date, start_date_local: date });
		}),
	};
}

beforeEach(async () => {
	await resetDb();
	ctx = makeCtx();
	await seedRider(ctx, { athleteId: ATHLETE_A });
});

it("is on for every switch by default", () => {
	for (const name of [
		"BADGES",
		"PHRASES",
		"SEASON_ALBUM",
		"FUN_THEMES",
	] as const) {
		expect(env[name]).toBe("on");
	}
});

describe("BADGES", () => {
	beforeEach(() => seedBalance(ATHLETE_A, { trainingRynke: 30 }));

	it("off: no page, menu entry or tour step", async () => {
		const off = switched("BADGES", "off");
		const page = await riderPage(off, ATHLETE_A, "/me/settings");
		expect(page.html).not.toContain('href="/me/badges"');
		expect((await riderPage(off, ATHLETE_A, "/me/badges")).status).toBe(404);
		const steps = tourSteps(
			"rider",
			{ organiser: false },
			hiddenSections(off.env),
		);
		expect(steps.map((s) => s.path)).not.toContain("/me/badges");

		const on = await riderPage(switched("BADGES", "on"), ATHLETE_A, "/me");
		expect(on.html).toContain('href="/me/badges"');
		expect(
			(await riderPage(switched("BADGES", "on"), ATHLETE_A, "/me/badges"))
				.status,
		).toBe(200);
	});

	it("off: no badge news, notification or team badge check", async () => {
		const off = switched("BADGES", "off");
		const result = await evaluateChange(off, ATHLETE_A, rides());
		expect(result.badges).toEqual([]);
		expect(await count("badge_rises")).toBe(0);
		expect(await teamBadgeNews(off, [ATHLETE_A])).toEqual([]);
		expect(await count("team_badge_notices")).toBe(0);
		// The app opens on the badges page only while they are on.
		expect(await homeOf(off, ATHLETE_A)).not.toBe("/me/badges");
	});

	it("on: the same rides are badge news", async () => {
		const on = switched("BADGES", "on");
		const earned = await evaluateChange(on, ATHLETE_A, rides());
		expect(earned.badges.length).toBeGreaterThan(0);
		expect(await count("badge_rises")).toBe(1);
	});

	it("off: a stored badge rise is no notification text", async () => {
		await upsertBadgeRiseStatement(
			env.DB,
			ATHLETE_A,
			[BADGES[0]?.id ?? ""],
			NOW,
		).run();
		const text = (c: TestCtx) =>
			riderPage(c, ATHLETE_A, "/me/notification-text");
		expect((await text(switched("BADGES", "off"))).status).toBe(204);
		expect((await text(switched("BADGES", "on"))).status).toBe(200);
	});
});

describe("PHRASES", () => {
	beforeEach(() =>
		seedBalance(ATHLETE_A, { trainingRynke: 30, trainingMissing: 220 }),
	);

	it("off: no quote on the Team page and nothing marked as seen", async () => {
		const off = await riderPage(switched("PHRASES", "off"), ATHLETE_A, "/team");
		expect(off.status).toBe(200);
		expect(off.html).not.toContain('class="quote');
		expect(await count("quote_seen")).toBe(0);

		// A team on the common phrases has none in a language without a set yet.
		if (!phraseSet(ctx.team, ctx.team.defaultLocale)) return;
		const on = await riderPage(switched("PHRASES", "on"), ATHLETE_A, "/team");
		expect(on.html).toContain('class="quote');
		expect(await count("quote_seen")).toBe(1);
	});
});

describe("SEASON_ALBUM", () => {
	const FILES: AlbumFiles = { fonts: {} };
	const album = (c: TestCtx) =>
		handleAlbumRequest(
			new Request("http://127.0.0.1:8798/riders?cutoff=2026-10-06"),
			c.env,
			FILES,
			() => NOW,
		);
	const albumText = (c: TestCtx) =>
		escapeHtml(createI18n(c.team.defaultLocale, c.catalogs).t("privacy.album"));

	it("off: no album and no word of it in the privacy text", async () => {
		const off = switched("SEASON_ALBUM", "off");
		expect((await album(off)).status).toBe(404);
		const page = await riderPage(off, ATHLETE_A, "/privacy");
		expect(page.html).not.toContain(albumText(off).slice(0, 40));

		const on = switched("SEASON_ALBUM", "on");
		expect((await album(on)).status).toBe(200);
		const shown = await riderPage(on, ATHLETE_A, "/privacy");
		expect(shown.html).toContain(albumText(on).slice(0, 40));
	});
});

describe("FUN_THEMES", () => {
	it("off: no fun theme in the menu or the head script", async () => {
		const off = await riderPage(
			switched("FUN_THEMES", "off"),
			ATHLETE_A,
			"/me/settings",
		);
		for (const id of ["confetti", "disco"]) {
			expect(off.html).not.toContain(`value="${id}"`);
			expect(off.html).not.toContain(`"${id}"`);
		}
		expect(off.html).toContain('value="rynke-day"');

		const on = await riderPage(
			switched("FUN_THEMES", "on"),
			ATHLETE_A,
			"/me/settings",
		);
		for (const id of ["confetti", "disco"]) {
			expect(on.html).toContain(`value="${id}"`);
		}
	});
});
