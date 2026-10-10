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
		"Wir lesen nur die Eckdaten deiner Radfahrten wie Distanz, Zeit und Höhenmeter und machen daraus Rynke.",
	"consent.short.shown":
		"Das Team sieht deine Rynke ohne Namen, die Orga mit deinem Vornamen.",
	"consent.details": "Alle Details",
	"consent.organisers":
		"Die Orga sieht deinen Vornamen von Strava, deine Rynke und woher sie kommen, was dir noch fehlt, ob du dein Trainingsziel erreicht hast, deine Teamtermine und Korrekturen.",
	"consent.team":
		"Alle anderen im Team sehen deine Rynke, insgesamt und pro Woche, ohne deinen Namen.",
	"consent.required": "Lesen und Teilen sind Voraussetzung fürs Mitmachen.",
	"consent.write":
		"Freiwillig: Strava fragt auch, ob RynkePoints Aktivitäten hochladen darf. Wir laden nie etwas hoch, sondern schreiben damit später einen kurzen Rynke-Abschnitt in deine Fahrtbeschreibungen, sichtbar für alle, die die Fahrt sehen dürfen. Deinen eigenen Text ändern wir nie. Ohne diese Erlaubnis machst du genauso mit.",
	"consent.agree":
		"Ich bin einverstanden, dass RynkePoints meine Fahrten liest und meine Rynke wie beschrieben teilt.",

	"me.title": "Deine RynkePoints",
	"me.greeting": "Hallo {firstName}! 🦧",
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
	"me.disconnect.button": "Verbindung trennen und meine Daten löschen",

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
	"rynke.verdict.notYet": "Noch nicht qualifiziert 🍌",
	"rynke.verdict.missing": "Dir fehlen noch:",
	"rynke.missing.training": "{n}\u00a0Trainingsrynke",
	"rynke.missing.team": "{n}\u00a0Teamrynke",
	"rynke.missing.withoutVirtual": "{n}\u00a0Trainingsrynke draußen",
	"rynke.rides.col.elevationTotal": "Gezählte Höhenmeter",
	"rynke.rides.position": "Fahrten {from}–{to} von {total}",
	"rynke.pager.label": "Seiten",
	"rynke.pager.first": "« Neueste",
	"rynke.pager.previous": "‹ Neuere",
	"rynke.pager.next": "Ältere ›",
	"rynke.pager.last": "Älteste »",
	"rynke.notice.updating":
		"Seit dem {date} gelten neue Regeln. Deine Rynke werden gerade neu berechnet; bis dahin siehst du sie nach Regel-Version\u00a0{version}.",
	"rynke.rules.heading": "Regeln",
	"rynke.rules.version":
		"Regel-Version\u00a0{version}, gültig seit dem {date}.",
	"rynke.rules.windowDeadline":
		"Es zählt alles vom {start} bis zum {deadline}.",
	"rynke.rules.handout": "Die Regeln als PDF",
	"rynke.ride.counts": "zählt 🪙",
	"rynke.ride.doesNotCount": "zählt nicht",
	"rynke.ride.beingEvaluated": "🦧 wird ausgewertet",
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
	"rynke.gauge.reached": "✓ erreicht",
	"rynke.gauge.elevation":
		"Höhenmeter: {value} von {target}, noch {missing} bis +{stepRynke}\u00a0Trainingsrynke",
	"rynke.source.distance": "Distanz",
	"rynke.source.elevation": "Höhenmeter",
	"rynke.source.team_training": "Teamtraining",
	"rynke.source.training_weekend_day": "Tag Trainingswochenende",
	"rynke.source.technique_training": "Techniktraining",
	"rynke.breakdown.heading": "Woher deine Rynke kommen",
	"rynke.breakdown.trainingRynke": "{n}\u00a0Trainingsrynke",
	"rynke.breakdown.elevation": "{metres} → {rynke}\u00a0Trainingsrynke",
	"rynke.breakdown.kind":
		"{count}× dabei → {team}\u00a0Teamrynke, {training}\u00a0Trainingsrynke",
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
	"prompt.install.text":
		"Hol dir RynkePoints als App auf deinen Startbildschirm.",
	"prompt.notify.text":
		"Sollen wir dir Bescheid sagen, wenn du neue Rynke bekommst?",
	"prompt.notify.accept": "Benachrichtigungen einschalten",
	"prompt.notify.decline": "Nicht jetzt",
	"prompt.close": "Schließen",
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
	"nav.organiser": "Orga",
	"nav.settings": "Einstellungen",
	"shell.refresh": "Aktualisieren",
	"shell.title": "{section} – RynkePoints",
	"hero.training": "{n}\u00a0Trainingsrynke",
	"hero.team": "{n}\u00a0Teamrynke",
	"celebrate.training":
		"+{n}\u00a0Trainingsrynke seit deinem letzten Besuch 🎉",
	"celebrate.team": "+{n}\u00a0Teamrynke seit deinem letzten Besuch 🎉",
	"celebrate.both":
		"+{training}\u00a0Trainingsrynke und +{team}\u00a0Teamrynke seit deinem letzten Besuch 🎉",
	"landing.tagline": "Sammle deine Rynke 🦧",
	"settings.language": "Sprache",
	"settings.appearance": "Darstellung",
	"settings.scheme.system": "System",
	"settings.scheme.light": "Hell",
	"settings.scheme.dark": "Dunkel",
	"settings.appearance.hint": "Gilt nur für dieses Gerät.",
	"settings.app": "App",
	"settings.strava": "Strava-Verbindung",
	"settings.account": "Konto",
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
	"organiser.events.attendees": "{count} dabei",
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
	"team.total.label": "Team Rynkeby Hamburg 🦧",
	"team.total.value": "{n}\u00a0Rynke",
	"team.total.kind": "gemeinsam gesammelt",
	"team.total.thisWeek": "+{n} diese Woche 🔥",
	"team.kind.label": "Welche Rynke",
	"team.kind.training": "Training",
	"team.kind.team": "Team",
	"team.place": "Du bist {place} von {count} 🚴",
	"team.place.joint": "Du bist gemeinsam {place} von {count} 🚴",
	"team.place.next": "Noch {n}\u00a0Rynke bis zum nächsten Platz",
	"team.place.lead": "Du führst das Peloton an. Nimm die anderen mit!",
	"team.quote.push": "Für dich 🍌",
	"team.quote.onTrack": "Für dich 🤝",
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
	"team.list.you": "Du 🦧",
	"team.list.weeks": "Woche für Woche: {values}",
	"team.chart.heading": "Das Team, Woche für Woche",
	"team.chart.hint":
		"Alle Rynke des Teams zusammengezählt, Stand am Ende jeder Woche.",
	"team.chart.now": "diese Woche",
	"team.chart.label":
		"{kind} des Teams am Ende jeder Woche, {weeks} Wochen, jetzt {total}",
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
	"organiser.overview.group.push": "Braucht Schwung 🍌",
	"organiser.overview.group.notYet": "Trainingsziel noch nicht erreicht",
	"organiser.overview.group.onTrack": "Gut unterwegs 🚴",
	"organiser.overview.group.in": "Trainingsziel erreicht 🎯",
	"organiser.overview.group.all": "Alle",
	"organiser.overview.showing": "Angezeigt: {group}",
	"organiser.overview.hint":
		"Der Strich auf jedem Balken zeigt das gleichmäßige Tempo bis zum Stichtag: heute {training} Training und {team} Team.",
	"organiser.overview.training": "Training {n} von {threshold}",
	"organiser.overview.team": "Team {n} von {threshold}",
	"organiser.overview.outdoor": "Training draußen {n} von {required}",
	"organiser.overview.toGo.training": "Noch {n} Training",
	"organiser.overview.toGo.team": "Noch {n} Team",
	"organiser.overview.toGo.outdoor": "Noch {n} Training draußen",
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
	"organiser.overview.column.outdoor": "Draußen",
	"organiser.overview.column.missing": "Fehlt noch",
	"organiser.overview.column.distance": "Distanz",
	"organiser.overview.column.elevation": "Höhenmeter",
	"organiser.overview.column.events": "Termine",
	"organiser.overview.column.corrections": "Korrekturen",
	"organiser.overview.column.virtual": "Virtuell",
} satisfies Record<string, string>;
