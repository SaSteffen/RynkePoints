import type { RynkeRules } from "../rynke/rules";
import { hamburg } from "./hamburg";
import type { TeamData } from "./types";

// Europe's own Rynke rules (feature 039, decided with Team Europe on
// 2026-11-17): the founding team's version 3 values, written out, plus a
// minimum ride length of 25 km, only a third of the Training Rynke needed from
// outside virtual rides, and no Team Rynke: no threshold, and no team event
// earns any (research R2). Raise `version` and set `effectiveDate` in the
// same change as any change of a value, of rule logic or of the season or
// qualification dates in wrangler.jsonc (issue #19), and keep the previous
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
	teamThreshold: null,
	// A third of 250 from anything but virtual rides, rounded up (research R15).
	minOutsideTraining: 84,
	teamEvents: {
		team_training: { team: 0, training: 0 },
		training_weekend_day: { team: 0, training: 0 },
		technique_training: { team: 0, training: 0 },
	},
};

// Version 5 (decided with Team Europe on 2026-11-19): a ride under the minimum
// counts again, its elevation included, and only its kilometres earn nothing.
// The minimum is 25 km outdoors and 1 km for virtual rides, so short, hard
// indoor sessions earn their full 10 km and their elevation.
const { minRideKm: _minRideKm, ...EUROPE_RULES_V4_VALUES } = EUROPE_RULES_V4;
const EUROPE_RULES_V5: RynkeRules = {
	...EUROPE_RULES_V4_VALUES,
	version: 5,
	effectiveDate: "2026-11-19",
	distanceMinKm: { outdoor: 25, virtual: 1 },
};

// Version 6 (Team Europe's rules review, 2026-11-20): a virtual ride may
// average up to 50 km/h, as long descents on Rouvy or Zwift do; rides
// outdoors keep 45 km/h, which catches car and train trips.
const EUROPE_RULES_V6: RynkeRules = {
	...EUROPE_RULES_V5,
	version: 6,
	effectiveDate: "2026-11-20",
	virtualMaxSpeedKmh: 50,
};

// Team Rynkeby Europe (feature 026). English by default, the common phrases and
// badge names, its own coin. Everything it hasn't supplied yet is copied from
// the founding team and named in `placeholders` (FR-053), so `team-check
// --deployable europe` refuses a production deploy until each is replaced.

export const europe: TeamData = {
	id: "europe",
	name: "Team Rynkeby Europe",
	// The founding team's short name and colours, as Europe's own (spec 026 T081).
	shortName: hamburg.shortName,
	defaultLocale: "en",
	foreignLocale: "en",
	// The founding team's versions 1–3, which Europe ran on since feature 026,
	// then its own (feature 039 research R4).
	rules: [
		...hamburg.rules.slice(0, 3),
		EUROPE_RULES_V4,
		EUROPE_RULES_V5,
		EUROPE_RULES_V6,
	],
	// No team events and no Tour de Paris days (feature 039 research R3).
	eventKinds: [],
	colours: hamburg.colours,
	art: {
		// art/coin/europe/, copied by pnpm coin-art.
		coin: {
			front: "/teams/europe/coin/rynke-coin-front.svg",
			back: "/teams/europe/coin/rynke-coin-back.svg",
		},
		// The home-screen icons show Europe's coin (pnpm icons); the favicon and
		// the notification badge show only the head and are shared.
		icons: {
			...hamburg.art.icons,
			appleTouch: "/teams/europe/icons/apple-touch-icon.png",
			icon192: "/teams/europe/icons/icon-192.png",
			icon512: "/teams/europe/icons/icon-512.png",
			maskable512: "/teams/europe/icons/icon-maskable-512.png",
		},
		// Its own take of each badge with the founding team's motifs
		// (art/badges/teams/europe/, pnpm badge-build).
		badges: Object.fromEntries(
			hamburg.art.teamSpecificBadges.map((id) => [
				id,
				`/teams/europe/badges/${id}.svg`,
			]),
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
	// Half of the re-check's 300 reads a day (feature 036 FR-008).
	recheckAllowance: 150,
	// For now an English translation of the founding team's handout (T082).
	rulesHandout: { path: "/teams/europe/rynke-points.pdf", locale: "en" },
	dev: { host: "europe.localhost", port: 8790, inspectorPort: 9231 },
	cloudflare: {
		worker: "rynke-points-europe",
		databaseId: "ab5fb54c-2e8d-4ee3-8668-a27e99da58f5",
		queueIds: ["15a3b7e979294386838bf566b4f300cf"],
	},
	placeholders: [],
};
