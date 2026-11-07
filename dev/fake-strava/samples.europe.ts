import {
	ALL_SCOPES,
	ordinaryRiders,
	ride,
	rides,
	type SampleRider,
	type SampleSet,
	slot,
	type TeamEventRecipe,
} from "./samples";

// Team Europe's sample riders (feature 026 FR-050): the same states as
// Hamburg's, with first names from the team's countries (Denmark, Norway,
// Sweden, Finland, Iceland, Germany, France, the Netherlands, Lithuania, the
// UK and Canada). Only first names joined to the state they show, so nobody
// real is meant; athlete IDs 991001–991099, apart from Hamburg's.

/** One to three per country, accents and all. */
const ORDINARY_NAMES = [
	"Aino", // Finland
	"Bjørn", // Norway
	"Camille", // France
	"Daan", // the Netherlands
	"Einar", // Iceland
	"Freja", // Denmark
	"Gintarė", // Lithuania
	"Hamish", // the UK
	"Ilse", // Germany
	"Jóhanna", // Iceland
	"Kalle", // Sweden
	"Logan", // Canada
	"Mette", // Denmark
	"Niklas", // Germany
	"Oona", // Finland
	"Pieter", // the Netherlands
	"Quentin", // France
	"Rokas", // Lithuania
	"Sølvi", // Norway
	"Torsten", // Sweden
	"Ulla", // Denmark
	"Vilja", // Finland
	"Wyatt", // Canada
	"Xavier", // Canada
	"Ylva", // Sweden
];

