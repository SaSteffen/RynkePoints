import { BADGE_NAMES } from "../content/badge-names/hamburg.de";
import { HAMBURG_PHRASES } from "../content/phrases/hamburg.de";
import type { RynkeRules } from "../rynke/rules";
import type { TeamData } from "./types";

// The founding team's data: today's values, moved here from the modules that
// held them (feature 026 T038). The rule functions take this history as an
// argument (`ctx.team.rules`, T045).

// The Rynke rules (research R8, FR-012, FR-023, moved from src/rynke/rules.ts).
// Raise `version` and set `effectiveDate` in the same change as any change of a
// value or of rule logic: every stored result records the version, and the
// daily cron re-evaluates riders stored with another one. Flagged rides never
// count (FR-005g); that is deliberately not a rule value.
//
// When raising `version`, keep the previous object in `rules`: the rider page
// explains stored results with the rules of the version they record (feature
// 005, research R3).
//
// The team-event amounts are rule values too (FR-012). Version 2 is Story 3's
// logic change: every evaluation counts attendance, with the same values as
// version 1 (research R18). Version 3 lets a ride pause as long as it moves,
// half of its elapsed time, instead of half its moving time (FR-005a).

const RULES_V1: RynkeRules = {
	version: 1,
	effectiveDate: "2026-10-07",
	distanceStepKm: 10,
	distanceStepRynke: 1,
	elevationStepM: 1000,
	elevationStepRynke: 5,
	maxPausedShare: { num: 1, den: 2 },
	minSpeedKmh: 10,
	maxSpeedKmh: 45,
	maxClimbMPerH: 1500,
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

const RULES_V2: RynkeRules = {
	...RULES_V1,
	version: 2,
	effectiveDate: "2026-10-07",
};

const RULES_V3: RynkeRules = {
	...RULES_V2,
	version: 3,
	effectiveDate: "2026-10-09",
	maxPausedShare: { num: 1, den: 1 },
};

/** The founding team: German by default, its own German phrases and badge names. */
export const hamburg: TeamData = {
	id: "hamburg",
	name: "Team Rynkeby Hamburg",
	shortName: "RynkePoints",
	defaultLocale: "de",
	foreignLocale: "en",
	rules: [RULES_V1, RULES_V2, RULES_V3],
	// Every kind of src/rynke/team-events.ts, the Tour de Paris among them.
	eventKinds: [
		"team_training",
		"training_weekend_day",
		"technique_training",
		"tour_de_paris",
	],
	colours: {
		// Every theme of src/http/themes.ts, in its menu order.
		themes: [
			"rynke-day",
			"baltic",
			"paris",
			"lilac",
			"confetti",
			"rynke-night",
			"night-ride",
			"forest",
			"plum",
			"disco",
			"contrast-light",
			"contrast-dark",
		],
		// The manifest's (src/http/pwa.ts).
		manifest: { themeColor: "#fffdf5", backgroundColor: "#fffdf5" },
	},
	art: {
		// What src/http/coin.ts and src/http/theme-menu.ts show.
		coin: {
			front: "/coin/rynke-coin-front.svg",
			back: "/coin/rynke-coin-back.svg",
		},
		// The page head's (src/http/html.ts), the manifest's and the service
		// worker's notification icons.
		icons: {
			favicon: "/icons/favicon.svg",
			appleTouch: "/icons/apple-touch-icon.png",
			icon192: "/icons/icon-192.png",
			icon512: "/icons/icon-512.png",
			maskable512: "/icons/icon-maskable-512.png",
			notificationBadge: "/icons/badge-96.png",
		},
		badges: {},
		// The badges whose scenes in art/badges/badges.json show Hamburg: the
		// Elbphilharmonie, and the harbour crane on the river.
		teamSpecificBadges: ["distance-1000", "running-100", "team-running-1000"],
	},
	phrases: { kind: "own", locale: "de", set: HAMBURG_PHRASES },
	badgeNames: { kind: "own", locale: "de", names: BADGE_NAMES },
	// The quote monkeys' holidays: the German December ones (feature 035) and
	// Karneval, Easter, Midsummer and Halloween (feature 037 data-model.md).
	holidays: [
		{
			id: "karneval",
			monkey: "karneval",
			from: { anchor: "easter", offset: -52 },
			to: { anchor: "easter", offset: -46 },
			kind: "short",
		},
		{
			id: "easter",
			monkey: "easter",
			from: { anchor: "easter", offset: -2 },
			to: { anchor: "easter", offset: 1 },
			kind: "short",
		},
		{
			id: "midsummer",
			monkey: "midsummer",
			from: "06-20",
			to: "06-24",
			kind: "short",
		},
		{
			id: "halloween",
			monkey: "halloween",
			from: "10-29",
			to: "10-31",
			kind: "short",
		},
		{
			id: "advent",
			monkey: "advent",
			from: { anchor: "first-advent", offset: 0 },
			to: "12-23",
			kind: "long",
		},
		{
			id: "nikolaus",
			monkey: "nikolaus",
			from: "12-06",
			to: "12-06",
			kind: "short",
		},
		{
			id: "christmas",
			monkey: "christmas",
			from: "12-24",
			to: "12-26",
			kind: "short",
		},
		{
			id: "new-year",
			monkey: "new-year",
			from: "12-31",
			to: "01-01",
			kind: "short",
		},
	],
	// Filled with Europe's club once it has one (FR-012, release 4).
	otherClubIds: [],
	// Half of the re-check's 300 reads a day; Europe has the other half (036).
	recheckAllowance: 150,
	rulesHandout: { path: "/rynke-punkte.pdf", locale: "de" },
	dev: { host: "localhost", port: 8789, inspectorPort: 9230 },
	cloudflare: {
		worker: "rynke-points",
		databaseId: "f1493f0b-1930-48de-afc5-f6edda211092",
		queueIds: [],
	},
	placeholders: [],
};
