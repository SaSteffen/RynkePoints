import { env } from "cloudflare:test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readOnly } from "../../album/guard";
import { loadAlbum } from "../../album/load";
import { renderAlbum } from "../../album/render";
import { samplesFor } from "../../dev/fake-strava/sample-sets";
import { devFetch } from "../../dev/worker";
import {
	BADGE_CATEGORIES,
	BADGES,
	categoryById,
} from "../../src/badges/catalog";
import { CATALOGS } from "../../src/i18n/catalogs";
import {
	CorrectionRefused,
	correctionChange,
} from "../../src/rynke/correction-change";
import {
	TeamEventRefused,
	teamEventChange,
} from "../../src/rynke/team-event-change";
import { hasEvents, hasTeamRynke, teamFor } from "../../src/teams";
import { makeCtx, type TestCtx } from "../support/ctx";
import { NOW } from "../support/fixtures";
import PINNED_VARS from "../support/pinned.json";
import {
	endSampleSeason,
	getPage,
	LOCAL,
	pageText,
	riderCookie,
	rows,
	seedSampleSeason,
} from "../support/sample-season";

// A team without Team Rynke and events (feature 039 US4, contracts/
// team-surfaces.md): none of its pages, in English or German, mentions them
// or links to the event pages, those pages don't exist, and the domain refuses
// what the pages no longer offer. The founding team's counterpart is
// pages-snapshot.test.ts.

const team = teamFor(env);
const { riders: SAMPLES, organiser: ORGANISER } = samplesFor(team.id);

const LANGS = ["en", "de"] as const;

// "Team Rynke" but not the team's name, "Team Rynkeby …".
const FORBIDDEN: Record<(typeof LANGS)[number], readonly (string | RegExp)[]> =
	{
		en: [
			/Team Rynke(?!by)/,
			"team event",
			"Team event",
			"attend",
			"Tour de Paris",
			"tour day",
			// A rider's report of an event they were at (feature 019).
			"open report",
		],
		de: [
			"Teamrynke",
			"Teamtermin",
			"Termine",
			"Tour de Paris",
			"offenen Meldung",
		],
	};

const EVENT_LINK = /href="\/(organiser\/)?events/;

/** A connected sample rider who isn't an organiser, with rides. */
function rider(): string {
	const found = SAMPLES.find(
		(r) =>
			r.clubMember &&
			r.behaviour === "normal" &&
			!r.organiser &&
			!r.administrator &&
			r.consentVersion === undefined &&
			r.rides.length > 0,
	);
	if (!found) throw new Error("no ordinary sample rider");
	return found.athleteId;
}

function heldBack(): string {
	const found = SAMPLES.find((r) => r.consentVersion !== undefined);
	if (!found) throw new Error("no sample rider is held back on consent");
	return found.athleteId;
}

/** Asserts that a page's visible text and links carry no Team Rynke or events. */
async function expectClean(
	label: string,
	lang: (typeof LANGS)[number],
	markup: string,
): Promise<void> {
	const text = await pageText(markup);
	for (const word of FORBIDDEN[lang]) {
		const lines = text
			.split("\n")
			.filter((line) =>
				typeof word === "string" ? line.includes(word) : word.test(line),
			);
		expect.soft(lines, `${label} ${lang}: "${word}"`).toEqual([]);
	}
	expect.soft(markup, `${label} ${lang}: event link`).not.toMatch(EVENT_LINK);
}

async function checkPage(
	path: string,
	lang: (typeof LANGS)[number],
	cookie?: string,
): Promise<string> {
	const { status, markup } = await getPage(path, lang, cookie);
	expect.soft(status, `${path} ${lang}`).toBe(200);
	await expectClean(path, lang, markup);
	return markup;
}

/** The badges only recorded events earn (feature 039 US5, research R9). */
const EVENT_ONLY = BADGE_CATEGORIES.filter((c) => c.events);

/** Asserts that a badge list holds no event-only badge, earned or to come. */
async function expectNoEventBadges(
	label: string,
	lang: (typeof LANGS)[number],
	markup: string,
): Promise<void> {
	const lines = new Set((await pageText(markup)).split("\n"));
	for (const category of EVENT_ONLY) {
		const heading = CATALOGS[lang][`badges.category.${category.id}`];
		expect.soft(lines.has(heading), `${label} ${lang}: ${heading}`).toBe(false);
		expect
			.soft(markup, `${label} ${lang}: ${category.id}`)
			.not.toContain(`data-category="${category.id}"`);
	}
	for (const badge of BADGES) {
		if (!categoryById(badge.category).events) continue;
		expect
			.soft(markup, `${label} ${lang}: ${badge.id}`)
			.not.toContain(`data-badge="${badge.id}"`);
	}
}

