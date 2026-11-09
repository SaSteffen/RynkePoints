import type { PhraseSet, Season } from "../types";

// The common phrases' English original (feature 026 FR-045–FR-047), for every
// team without phrases of its own. Every other `common.<locale>.ts` adapts it
// index by index. A phrase never names a team, place, charity or rider, and
// never ranks or compares riders (FR-024). The two lists suit any time of year;
// the season lists at the end only fit their season.

/** For a rider who doesn't qualify yet and is behind the even pace (FR-021). */
export const QUOTES_PUSH = [
	// Getting out
	"Best time for the next ride? Shortly after you finish reading this.",
	"You're thinking about riding. Good start. Now the front door.",
	"If it isn't on Strava, it didn't happen. Time for something to happen.",
	"You don't have to be fast. You just have to set off.",
	"The sofa will still be there. The season won't.",
	"Deal: ten minutes. If it still feels pointless after that, you can turn back.",
	"The first ride after a break feels like your very first. The second one doesn't.",
	"Road closed, detour signposted. A few extra kilometres, free of charge.",
	"Your bike is spotless right now. Time to change that.",
	"Shorts already on? Then the hardest part is done.",
	"A kilometre is a kilometre. The first one is just more stubborn.",
	"A bit further than last time. Nobody here asks for more.",
	"Bad day? Ride it off. Works for average ones too.",
	"Helmet on. No discussion. Go.",
	"Lights on and out. Kilometres in the dark count the same.",
	"Once round the block is a ride. Twice is almost a tour.",
	"Ride in the morning and the rest of the day can do what it likes.",
	"You don't need to know where you're going. Only how to get back.",
	"Took a wrong turn? That's just a longer ride.",
	"First ride after a cold: short, slow, with a way home.",
	"On the way home, take the turning you always ride past.",
	"Out the door before anyone asks if you could quickly help with something.",
	"A bar in your back pocket, and the ride is allowed to get longer.",
	"Not a day for a personal best. A day for any time at all.",
	"Ride to the next lamppost. Then the one after that. That's the whole method.",
	"Put the ride in your calendar, with a time. Like the dentist, only nicer.",
	"Phone on silent, bike out. The messages will still be there in an hour.",
	"The first quarter of an hour is sticky. After that you remember why you do this.",
	"Bottle full, tyres pumped, lights charged. All that's missing is you.",
	"Ten kilometres isn't much. That's exactly why you ride them today.",
	"Long day at work? Short ride after.",
	"Opening Strava to watch other people ride? You could just ride.",
	"Two rides a week is enough to start with. The first one is today.",
	"The way to work is a ride too. One with a destination built in.",
	"Twenty minutes now beats none this evening.",
	"Ride early on Saturday and the rest of the day is yours.",
	"A ride for your head, not your stats. The Rynke come anyway.",
	"One episode less tonight, one ride more.",
	"Just set off. Where to will come to you on the way.",
	"Flat tyre? That's not an excuse, that's practice.",
	"Just a short one. It usually turns into a longer one.",
	"Plan B: ride. Plan A was also ride.",
	"Out briefly is still out.",
	"One hill, one descent. The descent is worth the hill.",
	"A rest day is good. Twelve in a row is a holiday.",
	"Kilometres pass unnoticed when you're talking. Bring someone.",
	"The hardest pedal stroke is the first one. The rest take care of themselves.",
	"Short rides count. Long rides count more. Any ride beats no ride.",
	"Lay out your kit the night before. Nobody likes arguing with themselves at 6 AM.",
	"Nobody has ever come home from a ride wishing they'd stayed in.",
	"Thirty minutes is a proper ride. Ask anyone who's done one.",
	"Clip in, roll out, sort the rest out on the way.",
	"The bike doesn't care how fit you are. It just wants taking out.",
	"Easy spin today. Easy still counts.",
	"Fill a bottle. That's how it starts.",
	"The ride you actually do beats the big one you keep planning.",
	"Pick a direction. Ride for twenty minutes. Turn round.",
	"There's always a lane you haven't ridden down yet.",
	"Kit on, decisions off.",
	"The quickest way to feel like riding is to start riding.",
	"Spin the legs out after work. Whatever's on your mind will still be there, only smaller.",
	"Sunday's ride starts with Saturday's early night.",
	"Somewhere there's a café with a slice of cake waiting. Ride there.",
	// A team spread out
	"Somewhere in the team, someone is out riding right now. You could be too.",
	"Your teammates are spread across the map. Every ride you post adds to the same total.",
	"Nobody else in the team rides your roads. That makes every ride a small travel report.",
	// Rynke
	"Rynke come one kilometre at a time. No shortcuts, sadly.",
	"Every climb adds Rynke. Even the small ones.",
	// Weather
	"A bit of drizzle never stopped a mudguard.",
	"Grey sky, dry roads. That's a riding day.",
	"Headwind out, tailwind home. Plan it that way round.",
	"Cold start, warm finish. That's how it usually goes.",
	"The forecast keeps changing its mind. You don't have to.",
	"It's dry right now. That's all the forecast you need.",
	"Wet roads wash off. Bikes and riders both.",
	// Calm
	"Behind on the plan? Plans are there to be caught up with.",
	"There's plenty of season left. Use a bit of it today.",
	"A quiet week isn't a disaster. Two rides this week and it's forgotten.",
	"Nobody starts fit. Everybody starts by riding.",
	// Tips
	"Tip: keep a short loop for busy days. Thirty minutes, door to door.",
	"Tip: plan the café stop first. The route tends to sort itself out.",
	// Excuses
	"Bike needs a clean? It'll only get dirty again.",
	"Not in the mood? Ride for five minutes, then ask yourself again.",
	"Feeling sluggish? Riding fixes sluggish. Sitting doesn't.",
	// Indoor trainer
	"Raining sideways? That's what the trainer is for.",
	"Indoor ride, a good playlist, done before the rain stops.",
	"Half an hour on the trainer. Put something good on and go.",
] as const;

