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

	"landing.title": "Connect with Strava",
	"landing.intro":
		"RynkePoints collects Team Rynkeby Hamburg's rides for points and events.",
	"landing.who": "Only members of {clubLink} can take part.",
	"club.linkText": "our team club on Strava",
	"landing.dataRead":
		"From your rides we only read name, sport type, start time, distance, moving time, elapsed time including pauses, elevation gain, whether the ride was entered manually or ridden on an indoor trainer, and whether Strava has flagged it – no GPS tracks, maps, photos or health data.",
	"landing.private":
		'On Strava you decide whether your private ("Only You") activities are included: Strava lists this as viewing your private activities. If you untick it, your private rides don\'t count for Rynke.',
	"landing.purpose":
		"We use the data only for the team's Rynke (points) and events. Nobody but you sees your individual rides or their names.",
	"landing.leave":
		"You can leave at any time: on your RynkePoints page, or by removing RynkePoints in your Strava settings. We then delete all data about you, including your Rynke; on your RynkePoints page we confirm it right away. If you leave the club, we delete your data within 24 hours.",
	"landing.backups":
		"Deleted data stays in our hosting provider's backups for up to 7 days and then disappears automatically.",
	"landing.cookies":
		"We only set necessary cookies: for signing in and for your language choice.",
	"landing.notifications":
		"Notifications are optional and per device. Only on your device do they show how many Rynke are new and what you still need. They pass through the push service of your device's or browser's maker (e.g. Google, Apple, Mozilla, Microsoft). For this we store only the address that service gives your device, and delete it when you turn notifications off, sign out or leave.",

	"consent.heading": "What you agree to by connecting",
	"consent.organisers":
		"The team's organisers see your first name from Strava, your Rynke with their breakdown, what you still need, whether you qualify, your attendance at team events and corrections.",
	"consent.team":
		"Everyone else on the team sees your accumulated Rynke, overall and per week, without your name.",
	"consent.required": "Reading and sharing are required to take part.",
	"consent.write":
		"If you like, you can allow RynkePoints on Strava to edit your activities. Once the feature exists, we then write a short Rynke section into your ride descriptions; we never change your own text. Whoever may see the ride on Strava sees the section. Strava lists this permission as uploading activities to Strava; RynkePoints never uploads activities. You take part just the same without this permission, so you can untick it.",
	"consent.agree":
		"I agree that RynkePoints reads my rides and shares my Rynke as described.",

	"me.title": "Your RynkePoints",
	"me.greeting": "Hi {firstName}!",
	"me.status.connected": "Connected to Strava",
	"me.status.needsReconnect": "Your Strava connection needs to be renewed.",
	"me.reconnect": "Reconnect",
	"me.scope.readAll": "Including your private activities",
	"me.scope.sharedOnly":
		'Shared activities only – private ("Only You") activities are not imported.',
	"me.scope.write":
		"Write access granted: once the feature exists, RynkePoints writes a Rynke section into your ride descriptions.",
	"me.scope.noWrite":
		"No write access: RynkePoints writes nothing into your ride descriptions.",
	"me.changePermissions": "Change permissions on Strava",
	"me.consent.heading": "Your consent",
	"me.consent.accepted": "Agreed on {date} (version {version}):",
	"me.consent.none":
		"No consent is recorded for you yet. Please read what you agree to by connecting, and agree; Strava then asks for your permissions again. Until then, nobody on the team sees anything of yours.",
	"me.consent.renew.heading": "Please agree again",
	"me.consent.renew.older":
		"You agreed to version {accepted} on {date}. Version {version} changes this:",
	"me.consent.renew.strava":
		"RynkePoints needs another permission for this; Strava asks you for it.",
	"me.consent.renew.button": "Agree and continue",
	"me.consent.renew.leave":
		"If you don't want to agree, you can disconnect; all your data is then deleted.",
	"me.import.done": "Import complete",
	"me.recent.heading": "Your rides",
	"me.recent.empty": "No rides imported yet",
	"me.recent.col.date": "Date",
	"me.recent.col.distance": "Distance",
	"me.disconnect.button": "Disconnect and delete my data",

	"units.km": "{value} km",
	"units.m": "{value} m",
	"units.percent": "{value}%",
	"units.kmh": "{value} km/h",
	"units.mPerH": "{value} m/h",
	"units.duration": "{h} h {min} min",
	"units.durationMin": "{min} min",
	"sport.Ride": "Ride",
	"sport.MountainBikeRide": "Mountain bike ride",
	"sport.GravelRide": "Gravel ride",
	"sport.EBikeRide": "E-bike ride",
	"sport.EMountainBikeRide": "E-mountain bike ride",
	"sport.VirtualRide": "Virtual ride",

	"rynke.training": "Training Rynke",
	"rynke.team": "Team Rynke",
	"rynke.withoutVirtual": "Training Rynke without virtual rides",
	"rynke.notice.notWorkedOut":
		"Your Rynke are still being worked out. Check back in a few minutes.",
	"rynke.summary.heading": "Your Rynke",
	"rynke.verdict.in": "You're in: you have everything you need for the tour.",
	"rynke.verdict.notYet": "Not in yet. You still need:",
	"rynke.missing.training": "{n} Training Rynke",
	"rynke.missing.team": "{n} Team Rynke",
	"rynke.missing.withoutVirtual":
		"{n} Training Rynke from outdoor (non-virtual) rides",
	"rynke.summary.ofTarget": "{value} of {target}",
	"rynke.summary.missing": "{n} still missing",
	"rynke.summary.reached": "reached ✓",
	"rynke.rides.col.status": "Counts?",
	"rynke.rides.col.elevationTotal": "Towards elevation",
	"rynke.rides.position": "Rides {from}–{to} of {total}",
	"rynke.pager.label": "Pages",
	"rynke.pager.first": "« Newest",
	"rynke.pager.previous": "‹ Newer",
	"rynke.pager.next": "Older ›",
	"rynke.pager.last": "Oldest »",
	"rynke.notice.updating":
		"The rules have changed: new rules apply since {date}. Your numbers are being updated; until then you see them under rules version {version}.",
	"rynke.notice.importing":
		"Your rides since {date} are still being imported. Your Rynke will grow as they arrive.",
	"rynke.rules.heading": "Rules",
	"rynke.rules.version":
		"Computed with rules version {version}, in effect since {date}.",
	"rynke.rules.window": "Everything from {start} counts.",
	"rynke.rules.windowDeadline": "Everything from {start} to {deadline} counts.",
	"rynke.rules.handout": "How Rynke work (rules handout, in German)",
	"rynke.ride.counts": "counts",
	"rynke.ride.doesNotCount": "doesn't count",
	"rynke.ride.beingEvaluated": "being evaluated",
	"rynke.ride.virtual": "virtual",
	"rynke.ride.fixHint":
		"You can correct the ride on Strava or ask an organiser.",
	"rynke.reason.flagged":
		"Strava flagged this ride. If you disagree, please settle it with Strava.",
	"rynke.reason.pause":
		"Paused too long: {paused} paused for {moving} moving time – more than half is not allowed.",
	"rynke.reason.pause.share":
		"Paused too long: {paused} paused for {moving} moving time – more than {share} is not allowed.",
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
	"rynke.reason.outside_window.afterDeadlineNoDate": "After the deadline.",
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
	"rynke.gauges.heading": "Your progress",
	"rynke.gauge.caption": "{label}: {value} of {target} · {percent}",
	"rynke.gauge.reached": "✓ reached",
	"rynke.gauge.elevation":
		"Elevation towards the next {stepRynke} Training Rynke: {value} of {target} · {percent} · {missing} to go",
	"rynke.source.distance": "Distance",
	"rynke.source.elevation": "Elevation",
	"rynke.source.team_training": "Team training",
	"rynke.source.training_weekend_day": "Training-weekend day",
	"rynke.source.technique_training": "Technique training",
	"rynke.breakdown.heading": "Where your Rynke come from",
	"rynke.breakdown.trainingRynke": "{n} Training Rynke",
	"rynke.breakdown.elevation":
		"{metres} in total → {rynke} Training Rynke, {toNext} to the next {stepRynke}",
	"rynke.breakdown.elevationNoStep":
		"{metres} in total → {rynke} Training Rynke, {toNext} to the next step",
	"rynke.breakdown.total": "Total",
	"rynke.breakdown.totals": "{training} Training Rynke · {team} Team Rynke",
	"rynke.breakdown.kind":
		"attended {count} × → {team} Team Rynke, {training} Training Rynke",
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
		"We can't connect you without your agreement. Read on the start page what RynkePoints reads and shares, and tick the box.",
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
	"install.dismiss": "Dismiss",
	"offline.title": "No connection",
	"offline.body":
		"RynkePoints needs an internet connection. Please try again shortly.",
	"push.body": "New Rynke – tap to view",
	"push.body.rise": "New Rynke: {rise}.",
	"push.body.riseMissing": "New Rynke: {rise}. You still need {missing}.",
	"push.rise.training": "+{n} Training Rynke",
	"push.rise.team": "+{n} Team Rynke",
	"notifications.heading": "Notifications",
	"notifications.explain":
		"If you like, this device lets you know when you have new Rynke: how many, and what you still need.",
	"notifications.on": "Notifications are on for this device.",
	"notifications.off": "Notifications are off for this device.",
	"notifications.turnOn": "Turn on notifications",
	"notifications.turnOff": "Turn off notifications",
	"notifications.blocked":
		"Notifications stay off because your device blocks them for RynkePoints. You can allow them in your browser's or device's settings.",
	"notifications.needsHomeScreen":
		"On an iPhone, notifications only work once RynkePoints is on your home screen. Then open it from there.",
	"notifications.unsupported": "This browser can't show notifications.",
	"notifications.failed": "That didn't work. Please try again.",

	"error.notFound.title": "Page not found",
	"error.notFound.body": "This page doesn't exist.",
	"error.forbidden.title": "Request refused",
	"error.forbidden.body": "Please reload the page and try again.",
};
