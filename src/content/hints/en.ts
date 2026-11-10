import { type HintLines, monthNames } from "./types";

// The English hint lines, as approved in specs/034-badge-hints/hint-phrases.md:
// natural English, not word-for-word translations.

export const HINTS_EN: HintLines = {
	locale: "en",
	label: "Tip",
	more: "To the card",
	monthName: monthNames("en"),
	lines: {
		distance: [
			({ n }) => `${n} km to your next distance badge.`,
			({ n }) => `Ride ${n} km more and the next distance badge is yours.`,
		],
		elevation: [
			({ n }) => `${n} m of climbing to your next elevation badge.`,
			({ n }) => `${n} m of climbing to go. Time to find a few hills.`,
		],
		trainingRynke: [({ n }) => `${n} Rynke to your next Training Rynke badge.`],
		running: [({ n }) => `${n} km of running to your next running badge.`],
		swimming: [({ n }) => `${n} km of swimming to your next swimming badge.`],
		virtualRides: [
			({ n }) => `${n} km on the trainer or a virtual ride to your next badge.`,
		],
		rideLength: [
			({ best, next }) =>
				`Your longest ride this season: ${best} km. The next badge starts at ${next} km.`,
		],
		runLength: [
			({ best, next }) =>
				`Your longest run this season: ${best} km. The next badge starts at ${next} km.`,
		],
		swimLength: [
			({ best, next }) =>
				`Your longest swim this season: ${best} km. The next badge starts at ${next} km.`,
		],
		winterOne: [
			({ month }) =>
				`One more day riding outside and the next ${month} badge is yours.`,
		],
		winterSeveral: [
			({ n, month, left }) =>
				`${n} more days riding outside for the next ${month} badge. ${month} has ${left} days left.`,
		],
		winterNoSpare: [
			({ month }) =>
				`Ride outside every day from now on and the ${month} badge still works out.`,
		],
		newYear: [
			() => "Plans for 1 January, apart from sleeping in?",
			() => "The roads are quiet on New Year's Day. Good time for a spin.",
		],
		christmasEve: [
			() =>
				"Anything planned for the 24th? A short ride fits in before the presents.",
			() => "Christmas Eve morning has the emptiest roads of the year.",
		],
		christmas: [
			() =>
				"Somewhere between the roast and the biscuits: a ride on the 25th or 26th?",
			() => "Two days of Christmas. One of them is enough for a ride.",
		],
		festive500: [
			() =>
				"Christmas Eve to New Year's Eve is a long week. How many kilometres fit in?",
			() => "Between Christmas and New Year, trainer rides count too.",
		],
		nightOwl: [
			() => "Ever gone out after dinner? With lights, of course.",
			() => "Fancy a late ride? It might be worth it.",
		],
		earlyBird: [
			() => "Ever been out before your alarm went off?",
			() => "Start in the dark and you see the sunrise from the saddle.",
		],
		restDay: [
			({ n }) =>
				`${n} days in a row. Keep going; at some point a day on the sofa is well earned.`,
			() => "Rest is part of training. Especially after a long streak.",
		],
		stageRider: [
			() =>
				"How about a long weekend on the bike, with several long days back to back?",
			() => "On the Tour it's not one long day, it's several.",
		],
		triathlon: [
			() => "Bike, running shoes, swimsuit. All on one day?",
			() => "You ride, you run, you swim. Just never all on the same day.",
		],
		piDay: [
			() => "14 March is Pi Day. Fancy a ride that fits the date?",
			() => "On 14 March, maths and cycling go well together.",
		],
		solsticeDecember: [
			() =>
				"Shortest day of the year. A ride outside in what little light there is?",
			() =>
				"Around 21 December it gets dark earliest. Why not ride outside just then?",
		],
		solsticeJune: [
			() =>
				"You rode on the shortest day in December. The longest one is coming.",
			() => "The longest day has plenty of light for a ride outside.",
		],
		easter: [
			() => "Easter on the bike, not just hunting for eggs?",
			() => "Easter Sunday or Monday, both good days for a ride.",
		],
		everesting: [
			() => "How much climbing can you do in a month? There's a target.",
			() => "Up a hill, down a hill, all month long.",
		],
		winterSleep: [
			() => "No ride outside yet this year? The bike's ready.",
			() => "The trainer was fine. Outside is better.",
		],
	},
};
