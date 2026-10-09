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
	"me.greeting": "Hi {firstName}! 🦧",
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
	"me.recent.heading": "Your rides",
	"me.recent.none": "No rides this season yet.",
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
	"waiting.heading": "Fetching your rides",
	"waiting.body":
		"Because you've just connected, we're fetching your rides since {date} from Strava, once. This only happens this one time. Check back in about 5 minutes – this page updates by itself.",
	"rynke.summary.heading": "Your Rynke",
	"rynke.verdict.in":
		"You're in: you have everything you need for the tour. On to Paris! 🗼",
	"rynke.verdict.notYet": "Not in yet 🍌 You still need:",
	"rynke.missing.training": "{n} Training Rynke",
	"rynke.missing.team": "{n} Team Rynke",
	"rynke.missing.withoutVirtual":
		"{n} Training Rynke from outdoor (non-virtual) rides",
	"rynke.summary.ofTarget": "{value} of {target}",
	"rynke.summary.missing": "{n} still missing",
	"rynke.summary.reached": "reached ✓",
	"rynke.rides.col.elevationTotal": "Towards elevation",
	"rynke.rides.position": "Rides {from}–{to} of {total}",
	"rynke.pager.label": "Pages",
	"rynke.pager.first": "« Newest",
	"rynke.pager.previous": "‹ Newer",
	"rynke.pager.next": "Older ›",
	"rynke.pager.last": "Oldest »",
	"rynke.notice.updating":
		"The rules have changed: new rules apply since {date}. Your numbers are being updated; until then you see them under rules version {version}.",
	"rynke.rules.heading": "Rules",
	"rynke.rules.version":
		"Computed with rules version {version}, in effect since {date}.",
	"rynke.rules.windowDeadline": "Everything from {start} to {deadline} counts.",
	"rynke.rules.handout": "How Rynke work (rules handout, in German)",
	"rynke.ride.counts": "counts 🪙",
	"rynke.ride.doesNotCount": "doesn't count",
	"rynke.ride.beingEvaluated": "🦧 being evaluated",
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
	"prompt.install.text": "Get RynkePoints as an app on your home screen.",
	"prompt.notify.text": "Shall we tell you when you get new Rynke?",
	"prompt.notify.accept": "Turn on notifications",
	"prompt.notify.decline": "Not now",
	"prompt.close": "Close",
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
	"notifications.blocked":
		"Notifications stay off because your device blocks them for RynkePoints. You can allow them in your browser's or device's settings.",
	"notifications.needsHomeScreen":
		"On an iPhone, notifications only work once RynkePoints is on your home screen. Then open it from there.",
	"notifications.unsupported": "This browser can't show notifications.",
	"notifications.failed": "That didn't work. Please try again.",

	// Feature 011: the app shell's sections, navigation and Settings groups.
	// Strava ships its white assets in English only, as with the others.
	"nav.label": "Sections",
	"nav.overview": "Overview",
	"nav.rides": "Rides",
	"nav.team": "Team",
	"nav.settings": "Settings",
	"shell.refresh": "Refresh",
	"shell.title": "{section} – RynkePoints",
	"hero.training": "{n} Training Rynke",
	"hero.team": "and {n} Team Rynke on the road to Paris",
	"celebrate.training": "+{n} Training Rynke since your last visit 🎉",
	"celebrate.team": "+{n} Team Rynke since your last visit 🎉",
	"celebrate.both":
		"+{training} Training Rynke and +{team} Team Rynke since your last visit 🎉",
	"landing.tagline": "Collect your Rynke 🦧",
	"settings.language": "Language",
	"settings.appearance": "Appearance",
	"settings.scheme.system": "System",
	"settings.scheme.light": "Light",
	"settings.scheme.dark": "Dark",
	"settings.appearance.hint": "Applies to this device only.",
	"settings.app": "App",
	"settings.strava": "Strava connection",
	"settings.account": "Account",
	"rynke.ride.why": "Why?",
	"notifications.switch": "Notifications on this device",
	"brand.poweredByStrava.srcDark": "/strava/en/powered-by-strava-white.svg",
	"brand.connectWithStrava.srcDark": "/strava/en/connect-with-strava-white.svg",

	"error.notFound.title": "Page not found",
	"error.notFound.body": "This page doesn't exist.",
	"error.forbidden.title": "Request refused",
	"error.forbidden.body": "Please reload the page and try again.",

	"organiser.title": "Organiser",
	"organiser.link": "Organiser pages",
	"organiser.back": "Back to the events",
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
	"organiser.events.attendees": "{count} attended",
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
	"organiser.riders.link": "Team overview",
	"organiser.riders.back": "Back to the team overview",
	"organiser.corrections.heading": "Corrections for {name}",
	"organiser.corrections.none": "No corrections yet.",
	"organiser.corrections.new": "New correction",
	"organiser.corrections.training": "{amount} Training Rynke",
	"organiser.corrections.team": "{amount} Team Rynke",
	"organiser.field.training": "Training Rynke (+ or −, empty is 0)",
	"organiser.field.team": "Team Rynke (+ or −, empty is 0)",
	"organiser.field.reason": "Reason",
	"organiser.corrections.remove": "Remove…",
	"organiser.corrections.removeWarning":
		"This removes the correction; the rider's Rynke follow.",
	"organiser.corrections.removeConfirm": "Yes, remove",

	// Feature 016: the Team page (contracts/messages.md "Team page").
	"team.heading": "Team",
	"team.total.label": "Team Rynkeby Hamburg 🦧",
	"team.total.value": "{n} Rynke",
	"team.total.kind": "{kind} Rynke collected together",
	"team.total.thisWeek": "+{n} this week 🔥",
	"team.kind.label": "Which Rynke",
	"team.kind.training": "Training",
	"team.kind.team": "Team",
	"team.place": "You're {place} of {count} riders 🚴",
	"team.place.joint": "You're joint {place} of {count} riders 🚴",
	"team.place.next": "{n} Rynke to pass the next place",
	"team.place.lead": "You lead the peloton. Bring the others along!",
	"team.quote.push": "For you 🍌",
	"team.quote.onTrack": "For you 🤝",
	"team.peloton.heading": "The peloton 🚴",
	"team.peloton.hint":
		"Every coin is a rider. The front of the bunch rides on the right.",
	"team.peloton.back": "Back of the bunch",
	"team.peloton.front": "Front 🏁",
	"team.peloton.label":
		"{count} riders between {min} and {max} Rynke; you have {own}",
	"team.peloton.you": "You",
	"team.list.heading": "Leaderboard",
	"team.list.count": "{n} riders listed",
	"team.list.hint":
		"No names, just Rynke. The line shows each rider's season so far.",
	"team.list.scope": "Show",
	"team.list.around": "Around you",
	"team.list.everyone": "Everyone",
	"team.list.ahead": "· · · {n} riders ahead · · ·",
	"team.list.behind": "· · · {n} riders behind · · ·",
	"team.list.you": "You 🦧",
	"team.list.other": "{n} {kind}",
	"team.list.weeks": "Week by week: {values}",
	"team.chart.heading": "The team, week by week",
	"team.chart.hint":
		"Everyone's {kind} Rynke added up, at the end of each week.",
	"team.chart.now": "this week",
	"team.chart.label":
		"Team {kind} at the end of each week, {weeks} weeks, now {total}",
	"team.chart.best": "Best team week so far: +{n} in the week ending {date} 🔥",
	"team.chart.table": "All weeks",
	"team.chart.week": "Week ending",
	"team.chart.total": "Total",
	"team.chart.gain": "Gain",
	"team.organiser.overview": "Team overview",

	// Feature 016: the organiser overview (contracts/messages.md "Organiser overview").
	"organiser.overview.heading": "Team overview",
	"organiser.overview.deadline": "Qualification deadline · {date}",
	"organiser.overview.daysLeft": "{n} days to go ⏳",
	"organiser.overview.deadlinePassed": "The deadline has passed",
	"organiser.overview.qualified": "{n} of {count} in for Paris 🗼",
	"organiser.overview.groups": "Groups",
	"organiser.overview.group.push": "Need a push 🍌",
	"organiser.overview.group.notYet": "Not yet in",
	"organiser.overview.group.onTrack": "On track 🚴",
	"organiser.overview.group.in": "In for Paris 🗼",
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
	"organiser.overview.qualifiedList": "In for Paris 🗼",
	"organiser.overview.qualifiedHint":
		"Both thresholds and the outdoor share met.",
	"organiser.overview.nobodyYet": "Nobody qualifies yet.",
	"organiser.overview.none": "No riders share their Rynke yet.",
	"organiser.overview.column.name": "Rider",
	"organiser.overview.column.group": "Group",
	"organiser.overview.column.training": "Training",
	"organiser.overview.column.team": "Team",
	"organiser.overview.column.outdoor": "Outdoor",
	"organiser.overview.column.missing": "Still to go",
	"organiser.overview.column.distance": "Distance",
	"organiser.overview.column.elevation": "Elevation",
	"organiser.overview.column.events": "Team events",
	"organiser.overview.column.corrections": "Corrections",
	"organiser.overview.column.virtual": "Virtual",
};
