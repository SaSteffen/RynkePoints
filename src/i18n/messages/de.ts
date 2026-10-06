// German source catalog (research R16). Its keys define `MessageId`; every other
// catalog must have exactly these keys. Inventory: contracts/messages.md.

export const de = {
	"meta.languageName": "Deutsch",
	"meta.intlLocale": "de-DE",
	"app.name": "RynkePoints",
	// Strava's original (English) files until a German variant is confirmed in
	// Strava's downloads (research R19).
	"brand.connectWithStrava.src": "/strava/en/connect-with-strava.svg",
	"brand.connectWithStrava.alt": "Mit Strava verbinden",
	"brand.poweredByStrava.src": "/strava/en/powered-by-strava.svg",
	"brand.poweredByStrava.alt": "Powered by Strava",

	"layout.switcher.label": "Sprache",
	"layout.logout": "Abmelden",

	"landing.title": "Mit Strava verbinden",
	"landing.intro":
		"RynkePoints sammelt die Radfahrten von Team Rynkeby Hamburg für Punkte und Events.",
	"landing.who": "Mitmachen können nur Mitglieder {clubLink}.",
	"club.linkText": "unseres Team-Clubs auf Strava",
	"landing.dataRead":
		"Wir lesen von deinen Radfahrten nur Sportart, Startzeit, Distanz, Bewegungszeit und Höhenmeter – keine GPS-Spuren, Karten, Fotos oder Gesundheitsdaten.",
	"landing.private":
		"Auf Strava entscheidest du selbst, ob auch deine privaten („Nur du“) Aktivitäten dazugehören.",
	"landing.purpose":
		"Wir nutzen die Daten nur für die Punkte und Events des Teams. Niemand sonst sieht deine Aktivitäten.",
	"landing.leave":
		"Du kannst jederzeit aussteigen: auf deiner RynkePoints-Seite oder indem du RynkePoints in deinen Strava-Einstellungen entfernst. Wenn du den Club verlässt, löschen wir deine Daten innerhalb von 24 Stunden.",
	"landing.backups":
		"Gelöschte Daten bleiben bis zu 7 Tage in den Sicherungen unseres Hosting-Anbieters und verschwinden danach automatisch.",
	"landing.cookies":
		"Wir setzen nur notwendige Cookies: für die Anmeldung und für deine Sprachwahl.",

	"me.title": "Deine RynkePoints",
	"me.greeting": "Hallo {firstName}!",
	"me.status.connected": "Mit Strava verbunden",
	"me.status.needsReconnect": "Die Verbindung zu Strava muss erneuert werden.",
	"me.reconnect": "Erneut verbinden",
	"me.scope.readAll": "Einschließlich deiner privaten Aktivitäten",
	"me.scope.sharedOnly":
		"Nur geteilte Aktivitäten – private („Nur du“) Aktivitäten werden nicht importiert.",
	"me.import.running": "Deine Fahrten seit dem {date} werden importiert …",
	"me.import.done": "Import abgeschlossen",
	"me.recent.heading": "Zuletzt importierte Fahrten",
	"me.recent.empty": "Noch keine Fahrten importiert",
	"me.recent.col.date": "Datum",
	"me.recent.col.sport": "Sportart",
	"me.recent.col.distance": "Distanz",
	"me.recent.col.elevation": "Höhenmeter",
	"me.disconnect.button": "Verbindung trennen und meine Daten löschen",

	"units.km": "{value} km",
	"units.m": "{value} m",
	"sport.Ride": "Radfahrt",
	"sport.MountainBikeRide": "Mountainbike-Fahrt",
	"sport.GravelRide": "Gravel-Fahrt",
	"sport.EBikeRide": "E-Bike-Fahrt",
	"sport.EMountainBikeRide": "E-Mountainbike-Fahrt",
	"sport.VirtualRide": "Virtuelle Fahrt",

	"disconnect.title": "Daten löschen?",
	"disconnect.explain":
		"RynkePoints gibt den Zugriff auf dein Strava-Konto zurück und löscht sofort alle Daten über dich. Deine Aktivitäten auf Strava bleiben unverändert.",
	"disconnect.confirm": "Ja, alles löschen",
	"disconnect.cancel": "Abbrechen",

	"notice.retry": "Noch einmal versuchen",
	"notice.backToStart": "Zur Startseite",
	"notice.expired.title": "Anmeldung abgelaufen",
	"notice.expired.body":
		"Die Anmeldung ist abgelaufen. Bitte versuche es noch einmal.",
	"notice.denied.title":
		"RynkePoints braucht Lesezugriff auf deine Aktivitäten",
	"notice.denied.body":
		"Ohne diese Berechtigung kann RynkePoints nicht funktionieren.",
	"notice.teamFull.title": "Das Team ist im Moment voll",
	"notice.teamFull.body":
		"Strava erlaubt RynkePoints gerade keine weiteren Fahrerinnen und Fahrer. Wir melden uns, sobald wieder Platz ist.",
	"notice.failed.title": "Verbindung fehlgeschlagen",
	"notice.failed.body":
		"Die Verbindung zu Strava hat nicht geklappt. Bitte versuche es noch einmal.",
	"notice.notMember.title": "Nur für Club-Mitglieder",
	"notice.notMember.body":
		"Nur Mitglieder {clubLink} können mitmachen. Tritt dem Club bei und versuche es dann noch einmal.",
	"notice.nothingStored":
		"Wir haben kein Konto für dich angelegt und weder deinen Strava-Zugang noch deine Aktivitäten gespeichert.",
	"notice.stravaBusy.title": "Strava ist gerade ausgelastet",
	"notice.stravaBusy.body":
		"Bitte versuche es in ein paar Minuten noch einmal.",
	"notice.deleted.title": "Deine Daten wurden gelöscht",
	"notice.deleted.body":
		"Wir haben alle Daten über dich gelöscht. Kopien in den Sicherungen unseres Hosting-Anbieters verschwinden spätestens nach 7 Tagen.",
	"notice.revokeFailed.body":
		"Wir konnten den Zugriff bei Strava nicht zurückgeben. Bitte entferne RynkePoints in deinen Strava-Einstellungen unter „Meine Apps“.",

	"error.notFound.title": "Seite nicht gefunden",
	"error.notFound.body": "Diese Seite gibt es nicht.",
	"error.forbidden.title": "Anfrage abgelehnt",
	"error.forbidden.body":
		"Bitte lade die Seite neu und versuche es noch einmal.",
} satisfies Record<string, string>;