/** For every other rider: on pace or already qualified (FR-021). */
export const QUOTES_ON_TRACK = [
	// The team from afar
	"Kudos cost nothing. Spread them around.",
	"Found a great route? Share it. Someone may ride near it one day.",
	// Riding well
	"You're on track. Enjoy a ride with no goal at all.",
	"Try a road you've never ridden. You've earned a detour.",
	"Plan a long ride for the weekend. You've got the legs for it.",
	"At home they know by now: “back soon” means two hours.",
] as const;

/** Push quotes for one season only, picked alongside QUOTES_PUSH in it (FR-025). */
export const SEASON_QUOTES_PUSH: Record<Season, readonly string[]> = {
	// Spring (March to May)
	spring: [
		"Lighter evenings are back. Use one.",
		"First ride in shorts this year. Your legs may look surprised.",
		"Spring service: oil, air, a quick wipe. Then out.",
		"Spring weather changes by the hour. Pack a gilet and stop checking.",
	],
	// Summer (June to August)
	summer: [
		"Early rides are the cool ones. Set the alarm.",
		"Long evenings like these don't last. Ride one of them.",
		"Hot out? Two bottles and a shady route.",
	],
	// Autumn (September to November)
	autumn: [
		"The summer kilometres are still in your legs. Use them before they wander off.",
		"Mud on the bike is how autumn tells everyone you were out.",
		"Quieter roads, fewer people out. Autumn rides have their perks.",
		"Grey morning, gold leaves by noon. Autumn rewards whoever goes anyway.",
		"Arm warmers back on. Same ride, one more layer.",
		"Full-finger gloves and a jacket, and autumn is suddenly fine.",
	],
	// Winter (December to February)
	winter: [
		"Winter rides are short and smug. Both are allowed.",
		"Cold hands are a glove problem, not a riding problem.",
		"Bright winter day? Drop everything else.",
		"Winter kilometres count the same and feel like more.",
	],
};

/** On-track quotes for one season only, picked alongside QUOTES_ON_TRACK in it (FR-025). */
export const SEASON_QUOTES_ON_TRACK: Record<Season, readonly string[]> = {
	// Spring (March to May)
	spring: [
		"Lots of people are dusting off their bikes. Invite a friend along.",
		"Spring is good for a longer ride. Map one out.",
		"Plan the first café ride of the year. Sitting outside optional.",
	],
	// Summer (June to August)
	summer: [
		"Light till late. Perfect for a long evening ride.",
		"Plan a ride that ends at an ice-cream shop. The route is secondary.",
		"On holiday? Post a photo from a road nobody in the team has ridden yet.",
	],
	// Autumn (September to November)
	autumn: [
		"Clear autumn day? Post a photo so the rest of the team sees it too.",
		"Still out in autumn. The habit is the hard part, and you've got it.",
		"Wet leaves, low sun, empty roads. Autumn has its good rides too.",
	],
	// Winter (December to February)
	winter: [
		"Still riding in winter. Overshoes by now, presumably.",
		"Winter rides are easier with company. Ask a friend along.",
		"Bright winter day? You know what to do.",
	],
};

/** The common set's English original (feature 026 FR-045). */
export const COMMON_EN: PhraseSet = {
	push: QUOTES_PUSH,
	onTrack: QUOTES_ON_TRACK,
	seasonPush: SEASON_QUOTES_PUSH,
	seasonOnTrack: SEASON_QUOTES_ON_TRACK,
};
