// German source catalog (research R16). Its keys define `MessageId`; every other
// catalog must have exactly these keys. Inventory: contracts/messages.md.
// `\u00a0` keeps a number on one line with its unit or its Rynke.

export const de = {
	"meta.languageName": "Deutsch",
	"meta.intlLocale": "de-DE",
	"app.name": "RynkePoints",
	// Strava ships its brand assets in English only, so every language shows the
	// English files; only the alt text is translated (research R19).
	"brand.connectWithStrava.src": "/strava/en/connect-with-strava.svg",
	"brand.connectWithStrava.alt": "Mit Strava verbinden",
	"brand.poweredByStrava.src": "/strava/en/powered-by-strava.svg",
	"brand.poweredByStrava.alt": "Powered by Strava",
	// Strava's Brand Guidelines §3 fix this text in every language (008 FR-009).
	"brand.viewOnStrava": "View on Strava",

	"layout.switcher.label": "Sprache",
	"layout.logout": "Abmelden",
	"layout.loading": "Seite wird geladen",

	"landing.title": "Mit Strava verbinden",
	"landing.intro":
		"Aus deinen Radfahrten auf Strava werden Rynke, die Punkte von Team Rynkeby Hamburg.",
	"landing.who": "Mitmachen können nur Mitglieder {clubLink}.",
	"club.linkText": "unseres Team-Clubs auf Strava",
	"landing.dataRead":
		"Von jeder Radfahrt lesen wir nur Namen, Sportart, Startzeit, Distanz, Bewegungszeit, Gesamtzeit mit Pausen, Höhenmeter, ob sie manuell eingetragen oder auf dem Rollentrainer gefahren wurde und ob Strava sie markiert hat.",
	"landing.private":
		"Private Fahrten („Nur du“) zählen nur, wenn du auf Strava das Anzeigen deiner privaten Aktivitäten erlaubst.",
	"landing.purpose":
		"Wir nutzen die Daten nur für Rynke und Teamtermine. Deine einzelnen Fahrten und ihre Namen siehst nur du.",
	"landing.leave":
		"Aussteigen geht jederzeit: in den Einstellungen oder indem du RynkePoints auf Strava entfernst. Dann löschen wir alle Daten über dich, auch deine Rynke. Verlässt du den Club, löschen wir sie innerhalb von 24\u00a0Stunden.",
	"landing.backups":
		"Gelöschte Daten bleiben noch bis zu 7\u00a0Tage in den Sicherungen unseres Hosting-Anbieters.",
	"landing.cookies":
		"Wir setzen nur notwendige Cookies: für die Anmeldung und deine Sprachwahl.",
	"landing.notifications":
		"Benachrichtigungen sind freiwillig, gelten pro Gerät und zeigen nur dir, wie viele Rynke neu sind und was dir noch fehlt. Sie laufen über den Dienst des Geräte- oder Browserherstellers (z.\u00a0B. Google, Apple, Mozilla, Microsoft). Wir speichern dafür nur die Adresse, die er deinem Gerät gibt, und löschen sie, wenn du sie ausschaltest, dich abmeldest oder gehst.",

	"consent.heading": "Was du mit dem Verbinden erlaubst",
	"consent.short.notRead":
		"Wir lesen keine GPS-Spuren, Karten, Fotos oder Gesundheitsdaten.",
	"consent.short.read":
		"Wir lesen nur die Eckdaten deiner Rad-, Lauf- und Schwimmaktivitäten wie Distanz, Zeit und Höhenmeter und machen daraus Rynke und Abzeichen.",
	"consent.short.shown":
		"Das Team sieht deine Rynke ohne Namen, die Orga mit deinem Vornamen.",
	"consent.details": "Alle Details",
	"consent.organisers":
		"Die Orga sieht deinen Vornamen von Strava, deine Rynke und woher sie kommen, was dir noch fehlt, ob du dein Trainingsziel erreicht hast, deine Teamtermine und Korrekturen und bei welchen Teamterminen du gemeldet hast, dass du dabei bist oder warst.",
	"consent.team":
		"Alle anderen im Team sehen deine Rynke, insgesamt und pro Woche, ohne deinen Namen. Deine Kilometer und Höhenmeter zählen ohne Namen zu den Team-Summen der Team-Abzeichen. An welchen Tagen und zu welcher Stunde du fährst, läufst oder schwimmst, zählt ohne Namen für die Team-Überraschungen.",
	"consent.required": "Lesen und Teilen sind Voraussetzung fürs Mitmachen.",
	"consent.agree":
		"Einverstanden: RynkePoints liest deine Fahrten und teilt deine Rynke wie beschrieben.",

	"me.title": "Deine RynkePoints",
	"me.greeting": "Hallo {firstName}!",
	"me.status.connected": "Mit Strava verbunden",
	"me.status.needsReconnect": "Die Verbindung zu Strava muss erneuert werden.",
	"me.reconnect": "Erneut verbinden",
	"me.scope.readAll": "Private Aktivitäten zählen mit.",
	"me.scope.sharedOnly": "Private („Nur du“) Aktivitäten zählen nicht.",
	"me.scope.write":
		"RynkePoints darf einen Rynke-Abschnitt in deine Fahrtbeschreibungen schreiben, sobald es die Funktion gibt.",
	"me.scope.noWrite":
		"RynkePoints schreibt nichts in deine Fahrtbeschreibungen.",
	"me.changePermissions": "Berechtigungen auf Strava ändern",
	"me.consent.heading": "Deine Zustimmung",
	"me.consent.accepted": "Zugestimmt am {date} (Version\u00a0{version}).",
	"me.consent.none":
		"Bitte stimme zu, damit wir deine Fahrten auswerten können. Strava fragt danach noch einmal nach den Berechtigungen. Bis dahin sieht das Team nichts von dir.",
	"me.consent.renew.heading": "Bitte stimme erneut zu",
	"me.consent.renew.older":
		"Du hast am {date} Version\u00a0{accepted} zugestimmt. Version\u00a0{version} ändert Folgendes:",
	"me.consent.renew.strava":
		"Dafür braucht RynkePoints eine weitere Berechtigung; Strava fragt dich danach.",
	"me.consent.renew.button": "Zustimmen und weiter",
	"me.consent.renew.leave":
		"Du möchtest nicht zustimmen? Dann trenn die Verbindung; dabei löschen wir alle deine Daten.",
	"me.recent.heading": "Deine Fahrten",
	"me.recent.none": "Noch keine Fahrten in dieser Saison.",
	"me.recent.col.distance": "Distanz",
	"me.disconnect.button": "Verbindung trennen und deine Daten löschen",

	"units.km": "{value}\u00a0km",
	"units.m": "{value}\u00a0m",
	"units.percent": "{value}\u00a0%",
	"units.kmh": "{value}\u00a0km/h",
	"units.mPerH": "{value}\u00a0m/h",
	"units.duration": "{h}\u00a0h {min}\u00a0min",
	"units.durationMin": "{min}\u00a0min",
	"sport.Ride": "Radfahrt",
	"sport.MountainBikeRide": "Mountainbike-Fahrt",
	"sport.GravelRide": "Gravel-Fahrt",
	"sport.EBikeRide": "E-Bike-Fahrt",
	"sport.EMountainBikeRide": "E-Mountainbike-Fahrt",
	"sport.VirtualRide": "Virtuelle Fahrt",

	"rynke.training": "Trainingsrynke",
	"rynke.team": "Teamrynke",
	"rynke.withoutVirtual": "Trainingsrynke draußen",
	"waiting.heading": "Deine Fahrten werden geholt",
	"waiting.body":
		"Wir holen einmalig deine Fahrten seit dem {date} von Strava. Das dauert etwa 5\u00a0Minuten; die Seite aktualisiert sich von selbst.",
	"rynke.verdict.in": "Qualifiziert für Paris! 🗼",
	"rynke.verdict.notYet": "Noch nicht qualifiziert",
	"rynke.verdict.missing": "Dir fehlen noch:",
	"rynke.status.push": "Du liegst hinter dem Plan.",
	"rynke.status.onTrack": "Du liegst im Plan.",
	"rynke.status.in": "Plan übererfüllt: Trainingsziel erreicht.",
	"rynke.missing.training": "{n}\u00a0Trainingsrynke",
	"rynke.missing.team": "{n}\u00a0Teamrynke",
	"rynke.missing.withoutVirtual": "{n}\u00a0Trainingsrynke draußen",
	"rynke.rides.col.elevationTotal": "Gezählte Höhenmeter",
	"rynke.rides.total": "{total} Fahrten in dieser Saison",
	"rynke.rides.newest": "Zu den neuesten Fahrten",
	"rynke.rides.loading": "Ältere Fahrten werden geladen …",
	"rynke.rides.failed": "Ältere Fahrten konnten nicht geladen werden.",
	"rynke.rides.retry": "Erneut versuchen",
	"rynke.rides.added": "Weitere Fahrten geladen",
	"rynke.notice.updating":
		"Seit dem {date} gelten neue Regeln. Deine Rynke werden gerade neu berechnet; bis dahin siehst du sie nach Regel-Version\u00a0{version}.",
	"rynke.rules.heading": "Regeln",
	"rynke.rules.version":
		"Regel-Version\u00a0{version}, gültig seit dem {date}.",
	"rynke.rules.windowDeadline":
		"Es zählt alles vom {start} bis zum {deadline}.",
	"rynke.rules.handout": "Die Regeln als PDF",
	"rynke.ride.counts": "zählt 🪙",
	"rynke.ride.countsWithoutRynke": "zählt",
	"rynke.ride.doesNotCount": "zählt nicht",
	"rynke.ride.beingEvaluated": "Wird ausgewertet",
	"rynke.ride.virtual": "virtuell",
	"rynke.ride.fixHint":
		"Du kannst die Fahrt auf Strava korrigieren oder dich an die Orga wenden.",
	"rynke.reason.flagged":
		"Strava hat die Fahrt markiert. Wenn du anderer Meinung bist, kläre das bitte mit Strava.",
	"rynke.reason.pause":
		"Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit; mehr als die Hälfte ist nicht erlaubt.",
	"rynke.reason.pause.moving":
		"Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit; mehr Pause als Bewegung ist nicht erlaubt.",
	"rynke.reason.pause.share":
		"Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit; mehr als {share} ist nicht erlaubt.",
	"rynke.reason.pause.noLimit":
		"Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit.",
	"rynke.reason.pause.noMovingTime":
		"Keine Bewegungszeit: Die Fahrt gilt als ganz pausiert.",
	"rynke.reason.manual": "Manuell auf Strava eingetragen.",
	"rynke.reason.too_slow":
		"Zu langsam: {speed} im Schnitt, mindestens {limit} sind nötig.",
	"rynke.reason.too_slow.noLimit": "Zu langsam: {speed} im Schnitt.",
	"rynke.reason.too_fast":
		"Zu schnell für eine Radfahrt: {speed} im Schnitt, höchstens {limit} sind erlaubt.",
	"rynke.reason.too_fast.noLimit":
		"Zu schnell für eine Radfahrt: {speed} im Schnitt.",
	"rynke.reason.climbing_rate":
		"Zu viele Höhenmeter für die Zeit: {rate} bergauf, höchstens {limit} sind erlaubt.",
	"rynke.reason.climbing_rate.noLimit":
		"Zu viele Höhenmeter für die Zeit: {rate} bergauf.",
	"rynke.reason.excluded_sport_type": "{sport} zählt nicht für Rynke.",
	"rynke.reason.outside_window": "Vor dem Saisonstart am {date}.",
	"rynke.reason.outside_window.afterDeadline": "Nach dem Stichtag am {date}.",
	"rynke.reason.overlap":
		"Doppelt aufgezeichnet: Deine Fahrt vom {date}, {time}\u00a0Uhr, {distance} zählt stattdessen.",
	"rynke.reason.overlap.noRide":
		"Doppelt aufgezeichnet: Eine andere deiner Fahrten zählt stattdessen.",
	"rynke.reason.unknown": "Zählt nach den aktuellen Regeln nicht.",
	"rynke.unknown.elapsed_time":
		"Die Gesamtzeit mit Pausen fehlt noch, deshalb ist die Pausenregel noch nicht geprüft.",
	"rynke.unknown.manual":
		"Ob die Fahrt manuell eingetragen wurde, ist noch nicht bekannt.",
	"rynke.unknown.trainer":
		"Ob die Fahrt auf dem Rollentrainer war, ist noch nicht bekannt.",
	"rynke.unknown.flagged":
		"Ob Strava die Fahrt markiert hat, ist noch nicht bekannt.",
	"rynke.unknown.mayChange": "Das Ergebnis kann sich noch ändern.",
	"rynke.gauges.heading": "Dein Fortschritt 🪙",
	"rynke.gauge.caption": "{label}: {value} von {target} · {percent}",
	"rynke.gauge.elevation":
		"Höhenmeter: {value} von {target}, noch {missing} bis {step}",
	"rynke.gauge.step": "+{n}",
	"rynke.source.distance": "Distanz",
	"rynke.source.elevation": "Höhenmeter",
	"rynke.source.team_training": "Teamtraining",
	"rynke.source.training_weekend_day": "Tag Trainingswochenende",
	"rynke.source.technique_training": "Techniktraining",
	"rynke.source.tour_de_paris": "Tour de Paris",
	"rynke.breakdown.heading": "Woher deine Rynke kommen",
	"rynke.breakdown.attended": "{count}× dabei",
	"rynke.events.heading": "Deine Teamtermine",
	"rynke.events.none": "Für dich ist noch kein Teamtermin eingetragen.",
	"rynke.events.notCounting": "zählt nicht: außerhalb des Wertungszeitraums",

	"disconnect.title": "Daten löschen?",
	"disconnect.explain":
		"RynkePoints gibt den Zugriff auf dein Strava-Konto zurück und löscht sofort alle Daten über dich. Deine Aktivitäten auf Strava bleiben, wie sie sind.",
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
	"notice.consentRequired.title": "Bitte stimme zuerst zu",
	"notice.consentRequired.body":
		"Ohne deine Zustimmung können wir dich nicht verbinden. Setz auf der Startseite den Haken.",
	"notice.teamFull.title": "Das Team ist im Moment voll",
	"notice.teamFull.body":
		"Strava erlaubt RynkePoints gerade keine weiteren Rider. Wir melden uns, sobald wieder Platz ist.",
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

	// Feature 010: the installable app and its notification. `push.body` reaches
	// the device only through /notification-text and has no placeholder (SC-008);
	// `push.body.rise*` and `push.rise.*` only through the signed-in
	// /me/notification-text.
	"install.button": "Als App installieren",
	"install.ios":
		"Als App auf dem iPhone: Tippe in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“.",
	"install.firefox":
		"Als App mit Firefox: Tippe auf das Menü ⋮ und dann auf „Installieren“ oder „Zum Startbildschirm hinzufügen“.",
	"install.macSafari":
		"Als App auf dem Mac: Wähle in Safari „Ablage“ > „Zum Dock hinzufügen“.",
	"prompt.install.text":
		"Hol dir RynkePoints als App auf deinen Startbildschirm.",
	"prompt.notify.text":
		"Sollen wir dir Bescheid sagen, wenn du neue Rynke bekommst?",
	"prompt.notify.accept": "Benachrichtigungen einschalten",
	"prompt.notify.decline": "Nicht jetzt",
	"prompt.close": "Schließen",

	"tour.label": "Erste Schritte",
	"tour.progress": "{step} von {total}",
	"tour.next": "Weiter",
	"tour.done": "Alles klar",
	"tour.skip": "Überspringen",
	"tour.start": "Zeig mal",
	"tour.example":
		"Beispieldaten: So sieht es aus, wenn schon ein paar Fahrten da sind. Deine eigenen Zahlen siehst du nach dem Rundgang.",
	"tour.rider.intro": "Neu hier? Wir zeigen dir kurz, wo du was findest.",
	"tour.rider.team":
		"Team: wie das ganze Team dasteht und wo du in der Rangliste stehst.",
	"tour.rider.peloton":
		"Das Peloton: alle im Team nach ihren Trainingsrynke, ohne Namen; deine Münze ist markiert. Je weiter rechts, desto mehr Rynke. Wer mit Abstand vorn fährt, ist im Breakaway.",
	"tour.rider.you": "Du: deine Rynke und was dir noch zur Qualifikation fehlt.",
	"tour.rider.elevation":
		"Der Höhenmeter-Zähler: Alle {elevationM}\u00a0Höhenmeter bringen dir {elevationRynke}\u00a0Trainingsrynke. Er zeigt, wie viele Meter dir noch bis zu den nächsten fehlen.",
	"tour.rider.teamRynke":
		"Teamrynke gibt es nur für Teamtermine, bei denen die Orga dich eingetragen hat: {teamTraining} für ein Teamtraining, {weekendDay} für einen Tag am Trainingswochenende, {technique} für ein Techniktraining. Für Paris brauchst du {teamThreshold}.",
	"tour.rider.outdoor":
		"Höchstens {virtualShare} deiner Trainingsrynke dürfen von virtuellen Fahrten kommen. Dieser Balken zählt alles außer ihnen: Mindestens {outside} von {trainingThreshold} Trainingsrynke musst du draußen erfahren, Teamtermine zählen mit.",
	"tour.rider.rides":
		"Fahrten: jede Fahrt und was sie gebracht hat. Diese hier zählt nicht. Unter „Warum?“ steht, woran es lag und was du tun kannst.",
	"tour.rider.shortRide":
		"Für jede volle {distanceKm}\u00a0km einer Fahrt gibt es {distanceRynke}\u00a0Trainingsrynke. Diese Fahrt war kürzer: Sie zählt, bringt aber keine Rynke für die Strecke. Ihre Höhenmeter kommen trotzdem auf den Zähler.",
	"tour.rider.badges":
		"Abzeichen: deine und die des Teams, und wie weit es bis zum nächsten ist.",
	"tour.rider.events":
		"Termine: die Teamtermine. Sag vorher Bescheid, ob du dabei bist, und melde danach, dass du da warst. Sobald die Orga dich eingetragen hat, gibt es Teamrynke.",
	"tour.rider.settings":
		"Einstellungen: Sprache, Benachrichtigungen, deine Strava-Verbindung, die Regeln und dieser Rundgang.",
	"tour.rider.theme":
		"Das Farbschema wählst du hier oben, für dieses Gerät. Konfetti und Disco feiern jeden Wechsel zwischen den Bereichen, das lässt sich in den Einstellungen abstellen.",
	"tour.organiser.intro":
		"Du bist jetzt in der Orga: Der Orga-Tab ist neu. Wir zeigen dir, was drin ist.",
	"tour.organiser.riders":
		"Rider: alle im Team mit ihren Trainings- und Teamrynke und dem, was ihnen noch fehlt.",
	"tour.organiser.example":
		"Beispielteam: So sieht Orga aus, wenn die Saison läuft. Anklicken lässt sich hier nichts; das echte Team siehst du nach dem Rundgang.",
	"tour.organiser.groups":
		"Die Gruppen: „Braucht Schwung“ liegt hinter dem Tempo, „Gut unterwegs“ im Plan, „Trainingsziel erreicht“ hat alles zusammen. Tippst du auf eine Kachel, siehst du nur ihre Rider. Ganz vorn: alle mit einer offenen Meldung.",
	"tour.organiser.pace":
		"Der Strich auf jedem Balken ist das gleichmäßige Tempo bis zum Stichtag. Wer links davon liegt, braucht Schwung. Ein Tipp auf einen Namen öffnet die Korrekturen: Rynke dazu oder weg, mit Grund.",
	"tour.organiser.requests":
		"Meldungen: Rider sagen dir, dass sie bei einem Teamtermin waren. „Eintragen“ gibt ihnen die Rynke des Termins, ✕ lehnt ab. Beides kannst du kurz danach rückgängig machen.",
	"tour.organiser.newEvent":
		"Hier legst du Teamtermine an: Art, Datum und, wenn du willst, einen Namen. Ein Teamtraining bringt {teamTraining}\u00a0Teamrynke, ein Tag am Trainingswochenende {weekendDay}, ein Techniktraining {technique}.",
	"tour.organiser.upcoming":
		"Ein kommender Termin: Rider sagen vorher, ob sie dabei sind. Die Zahl zeigt, wie viele zugesagt haben.",
	"tour.organiser.past":
		"Ein vergangener Termin: Öffne ihn und hake ab, wer da war; erst dann gibt es die Rynke. Graue Kästchen sind offene Meldungen. Warst du selbst dabei, tippe auf „Ich war auch dabei“.",
	"offline.title": "Keine Verbindung",
	"offline.body":
		"RynkePoints braucht eine Internetverbindung. Versuch es gleich noch einmal.",
	"push.body": "Neue Rynke – tippe zum Ansehen",
	"push.body.rise": "Neue Rynke: {rise}.",
	"push.body.riseMissing": "Neue Rynke: {rise}. Dir fehlen noch {missing}.",
	"push.rise.training": "+{n}\u00a0Trainingsrynke",
	"push.rise.team": "+{n}\u00a0Teamrynke",
	"notifications.heading": "Benachrichtigungen",
	"notifications.explain":
		"Dieses Gerät sagt dir Bescheid, wenn du neue Rynke hast, und was dir noch fehlt.",
	"notifications.on": "Auf diesem Gerät an.",
	"notifications.off": "Auf diesem Gerät aus.",
	"notifications.blocked":
		"Dein Gerät blockiert Benachrichtigungen für RynkePoints. Du kannst sie in den Einstellungen des Browsers oder Geräts erlauben.",
	"notifications.needsHomeScreen":
		"Auf dem iPhone gibt es Benachrichtigungen nur, wenn RynkePoints auf dem Home-Bildschirm liegt. Öffne es dann von dort.",
	"notifications.unsupported":
		"Dieser Browser kann keine Benachrichtigungen anzeigen.",
	"notifications.failed":
		"Das hat nicht geklappt. Versuch es bitte noch einmal.",

	// Feature 011: the app shell's sections, navigation and Settings groups.
	// Strava ships its white assets in English only, as with the others.
	"nav.label": "Bereiche",
	"nav.you": "Du",
	"nav.rides": "Fahrten",
	"nav.team": "Team",
	"nav.badges": "Abzeichen",
	"nav.organiser": "Orga",
	"nav.settings": "Einstellungen",
	"nav.settings.short": "Einst.",
	"shell.refresh": "Aktualisieren",
	"shell.title": "{section} – RynkePoints",
	"hero.training": "{n} Trainingsrynke",
	"hero.team": "{n} Teamrynke",
	"celebrate.training":
		"+{n}\u00a0Trainingsrynke seit deinem letzten Besuch 🎉",
	"celebrate.team": "+{n}\u00a0Teamrynke seit deinem letzten Besuch 🎉",
	"celebrate.both":
		"+{training}\u00a0Trainingsrynke und +{team}\u00a0Teamrynke seit deinem letzten Besuch 🎉",
	"landing.tagline": "Sammle deine Rynke",
	"settings.language": "Sprache",
	"theme.button": "Farbschema",
	"theme.menu.title": "Farbschema",
	"theme.menu.close": "Schließen",
	"theme.menu.note": "Gilt nur für dieses Gerät.",
	"theme.auto": "Automatisch",
	"theme.auto.hint": "Wie das Gerät: Rynke Tag oder Nacht",
	"theme.group.light": "Hell",
	"theme.group.dark": "Dunkel",
	"theme.group.contrast": "Hoher Kontrast",
	"theme.sparkle": "Glitzer",
	"theme.name.rynke-day": "Rynke Tag",
	"theme.name.baltic": "Ostsee",
	"theme.name.paris": "Paris",
	"theme.name.lilac": "Flieder",
	"theme.name.confetti": "Konfetti",
	"theme.name.rynke-night": "Rynke Nacht",
	"theme.name.night-ride": "Nachtfahrt",
	"theme.name.forest": "Wald",
	"theme.name.plum": "Pflaume",
	"theme.name.disco": "Disco",
	"theme.name.contrast-light": "Kontrast hell",
	"theme.name.contrast-dark": "Kontrast dunkel",
	"settings.app": "App",
	"settings.strava": "Strava-Verbindung",
	"settings.account": "Konto",
	"settings.shows": "Animationen",
	"settings.shows.on": "Animationen beim Seitenwechsel in Konfetti und Disco",
	"settings.tour": "Rundgang",
	"settings.tour.rider": "Rundgang noch mal zeigen",
	"settings.tour.organiser": "Orga-Rundgang noch mal zeigen",
	"rynke.ride.why": "Warum?",
	"notifications.switch": "Benachrichtigungen auf diesem Gerät",
	"brand.poweredByStrava.srcDark": "/strava/en/powered-by-strava-white.svg",
	"brand.connectWithStrava.srcDark": "/strava/en/connect-with-strava-white.svg",

	"error.notFound.title": "Seite nicht gefunden",
	"error.notFound.body": "Diese Seite gibt es nicht.",
	"error.forbidden.title": "Anfrage abgelehnt",
	"error.forbidden.body":
		"Bitte lade die Seite neu und versuche es noch einmal.",

	"organiser.title": "Orga",
	"organiser.back": "Zurück zu den Terminen",
	"organiser.switch.label": "Orga-Ansichten",
	"organiser.switch.riders": "Rider",
	"organiser.switch.events": "Termine",
	"organiser.formerOrganiser": "ehemaliges Orga-Mitglied",
	"organiser.changedBy": "Zuletzt geändert von {name} am {date}",
	"organiser.error.unknown_kind": "Bitte eine Terminart wählen.",
	"organiser.error.invalid_date": "Bitte ein gültiges Datum eingeben.",
	"organiser.error.invalid_name": "Der Name darf höchstens 100 Zeichen haben.",
	"organiser.error.event_missing": "Diesen Termin gibt es nicht mehr.",
	"organiser.error.rider_not_connected":
		"Jemand ist ausgetreten oder muss sich erst neu verbinden.",
	"organiser.error.outside_season": "Das Datum liegt außerhalb der Saison.",
	"organiser.error.future_event":
		"Die Teilnahme lässt sich erst eintragen, wenn der Termin war.",
	"organiser.error.rider_not_listed":
		"Die Liste hat sich geändert. Bitte prüfen und noch einmal speichern.",
	"organiser.error.invalid_amount":
		"Bitte ganze Zahlen eingeben; mindestens eine darf nicht 0 sein.",
	"organiser.error.invalid_reason":
		"Bitte einen Grund mit höchstens 200 Zeichen angeben.",
	"organiser.error.correction_missing": "Diese Korrektur gibt es nicht mehr.",
	"organiser.done.created": "Termin angelegt.",
	"organiser.done.saved": "Gespeichert.",
	"organiser.done.deleted": "Termin gelöscht.",
	"organiser.done.attendance": "Teilnahme gespeichert.",
	"organiser.done.added": "Korrektur hinzugefügt.",
	"organiser.done.removed": "Korrektur entfernt.",
	"organiser.events.heading": "Teamtermine dieser Saison",
	"organiser.events.none": "In dieser Saison gibt es noch keine Teamtermine.",
	"organiser.events.attendees": "{count}\u00a0Personen",
	"organiser.events.new": "Neuer Termin",
	"organiser.event.heading": "Termin bearbeiten",
	"organiser.field.kind": "Art",
	"organiser.field.date": "Datum",
	"organiser.field.name": "Name (optional)",
	"organiser.add": "Anlegen",
	"organiser.save": "Speichern",
	"organiser.event.delete": "Termin löschen…",
	"organiser.event.deleteWarning":
		"Das löscht den Termin und seine Teilnahmen; die Rynke der Rider passen sich an.",
	"organiser.event.deleteConfirm": "Ja, löschen",
	"organiser.attendance.heading": "Wer war dabei?",
	"organiser.attendance.save": "Teilnahme speichern",
	"organiser.attendance.profile": "Auf Strava ansehen",
	"organiser.attendance.future":
		"Die Teilnahme lässt sich eintragen, sobald der Termin war.",
	"organiser.attendance.none":
		"Noch ist niemand verbunden, der seine Daten mit dem Team teilt.",
	"organiser.riders.back": "Zurück zur Teamübersicht",
	"organiser.corrections.heading": "Korrekturen für {name}",
	"organiser.corrections.none": "Noch keine Korrekturen.",
	"organiser.corrections.new": "Neue Korrektur",
	"organiser.corrections.training": "{amount}\u00a0Trainingsrynke",
	"organiser.corrections.team": "{amount}\u00a0Teamrynke",
	"organiser.field.training": "Trainingsrynke (+ oder −, leer ist 0)",
	"organiser.field.team": "Teamrynke (+ oder −, leer ist 0)",
	"organiser.field.reason": "Grund",
	"organiser.corrections.remove": "Entfernen…",
	"organiser.corrections.removeWarning":
		"Das entfernt die Korrektur; die Rynke der Person passen sich an.",
	"organiser.corrections.removeConfirm": "Ja, entfernen",

	// Feature 016: the Team page (contracts/messages.md "Team page").
	"team.heading": "Team",
	"team.total.label": "Team Rynkeby Hamburg",
	"team.total.training": "{n} Trainingsrynke",
	"team.total.team": "{n} Teamrynke",
	"team.total.kind": "gemeinsam gesammelt",
	"team.total.thisWeek": "+{n} diese Woche 🔥",
	"team.kind.label": "Welche Rynke",
	"team.kind.training": "Training",
	"team.kind.team": "Team",
	"team.place": "Position {place} von {count} 🚴",
	"team.place.next": "Noch {n}\u00a0Rynke bis zum nächsten Platz",
	"team.place.lead": "Du führst das Peloton an. Nimm die anderen mit!",
	"team.peloton.heading": "Das Peloton 🚴",
	"team.peloton.hint": "Jede Münze ist ein Rider. Rechts fährt die Spitze.",
	"team.peloton.back": "Ende des Feldes",
	"team.peloton.front": "Spitze 🏁",
	"team.peloton.label":
		"{count} Rider zwischen {min} und {max}\u00a0Rynke; du hast {own}",
	"team.peloton.you": "Du",
	"team.peloton.breakaway": "Breakaway 🏁",
	"team.peloton.hint.breakaway":
		"Jede Münze ist ein Rider. Ganz rechts, hinter der Lücke, fährt der Breakaway.",
	"team.peloton.label.breakaway":
		"{count} Rider zwischen {min} und {max}\u00a0Rynke, davon {away} im Breakaway; du hast {own}",
	"team.list.heading": "Rangliste",
	"team.list.count": "{n}\u00a0Rider",
	"team.list.hint": "Ohne Namen. Die Linie zeigt die Saison bisher.",
	"team.list.scope": "Zeigen",
	"team.list.around": "Um dich herum",
	"team.list.everyone": "Alle",
	"team.list.ahead": "· · · {n} weitere vor dir · · ·",
	"team.list.behind": "· · · {n} weitere hinter dir · · ·",
	"team.list.you": "Du",
	"team.list.weeks": "Woche für Woche: {values}",
	"team.chart.heading": "Das Team, Woche für Woche",
	"team.chart.hint":
		"Die Balken zeigen, was das Team in jeder Woche gesammelt hat, die Linie alles zusammengezählt.",
	"team.chart.now": "diese Woche",
	"team.chart.label":
		"{kind} des Teams pro Woche und zusammengezählt, {weeks} Wochen, jetzt {total}",
	"team.chart.best": "Beste Teamwoche bisher: +{n} in der Woche bis {date} 🔥",
	"team.chart.table": "Alle Wochen",
	"team.chart.week": "Woche bis",
	"team.chart.total": "Gesamt",
	"team.chart.gain": "Plus",

	// Feature 016: the organiser overview (contracts/messages.md "Organiser overview").
	"organiser.overview.heading": "Teamübersicht",
	"organiser.overview.deadline": "Stichtag · {date}",
	"organiser.overview.daysLeft": "Noch {n} Tage ⏳",
	"organiser.overview.deadlinePassed": "Der Stichtag ist vorbei",
	"organiser.overview.qualified":
		"{n} von {count} haben ihr Trainingsziel erreicht 🎯",
	"organiser.overview.groups": "Gruppen",
	"organiser.overview.group.push": "Braucht Schwung",
	"organiser.overview.group.notYet": "Trainingsziel noch nicht erreicht",
	"organiser.overview.group.onTrack": "Gut unterwegs",
	"organiser.overview.group.in": "Trainingsziel erreicht",
	"organiser.overview.group.all": "Alle",
	"organiser.overview.showing": "Angezeigt: {group}",
	"organiser.overview.hint":
		"Der Strich auf jedem Balken zeigt das gleichmäßige Tempo bis zum Stichtag: heute {training} Training und {team} Team.",
	"organiser.overview.hint.percent":
		"Der Strich auf jedem Balken zeigt das gleichmäßige Tempo bis zum Stichtag: heute {training} vom Training und {team} vom Team.",
	"organiser.overview.training.percent": "Training {n}",
	"organiser.overview.team.percent": "Team {n}",
	"organiser.overview.behind.training": "Training hinter dem Tempo",
	"organiser.overview.behind.team": "Team hinter dem Tempo",
	"organiser.overview.reason.outdoor": "Noch zu wenig Training draußen",
	"organiser.overview.training": "Training {n} von {threshold}",
	"organiser.overview.team": "Team {n} von {threshold}",
	"organiser.overview.outdoor": "Training draußen {n} von {required}",
	"organiser.overview.toGo.training": "Noch {n} Training",
	"organiser.overview.toGo.team": "Noch {n} Team",
	"organiser.overview.toGo.outdoor": "Noch {n} Training draußen",
	"organiser.overview.toGo.short": "noch {n}",
	"organiser.overview.behind": "hinter dem Tempo",
	"organiser.overview.breakdown": "Woher die Rynke kommen",
	"organiser.overview.distance": "Distanz {n}",
	"organiser.overview.elevation": "Höhenmeter {n}",
	"organiser.overview.event":
		"{kind}: {attended}× → {training} Training, {team} Team",
	"organiser.overview.corrections":
		"Korrekturen {training} Training, {team} Team",
	"organiser.overview.virtual": "Virtuelle Fahrten {n} % vom Training",
	"organiser.overview.amounts": "{training} Training, {team} Team",
	"organiser.overview.percent": "{n} %",
	"organiser.overview.qualifiedList": "Trainingsziel erreicht 🎯",
	"organiser.overview.qualifiedHint":
		"Beide Schwellen und der Anteil draußen erreicht.",
	"organiser.overview.nobodyYet":
		"Noch hat niemand das Trainingsziel erreicht.",
	"organiser.overview.none": "Noch teilt niemand Rynke mit dem Team.",
	"organiser.overview.column.name": "Wer",
	"organiser.overview.column.group": "Gruppe",
	"organiser.overview.column.training": "Training",
	"organiser.overview.column.team": "Team",
	"organiser.overview.column.distance": "Distanz",
	"organiser.overview.column.elevation": "Höhenmeter",
	"organiser.overview.column.corrections": "Korrekturen",
	"organiser.overview.column.rynke": "Rynke",
	"organiser.overview.column.virtual": "Virtuell",

	// Feature 013: the Abzeichen section (contracts/badge-messages.md). Badge
	// names aren't here: they are German in every language (badges.de.ts).
	"badges.heading": "Abzeichen",
	"badges.personal.newest": "Deine Abzeichen",
	"badges.personal.all": "Alle deine Abzeichen ({n})",
	"badges.team.newest": "Team-Abzeichen",
	"badges.team.all": "Alle Team-Abzeichen ({n})",
	"badges.switch.group": "Wessen Abzeichen",
	"badges.switch.personal": "Deine",
	"badges.switch.team": "Team",
	"badges.switch.scope": "Zeigen",
	"badges.switch.newest": "Neueste",
	"badges.switch.all": "Alle",
	"badges.empty": "Noch kein Abzeichen – deine erste Fahrt bringt dich näher.",
	"badges.missing": "Noch {value}",
	"badges.next": "Nächstes Abzeichen",
	"badges.first": "Erstes Abzeichen",
	"badges.earnedOn": "erreicht am {date}",
	"badges.close": "Schließen",
	"badges.label": "{name}, {value}",
	"badges.reveal.one": "Neues Abzeichen: {name}",
	"badges.reveal.many": "{n} neue Abzeichen",
	"badges.category.distance": "Distanz",
	"badges.category.elevation": "Höhenmeter",
	"badges.category.team_events": "Teamtermine",
	"badges.category.technique": "Techniktraining",
	"badges.category.training_rynke": "Trainings-Rynke",
	"badges.category.run_length": "Längster Lauf",
	"badges.category.running": "Laufen gesamt",
	"badges.category.ride_length": "Längste Fahrt",
	"badges.category.virtual_rides": "Virtuell",
	"badges.category.swim_length": "Längstes Schwimmen",
	"badges.category.swimming": "Schwimmen gesamt",
	"badges.category.winter_november": "Winter: November",
	"badges.category.winter_december": "Winter: Dezember",
	"badges.category.winter_january": "Winter: Januar",
	"badges.category.winter_february": "Winter: Februar",
	"badges.category.surprise": "Überraschungen",
	"badges.category.team_training_rynke": "Trainings-Rynke gemeinsam",
	"badges.category.team_distance": "Kilometer gemeinsam",
	"badges.category.team_elevation": "Höhenmeter gemeinsam",
	"badges.category.team_running": "Laufen gemeinsam",
	"badges.category.big_training": "Große Ausfahrt",
	"badges.category.attendances": "Teilnahmen",
	"badges.category.tour_de_paris": "Tour de Paris",
	"badges.category.team_surprise": "Team-Überraschungen",
	"badges.about.distance": "Rad-Kilometer mit Trainings-Rynke.",
	"badges.about.elevation": "Alle Höhenmeter mit Trainings-Rynke.",
	"badges.about.team_events": "Jeder Teamtermin mit dir.",
	"badges.about.technique": "Eins fürs erste, eins für beide.",
	"badges.about.training_rynke": "Alle deine Trainings-Rynke.",
	"badges.about.run_length": "Längster Lauf am Stück, draußen.",
	"badges.about.running": "Deine Lauf-Kilometer draußen.",
	"badges.about.ride_length": "Längste Fahrt mit Trainings-Rynke.",
	"badges.about.virtual_rides": "Kilometer auf der Rolle und virtuell.",
	"badges.about.swim_length": "Längstes Schwimmen am Stück.",
	"badges.about.swimming": "Alle Schwimm-Kilometer.",
	"badges.about.winter_november": "November-Tage mit Fahrt draußen.",
	"badges.about.winter_december": "Dezember-Tage mit Fahrt draußen.",
	"badges.about.winter_january": "Januar-Tage mit Fahrt draußen.",
	"badges.about.winter_february": "Februar-Tage mit Fahrt draußen.",
	"badges.about.surprise": "?",
	"badges.about.team_training_rynke": "Trainings-Rynke aller Rider.",
	"badges.about.team_distance": "Die Rad-Kilometer des ganzen Teams.",
	"badges.about.team_elevation": "Die Rad-Höhenmeter des ganzen Teams.",
	"badges.about.team_running": "Die Lauf-Kilometer des ganzen Teams.",
	"badges.about.big_training": "Rekord: Rider an einem Termin.",
	"badges.about.attendances": "Teilnahmen aller Rider zusammen.",
	"badges.about.tour_de_paris": "Jeder Tag der Tour mit dir.",
	"badges.about.team_surprise": "?",
	"badges.for.distance": "Du bist in dieser Saison {value} Rad gefahren.",
	"badges.for.elevation":
		"Du bist in dieser Saison mit dem Rad {value} bergauf gefahren.",
	"badges.for.team_events":
		"Du hast in dieser Saison {value} des Teams besucht.",
	"badges.for.technique":
		"Du hast in dieser Saison {value} zur Fahrtechnik besucht.",
	"badges.for.training_rynke":
		"Du hast in dieser Saison {value} im Training gesammelt.",
	"badges.for.run_length":
		"Dein längster Lauf dieser Saison: {value} am Stück.",
	"badges.for.running": "Du bist in dieser Saison {value} gelaufen.",
	"badges.for.ride_length":
		"Deine längste Fahrt dieser Saison: {value} am Stück.",
	"badges.for.virtual_rides":
		"Du bist in dieser Saison {value} virtuell gefahren.",
	"badges.for.swim_length":
		"Dein längstes Schwimmen dieser Saison: {value} am Stück.",
	"badges.for.swimming": "Du bist in dieser Saison {value} geschwommen.",
	"badges.for.winter_november": "Im November: {value} draußen auf dem Rad.",
	"badges.for.winter_december": "Im Dezember: {value} draußen auf dem Rad.",
	"badges.for.winter_january": "Im Januar: {value} draußen auf dem Rad.",
	"badges.for.winter_february": "Im Februar: {value} draußen auf dem Rad.",
	"badges.for.team_training_rynke":
		"Alle Rider zusammen haben in dieser Saison {value} im Training gesammelt.",
	"badges.for.team_distance":
		"Alle Rider zusammen sind in dieser Saison {value} Rad gefahren.",
	"badges.for.team_elevation":
		"Alle Rider zusammen sind in dieser Saison {value} bergauf gefahren.",
	"badges.for.team_running":
		"Alle Rider zusammen sind in dieser Saison {value} gelaufen.",
	"badges.for.big_training":
		"{value} waren bei einem einzigen Teamtermin zusammen dabei.",
	"badges.for.attendances":
		"Alle Teamtermine dieser Saison zusammen hatten {value}: Jeder Rider bei jedem Termin zählt eins.",
	"badges.tourDay.for": "Tag {day} der Tour de Paris – der Ort folgt.",
	"badges.value.km": "{n}\u00a0km",
	"badges.value.m": "{n}\u00a0m",
	"badges.value.rynke": "{n}\u00a0Rynke",
	"badges.value.events": "{n}\u00a0Termine",
	"badges.value.events.one": "{n}\u00a0Termin",
	"badges.value.trainings": "{n}\u00a0Trainings",
	"badges.value.trainings.one": "{n}\u00a0Training",
	"badges.value.riders": "{n}\u00a0Rider",
	"badges.value.riders.one": "{n}\u00a0Rider",
	"badges.value.attendances": "{n}\u00a0Teilnahmen",
	"badges.value.attendances.one": "{n}\u00a0Teilnahme",
	"badges.value.days": "{n}\u00a0Tage",
	"badges.value.tourDay": "Tag\u00a0{n}",
	"badges.value.days.one": "{n}\u00a0Tag",
	"badges.surprise.new-year": "Neujahr",
	"badges.surprise.new-year.for": "Du warst am Neujahrstag unterwegs.",
	"badges.surprise.christmas-eve": "Heiligabend",
	"badges.surprise.christmas-eve.for": "Du warst an Heiligabend unterwegs.",
	"badges.surprise.christmas": "Weihnachten",
	"badges.surprise.christmas.for":
		"Du warst an den Weihnachtsfeiertagen unterwegs.",
	"badges.surprise.night-owl": "Nachteule",
	"badges.surprise.night-owl.for": "Du bist nach 21:30 Uhr losgefahren.",
	"badges.surprise.early-bird": "Frühaufsteher",
	"badges.surprise.early-bird.for": "Du bist vor 6 Uhr losgefahren.",
	"badges.surprise.rest-day": "Ruhetag",
	"badges.surprise.rest-day.for":
		"Eine Woche lang jeden Tag aktiv – und dann einen Tag Pause. Verdient!",
	"badges.surprise.day-off": "Teampause",
	"badges.surprise.day-off.for":
		"Ein Tag, an dem das ganze Team die Füße hochgelegt hat.",
	"badges.surprise.all-out": "Alle draußen",
	"badges.surprise.all-out.for":
		"Ein Tag, an dem wirklich alle unterwegs waren.",
	"badges.surprise.round-the-clock": "Rund um die Uhr",
	"badges.surprise.round-the-clock.for":
		"Zu jeder Stunde eines Tages war jemand aus dem Team unterwegs.",
	"badges.surprise.relay": "Staffelstab",
	"badges.surprise.relay.for":
		"30 Tage am Stück war jeden Tag jemand aus dem Team aktiv.",
	"badges.surprise.new-years-eve": "Silvesterrunde",
	"badges.surprise.new-years-eve.for":
		"Mindestens fünf aus dem Team waren an Silvester unterwegs.",
	"badges.surprise.sunday-outing": "Sonntagsausflug",
	"badges.surprise.sunday-outing.for":
		"Mindestens zehn aus dem Team an einem Sonntag ohne Teamtermin.",
	"badges.surprise.festive-500": "Festive 500",
	"badges.surprise.festive-500.for":
		"Zwischen Heiligabend und Silvester 500 Kilometer gefahren.",
	"badges.surprise.stage-rider": "Etappenfahrer",
	"badges.surprise.stage-rider.for":
		"Drei Tage am Stück je 100 Kilometer – wie auf der Tour.",
	"badges.surprise.triathlon": "Dreikampf",
	"badges.surprise.triathlon.for":
		"Radfahren, Laufen und Schwimmen an einem Tag.",
	"badges.surprise.pi-day": "Kreiszahl",
	"badges.surprise.pi-day.for":
		"Am Pi-Tag, dem 14. März, mindestens 31,4 Kilometer am Stück gefahren.",
	"badges.surprise.solstice": "Sonnenwende",
	"badges.surprise.solstice.for":
		"Draußen gefahren am kürzesten und am längsten Tag des Jahres.",
	"badges.surprise.easter": "Ostern",
	"badges.surprise.easter.for": "An Ostern unterwegs gewesen.",
	"badges.surprise.everesting": "Everesting",
	"badges.surprise.everesting.for":
		"In einem Monat 8.848 Höhenmeter gesammelt – einmal Mount Everest.",
	"badges.surprise.winter-sleep": "Winterschlaf",
	"badges.surprise.winter-sleep.for":
		"Deine erste Ausfahrt draußen im neuen Jahr.",
	"badges.surprise.festive-team": "Festive Team",
	"badges.surprise.festive-team.for":
		"Zwischen Heiligabend und Silvester ist das ganze Team gefahren.",
	"badges.value.half": "Halbmarathon",
	"badges.value.piRun": "Pi-Run",
	"badges.value.marathon": "Marathon",
	"notification.badge": "Neues Abzeichen: {name} 🏅",
	"notification.badges": "{n} neue Abzeichen 🏅",
	"notification.teamBadge": "Neues Team-Abzeichen: {name} 🏅",
	"notification.teamBadges": "{n} neue Team-Abzeichen 🏅",

	"privacy.link": "Datenschutz und Kontakt",
	"privacy.title": "Datenschutz",
	"privacy.updated": "Stand: {date}",
	"privacy.intro":
		"Hier steht, welche Daten RynkePoints verarbeitet, wozu, wer sie sieht, wie lange sie gespeichert werden und welche Rechte du hast.",
	"privacy.controller.heading": "Verantwortlich und Kontakt",
	"privacy.controller.body":
		"Verantwortlich für die Datenverarbeitung in RynkePoints ist:",
	"privacy.contact.body":
		"Für Fragen, Hilfe, Auskunft oder Löschung schreib an {email}.",
	"privacy.purpose.heading": "Wozu RynkePoints Daten verarbeitet",
	"privacy.purpose.body":
		"RynkePoints ist die Trainings-App von Team Rynkeby Hamburg. Sie liest die Eckdaten deiner Aktivitäten aus Strava, macht daraus Rynke (Trainingspunkte) und Abzeichen und zeigt sie dir, dem Team und den Organisatoren. Es gibt keine Werbung, keine Zahlungen, kein Tracking und keine Analyse-Werkzeuge. Daten werden weder verkauft noch weitergegeben und nicht für KI oder maschinelles Lernen verwendet.",
	"privacy.strava.heading": "Daten aus Strava",
	"privacy.strava.rider":
		"Zu dir: deine Strava-Athleten-ID, dein Vorname, die Berechtigungen, die du erteilt hast, und die Zugangsschlüssel (Tokens), verschlüsselt gespeichert.",
	"privacy.strava.rides":
		"Zu jeder Radfahrt: Aktivitäts-ID, Titel, Sportart, Startzeit und Zeitzone, Distanz, Bewegungs- und Gesamtzeit, Höhenmeter und ob sie manuell eingetragen, auf dem Rollentrainer gefahren, privat oder von Strava markiert ist.",
	"privacy.strava.runsSwims":
		"Zu jedem Lauf und jedem Schwimmen nur Aktivitäts-ID, Startzeit, Distanz und ob sie privat ist, für die Lauf- und Schwimmabzeichen.",
	"privacy.strava.private":
		"Gespeichert werden nur Aktivitäten ab Saisonbeginn, private („Nur du“) nur, wenn du die Berechtigung dafür erteilt hast.",
	"privacy.strava.never":
		"Nie gelesen oder gespeichert werden GPS-Spuren, Karten, Routen, Segmente, Fotos, Beschreibungen, Herzfrequenz, Leistung, Trittfrequenz, Kalorien oder andere Gesundheitsdaten, deine Follower und Daten anderer Athleten.",
	"privacy.strava.how":
		"Neue, geänderte und gelöschte Aktivitäten meldet Strava von selbst; RynkePoints fragt nicht regelmäßig nach. Einmal am Tag prüft RynkePoints, ob du noch Mitglied im Strava-Club des Teams bist.",
	"privacy.team.heading": "Daten vom Team und daraus berechnet",
	"privacy.team.body":
		"Die Organisatoren tragen ein, an welchen Teamterminen du teilgenommen hast, und können deine Rynke mit Grund und Datum korrigieren. Du kannst selbst melden, bei welchen Teamterminen du dabei bist oder warst; die Organisatoren sehen das und entscheiden, ob sie dich eintragen. Gespeichert wird auch, wer das wann geändert hat.",
	"privacy.team.derived":
		"Aus all dem berechnet RynkePoints deine Rynke, deine Abzeichen und welche Fahrten warum zählen.",
	"privacy.technical.heading": "Technisch nötige Daten",
	"privacy.technical.cookies":
		"Cookies: „rp_session“ hält dich angemeldet, bis 180 Tage nach deinem letzten Besuch; „rp_oauth_state“ schützt die Anmeldung bei Strava für 10 Minuten; „rp_lang“ merkt sich eine gewählte Sprache für ein Jahr. Andere Cookies und Tracker gibt es nicht.",
	"privacy.technical.push":
		"Benachrichtigungen sind freiwillig und gelten pro Gerät. Gespeichert wird nur die Adresse, die der Push-Dienst deines Geräts oder Browsers vergibt. Die Benachrichtigung selbst ist leer: Was sie anzeigt, holt dein Gerät direkt bei RynkePoints. Die Adresse wird gelöscht, wenn du Benachrichtigungen ausschaltest, dich auf dem Gerät abmeldest oder gehst.",
	"privacy.technical.logs":
		"Server-Protokolle enthalten nur Kennungen wie Athleten- und Aktivitäts-IDs und die Art eines Fehlers, nie Zugangsschlüssel oder Aktivitätsdaten. IP-Adressen speichert RynkePoints nicht.",
	"privacy.visibility.heading": "Wer was sieht",
	"privacy.visibility.you":
		"Du siehst deine eigenen Aktivitäten mit Titel, deine Rynke und deine Abzeichen. Die Titel sieht sonst niemand.",
	"privacy.visibility.team":
		"Das übrige Team sieht deine Rynke, insgesamt und pro Woche, ohne deinen Namen. Deine Kilometer und Höhenmeter und an welchen Tagen und zu welcher Stunde du aktiv bist zählen ohne Namen zu den Teamsummen und Team-Abzeichen.",
	"privacy.visibility.organisers":
		"Die Organisatoren sehen deinen Vornamen, deine Rynke und woher sie kommen, was dir noch fehlt, ob du dein Trainingsziel erreicht hast, deine Teamtermine und Korrekturen und bei welchen Teamterminen du gemeldet hast, dass du dabei bist oder warst, aber keine einzelnen Aktivitäten.",
	"privacy.visibility.public":
		"Nichts davon ist öffentlich: Jede Seite mit diesen Daten verlangt eine Anmeldung mit Strava.",
	"privacy.legal.heading": "Rechtsgrundlagen",
	"privacy.legal.body":
		"Das Lesen deiner Strava-Daten und das Teilen deiner Rynke wie beschrieben beruhen auf deiner Einwilligung, die du vor dem Verbinden gibst (Art. 6 Abs. 1 lit. a DSGVO). Teamtermine, Korrekturen, die technisch nötigen Cookies und die Protokolle beruhen auf dem berechtigten Interesse, das Training des Teams zu organisieren und die App sicher zu betreiben (Art. 6 Abs. 1 lit. f DSGVO; für Cookies § 25 Abs. 2 TDDDG).",
	"privacy.retention.heading": "Wie lange gespeichert wird",
	"privacy.retention.body":
		"Deine Daten bleiben gespeichert, solange du verbunden bist, und folgen dabei Strava: Löschst du eine Aktivität in Strava oder machst sie privat, ohne die Berechtigung dafür erteilt zu haben, verschwindet sie auch hier, sobald Strava das meldet, meist innerhalb von Minuten. Aktivitäten von vor dem Saisonbeginn werden gelöscht.",
	"privacy.retention.deletion":
		"Alle Daten zu dir werden auf einmal gelöscht, und der Zugang bei Strava wird widerrufen, wo er noch gilt, wenn du dich in der App trennst, RynkePoints in deinen Strava-Einstellungen entfernst, den Strava-Club des Teams verlässt (innerhalb von 24 Stunden) oder eine unterbrochene Verbindung nicht innerhalb von 7 Tagen erneuerst.",
	"privacy.retention.backups":
		"Danach bleiben die Daten höchstens 7 Tage in den automatischen Sicherungen der Datenbank und verschwinden dann. Server-Protokolle löscht Cloudflare nach höchstens 7 Tagen.",
	"privacy.album":
		"Am Ende jeder Saison erstellen wir für alle im Team ein Saisonalbum als PDF – aus den Daten, die du in der App siehst, und Summen über das ganze Team. Das geschieht auf dem Rechner der verantwortlichen Person, nicht bei Cloudflare. Dein Album bekommst nur du, danach wird es gelöscht.",
	"privacy.recipients.heading": "Wer die Daten verarbeitet",
	"privacy.recipients.cloudflare":
		"RynkePoints läuft bei Cloudflare, Inc. als Auftragsverarbeiter: Webserver, Warteschlange und Datenbank. Cloudflare verarbeitet dabei technisch bedingt deine IP-Adresse, um die Seiten auszuliefern und vor Angriffen zu schützen. Cloudflare hat Rechenzentren weltweit, auch in den USA; für Übermittlungen dorthin ist Cloudflare nach dem EU-US Data Privacy Framework zertifiziert, und es gelten die EU-Standardvertragsklauseln.",
	"privacy.recipients.push":
		"Die Push-Dienste der Geräte- und Browserhersteller (etwa Google, Apple, Mozilla, Microsoft) erhalten nur leere Benachrichtigungen an die Adresse deines Geräts.",
	"privacy.recipients.strava":
		"Für die Daten in deinem Strava-Konto ist Strava selbst verantwortlich. Es gilt die {stravaPrivacy}; sie hat Vorrang, wenn sie dieser Erklärung widerspricht.",
	"privacy.recipients.stravaPrivacy": "Datenschutzerklärung von Strava",
	"privacy.recipients.usage":
		"Strava kann Nutzungsdaten darüber erheben, wie RynkePoints die Strava-Schnittstelle nutzt, und sie für beliebige geschäftliche Zwecke verwenden, etwa um die Schnittstelle und die Strava-Plattform zu verbessern, Support zu leisten oder die Einhaltung seiner Bedingungen zu prüfen.",
	"privacy.links.heading": "Links zu Strava",
	"privacy.links.body":
		"Links zu Strava führen auf Seiten, die Strava betreibt und für deren Inhalt allein Strava verantwortlich ist. RynkePoints macht sich diese Inhalte nicht zu eigen und hat keinen Einfluss auf sie. Erfahren wir von rechtswidrigen Inhalten auf einer verlinkten Seite, entfernen wir den Link.",
	"privacy.rights.heading": "Deine Rechte",
	"privacy.rights.body":
		"Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15 bis 21 DSGVO). Deine Einwilligung kannst du jederzeit widerrufen, am einfachsten, indem du dich in der App trennst; was bis dahin geschah, bleibt rechtmäßig. Du kannst dich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren, insbesondere dort, wo du wohnst. Für alle Anliegen erreichst du uns unter {email}.",
	"privacy.changes.heading": "Änderungen",
	"privacy.changes.body":
		"Ändert sich, welche Daten RynkePoints liest oder wer sie sieht, bitten wir dich erneut um deine Einwilligung, bevor die App dir wieder etwas zeigt.",
	// Feature 019: team-event reports (contracts/messages.md).
	"nav.events": "Termine",
	"nav.organiser.open": "Orga, {n} offene Meldungen",
	"events.heading": "Teamtermine 📅",
	"events.until": "bis {date}",
	"events.note.title": "Melde dich hier selbst an",
	"events.note.body":
		"Deine Teilnahme an Teamterminen können wir noch nicht aus Spond oder Strava übernehmen. Sag hier Bescheid, bei welchen Terminen du dabei bist oder warst.",
	"events.upcoming": "Demnächst",
	"events.upcoming.hint":
		"„Bin dabei“ sagt der Orga nur Bescheid. Rynke gibt es erst, wenn der Termin vorbei ist und die Orga dich eingetragen hat. Bis dahin kannst du jederzeit wieder absagen.",
	"events.upcoming.none": "Noch sind keine Teamtermine geplant.",
	"events.past": "Vorbei",
	"events.past.none": "In dieser Saison war noch kein Teamtermin.",
	"events.past.all": "Alle zeigen",
	"events.amount.team": "+{n} Team",
	"events.amount.training": "+{n} Training",
	"events.join": "Bin dabei",
	"events.leave": "Doch nicht dabei",
	"events.joined.label": "Bin dabei. Antippen, um abzusagen.",
	"events.report": "Ich war dabei",
	"events.reported.label": "Ich war dabei, gemeldet",
	"events.attended": "Du warst dabei",
	"events.error.event_over": "Der Termin ist vorbei, absagen geht nicht mehr.",
	"events.error.already_attending":
		"Du bist bei diesem Termin schon eingetragen.",
	"events.error.event_missing": "Diesen Termin gibt es nicht mehr.",
	"organiser.switch.events.open": "Termine, {n} offene Meldungen",
	"organiser.requests.heading": "{n} offene Meldungen ⏳",
	"organiser.requests.heading.one": "1 offene Meldung ⏳",
	"organiser.requests.intro":
		"Rider sagen, sie waren dabei – bei {n} Terminen.",
	"organiser.requests.intro.one":
		"Rider sagen, sie waren dabei – bei einem Termin.",
	"organiser.requests.open": "Termin öffnen",
	"organiser.requests.confirm": "Eintragen",
	"organiser.requests.confirm.label": "{name} bei {event} eintragen",
	"organiser.requests.deny.label": "Meldung von {name} bei {event} ablehnen",
	"organiser.requests.confirmAll": "Alle {n} eintragen",
	"organiser.requests.wants": "⏳ Will eingetragen werden: {event}",
	"organiser.done.confirmed": "{names} eingetragen.",
	"organiser.done.denied": "Meldung von {names} abgelehnt.",
	"organiser.done.undone": "Rückgängig gemacht.",
	"organiser.done.attendance.reports":
		"Gespeichert: {yes} eingetragen, {no} abgelehnt, {open} offen.",
	"organiser.undo": "Rückgängig",
	"organiser.error.request_settled":
		"Diese Meldung hat schon jemand anders erledigt.",
	"organiser.error.undo_expired":
		"Das lässt sich nicht mehr rückgängig machen.",
	"organiser.events.attendees.you": "{count}\u00a0Personen, inklusive dir",
	"organiser.events.intents": "{count} zugesagt",
	"organiser.events.open": "⏳ {count} offen",
	"organiser.events.self": "Ich war auch dabei",
	"organiser.events.upcoming": "Demnächst",
	"organiser.events.past": "Vorbei",
	"organiser.attendance.headingFuture": "Wer kommt?",
	"organiser.attendance.count": "{count} dabei",
	"organiser.attendance.countFuture": "{count} zugesagt",
	"organiser.attendance.legend": "Was die Kästchen zeigen",
	"organiser.attendance.legend.empty": "Leer – nicht dabei",
	"organiser.attendance.legend.grey": "Grau – Meldung, noch offen",
	"organiser.attendance.legend.greyFuture": "Grau – zugesagt",
	"organiser.attendance.legend.checked": "Haken – dabei, gibt Rynke",
	"organiser.attendance.confirmAll": "Alle {n} Meldungen eintragen",
	"organiser.attendance.tag.open": "Meldung offen",
	"organiser.attendance.tag.yes": "wird eingetragen",
	"organiser.attendance.tag.no": "wird abgelehnt",
	"organiser.attendance.tag.intent": "zugesagt",
	"organiser.attendance.summary":
		"Meldungen: {yes} werden eingetragen, {no} abgelehnt, {open} offen",
	"organiser.overview.group.requests": "Rider mit offener Meldung",
	"organiser.overview.column.requests": "Meldung",
	// The Overview's progress charts (feature 009 contracts/messages.md).
	"progress.heading": "Dein Saisonverlauf",
	"progress.rules":
		"Berechnet mit den Regeln Version {version}, für die ganze Saison.",
	"progress.nothingYet": "Du hast in dieser Saison noch keine Rynke gesammelt.",
	"progress.periods.label": "Zeitraum",
	"progress.period.season": "Ganze Saison",
	"progress.period.3m": "Letzte 3 Monate",
	"progress.period.4w": "Letzte 4 Wochen",
	"progress.chart.training":
		"Trainingsrynke vom {from} bis {to}: {value} am Ende, Ziel {threshold}",
	"progress.chart.team":
		"Teamrynke vom {from} bis {to}: {value} am Ende, Ziel {threshold}",
	"progress.legend.threshold": "Ziel ({value})",
	"progress.help":
		"Pfeiltasten wählen einen Tag, + und − zoomen, Bild auf/ab verschiebt, 0 zeigt die ganze Saison.",
	"progress.day": "{date} · {training} Trainingsrynke · {team} Teamrynke",
	"progress.table.summary": "Zahlen als Tabelle",
	"progress.table.week": "Woche ab",
	"progress.table.total": "Summe",
	"progress.legend.pace": "Gleichmäßiges Tempo bis zum Stichtag",
	"progress.legend.needed": "Nötig draußen ({value})",
	"progress.day.ahead": "{n} vor dem Tempo ({pace})",
	"progress.day.behind": "{n} hinter dem Tempo ({pace})",
	"progress.day.onPace": "genau im Tempo ({pace})",
	"progress.day.series": "{series}: {text}",
	"progress.day.outside": "davon draußen: {value}",

	// The season album (feature 021 US4, US5, contracts/messages.md). Printed,
	// never shown in the app.
	"album.title": "Rynke-Album",
	"album.team.name": "Team Rynkeby Hamburg",
	"album.season": "Saison {season}",
	"album.owner": "Dieses Album gehört",
	"album.coin": "Die Rynke-Münze",
	"album.rider.training": "Trainingsrynke",
	"album.rider.team": "Teamrynke",
	"album.rider.events": "Teamtermine dabei",
	"album.team.heading": "Die Saison des Teams",
	"album.team.training": "{count} Trainingsrynke zusammen",
	"album.events.date": "Datum",
	"album.events.kind": "Art",
	"album.events.name": "Name",
	"album.events.riders": "Rider",
	"album.events.you": "Du",
	"album.events.attended": "dabei",
	"album.events.none": "Noch keine Teamtermine.",
	"album.events.count": "{count} Teamtermine, davon {tour} Tage Tour de Paris",
	"album.events.noTour": "{count} Teamtermine, noch keine Tour-Tage",
	"album.events.yours": "du warst dabei ({count})",
	"album.continued": "{title} (Fortsetzung)",
	"album.stickers.mine": "Meine Abzeichen",
	"album.stickers.team": "Team-Abzeichen",
	"album.stickers.count": "{earned} von {total}",
	"album.stickers.secret": "?",
	"album.cutoff": "Stand: {date}",
} satisfies Record<string, string>;
