import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { BADGE_NAMES } from "../../src/content/badge-names/hamburg.de";
import { COMMON_PHRASES } from "../../src/content/phrases/common";
import { HAMBURG_PHRASES } from "../../src/content/phrases/hamburg.de";
import type { PhraseSet } from "../../src/content/types";
import { escapeHtml } from "../../src/http/html";
import { CATALOGS, type Locale } from "../../src/i18n/catalogs";
import { createI18n } from "../../src/i18n/i18n";
import { teamFor } from "../../src/teams";
import type { TeamData } from "../../src/teams/types";
import { makeCtx, resetDb, seedRider, type TestCtx } from "../support/ctx";
import { ATHLETE_A } from "../support/fixtures";
import { riderPage, seedBalance } from "../support/rider-view";

// The phrase rule (feature 026 FR-025, FR-052, contracts/phrases.md): a team
// with its own phrases and badge names shows them in every language; a team
// set to `common` shows the common ones in the rider's language.

const LOCALES = Object.keys(CATALOGS) as Locale[];
const BADGE = "distance-100";

const founding = makeCtx();
/** A team built for the test: the founding team's data, set to `common`. */
const commonTeam: TeamData = {
	...teamFor(env),
	phrases: { kind: "common" },
	badgeNames: { kind: "common" },
};
const common = makeCtx({ team: commonTeam });

const all = (set: PhraseSet) =>
	[
		...set.push,
		...set.onTrack,
		...Object.values(set.seasonPush).flat(),
		...Object.values(set.seasonOnTrack).flat(),
	].map(escapeHtml);

function quoteOf(page: string): { lang: string; text: string } | null {
	const match = page.match(
		/<blockquote class="quote [^"]*" lang="([^"]+)">\n<p>([^<]*)<\/p>/,
	);
	return match ? { lang: match[1] ?? "", text: match[2] ?? "" } : null;
}

async function seed(ctx: TestCtx) {
	await resetDb();
	await seedRider(ctx, { athleteId: ATHLETE_A });
	await seedBalance(ATHLETE_A, { trainingRynke: 17, teamRynke: 5 });
	await env.DB.prepare(
		"INSERT INTO rider_badges (athlete_id, badge_id, earned_on) VALUES (?, ?, ?)",
	)
		.bind(ATHLETE_A, BADGE, "2026-10-01")
		.run();
}

describe("a team with its own phrases and badge names", () => {
	beforeEach(() => seed(founding));

	it.each(LOCALES)("shows only its German phrases in %s", async (locale) => {
		const { html } = await riderPage(founding, ATHLETE_A, "/team", locale);
		const quote = quoteOf(html);
		expect(quote?.lang).toBe("de");
		expect(all(HAMBURG_PHRASES)).toContain(quote?.text);
	});

	it.each(LOCALES)("shows its German badge names in %s", async (locale) => {
		const { html } = await riderPage(founding, ATHLETE_A, "/me/badges", locale);
		expect(html).toContain(`<h4>${escapeHtml(BADGE_NAMES[BADGE] ?? "")}</h4>`);
	});
});

describe("a team set to common", () => {
	beforeEach(() => seed(common));

	it.each(LOCALES)("speaks %s or says nothing", async (locale) => {
		const { html } = await riderPage(common, ATHLETE_A, "/team", locale);
		const quote = quoteOf(html);
		const set = COMMON_PHRASES[locale];
		if (!set) {
			expect(quote).toBeNull();
			return;
		}
		expect(quote?.lang).toBe(locale);
		expect(all(set)).toContain(quote?.text);
		expect(all(HAMBURG_PHRASES)).not.toContain(quote?.text);
	});

	it.each(LOCALES)("names badges in %s", async (locale) => {
		const { html } = await riderPage(common, ATHLETE_A, "/me/badges", locale);
		const name = createI18n(locale, CATALOGS).t(`badge.name.${BADGE}`);
		expect(html).toContain(`<h4>${escapeHtml(name)}</h4>`);
		if (name !== BADGE_NAMES[BADGE]) {
			expect(html).not.toContain(
				`<h4>${escapeHtml(BADGE_NAMES[BADGE] ?? "")}</h4>`,
			);
		}
	});
});