export const SAMPLE_RIDERS: readonly SampleRider[] = [
	{
		athleteId: 991001,
		firstName: "Ingrid Importing",
		state: "Import still running: the fake answers her activity list with 503",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "import-stuck",
		rides: rides(4, (i) => ride(...slot(i), 45, 250, 24)),
	},
	{
		athleteId: 991002,
		firstName: "Nanna NoRides",
		state: "No rides, so no badges yet",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [],
	},
	{
		athleteId: 991003,
		firstName: "Fleur FarAway",
		state: "Far from both targets",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: rides(4, (i) => ride(...slot(i), 20 + 6 * i, 120, 21)),
	},
	{
		athleteId: 991004,
		firstName: "Tuuli TrainingDone",
		state:
			"Training target reached without virtual rides; Team Rynke missing; organiser",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		organiser: true,
		// 24 rides of 102–112 km: over 240 distance Rynke plus about 90 for
		// climbing.
		rides: rides(24, (i) =>
			ride(...slot(i), 102 + (i % 11), 650 + ((i * 41) % 300), 24 + (i % 7)),
		),
	},
	{
		athleteId: 991005,
		firstName: "Védís Virtual",
		state: "Training target reached only thanks to virtual rides",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Outdoors: 140 distance Rynke and 1,400 m (5 Rynke), under 167. With
		// the virtual rides: over 250.
		rides: rides(27, (i) =>
			i < 14
				? ride(...slot(i), 100, 100, 26)
				: ride(...slot(i), 100, 200, 31, {
						sportType: "VirtualRide",
						trainer: true,
					}),
		),
	},
	{
		athleteId: 991006,
		firstName: "Rasmus Rejected",
		state:
			"Rides that don't count, one per rule, and a run that counts only for the running badges",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Each ride breaks only its own rule (CURRENT_RULES).
		rides: [
			// 7 km/h, below 10.
			ride(1, "18:00", 14, 40, 7),
			// 55 km/h, above 45.
			ride(2, "18:00", 55, 80, 55),
			// 130 minutes' pause on 90 moving, longer than moving.
			{ ...ride(3, "18:00", 40, 200, 26.67), elapsedMin: 220 },
			// 2,700 m in 90 minutes: 1,800 m/h, above 1,500.
			ride(4, "18:00", 30, 2700, 20),
			ride(5, "18:00", 35, 150, 25, { manual: true }),
			ride(6, "18:00", 35, 150, 25, { flagged: true }),
			ride(7, "18:00", 35, 150, 25, { sportType: "EBikeRide" }),
			// The same ride recorded twice: the shorter one overlaps.
			ride(8, "18:00", 55, 350, 25),
			ride(8, "18:10", 48, 300, 25),
			ride(9, "18:00", 8, 40, 10, { sportType: "Run" }),
		],
	},
	{
		athleteId: 991007,
		firstName: "Pauliina Paging",
		state:
			"More rides than one page (47; 20 per page) and team events, one before the season start",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Two a day, mornings and evenings.
		rides: rides(47, (i) =>
			ride(1 + Math.floor(i / 2), i % 2 === 0 ? "06:30" : "18:30", 22, 120, 21),
		),
		events: [
			{ daysAgo: 2, kind: "team_training", name: "Sample team training" },
			{ daysAgo: 11, kind: "training_weekend_day", name: null },
			{ daysAgo: 11, kind: "technique_training", name: "Sample group riding" },
			// Doesn't count: before the season start.
			{ daysAgo: null, kind: "team_training", name: null },
		],
	},
	{
		athleteId: 991008,
		firstName: "Odile OptionalDenied",
		state: "Optional permissions withheld; three private rides stay hidden",
		scopes: "read,activity:read",
		clubMember: true,
		behaviour: "normal",
		rides: rides(9, (i) =>
			ride(...slot(i), 45, 280, 25, { private: i % 3 === 2 }),
		),
	},
	{
		athleteId: 991009,
		firstName: "Rūta Reconnect",
		state: "Must reconnect: the fake refuses her activity calls and refresh",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "refused",
		rides: rides(3, (i) => ride(...slot(i), 55, 350, 26)),
	},
	{
		athleteId: 991010,
		firstName: "Nigel NotMember",
		state: "Not a club member: signing in shows the not-member notice",
		scopes: ALL_SCOPES,
		clubMember: false,
		behaviour: "normal",
		rides: rides(3, (i) => ride(...slot(i), 45, 250, 25)),
	},
	{
		athleteId: 991011,
		firstName: "Oskar Organiser",
		state: "Organiser: manages team events and attendance at /organiser",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		organiser: true,
		rides: rides(6, (i) => ride(...slot(i), 55, 450, 25)),
	},
	{
		athleteId: 991012,
		firstName: "Bente Badges",
		state:
			"Badges (feature 013): earlier and later ones in a category, both technique trainings",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// 12 rides of 60 km and 500 m: 720 km and 6,000 m, so distance 100 and
		// 500 and elevation 1,000 and 5,000, each a few days apart.
		rides: rides(12, (i) => ride(...slot(i), 60, 500, 26)),
		events: [
			{ daysAgo: 8, kind: "technique_training", name: "Sample braking" },
			{ daysAgo: 3, kind: "technique_training", name: "Sample climbing" },
			{ daysAgo: 5, kind: "team_training", name: null },
		],
	},
	{
		athleteId: 991013,
		firstName: "Nienke NearlyThere",
		state:
			"Badges (feature 013): just short of the first distance and elevation badges",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// 99.6 km and 990 m: "1 km to go" and "10 m to go". The 8 distance Rynke
		// already earn the first Training Rynke badge; neither ride is 50 km.
		rides: [ride(2, "17:00", 49.8, 495, 24), ride(4, "17:00", 49.8, 495, 24)],
	},
	{
		athleteId: 991014,
		firstName: "Chloé Complete",
		state:
			"Badges (feature 013): every personal riding and team-event badge, no runs",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// 25 rides of 200 km and 1,000 m: 5,000 km, 25,000 m and 625 Training
		// Rynke, each category's last badge.
		rides: rides(25, (i) => ride(...slot(i), 200, 1000, 26)),
		// 20 team events, both technique trainings among them.
		events: Array.from({ length: 20 }, (_, i) => ({
			daysAgo: 1 + i,
			kind: i < 2 ? "technique_training" : "team_training",
			name: null,
		})),
	},
	{
		athleteId: 991015,
		firstName: "Ragnar Runner",
		state:
			"Badges (feature 013): outdoor runs for the running badges; treadmill, virtual and manual runs that don't count",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [
			...rides(3, (i) => ride(...slot(i), 45, 220, 25)),
			// Outdoors: 8.2 + 5.1 = 13.3 km, the longest 8.2 km.
			ride(6, "06:30", 8.2, 50, 10, { sportType: "Run" }),
			ride(3, "18:30", 5.1, 140, 8, { sportType: "TrailRun" }),
			// None of these counts (FR-020, FR-020a).
			ride(2, "18:30", 10, 0, 11, { sportType: "Run", trainer: true }),
			ride(4, "18:30", 14, 0, 12, { sportType: "VirtualRun", trainer: true }),
			ride(5, "18:30", 21.1, 0, 10, { sportType: "Run", manual: true }),
		],
	},
	{
		athleteId: 991016,
		firstName: "Wouter Winter",
		state:
			"Badges (feature 013 parts C and D): a long ride, virtual rides, winter days, swims and surprise badges",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [
			// Ride length 50 and 100.
			ride(3, "08:30", 108, 650, 26),
			// Virtual: 28 + 27 km, so virtual 50; not winter days.
			ride(5, "19:00", 28, 0, 30, { sportType: "VirtualRide" }),
			ride(6, "19:00", 27, 0, 30, { trainer: true }),
			// Winter: a trainer ride on 5 December is no December day; two rides
			// on 10 January are one day; five days in February.
			ride(0, "10:00", 40, 200, 24, { onDate: "11-14" }),
			ride(0, "18:00", 30, 0, 30, { onDate: "12-05", trainer: true }),
			ride(0, "10:00", 40, 200, 24, { onDate: "12-06" }),
			ride(0, "09:00", 40, 200, 24, { onDate: "01-10" }),
			ride(0, "15:00", 30, 100, 24, { onDate: "01-10" }),
			ride(0, "10:00", 40, 200, 24, { onDate: "01-11" }),
			...rides(5, (i) =>
				ride(0, "10:00", 40, 200, 24, { onDate: `02-0${1 + i}` }),
			),
			// Surprises (part D): Christmas Eve and a night owl on its own day
			// (counting once the dates have passed); New Year and early bird.
			ride(0, "22:00", 30, 100, 24, { onDate: "12-24" }),
			ride(9, "22:00", 30, 100, 24),
			ride(0, "05:30", 30, 100, 24, { onDate: "01-01" }),
			// With the activities on days 2 to 6, a full week from day 8 on (the
			// manual swim on day 7 doesn't count); day 1 off and a ride on the
			// seeding day: the rest day.
			ride(7, "10:00", 30, 100, 24),
			ride(8, "10:00", 30, 100, 24),
			ride(0, "10:00", 30, 100, 24),
			// Swims: pool and open water count, the manual one doesn't.
			ride(2, "07:00", 1.0, 0, 2.4, { sportType: "Swim", trainer: true }),
			ride(4, "07:00", 0.9, 0, 2.4, { sportType: "Swim" }),
			ride(7, "07:00", 1.5, 0, 2.4, { sportType: "Swim", manual: true }),
		],
	},
	{
		athleteId: 991017,
		firstName: "Frauke Festtag",
		state:
			"Badges (feature 013 part F): surprise badges from cycling traditions",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [
			// Festive 500: 4 × 130 km between Christmas Eve and New Year's Eve,
			// two of them on Zwift.
			ride(0, "10:00", 130, 300, 26, { onDate: "12-25" }),
			ride(0, "10:00", 130, 300, 26, { onDate: "12-27" }),
			ride(0, "10:00", 130, 0, 30, {
				onDate: "12-29",
				sportType: "VirtualRide",
				trainer: true,
			}),
			ride(0, "10:00", 130, 0, 30, {
				onDate: "12-31",
				sportType: "VirtualRide",
				trainer: true,
			}),
			// Etappenfahrer: 100 km on three days in a row, the middle one in
			// two rides.
			ride(3, "08:00", 100, 500, 25),
			ride(4, "07:00", 55, 300, 25),
			ride(4, "15:00", 45, 200, 25),
			ride(5, "08:00", 100, 500, 25),
			// Dreikampf: a ride, a run and a swim on one day.
			ride(8, "07:00", 1.2, 0, 2.4, { sportType: "Swim" }),
			ride(8, "10:00", 35, 150, 25),
			ride(8, "18:00", 5, 30, 10, { sportType: "Run" }),
			// Kreiszahl: 32 km on 14 March.
			ride(0, "10:00", 32, 150, 24, { onDate: "03-14" }),
			// Sonnenwende: outdoors on both solstices.
			ride(0, "10:00", 25, 100, 24, { onDate: "12-21" }),
			ride(0, "10:00", 25, 100, 24, { onDate: "06-21" }),
			// Osterhase: a ride on Easter Monday.
			ride(0, "10:00", 30, 150, 24, { onEaster: 1 }),
			// Everesting: 9 × 1,000 m in May.
			...rides(9, (i) =>
				ride(0, "09:00", 50, 1000, 20, { onDate: `05-0${1 + i}` }),
			),
		],
	},
	{
		athleteId: 991018,
		firstName: "Aistė Admin",
		state: "Administrator: watches usage and riders at /admin",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		administrator: true,
		rides: rides(4, (i) => ride(...slot(i), 45, 220, 25)),
	},
	...ordinaryRiders(ORDINARY_NAMES, 991_020, "Kalle"),
];

