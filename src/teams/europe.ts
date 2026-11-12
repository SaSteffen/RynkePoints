import { hamburg } from "./hamburg";
import type { TeamData } from "./types";

// Team Rynkeby Europe (feature 026). English by default, the common phrases and
// badge names, its own coin. Everything it hasn't supplied yet is copied from
// the founding team and named in `placeholders` (FR-053), so `team-check
// --deployable europe` refuses a production deploy until each is replaced.

export const europe: TeamData = {
	id: "europe",
	name: "Team Rynkeby Europe",
	shortName: hamburg.shortName,
	defaultLocale: "en",
	foreignLocale: "en",
	// The founding team's rules and event kinds, decided (spec 026
	// clarification 2026-11-09).
	rules: hamburg.rules,
	eventKinds: hamburg.eventKinds,
	colours: hamburg.colours,
	art: {
		// art/coin/europe/, copied by pnpm coin-art.
		coin: {
			front: "/teams/europe/coin/rynke-coin-front.svg",
			back: "/teams/europe/coin/rynke-coin-back.svg",
		},
		icons: hamburg.art.icons,
		// The neutral picture for each badge with the founding team's motifs.
		badges: Object.fromEntries(
			hamburg.art.teamSpecificBadges.map((id) => [id, "placeholder"]),
		),
		teamSpecificBadges: [],
	},
	phrases: { kind: "common" },
	badgeNames: { kind: "common" },
	// No seasonal quote monkeys yet (feature 035); which holidays, if any, is
	// Team Europe's decision, so `holidays` is in `placeholders` until then.
	holidays: [],
	// The founding team's club (wrangler.jsonc `STRAVA_CLUB_ID`).
	otherClubIds: [1088689],
	// For now an English translation of the founding team's handout (T082).
	rulesHandout: { path: "/teams/europe/rynke-points.pdf", locale: "en" },
	dev: { host: "europe.localhost", port: 8790, inspectorPort: 9231 },
	// The database ID is the Wrangler block's placeholder (`database_id`).
	cloudflare: {
		worker: "rynke-points-europe",
		databaseId: "00000000-0000-0000-0000-000000000000",
		queueIds: [],
	},
	placeholders: [
		"shortName",
		"colours",
		"art.icons",
		"STRAVA_CLUB_ID",
		"STRAVA_EXTRA_CLUB_IDS",
		"SEASON_START_DATE",
		"QUALIFICATION_DEADLINE",
		"PRIVACY_CONTROLLER",
		"CONTACT_EMAIL",
		"database_id",
		"holidays",
	],
};
