import type { Catalog } from "../catalogs";

// English catalog. Typed as `Catalog`, so tsc rejects a missing or extra key.

export const en: Catalog = {
	"meta.languageName": "English",
	"meta.intlLocale": "en-GB",
	"app.name": "RynkePoints",
	"brand.connectWithStrava.src": "/strava/en/connect-with-strava.svg",
	"brand.connectWithStrava.alt": "Connect with Strava",
	"brand.poweredByStrava.src": "/strava/en/powered-by-strava.svg",
	"brand.poweredByStrava.alt": "Powered by Strava",
	"brand.viewOnStrava": "View on Strava",

	"layout.switcher.label": "Language",
	"layout.logout": "Sign out",
	"layout.loading": "Loading the page",

	"landing.title": "Connect with Strava",
	"landing.intro":
		"Your rides on Strava turn into Rynke, the points of Team Rynkeby Hamburg.",
	"landing.who": "Only members of {clubLink} can take part.",
	"club.linkText": "our team club on Strava",
	"landing.dataRead":
		"From each ride we only read its name, sport type, start time, distance, moving time, elapsed time including pauses, elevation gain, whether it was entered manually or ridden on an indoor trainer, and whether Strava has flagged it.",
	"landing.private":
		'Private ("Only You") rides only count if you allow viewing your private activities on Strava.',
	"landing.purpose":
		"We use the data only for Rynke and team events. Only you see your individual rides and their names.",
	"landing.leave":
		"You can leave at any time: in Settings, or by removing RynkePoints on Strava. We then delete all data about you, including your Rynke. If you leave the club, we delete it within 24 hours.",
	"landing.backups":
		"Deleted data stays in our hosting provider's backups for up to 7\u00a0days.",
	"landing.cookies":
		"We only set necessary cookies: for signing in and your language choice.",
	"landing.notifications":
		"Notifications are optional, per device, and show only you how many Rynke are new and what you still need. They pass through the push service of your device's or browser's maker (e.g. Google, Apple, Mozilla, Microsoft). For this we store only the address it gives your device, and delete it when you turn them off, sign out or leave.",

	"consent.heading": "What you agree to by connecting",
	"consent.short.notRead":
		"We don't read GPS tracks, maps, photos or health data.",
	"consent.short.read":
		"We only read the key figures of your rides, runs and swims, such as distance, time and elevation, and turn them into Rynke and badges.",
	"consent.short.shown":
		"The team sees your Rynke without your name, the organisers with your first name.",
	"consent.details": "All the details",
	"consent.organisers":
		"The organisers see your first name from Strava, your Rynke and where they come from, what you still need, whether you've reached your training goal, your team events and corrections, and which team events you reported you're coming to or were at.",
	"consent.team":
		"Everyone else on the team sees your Rynke, overall and per week, without your name. Your kilometres and elevation count towards the team sums of the team badges, without your name. On which days and at what hour you ride, run or swim counts towards the team surprises, without your name.",
	"consent.required": "Reading and sharing are required to take part.",
	"consent.agree":
		"Agreed: RynkePoints reads your rides and shares your Rynke as described.",

	"me.title": "Your RynkePoints",
	"me.greeting": "Hi {firstName}!",
	"me.status.connected": "Connected to Strava",
	"me.status.needsReconnect": "Your Strava connection needs to be renewed.",
	"me.reconnect": "Reconnect",
	"me.scope.readAll": "Private activities count too.",
	"me.scope.sharedOnly": 'Private ("Only You") activities don\'t count.',
	"me.scope.write":
		"RynkePoints may write a Rynke section into your ride descriptions once the feature exists.",
	"me.scope.noWrite": "RynkePoints writes nothing into your ride descriptions.",
	"me.changePermissions": "Change permissions on Strava",
	"me.consent.heading": "Your consent",
	"me.consent.accepted": "Agreed on {date} (version {version}).",
	"me.consent.none":
		"Please agree so we can count your rides. Strava then asks for the permissions again. Until then, the team sees nothing of yours.",
	"me.consent.renew.heading": "Please agree again",
	"me.consent.renew.older":
		"You agreed to version {accepted} on {date}. Version {version} changes this:",
	"me.consent.renew.strava":
		"RynkePoints needs another permission for this; Strava asks you for it.",
	"me.consent.renew.button": "Agree and continue",
	"me.consent.renew.leave":
		"Don't want to agree? Then disconnect; we delete all your data.",
	"me.recent.heading": "Your rides",
	"me.recent.none": "No rides this season yet.",
	"me.recent.col.distance": "Distance",
	"me.disconnect.button": "Disconnect and delete your data",

	"units.km": "{value}\u00a0km",
	"units.m": "{value}\u00a0m",
	"units.percent": "{value}%",
	"units.kmh": "{value}\u00a0km/h",
	"units.mPerH": "{value}\u00a0m/h",
	"units.duration": "{h}\u00a0h {min}\u00a0min",
	"units.durationMin": "{min}\u00a0min",
	"sport.Ride": "Ride",
	"sport.MountainBikeRide": "Mountain bike ride",
	"sport.GravelRide": "Gravel ride",
	"sport.EBikeRide": "E-bike ride",
	"sport.EMountainBikeRide": "E-mountain bike ride",
	"sport.VirtualRide": "Virtual ride",

	"rynke.training": "Training Rynke",
	"rynke.team": "Team Rynke",
	"rynke.withoutVirtual": "Training Rynke outdoors",
	"waiting.heading": "Fetching your rides",
	"waiting.body":
		"We're fetching your rides since {date} from Strava, once. That takes about 5\u00a0minutes; this page updates by itself.",
	"rynke.verdict.in": "Qualified for Paris! 🗼",
	"rynke.verdict.notYet": "Not qualified yet",
	"rynke.verdict.missing": "You still need:",
	"rynke.status.push": "You're behind the plan.",
	"rynke.status.onTrack": "You're on plan.",
	"rynke.status.in": "Ahead of plan: training goal reached.",
	"rynke.missing.training": "{n}\u00a0Training Rynke",
	"rynke.missing.team": "{n}\u00a0Team Rynke",
	"rynke.missing.withoutVirtual": "{n}\u00a0Training Rynke outdoors",
	"rynke.rides.col.elevationTotal": "Elevation counted",
	"rynke.rides.position": "Rides {from}–{to} of {total}",
	"rynke.rides.total": "{total} rides this season",
	"rynke.rides.newest": "To your newest rides",
	"rynke.rides.loading": "Loading older rides …",
	"rynke.rides.failed": "Couldn't load older rides.",
	"rynke.rides.retry": "Try again",
	"rynke.rides.added": "More rides loaded",
	"rynke.pager.label": "Pages",
	"rynke.pager.first": "« Newest",
	"rynke.pager.previous": "‹ Newer",
	"rynke.pager.next": "Older ›",
	"rynke.pager.last": "Oldest »",
	"rynke.notice.updating":
		"New rules apply since {date}. Your Rynke are being recalculated; until then you see them under rules version {version}.",
	"rynke.rules.heading": "Rules",
	"rynke.rules.version": "Rules version {version}, in effect since {date}.",
	"rynke.rules.windowDeadline": "Everything from {start} to {deadline} counts.",
	"rynke.rules.handout": "The rules as PDF (in German)",
	"rynke.ride.counts": "counts 🪙",
	"rynke.ride.doesNotCount": "doesn't count",
	"rynke.ride.beingEvaluated": "Being evaluated",
	"rynke.ride.virtual": "virtual",
	"rynke.ride.fixHint":
		"You can correct the ride on Strava or ask an organiser.",
	"rynke.reason.flagged":
		"Strava flagged this ride. If you disagree, please settle it with Strava.",
	"rynke.reason.pause":
		"Paused too long: {paused} paused for {moving} moving time; more than half is not allowed.",
	"rynke.reason.pause.moving":
		"Paused too long: {paused} paused for {moving} moving time; pausing longer than moving is not allowed.",
	"rynke.reason.pause.share":
		"Paused too long: {paused} paused for {moving} moving time; more than {share} is not allowed.",
	"rynke.reason.pause.noLimit":
		"Paused too long: {paused} paused for {moving} moving time.",
	"rynke.reason.pause.noMovingTime":
		"No moving time: the ride counts as paused throughout.",
	"rynke.reason.manual": "Entered manually on Strava.",
	"rynke.reason.too_slow":
		"Too slow: {speed} on average, at least {limit} needed.",
	"rynke.reason.too_slow.noLimit": "Too slow: {speed} on average.",
	"rynke.reason.too_fast":
		"Too fast for a bike ride: {speed} on average, at most {limit} allowed.",
	"rynke.reason.too_fast.noLimit":
		"Too fast for a bike ride: {speed} on average.",
	"rynke.reason.climbing_rate":
		"Too much climbing for the time: {rate} uphill, at most {limit} allowed.",
	"rynke.reason.climbing_rate.noLimit":
		"Too much climbing for the time: {rate} uphill.",
	"rynke.reason.excluded_sport_type": "{sport} doesn't count for Rynke.",
	"rynke.reason.outside_window": "Before the season start on {date}.",
	"rynke.reason.outside_window.afterDeadline": "After the deadline on {date}.",
	"rynke.reason.overlap":
		"Recorded twice: your ride of {date}, {time}, {distance} counts instead.",
	"rynke.reason.overlap.noRide":
		"Recorded twice: another of your rides counts instead.",
	"rynke.reason.unknown": "Doesn't count under the current rules.",
	"rynke.unknown.elapsed_time":
		"The elapsed time including pauses is still missing, so the pause rule hasn't been checked yet.",
	"rynke.unknown.manual":
		"Whether the ride was entered manually isn't known yet.",
	"rynke.unknown.trainer":
		"Whether the ride was on an indoor trainer isn't known yet.",
	"rynke.unknown.flagged": "Whether Strava flagged the ride isn't known yet.",
	"rynke.unknown.mayChange": "The result may still change.",
	"rynke.gauges.heading": "Your progress 🪙",
	"rynke.gauge.caption": "{label}: {value} of {target} · {percent}",
	"rynke.gauge.elevation":
		"Elevation: {value} of {target}, {missing} to go for {step}",
	"rynke.gauge.step": "+{n}",
	"rynke.source.distance": "Distance",
	"rynke.source.elevation": "Elevation",
	"rynke.source.team_training": "Team training",
	"rynke.source.training_weekend_day": "Training-weekend day",
	"rynke.source.technique_training": "Technique training",
	"rynke.breakdown.heading": "Where your Rynke come from",
	"rynke.breakdown.attended": "attended {count}×",
	"rynke.events.heading": "Your team events",
	"rynke.events.none": "No team event has been recorded for you yet.",
	"rynke.events.notCounting": "doesn't count: outside the counting period",

	"disconnect.title": "Delete your data?",
	"disconnect.explain":
		"RynkePoints gives up its access to your Strava account and immediately deletes all data about you. Your activities on Strava stay as they are.",
	"disconnect.confirm": "Yes, delete everything",
	"disconnect.cancel": "Cancel",

	"notice.retry": "Try again",
	"notice.backToStart": "Back to the start page",
	"notice.expired.title": "Sign-in expired",
	"notice.expired.body": "Your sign-in expired. Please try again.",
	"notice.denied.title": "RynkePoints needs read access to your activities",
	"notice.denied.body": "RynkePoints can't work without this permission.",
	"notice.consentRequired.title": "Please agree first",
	"notice.consentRequired.body":
		"We can't connect you without your agreement. Tick the box on the start page.",
	"notice.teamFull.title": "The team is full for now",
	"notice.teamFull.body":
		"Strava doesn't allow RynkePoints any more riders right now. We'll let you know when there's room again.",
	"notice.failed.title": "Connection failed",
	"notice.failed.body": "Connecting to Strava didn't work. Please try again.",
	"notice.notMember.title": "Club members only",
	"notice.notMember.body":
		"Only members of {clubLink} can take part. Join the club and then try again.",
	"notice.nothingStored":
		"We haven't created an account for you or stored your Strava access or activities.",
	"notice.stravaBusy.title": "Strava is busy",
	"notice.stravaBusy.body": "Please try again in a few minutes.",
	"notice.deleted.title": "Your data has been deleted",
	"notice.deleted.body":
		"We have deleted all data about you. Copies in our hosting provider's backups disappear after 7 days at the latest.",
	"notice.revokeFailed.body":
		'We couldn\'t give up our access at Strava. Please remove RynkePoints under "My Apps" in your Strava settings.',

	"install.button": "Install as an app",
	"install.ios":
		'As an app on your iPhone: in Safari, tap "Share" and then "Add to Home Screen".',
	"install.firefox":
		'As an app with Firefox: tap the menu ⋮ and then "Install" or "Add to Home screen".',
	"install.macSafari":
		'As an app on your Mac: in Safari, choose "File" > "Add to Dock".',
	"prompt.install.text": "Get RynkePoints as an app on your home screen.",
	"prompt.notify.text": "Shall we tell you when you get new Rynke?",
	"prompt.notify.accept": "Turn on notifications",
	"prompt.notify.decline": "Not now",
	"prompt.close": "Close",

	"tour.label": "Getting started",
	"tour.progress": "{step} of {total}",
	"tour.next": "Next",
	"tour.done": "Got it",
	"tour.skip": "Skip",
	"tour.start": "Show me",
	"tour.rider.intro": "New here? Let us show you where everything is.",
	"tour.rider.team":
		"Team: how the whole team is doing and where you are in the ranking.",
	"tour.rider.you": "You: your Rynke and what you still need to qualify.",
	"tour.rider.rides":
		"Rides: every ride, what it earned, and why when it didn't count.",
	"tour.rider.badges":
		"Badges: yours and the team's, and how far it is to the next one.",
	"tour.rider.settings":
		"Settings: language, notifications, your Strava connection, the rules, and this tour again.",
	"tour.organiser.intro":
		"You're an organiser now: the Orga tab is new. Let us show you around.",
	"tour.organiser.riders":
		"Riders: who's on track and who needs a push. Tap a rider to add a correction.",
	"tour.organiser.events":
		"Events: add team events, then open one to tick who was there.",
	"offline.title": "No connection",
	"offline.body":
		"RynkePoints needs an internet connection. Please try again shortly.",
	"push.body": "New Rynke – tap to view",
	"push.body.rise": "New Rynke: {rise}.",
	"push.body.riseMissing": "New Rynke: {rise}. You still need {missing}.",
	"push.rise.training": "+{n}\u00a0Training Rynke",
	"push.rise.team": "+{n}\u00a0Team Rynke",
	"notifications.heading": "Notifications",
	"notifications.explain":
		"This device lets you know when you have new Rynke, and what you still need.",
	"notifications.on": "On for this device.",
	"notifications.off": "Off for this device.",
	"notifications.blocked":
		"Your device blocks notifications for RynkePoints. You can allow them in your browser's or device's settings.",
	"notifications.needsHomeScreen":
		"On an iPhone, notifications only work once RynkePoints is on your home screen. Then open it from there.",
	"notifications.unsupported": "This browser can't show notifications.",
	"notifications.failed": "That didn't work. Please try again.",

	// Feature 011: the app shell's sections, navigation and Settings groups.
	// Strava ships its white assets in English only, as with the others.
	"nav.label": "Sections",
	"nav.you": "You",
	"nav.rides": "Rides",
	"nav.team": "Team",
	"nav.badges": "Badges",
	"nav.organiser": "Orga",
	"nav.settings": "Settings",
	"nav.settings.short": "Settings",
	"shell.refresh": "Refresh",
	"shell.title": "{section} – RynkePoints",
	"hero.training": "{n} Training Rynke",
	"hero.team": "{n} Team Rynke",
	"celebrate.training": "+{n}\u00a0Training Rynke since your last visit 🎉",
	"celebrate.team": "+{n}\u00a0Team Rynke since your last visit 🎉",
	"celebrate.both":
		"+{training}\u00a0Training Rynke and +{team}\u00a0Team Rynke since your last visit 🎉",
	"landing.tagline": "Collect your Rynke",
	"settings.language": "Language",
	"settings.appearance": "Appearance",
	"settings.scheme.system": "System",
	"settings.scheme.light": "Light",
	"settings.scheme.dark": "Dark",
	"settings.appearance.hint": "Applies to this device only.",
	"settings.app": "App",
	"settings.strava": "Strava connection",
	"settings.account": "Account",
	"settings.tour": "Tours",
	"settings.tour.rider": "Show the tour again",
	"settings.tour.organiser": "Show the Orga tour again",
	"rynke.ride.why": "Why?",
	"notifications.switch": "Notifications on this device",
	"brand.poweredByStrava.srcDark": "/strava/en/powered-by-strava-white.svg",
	"brand.connectWithStrava.srcDark": "/strava/en/connect-with-strava-white.svg",

	"error.notFound.title": "Page not found",
	"error.notFound.body": "This page doesn't exist.",
	"error.forbidden.title": "Request refused",
	"error.forbidden.body": "Please reload the page and try again.",

	"organiser.title": "Organiser",
	"organiser.back": "Back to the events",
	"organiser.switch.label": "Orga views",
	"organiser.switch.riders": "Riders",
	"organiser.switch.events": "Events",
	"organiser.formerOrganiser": "a former organiser",
	"organiser.changedBy": "Last changed by {name} on {date}",
	"organiser.error.unknown_kind": "Please choose a kind of event.",
	"organiser.error.invalid_date": "Please enter a valid date.",
	"organiser.error.invalid_name": "The name may have at most 100 characters.",
	"organiser.error.event_missing": "This event no longer exists.",
	"organiser.error.rider_not_connected":
		"A rider has left or must reconnect first.",
	"organiser.error.outside_season": "The date is outside the season.",
	"organiser.error.future_event":
		"Attendance can be recorded once the event has taken place.",
	"organiser.error.rider_not_listed":
		"The list of riders has changed. Please check it and save again.",
	"organiser.error.invalid_amount":
		"Please enter whole numbers; at least one must not be 0.",
	"organiser.error.invalid_reason":
		"Please give a reason of at most 200 characters.",
	"organiser.error.correction_missing": "This correction no longer exists.",
	"organiser.done.created": "Event added.",
	"organiser.done.saved": "Saved.",
	"organiser.done.deleted": "Event deleted.",
	"organiser.done.attendance": "Attendance saved.",
	"organiser.done.added": "Correction added.",
	"organiser.done.removed": "Correction removed.",
	"organiser.events.heading": "Team events this season",
	"organiser.events.none": "No team events this season yet.",
	"organiser.events.attendees": "{count} people",
	"organiser.events.new": "New event",
	"organiser.event.heading": "Edit event",
	"organiser.field.kind": "Kind",
	"organiser.field.date": "Date",
	"organiser.field.name": "Name (optional)",
	"organiser.add": "Add",
	"organiser.save": "Save",
	"organiser.event.delete": "Delete event…",
	"organiser.event.deleteWarning":
		"This deletes the event and its attendance; the riders' Rynke follow.",
	"organiser.event.deleteConfirm": "Yes, delete",
	"organiser.attendance.heading": "Who was there?",
	"organiser.attendance.save": "Save attendance",
	"organiser.attendance.profile": "View on Strava",
	"organiser.attendance.future":
		"Attendance can be recorded once the event has taken place.",
	"organiser.attendance.none":
		"Nobody who shares their data with the team is connected yet.",
	"organiser.riders.back": "Back to the team overview",
	"organiser.corrections.heading": "Corrections for {name}",
	"organiser.corrections.none": "No corrections yet.",
	"organiser.corrections.new": "New correction",
	"organiser.corrections.training": "{amount}\u00a0Training Rynke",
	"organiser.corrections.team": "{amount}\u00a0Team Rynke",
	"organiser.field.training": "Training Rynke (+ or −, empty is 0)",
	"organiser.field.team": "Team Rynke (+ or −, empty is 0)",
	"organiser.field.reason": "Reason",
	"organiser.corrections.remove": "Remove…",
	"organiser.corrections.removeWarning":
		"This removes the correction; the rider's Rynke follow.",
	"organiser.corrections.removeConfirm": "Yes, remove",

	// Feature 016: the Team page (contracts/messages.md "Team page").
	"team.heading": "Team",
	"team.total.label": "Team Rynkeby Hamburg",
	"team.total.training": "{n} Training Rynke",
	"team.total.team": "{n} Team Rynke",
	"team.total.kind": "collected together",
	"team.total.thisWeek": "+{n} this week 🔥",
	"team.kind.label": "Which Rynke",
	"team.kind.training": "Training",
	"team.kind.team": "Team",
	"team.quote.push": "For you 🍌",
	"team.quote.onTrack": "For you 🤝",
	"team.list.heading": "Leaderboard",
	"team.list.count": "{n} riders listed",
	"team.list.hint": "No names. The line shows the season so far.",
	"team.list.scope": "Show",
	"team.list.around": "Around you",
	"team.list.everyone": "Everyone",
	"team.list.ahead": "· · · {n} riders ahead · · ·",
	"team.list.behind": "· · · {n} riders behind · · ·",
	"team.list.you": "You",
	"team.list.weeks": "Week by week: {values}",
	"team.chart.heading": "The team, week by week",
	"team.chart.hint":
		"All the team's Rynke added up, as at the end of each week.",
	"team.chart.now": "this week",
	"team.chart.label":
		"The team's {kind} at the end of each week, {weeks} weeks, now {total}",
	"team.chart.best": "Best team week so far: +{n} in the week ending {date} 🔥",
	"team.chart.table": "All weeks",
	"team.chart.week": "Week ending",
	"team.chart.total": "Total",
	"team.chart.gain": "Gain",

	// Feature 016: the organiser overview (contracts/messages.md "Organiser overview").
	"organiser.overview.heading": "Team overview",
	"organiser.overview.deadline": "Qualification deadline · {date}",
	"organiser.overview.daysLeft": "{n} days to go ⏳",
	"organiser.overview.deadlinePassed": "The deadline has passed",
	"organiser.overview.qualified":
		"{n} of {count} reached their training goal 🎯",
	"organiser.overview.groups": "Groups",
	"organiser.overview.group.push": "Need a push",
	"organiser.overview.group.notYet": "Training goal not reached yet",
	"organiser.overview.group.onTrack": "On track",
	"organiser.overview.group.in": "Training goal reached",
	"organiser.overview.group.all": "Everyone",
	"organiser.overview.showing": "Showing: {group}",
	"organiser.overview.hint":
		"The tick on each bar marks the even pace to the deadline: today {training} Training and {team} Team.",
	"organiser.overview.training": "Training {n} of {threshold}",
	"organiser.overview.team": "Team {n} of {threshold}",
	"organiser.overview.outdoor": "Outdoor Training {n} of {required}",
	"organiser.overview.toGo.training": "{n} Training to go",
	"organiser.overview.toGo.team": "{n} Team to go",
	"organiser.overview.toGo.outdoor": "{n} outdoor Training to go",
	"organiser.overview.toGo.short": "{n} to go",
	"organiser.overview.behind": "behind pace",
	"organiser.overview.breakdown": "Where the Rynke come from",
	"organiser.overview.distance": "Distance {n}",
	"organiser.overview.elevation": "Elevation {n}",
	"organiser.overview.event":
		"{kind}: {attended}× → {training} Training, {team} Team",
	"organiser.overview.corrections":
		"Corrections {training} Training, {team} Team",
	"organiser.overview.virtual": "Virtual rides {n} % of Training",
	"organiser.overview.amounts": "{training} Training, {team} Team",
	"organiser.overview.percent": "{n}%",
	"organiser.overview.qualifiedList": "Training goal reached 🎯",
	"organiser.overview.qualifiedHint":
		"Both thresholds and the outdoor share met.",
	"organiser.overview.nobodyYet": "Nobody has reached the training goal yet.",
	"organiser.overview.none": "No riders share their Rynke yet.",
	"organiser.overview.column.name": "Rider",
	"organiser.overview.column.group": "Group",
	"organiser.overview.column.training": "Training",
	"organiser.overview.column.team": "Team",
	"organiser.overview.column.distance": "Distance",
	"organiser.overview.column.elevation": "Elevation",
	"organiser.overview.column.corrections": "Corrections",
	"organiser.overview.column.rynke": "Rynke",
	"organiser.overview.column.virtual": "Virtual",

	// Feature 013: the Abzeichen section (contracts/badge-messages.md). Badge
	// names aren't here: they are German in every language (badges.de.ts).
	"badges.heading": "Badges",
	"badges.personal.newest": "Your badges",
	"badges.personal.all": "All your badges ({n})",
	"badges.team.newest": "Team badges",
	"badges.team.all": "All team badges ({n})",
	"badges.switch.group": "Whose badges",
	"badges.switch.personal": "Yours",
	"badges.switch.team": "Team",
	"badges.switch.scope": "Show",
	"badges.switch.newest": "Newest",
	"badges.switch.all": "All",
	"badges.empty": "No badge yet – your first ride brings you closer.",
	"badges.missing": "{value} to go",
	"badges.next": "Next badge",
	"badges.first": "First badge",
	"badges.earnedOn": "earned on {date}",
	"badges.close": "Close",
	"badges.label": "{name}, {value}",
	"badges.reveal.one": "New badge: {name}",
	"badges.reveal.many": "{n} new badges",
	"badges.category.distance": "Distance",
	"badges.category.elevation": "Elevation",
	"badges.category.team_events": "Team events",
	"badges.category.technique": "Technique training",
	"badges.category.training_rynke": "Training Rynke",
	"badges.category.run_length": "Longest run",
	"badges.category.running": "Running total",
	"badges.category.ride_length": "Longest ride",
	"badges.category.virtual_rides": "Virtual",
	"badges.category.swim_length": "Longest swim",
	"badges.category.swimming": "Swimming total",
	"badges.category.winter_november": "Winter: November",
	"badges.category.winter_december": "Winter: December",
	"badges.category.winter_january": "Winter: January",
	"badges.category.winter_february": "Winter: February",
	"badges.category.surprise": "Surprises",
	"badges.category.team_training_rynke": "Training Rynke together",
	"badges.category.team_distance": "Distance together",
	"badges.category.team_elevation": "Elevation together",
	"badges.category.team_running": "Running together",
	"badges.category.big_training": "Big training",
	"badges.category.attendances": "Attendances",
	"badges.category.team_surprise": "Team surprises",
	"badges.about.distance": "Kilometres on Training Rynke rides.",
	"badges.about.elevation": "Elevation on Training Rynke rides.",
	"badges.about.team_events": "Every team event you were at.",
	"badges.about.technique": "One for the first, one for both.",
	"badges.about.training_rynke": "All the Training Rynke you collected.",
	"badges.about.run_length": "Your longest single run, outdoors.",
	"badges.about.running": "All the kilometres you ran outdoors.",
	"badges.about.ride_length": "Longest Training Rynke ride.",
	"badges.about.virtual_rides": "Trainer and virtual kilometres.",
	"badges.about.swim_length": "Your longest single swim, anywhere.",
	"badges.about.swimming": "All the kilometres you swam.",
	"badges.about.winter_november": "Days in November with an outdoor ride.",
	"badges.about.winter_december": "Days in December with an outdoor ride.",
	"badges.about.winter_january": "Days in January with an outdoor ride.",
	"badges.about.winter_february": "Days in February with an outdoor ride.",
	"badges.about.surprise": "?",
	"badges.about.team_training_rynke": "All riders' Training Rynke together.",
	"badges.about.team_distance": "The whole team's ride kilometres.",
	"badges.about.team_elevation": "The whole team's ride elevation.",
	"badges.about.team_running": "The whole team's run kilometres.",
	"badges.about.big_training": "The most riders at one team event.",
	"badges.about.attendances": "All attendances at team events.",
	"badges.about.team_surprise": "?",
	"badges.for.distance": "You rode {value} by bike this season.",
	"badges.for.elevation": "You climbed {value} by bike this season.",
	"badges.for.team_events": "You joined {value} this season.",
	"badges.for.technique": "You attended {value} this season.",
	"badges.for.training_rynke": "You collected {value} in training this season.",
	"badges.for.run_length": "Your longest run this season: {value} in one go.",
	"badges.for.running": "You ran {value} this season.",
	"badges.for.ride_length": "Your longest ride this season: {value} in one go.",
	"badges.for.virtual_rides": "You rode {value} virtually this season.",
	"badges.for.swim_length": "Your longest swim this season: {value} in one go.",
	"badges.for.swimming": "You swam {value} this season.",
	"badges.for.winter_november": "In November: {value} outdoors on the bike.",
	"badges.for.winter_december": "In December: {value} outdoors on the bike.",
	"badges.for.winter_january": "In January: {value} outdoors on the bike.",
	"badges.for.winter_february": "In February: {value} outdoors on the bike.",
	"badges.for.team_training_rynke":
		"All riders together collected {value} in training this season.",
	"badges.for.team_distance": "All riders together rode {value} this season.",
	"badges.for.team_elevation":
		"All riders together climbed {value} by bike this season.",
	"badges.for.team_running": "All riders together ran {value} this season.",
	"badges.for.big_training": "{value} came to a single team event together.",
	"badges.for.attendances":
		"All team events this season together had {value}: every rider at every event counts one.",
	"badges.value.km": "{n}\u00a0km",
	"badges.value.m": "{n}\u00a0m",
	"badges.value.rynke": "{n}\u00a0Rynke",
	"badges.value.events": "{n}\u00a0team events",
	"badges.value.events.one": "{n}\u00a0team event",
	"badges.value.trainings": "{n}\u00a0technique trainings",
	"badges.value.trainings.one": "{n}\u00a0technique training",
	"badges.value.riders": "{n}\u00a0cyclists",
	"badges.value.riders.one": "{n}\u00a0cyclist",
	"badges.value.attendances": "{n}\u00a0visits",
	"badges.value.attendances.one": "{n}\u00a0visit",
	"badges.value.days": "{n}\u00a0days",
	"badges.value.days.one": "{n}\u00a0day",
	"badges.surprise.new-year": "New Year",
	"badges.surprise.new-year.for": "You were out on New Year's Day.",
	"badges.surprise.christmas-eve": "Christmas Eve",
	"badges.surprise.christmas-eve.for": "You were out on Christmas Eve.",
	"badges.surprise.christmas": "Christmas",
	"badges.surprise.christmas.for": "You were out over the Christmas holidays.",
	"badges.surprise.night-owl": "Night owl",
	"badges.surprise.night-owl.for": "You set off after 9:30 pm.",
	"badges.surprise.early-bird": "Early bird",
	"badges.surprise.early-bird.for": "You set off before 6 am.",
	"badges.surprise.rest-day": "Rest day",
	"badges.surprise.rest-day.for":
		"Active every day for a week – and then a day off. Well earned!",
	"badges.surprise.day-off": "Team day off",
	"badges.surprise.day-off.for":
		"A day on which the whole team put their feet up.",
	"badges.surprise.all-out": "All out",
	"badges.surprise.all-out.for": "A day on which really everyone was out.",
	"badges.surprise.round-the-clock": "Round the clock",
	"badges.surprise.round-the-clock.for":
		"Someone from the team was out in every hour of one day.",
	"badges.surprise.relay": "Relay",
	"badges.surprise.relay.for":
		"For 30 days in a row someone from the team was active every day.",
	"badges.surprise.new-years-eve": "New Year's Eve",
	"badges.surprise.new-years-eve.for":
		"At least five from the team were out on New Year's Eve.",
	"badges.surprise.sunday-outing": "Sunday outing",
	"badges.surprise.sunday-outing.for":
		"At least ten from the team out on a Sunday without a team event.",
	"badges.surprise.festive-500": "Festive 500",
	"badges.surprise.festive-500.for":
		"Rode 500 kilometres between Christmas Eve and New Year's Eve.",
	"badges.surprise.stage-rider": "Stage rider",
	"badges.surprise.stage-rider.for":
		"100 kilometres on each of three days in a row – like on the tour.",
	"badges.surprise.triathlon": "Triathlon",
	"badges.surprise.triathlon.for": "Cycling, running and swimming on one day.",
	"badges.surprise.pi-day": "Pi Day",
	"badges.surprise.pi-day.for":
		"Rode at least 31.4 kilometres in one go on Pi Day, 14 March.",
	"badges.surprise.solstice": "Solstice",
	"badges.surprise.solstice.for":
		"Rode outdoors on the shortest and the longest day of the year.",
	"badges.surprise.easter": "Easter",
	"badges.surprise.easter.for": "Out and about at Easter.",
	"badges.surprise.everesting": "Everesting",
	"badges.surprise.everesting.for":
		"Climbed 8,848 metres in one month – once up Mount Everest.",
	"badges.surprise.festive-team": "Festive Team",
	"badges.surprise.festive-team.for":
		"The whole team rode between Christmas Eve and New Year's Eve.",
	"badges.value.half": "Half marathon",
	"badges.value.marathon": "Marathon",
	"notification.badge": "New badge: {name} 🏅",
	"notification.badges": "{n} new badges 🏅",
	"notification.teamBadge": "New team badge: {name} 🏅",
	"notification.teamBadges": "{n} new team badges 🏅",

	"privacy.link": "Privacy and contact",
	"privacy.title": "Privacy",
	"privacy.updated": "Last updated: {date}",
	"privacy.intro":
		"This explains which data RynkePoints processes, what for, who sees it, how long it is kept and what your rights are.",
	"privacy.controller.heading": "Who is responsible, and how to reach us",
	"privacy.controller.body":
		"Responsible for the processing of data in RynkePoints is:",
	"privacy.contact.body":
		"For questions, help, a copy of your data or its deletion, write to {email}.",
	"privacy.purpose.heading": "What RynkePoints processes data for",
	"privacy.purpose.body":
		"RynkePoints is the training app of Team Rynkeby Hamburg. It reads the key figures of your activities from Strava, turns them into Rynke (training points) and badges, and shows them to you, the team and the organisers. There are no ads, no payments, no tracking and no analytics tools. Data is never sold or passed on, and never used for AI or machine learning.",
	"privacy.strava.heading": "Data from Strava",
	"privacy.strava.rider":
		"About you: your Strava athlete ID, your first name, the permissions you granted, and the access keys (tokens), stored encrypted.",
	"privacy.strava.rides":
		"For each ride: activity ID, title, sport type, start time and time zone, distance, moving and elapsed time, elevation gain, and whether it was entered manually, ridden on an indoor trainer, is private or was flagged by Strava.",
	"privacy.strava.runsSwims":
		"For each run and each swim only the activity ID, start time, distance and whether it is private, for the running and swimming badges.",
	"privacy.strava.private":
		"Only activities from the season start on are stored, and private (“Only You”) ones only if you granted the permission for them.",
	"privacy.strava.never":
		"Never read or stored: GPS tracks, maps, routes, segments, photos, descriptions, heart rate, power, cadence, calories or other health data, your followers, and other athletes' data.",
	"privacy.strava.how":
		"Strava reports new, changed and deleted activities by itself; RynkePoints doesn't keep asking. Once a day RynkePoints checks that you are still a member of the team's Strava club.",
	"privacy.team.heading": "Data from the team, and what is worked out from it",
	"privacy.team.body":
		"The organisers record which team events you attended, and can correct your Rynke with a reason and a date. You can report yourself which team events you're coming to or were at; the organisers see that and decide whether to record it. Who changed what, and when, is stored too.",
	"privacy.team.derived":
		"From all this RynkePoints works out your Rynke, your badges and which rides count, and why.",
	"privacy.technical.heading": "Data needed to run the app",
	"privacy.technical.cookies":
		"Cookies: “rp_session” keeps you signed in, until 180 days after your last visit; “rp_oauth_state” protects the sign-in with Strava for 10 minutes; “rp_lang” remembers a picked language for a year. There are no other cookies and no trackers.",
	"privacy.technical.push":
		"Notifications are optional and per device. Only the address your device's or browser's push service gives it is stored. The notification itself is empty: what it shows, your device fetches straight from RynkePoints. The address is deleted when you turn notifications off, sign out on that device or leave.",
	"privacy.technical.logs":
		"Server logs hold only identifiers such as athlete and activity IDs and the kind of an error, never access keys or activity data. RynkePoints doesn't store IP addresses.",
	"privacy.visibility.heading": "Who sees what",
	"privacy.visibility.you":
		"You see your own activities with their titles, your Rynke and your badges. Nobody else sees the titles.",
	"privacy.visibility.team":
		"Everyone else on the team sees your Rynke, overall and per week, without your name. Your kilometres and elevation, and on which days and at what hour you are active, count towards the team sums and team badges, without your name.",
	"privacy.visibility.organisers":
		"The organisers see your first name, your Rynke and where they come from, what you still need, whether you've reached your training goal, your team events and corrections, and which team events you reported you're coming to or were at, but no individual activities.",
	"privacy.visibility.public":
		"None of it is public: every page with this data needs you to sign in with Strava.",
	"privacy.legal.heading": "Legal basis",
	"privacy.legal.body":
		"Reading your Strava data and sharing your Rynke as described rest on your consent, given before you connect (Art. 6(1)(a) GDPR). Team events, corrections, the necessary cookies and the logs rest on the legitimate interest in organising the team's training and running the app securely (Art. 6(1)(f) GDPR; for cookies § 25(2) TDDDG).",
	"privacy.retention.heading": "How long data is kept",
	"privacy.retention.body":
		"Your data is kept while you are connected, and follows Strava: if you delete an activity on Strava, or make it private without having granted the permission for that, it disappears here too as soon as Strava reports it, usually within minutes. Activities from before the season start are deleted.",
	"privacy.retention.deletion":
		"All data about you is deleted at once, and access on Strava is revoked where it still works, when you disconnect in the app, remove RynkePoints in your Strava settings, leave the team's Strava club (within 24 hours), or don't renew a broken connection within 7 days.",
	"privacy.retention.backups":
		"After that the data stays in the database's automatic backups for at most 7 days, then it is gone. Cloudflare deletes server logs after at most 7 days.",
	"privacy.recipients.heading": "Who processes the data",
	"privacy.recipients.cloudflare":
		"RynkePoints runs on Cloudflare, Inc. as a processor: web server, work queue and database. To deliver the pages and protect them from attacks, Cloudflare necessarily processes your IP address. Cloudflare has data centres worldwide, including in the USA; for transfers there, Cloudflare is certified under the EU-US Data Privacy Framework, and the EU Standard Contractual Clauses apply.",
	"privacy.recipients.push":
		"The push services of the device and browser makers (such as Google, Apple, Mozilla, Microsoft) only receive empty notifications to your device's address.",
	"privacy.recipients.strava":
		"Strava itself is responsible for the data in your Strava account. The {stravaPrivacy} applies, and takes precedence where it conflicts with this notice.",
	"privacy.recipients.stravaPrivacy": "Strava Privacy Policy",
	"privacy.recipients.usage":
		"Strava may collect usage data about how RynkePoints uses the Strava API, and use it for any business purpose, such as improving the API and the Strava platform, providing support, or checking compliance with its terms.",
	"privacy.links.heading": "Links to Strava",
	"privacy.links.body":
		"Links to Strava lead to pages run by Strava, which alone is responsible for their content. RynkePoints doesn't adopt that content as its own and has no influence on it. If we learn of unlawful content on a linked page, we remove the link.",
	"privacy.rights.heading": "Your rights",
	"privacy.rights.body":
		"You have the right of access, rectification, erasure, restriction of processing, data portability and objection (Art. 15 to 21 GDPR). You can withdraw your consent at any time, most simply by disconnecting in the app; what happened before stays lawful. You can also complain to a data protection supervisory authority, in particular where you live. For anything, reach us at {email}.",
	"privacy.changes.heading": "Changes",
	"privacy.changes.body":
		"If what RynkePoints reads, or who sees it, changes, we ask for your consent again before the app shows you anything.",
	// Feature 019: team-event reports (contracts/messages.md).
	"nav.events": "Events",
	"nav.organiser.open": "Orga, {n} open reports",
	"events.heading": "Team events 📅",
	"events.until": "until {date}",
	"events.note.title": "Report it here yourself",
	"events.note.body":
		"We can't take your participation in team events from Spond or Strava yet. Let us know here which events you're coming to or were at.",
	"events.upcoming": "Coming up",
	"events.upcoming.hint":
		"“I'm in” only lets the organisers know. You get Rynke once the event is over and the organisers have added you. Until then you can change your mind any time.",
	"events.upcoming.none": "No team events planned yet.",
	"events.past": "Past",
	"events.past.none": "No team events this season yet.",
	"events.past.all": "Show all",
	"events.amount.team": "+{n} Team",
	"events.amount.training": "+{n} Training",
	"events.join": "I'm in",
	"events.leave": "Not coming after all",
	"events.joined.label": "I'm in. Tap to cancel.",
	"events.report": "I was there",
	"events.reported.label": "I was there, reported",
	"events.attended": "You were there",
	"events.error.event_over": "The event is over; you can't cancel any more.",
	"events.error.already_attending": "You're already added to this event.",
	"events.error.event_missing": "This event doesn't exist any more.",
	"organiser.switch.events.open": "Events, {n} open reports",
	"organiser.requests.heading": "{n} open reports ⏳",
	"organiser.requests.heading.one": "1 open report ⏳",
	"organiser.requests.intro": "Riders say they were there – at {n} events.",
	"organiser.requests.intro.one": "Riders say they were there – at one event.",
	"organiser.requests.open": "Open event",
	"organiser.requests.confirm": "Add",
	"organiser.requests.confirm.label": "Add {name} to {event}",
	"organiser.requests.deny.label": "Decline {name}'s report for {event}",
	"organiser.requests.confirmAll": "Add all {n}",
	"organiser.requests.wants": "⏳ Wants to be added: {event}",
	"organiser.done.confirmed": "{names} added.",
	"organiser.done.denied": "Report from {names} declined.",
	"organiser.done.undone": "Undone.",
	"organiser.done.attendance.reports":
		"Saved: {yes} added, {no} declined, {open} open.",
	"organiser.undo": "Undo",
	"organiser.error.request_settled":
		"Someone else has already dealt with this report.",
	"organiser.error.undo_expired": "That can't be undone any more.",
	"organiser.events.attendees.you": "{count} people, including you",
	"organiser.events.intents": "{count} coming",
	"organiser.events.open": "⏳ {count} open",
	"organiser.events.self": "I was there too",
	"organiser.events.upcoming": "Coming up",
	"organiser.events.past": "Past",
	"organiser.attendance.headingFuture": "Who's coming?",
	"organiser.attendance.count": "{count} attended",
	"organiser.attendance.countFuture": "{count} coming",
	"organiser.attendance.legend": "What the boxes show",
	"organiser.attendance.legend.empty": "Empty – not there",
	"organiser.attendance.legend.grey": "Grey – report, still open",
	"organiser.attendance.legend.greyFuture": "Grey – coming",
	"organiser.attendance.legend.checked": "Tick – there, earns Rynke",
	"organiser.attendance.confirmAll": "Add all {n} reports",
	"organiser.attendance.tag.open": "Report open",
	"organiser.attendance.tag.yes": "will be added",
	"organiser.attendance.tag.no": "will be declined",
	"organiser.attendance.tag.intent": "coming",
	"organiser.attendance.decide.open": "Leave open",
	"organiser.attendance.decide.yes": "Was there",
	"organiser.attendance.decide.no": "Wasn't there",
	"organiser.attendance.summary":
		"Reports: {yes} will be added, {no} declined, {open} open",
	"organiser.overview.group.requests": "Riders with an open report ⏳",
	"organiser.overview.column.requests": "Report",
};