/** Records the team events below (feature 014 FR-040). */
export const EVENT_ORGANISER = 991004;

// Tuuli TrainingDone stays without Team Rynke, as her state says.
export const SAMPLE_TEAM_EVENTS: readonly TeamEventRecipe[] = [
	{
		daysAgo: 4,
		kind: "team_training",
		name: "Sample team ride",
		attendees: [991003, 991005, 991008, 991011],
		reports: [991012, 991015],
	},
	{
		daysAgo: 13,
		kind: "training_weekend_day",
		name: "Sample training weekend",
		attendees: [991005, 991011],
		reports: [991012],
	},
	// Six listed riders at one event: the team's first big training (feature
	// 013 US4).
	{
		daysAgo: 6,
		kind: "team_training",
		name: "Sample big training",
		attendees: [991003, 991005, 991008, 991011, 991012, 991015],
	},
	// Feature 019: open requests at three events, one rider with three and one
	// with two, and intents for events still to come. Nobody attended them yet.
	{
		daysAgo: 21,
		kind: "team_training",
		name: "Sample early ride",
		attendees: [],
		reports: [991012, 991015],
	},
	{
		daysAgo: -5,
		kind: "team_training",
		name: "Sample ride ahead",
		attendees: [],
		reports: [991003, 991005, 991008],
	},
	{
		daysAgo: -16,
		kind: "technique_training",
		name: "Sample technique session",
		attendees: [],
		reports: [991012],
	},
	// Feature 021: the eight days of the Tour de Paris, after the qualification
	// deadline. Fleur rides all of them, Védís the first five, Oskar the first
	// two, so each has the tour badges of their own days; they earn no Rynke,
	// and badges only once their day has come (the /_dev/ clock pretends it).
	...Array.from({ length: 8 }, (_, i) => `Sample stage ${i + 1}`).map(
		(name, i): TeamEventRecipe => ({
			daysAgo: null,
			onDate: `07-${String(4 + i).padStart(2, "0")}`,
			kind: "tour_de_paris",
			name,
			attendees: [
				991003,
				...(i < 5 ? [991005] : []),
				...(i < 2 ? [991011] : []),
			],
		}),
	),
];

export const EUROPE_SAMPLES: SampleSet = {
	riders: SAMPLE_RIDERS,
	teamEvents: SAMPLE_TEAM_EVENTS,
	organiser: EVENT_ORGANISER,
};
