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

	"layout.switcher.label": "Language",
	"layout.logout": "Sign out",

	"landing.title": "Connect with Strava",
	"landing.intro":
		"RynkePoints collects Team Rynkeby Hamburg's rides for points and events.",
	"landing.who": "Only members of {clubLink} can take part.",
	"club.linkText": "our team club on Strava",
	"landing.dataRead":
		"From your rides we only read sport type, start time, distance, moving time and elevation gain – no GPS tracks, maps, photos or health data.",
	"landing.private":
		'On Strava you decide whether your private ("Only You") activities are included.',
	"landing.purpose":
		"We use the data only for the team's points and events. Nobody else sees your activities.",
	"landing.leave":
		"You can leave at any time: on your RynkePoints page, or by removing RynkePoints in your Strava settings. If you leave the club, we delete your data within 24 hours.",
	"landing.backups":
		"Deleted data stays in our hosting provider's backups for up to 7 days and then disappears automatically.",
	"landing.cookies":
		"We only set necessary cookies: for signing in and for your language choice.",

	"me.title": "Your RynkePoints",
	"me.greeting": "Hi {firstName}!",
	"me.status.connected": "Connected to Strava",
	"me.status.needsReconnect": "Your Strava connection needs to be renewed.",
	"me.reconnect": "Reconnect",
	"me.scope.readAll": "Including your private activities",
	"me.scope.sharedOnly":
		'Shared activities only – private ("Only You") activities are not imported.',
	"me.import.running": "Importing your rides since {date} …",
	"me.import.done": "Import complete",
	"me.recent.heading": "Recently imported rides",
	"me.recent.empty": "No rides imported yet",
	"me.recent.col.date": "Date",
	"me.recent.col.sport": "Sport",
	"me.recent.col.distance": "Distance",
	"me.recent.col.elevation": "Elevation",
	"me.disconnect.button": "Disconnect and delete my data",

	"units.km": "{value} km",
	"units.m": "{value} m",
	"sport.Ride": "Ride",
	"sport.MountainBikeRide": "Mountain bike ride",
	"sport.GravelRide": "Gravel ride",
	"sport.EBikeRide": "E-bike ride",
	"sport.EMountainBikeRide": "E-mountain bike ride",
	"sport.VirtualRide": "Virtual ride",

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

	"error.notFound.title": "Page not found",
	"error.notFound.body": "This page doesn't exist.",
	"error.forbidden.title": "Request refused",
	"error.forbidden.body": "Please reload the page and try again.",
};