/** The tour card's way on, or `null` on its last step. */
function nextStep(markup: string): string | null {
	const card = markup.match(/<aside class="tour"[\s\S]*?<\/aside>/)?.[0];
	const href = card?.match(/<a class="button" href="([^"]*)"/)?.[1];
	return href === undefined ? null : href.replaceAll("&amp;", "&");
}

async function checkTour(
	first: string,
	lang: (typeof LANGS)[number],
	cookie: string,
): Promise<number> {
	let path: string | null = first;
	let steps = 0;
	while (path !== null) {
		if (++steps > 30) throw new Error(`the tour from ${first} doesn't end`);
		const markup = await checkPage(path, lang, cookie);
		expect(markup).toContain('<aside class="tour"');
		path = nextStep(markup);
	}
	return steps;
}

describe.runIf(!hasEvents(team))(
	`${team.id} without Team Rynke and events (feature 039 US4)`,
	() => {
		let season: TestCtx;

		beforeAll(async () => {
			season = await seedSampleSeason();
		}, 120_000);

		afterAll(endSampleSeason);

		it("has neither, as its data says", () => {
			expect(hasTeamRynke(team)).toBe(false);
		});

		it("mentions neither on the start, privacy and consent pages", async () => {
			const held = await riderCookie(heldBack());
			for (const lang of LANGS) {
				await checkPage("/", lang);
				await checkPage("/privacy", lang);
				await checkPage("/me", lang, held);
			}
		}, 120_000);

		it("mentions neither on a rider's pages", async () => {
			const cookie = await riderCookie(rider());
			for (const lang of LANGS) {
				for (const path of [
					"/me",
					"/me/rides",
					"/team",
					"/team?kind=team",
					"/me/settings",
				]) {
					await checkPage(path, lang, cookie);
				}
			}
		}, 120_000);

		it("mentions neither on the organiser's pages", async () => {
			const cookie = await riderCookie(ORGANISER);
			for (const lang of LANGS) {
				for (const path of [
					"/organiser/riders",
					"/organiser/riders?view=graphs",
					`/organiser/riders/${rider()}`,
					"/me",
					"/team",
				]) {
					await checkPage(path, lang, cookie);
				}
			}
		}, 120_000);

		it("mentions neither in either tour", async () => {
			const riderCookieHeader = await riderCookie(rider());
			const organiser = await riderCookie(ORGANISER);
			for (const lang of LANGS) {
				expect(
					await checkTour("/team?tour=rider&step=1", lang, riderCookieHeader),
				).toBeGreaterThan(1);
				expect(
					await checkTour(
						"/organiser/riders?tour=organiser&step=1",
						lang,
						organiser,
					),
				).toBeGreaterThan(0);
			}
		}, 120_000);

		it("mentions neither in the season album", async () => {
			const athleteId = rider();
			const sample = SAMPLES.find((r) => r.athleteId === athleteId);
			const data = await loadAlbum(
				readOnly(env.DB),
				{ ...env, ...PINNED_VARS },
				{ athleteId, firstName: sample?.firstName ?? "" },
				"2026-10-06",
				NOW,
			);
			expect(data.slots.length).toBeGreaterThan(0);
			for (const lang of LANGS) {
				const markup = renderAlbum({ ...data, locale: lang });
				await expectClean("album", lang, markup);
				await expectNoEventBadges("album", lang, markup);
			}
		}, 120_000);

		it("lists no event-only badge on the badges page (US5)", async () => {
			for (const athleteId of [rider(), ORGANISER]) {
				const cookie = await riderCookie(athleteId);
				for (const lang of LANGS) {
					const markup = await checkPage("/me/badges", lang, cookie);
					expect(markup).toContain('class="badge-cards"');
					await expectNoEventBadges(`/me/badges ${athleteId}`, lang, markup);
				}
			}
		}, 120_000);

		it("has no event pages, for GET or POST", async () => {
			const organiser = await riderCookie(ORGANISER);
			for (const path of [
				"/events",
				"/events/1/report",
				"/events/1/report/delete",
				"/organiser/events",
				"/organiser/events/1",
				"/organiser/events/1/attendance",
				"/organiser/requests",
				"/organiser/requests/undo",
			]) {
				for (const method of ["GET", "POST"]) {
					const response = await devFetch(
						new Request(new URL(path, LOCAL), {
							method,
							headers: { Cookie: organiser, Origin: LOCAL },
						}),
						season,
					);
					await response.text();
					expect.soft(response.status, `${method} ${path}`).toBe(404);
				}
			}
		});

		it("opens Orga on the riders", async () => {
			const organiser = await riderCookie(ORGANISER);
			const response = await devFetch(
				new Request(new URL("/organiser", LOCAL), {
					headers: { Cookie: organiser },
				}),
				season,
			);
			await response.text();
			expect(response.status).toBeGreaterThanOrEqual(300);
			expect(response.status).toBeLessThan(400);
			expect(response.headers.get("Location")).toMatch(
				/^(http:\/\/localhost:8789)?\/organiser\/riders$/,
			);
		});

		it("shows the Training view for kind=team", async () => {
			const cookie = await riderCookie(rider());
			const { status, markup } = await getPage("/team?kind=team", "en", cookie);
			expect(status).toBe(200);
			expect(markup).not.toContain("kind-switch");
			expect(markup).not.toContain("kind=team");
		});

		it("refuses every team-event change", async () => {
			const ctx = makeCtx();
			for (const kind of [
				"team_training",
				"training_weekend_day",
				"technique_training",
				"tour_de_paris",
			]) {
				await expect(
					teamEventChange(ctx, {
						kind: "create-event",
						event: { kind, date: "2026-10-01", name: null },
					}),
				).rejects.toBeInstanceOf(TeamEventRefused);
			}
			await expect(
				teamEventChange(ctx, {
					kind: "add-attendance",
					eventId: 1,
					athleteIds: [rider()],
				}),
			).rejects.toBeInstanceOf(TeamEventRefused);
		});

		it("refuses a correction with Team Rynke", async () => {
			await expect(
				correctionChange(makeCtx(), {
					kind: "add-correction",
					athleteId: rider(),
					correction: {
						training: 0,
						team: 5,
						reason: "Sample",
						date: "2026-10-01",
					},
					by: ORGANISER,
				}),
			).rejects.toBeInstanceOf(CorrectionRefused);
		});

		it("refuses a correction form with Team Rynke and says why", async () => {
			const organiser = await riderCookie(ORGANISER);
			const athleteId = rider();
			const before = await rows(
				"SELECT correction_id FROM corrections WHERE athlete_id = ?",
				athleteId,
			);
			const response = await devFetch(
				new Request(
					new URL(`/organiser/riders/${athleteId}/corrections`, LOCAL),
					{
						method: "POST",
						headers: {
							Cookie: organiser,
							Origin: LOCAL,
							"Content-Type": "application/x-www-form-urlencoded",
						},
						body: new URLSearchParams({
							training: "0",
							team: "5",
							reason: "Sample",
							date: "2026-10-01",
						}),
					},
				),
				season,
			);
			await response.text();
			const location = response.headers.get("Location") ?? "";
			expect(location).toContain("error=invalid_amount");
			const page = await getPage(
				new URL(location, LOCAL).pathname + new URL(location, LOCAL).search,
				"en",
				organiser,
			);
			expect(page.markup).toContain('class="notice notice-error" role="alert"');
			expect(
				await rows(
					"SELECT correction_id FROM corrections WHERE athlete_id = ?",
					athleteId,
				),
			).toEqual(before);
		});

		it("counts a rider with Training Rynke and the outdoor share as qualified (SC-005)", async () => {
			const qualified = (await rows(
				"SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM rynke_balances WHERE qualified = 1 AND team_missing = 0",
			)) as { athlete_id: string }[];
			expect(qualified.length).toBeGreaterThan(0);
			expect(
				await rows(
					"SELECT CAST(athlete_id AS TEXT) AS athlete_id FROM rynke_balances WHERE training_missing = 0 AND virtual_share_missing = 0 AND qualified = 0",
				),
			).toEqual([]);
		});

		// Last, as it changes a stored result: a sandbox still holds results
		// worked out under version 3, which had Team Rynke.
		it("shows no Team Rynke for a result stored under an older version", async () => {
			const athleteId = rider();
			await env.DB.prepare(
				"UPDATE rynke_balances SET rules_version = 3, rules_effective_date = '2026-10-09', team_rynke = 1, team_missing = 24, qualified = 0 WHERE athlete_id = ?",
			)
				.bind(athleteId)
				.run();
			const cookie = await riderCookie(athleteId);
			for (const lang of LANGS) {
				const markup = await checkPage("/me", lang, cookie);
				expect(markup).toContain('class="rynke-gauges"');
				expect(markup).not.toContain("gauge-card-team");
				expect(markup).not.toContain('data-series="team"');
			}
		});
	},
);
