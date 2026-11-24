import {
	ALL_SCOPES,
	ordinaryRiders,
	ride,
	rides,
	type SampleRider,
	type SampleSet,
	slot,
} from "../../dev/fake-strava/samples";

// Team Europe's sample riders (feature 026 FR-050): the same states as
// Hamburg's, with first names from the team's countries (Denmark, Norway,
// Sweden, Finland, Iceland, Germany, France, the Netherlands, Lithuania, the
// UK and Canada). Only first names joined to the state they show, so nobody
// real is meant; athlete IDs "991001"–"991099", apart from Hamburg's. The team has
// no team events and no Team Rynke (feature 039), and kilometres earn Rynke
// from 25 km outdoors and from 1 km on virtual rides (rules version 5): nobody
// attends anything, and an outdoor ride is 25 km or longer unless it is there
// to show a shorter one. The season runs from 1 September like
// Hamburg's, the qualification window opens on 1 January (feature 040): rides
// from September to December count for the badges, not for Rynke. Seeded
// before the window opens, the rides count back from its last day
// (`recipeDay`), so most of them lie in the window; those before it are on set
// days (`onDate`).

/** One to three per country, accents and all. */
// The ordinary riders' athlete IDs are large (feature 042): from a few below 2^63 − 1, past
// what a JavaScript number holds exactly, so every local run and test covers
// them next to the small IDs of the named riders.
const LARGE_IDS_FROM = "9223372036854775780";

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
		athleteId: "991001",
		firstName: "Ingrid Importing",
		state: "Import still running: the fake answers her activity list with 503",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "import-stuck",
		rides: rides(4, (i) => ride(...slot(i), 45, 250, 24)),
	},
	{
		athleteId: "991002",
		firstName: "Nanna NoRides",
		state: "No rides, so no badges yet",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [],
	},
	{
		athleteId: "991003",
		firstName: "Fleur FarAway",
		state: "Far from the target",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: rides(4, (i) => ride(...slot(i), 26 + 6 * i, 120, 21)),
	},
	{
		athleteId: "991004",
		firstName: "Tuuli TrainingDone",
		state:
			"Training target reached without virtual rides, so qualified; organiser",
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
		athleteId: "991005",
		firstName: "Védís Virtual",
		state: "Training target reached only thanks to virtual rides",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Outdoors: 70 distance Rynke and 700 m (no Rynke), under the 84 needed
		// from outside virtual rides. With the virtual rides: over 250.
		rides: [
			...rides(27, (i) =>
				i < 7
					? ride(...slot(i), 100, 100, 26)
					: ride(...slot(i), 100, 200, 31, {
							sportType: "VirtualRide",
							trainer: true,
						}),
			),
			// Sa Calobra on Rouvy, Team Europe's example: 11.7 km and 700 m,
			// under 25 km but virtual, so 1 Rynke for its full 10 km and its
			// 700 m towards the elevation total (rules version 5).
			ride(1, "19:30", 11.7, 700, 14, {
				sportType: "VirtualRide",
				trainer: true,
			}),
		],
	},
	{
		athleteId: "991006",
		firstName: "Rasmus Rejected",
		state:
			"Rides that don't count, one per rule, and a run that counts only for the running badges",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Each ride breaks only its own rule (the team's current rules).
		rides: [
			// 7 km/h, below 10.
			ride(1, "18:00", 28, 40, 7),
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
		athleteId: "991007",
		firstName: "Pauliina Paging",
		state: "More rides than one page (47; 20 per page)",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// Two a day, mornings and evenings.
		rides: rides(47, (i) =>
			ride(1 + Math.floor(i / 2), i % 2 === 0 ? "06:30" : "18:30", 30, 120, 21),
		),
	},
	{
		athleteId: "991008",
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
		athleteId: "991009",
		firstName: "Rūta Reconnect",
		state: "Must reconnect: the fake refuses her activity calls and refresh",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "refused",
		rides: rides(3, (i) => ride(...slot(i), 55, 350, 26)),
	},
	{
		athleteId: "991010",
		firstName: "Nigel NotMember",
		state: "Not a club member: signing in shows the not-member notice",
		scopes: ALL_SCOPES,
		clubMember: false,
		behaviour: "normal",
		rides: rides(3, (i) => ride(...slot(i), 45, 250, 25)),
	},
	{
		athleteId: "991011",
		firstName: "Oskar Organiser",
		state: "Organiser: sees the team's riders at /organiser",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		organiser: true,
		rides: rides(6, (i) => ride(...slot(i), 55, 450, 25)),
	},
	{
		athleteId: "991012",
		firstName: "Bente Badges",
		state: "Badges (feature 013): earlier and later ones in a category",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// 12 rides of 60 km and 500 m: 720 km and 6,000 m, so distance 100 and
		// 500 and elevation 1,000 and 5,000, each a few days apart.
		rides: rides(12, (i) => ride(...slot(i), 60, 500, 26)),
	},
	{
		athleteId: "991013",
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
		athleteId: "991014",
		firstName: "Chloé Complete",
		state: "Badges (feature 013): every personal riding badge, no runs",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		// 25 rides of 200 km and 1,000 m: 5,000 km, 25,000 m and 625 Training
		// Rynke, each category's last badge.
		rides: rides(25, (i) => ride(...slot(i), 200, 1000, 26)),
	},
	{
		athleteId: "991015",
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
		athleteId: "991016",
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
			// on 10 January are one day; five days in February. November and
			// December lie before the window opens: badges, no Rynke (feature
			// 040).
			ride(0, "10:00", 40, 200, 24, { onDate: "11-14" }),
			ride(0, "18:00", 30, 0, 30, { onDate: "12-05", trainer: true }),
			ride(0, "10:00", 40, 200, 24, { onDate: "12-06" }),
			ride(0, "09:00", 40, 200, 24, { onDate: "01-10" }),
			ride(0, "15:00", 30, 100, 24, { onDate: "01-10" }),
			ride(0, "10:00", 40, 200, 24, { onDate: "01-11" }),
			...rides(5, (i) =>
				ride(0, "10:00", 40, 200, 24, { onDate: `02-0${1 + i}` }),
			),
			// Surprises (part D): Christmas Eve, before the window opens, and a
			// night owl on its own day (counting once the dates have passed); New
			// Year and early bird.
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
		athleteId: "991017",
		firstName: "Frauke Festtag",
		state:
			"Badges (feature 013 part F): surprise badges from cycling traditions",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [
			// Festive 500: 4 × 130 km between Christmas Eve and New Year's Eve,
			// two of them on Zwift; before the window opens, so badges only.
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
			// Sonnenwende: outdoors on both solstices, the December one before the
			// window opens.
			ride(0, "10:00", 25, 100, 24, { onSolstice: 12 }),
			ride(0, "10:00", 25, 100, 24, { onSolstice: 6 }),
			// Osterhase: a ride on Easter Monday.
			ride(0, "10:00", 30, 150, 24, { onEaster: 1 }),
			// Everesting: 9 × 1,000 m in May.
			...rides(9, (i) =>
				ride(0, "09:00", 50, 1000, 20, { onDate: `05-0${1 + i}` }),
			),
		],
	},
	{
		athleteId: "991018",
		firstName: "Aistė Admin",
		state: "Administrator: watches usage and riders at /admin",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		administrator: true,
		rides: rides(4, (i) => ride(...slot(i), 45, 220, 25)),
	},
	{
		athleteId: "991019",
		firstName: "Britt Steady",
		state: "Five rides, each a little longer",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: rides(5, (i) => ride(...slot(i), 40 + 5 * i, 260, 25)),
	},
	...ordinaryRiders(ORDINARY_NAMES, LARGE_IDS_FROM, "Kalle"),
	{
		athleteId: "991045",
		firstName: "Siiri ShortRide",
		state:
			"Outdoor rides of 24.9, 25.0 and 60 km: all count, the 24.9 km ride with its elevation but no kilometre Rynke (rules version 5); a 15 km ride on 10 November is before the window (feature 040)",
		scopes: ALL_SCOPES,
		clubMember: true,
		behaviour: "normal",
		rides: [
			ride(...slot(0), 24.9, 80, 24),
			ride(...slot(1), 25, 80, 24),
			ride(...slot(2), 60, 300, 25),
			// Before the window opens and under 25 km: a pre-window ride, for the
			// badges only (feature 040).
			ride(0, "17:00", 15, 60, 22, { onDate: "11-10" }),
		],
	},
	{
		athleteId: "991099",
		firstName: "Gwen Guest",
		state:
			"An administrator of another team on the guest list, not in the club: Orga and Admin, her rides count for nobody but her (feature 041)",
		scopes: ALL_SCOPES,
		clubMember: false,
		behaviour: "normal",
		guest: true,
		rides: rides(4, (i) => ride(...slot(i), 50, 300, 25)),
	},
];

/**
 * An organiser among the riders (Tuuli TrainingDone); the team has no team
 * events for one to record (feature 039 research R3).
 */
export const EVENT_ORGANISER = "991004";

export const EUROPE_SAMPLES: SampleSet = {
	riders: SAMPLE_RIDERS,
	teamEvents: [],
	organiser: EVENT_ORGANISER,
};
