import type { RynkeRules } from "../rynke/rules";
import { hamburg } from "./hamburg";
import type { TeamData } from "./types";

// Europe's own Rynke rules (feature 039, decided with Team Europe on
// 2026-11-17): the founding team's version 3 values, written out, plus a
// minimum ride length of 25 km. Raise `version` and set `effectiveDate` in the
// same change as any change of a value or of rule logic, and keep the previous
// object in `rules`: every stored result records its version, the daily cron
// re-evaluates riders stored with another one, and the rider page explains a
// stored result with the rules of its version.
const EUROPE_RULES_V4: RynkeRules = {
	version: 4,
	effectiveDate: "2026-11-17",
	distanceStepKm: 10,
	distanceStepRynke: 1,
	elevationStepM: 1000,
	elevationStepRynke: 5,
	maxPausedShare: { num: 1, den: 1 },
	minSpeedKmh: 10,
	maxSpeedKmh: 45,
	maxClimbMPerH: 1500,
	minRideKm: 25,
	excludedSportTypes: ["EBikeRide", "EMountainBikeRide"],
	trainingThreshold: 250,
	teamThreshold: 25,
	maxVirtualShare: { num: 1, den: 3 },
	teamEvents: {
		team_training: { team: 1, training: 5 },
		training_weekend_day: { team: 5, training: 10 },
		technique_training: { team: 5, training: 5 },
	},
};

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
	// The founding team's versions 1–3, which Europe ran on since feature 026,
	// then its own (feature 039 research R4).
	rules: [...hamburg.rules.slice(0, 3), EUROPE_RULES_V4],
	// The founding team's event kinds, decided (spec 026 clarification
	// 2026-11-09).
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
	// Team Europe's holidays (feature 037 data-model.md), sharing the founding
	// team's pictures, which show no place; no Nikolaus. Advent's set, the four
	// Advent Sundays, Christmas Eve as its own window and the days between the
	// years (feature 038).
	holidays: [
		{
			id: "carnival",
			monkeys: ["karneval"],
			from: { anchor: "easter", offset: -52 },
			to: { anchor: "easter", offset: -46 },
			kind: "short",
		},
		{
			id: "valentine",
			monkeys: ["valentine"],
			from: "02-14",
			to: "02-14",
			kind: "short",
		},
		{
			id: "easter",
			monkeys: ["easter"],
			from: { anchor: "easter", offset: -2 },
			to: { anchor: "easter", offset: 1 },
			kind: "short",
		},
		{
			id: "eu-day",
			monkeys: ["eu-day"],
			from: "05-09",
			to: "05-09",
			kind: "short",
		},
		{
			id: "midsummer",
			monkeys: ["midsummer"],
			from: "06-20",
			to: "06-24",
			kind: "short",
		},
		{
			id: "halloween",
			monkeys: ["halloween"],
			from: "10-29",
			to: "10-31",
			kind: "short",
		},
		{
			id: "advent",
			monkeys: [
				"advent",
				"christmas-market",
				"mulled-wine",
				"christmas-biscuits",
			],
			from: { anchor: "first-advent", offset: 0 },
			to: "12-23",
			kind: "long",
		},
		{
			id: "advent-1",
			monkeys: ["advent-wreath-1"],
			from: { anchor: "first-advent", offset: 0 },
			to: { anchor: "first-advent", offset: 0 },
			kind: "short",
		},
		{
			id: "advent-2",
			monkeys: ["advent-wreath-2"],
			from: { anchor: "first-advent", offset: 7 },
			to: { anchor: "first-advent", offset: 7 },
			kind: "short",
		},
		{
			id: "advent-3",
			monkeys: ["advent-wreath-3"],
			from: { anchor: "first-advent", offset: 14 },
			to: { anchor: "first-advent", offset: 14 },
			kind: "short",
		},
		{
			id: "advent-4",
			monkeys: ["advent-wreath-4"],
			from: { anchor: "first-advent", offset: 21 },
			to: { anchor: "first-advent", offset: 21 },
			kind: "short",
		},
		{
			id: "christmas-eve",
			monkeys: ["christmas"],
			from: "12-24",
			to: "12-24",
			kind: "short",
		},
		{
			id: "christmas",
			monkeys: ["christmas"],
			from: "12-25",
			to: "12-26",
			kind: "short",
		},
		{
			id: "between-the-years",
			monkeys: ["between-the-years"],
			from: "12-27",
			to: "12-30",
			kind: "short",
		},
		{
			id: "new-year",
			monkeys: ["new-year"],
			from: "12-31",
			to: "01-01",
			kind: "short",
		},
	],
	// The founding team's club (wrangler.jsonc `STRAVA_CLUB_ID`).
	otherClubIds: [1088689],
	// Half of the re-check's 300 reads a day (feature 036 FR-008).
	recheckAllowance: 150,
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
		"SEASON_START_DATE",
		"QUALIFICATION_DEADLINE",
		"PRIVACY_CONTROLLER",
		"CONTACT_EMAIL",
		"database_id",
	],
};
