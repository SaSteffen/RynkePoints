// German source catalog (research R16). Its keys define `MessageId`; every other
// catalog must have exactly these keys. Inventory: contracts/messages.md.

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
		"RynkePoints sammelt die Radfahrten von Team Rynkeby Hamburg für Punkte und Events.",
	"landing.who": "Mitmachen können nur Mitglieder {clubLink}.",
	"club.linkText": "unseres Team-Clubs auf Strava",
	"landing.dataRead":
		"Wir lesen von deinen Radfahrten nur Namen, Sportart, Startzeit, Distanz, Bewegungszeit, Gesamtzeit mit Pausen, Höhenmeter, ob die Fahrt manuell eingetragen oder auf dem Rollentrainer gefahren wurde und ob Strava sie markiert hat – keine GPS-Spuren, Karten, Fotos oder Gesundheitsdaten.",
	"landing.private":
		"Auf Strava entscheidest du selbst, ob auch deine privaten („Nur du“) Aktivitäten dazugehören: Strava nennt das Anzeigen deiner privaten Aktivitäten. Wenn du das abwählst, zählen deine privaten Fahrten nicht für Rynke.",
	"landing.purpose":
		"Wir nutzen die Daten nur für die Rynke (Punkte) und Events des Teams. Deine einzelnen Fahrten und ihre Namen sieht niemand außer dir.",
	"landing.leave":
		"Du kannst jederzeit aussteigen: auf deiner RynkePoints-Seite oder indem du RynkePoints in deinen Strava-Einstellungen entfernst. Dann löschen wir alle Daten über dich, auch deine Rynke; auf deiner RynkePoints-Seite bestätigen wir dir das sofort. Wenn du den Club verlässt, löschen wir deine Daten innerhalb von 24 Stunden.",
	"landing.backups":
		"Gelöschte Daten bleiben bis zu 7 Tage in den Sicherungen unseres Hosting-Anbieters und verschwinden danach automatisch.",
	"landing.cookies":
		"Wir setzen nur notwendige Cookies: für die Anmeldung und für deine Sprachwahl.",
	"landing.notifications":
		"Benachrichtigungen sind freiwillig und gelten pro Gerät. Sie zeigen nur auf deinem Gerät, wie viele Rynke neu sind und was dir noch fehlt. Sie laufen über den Benachrichtigungsdienst des Geräte- oder Browserherstellers (z. B. Google, Apple, Mozilla, Microsoft). Wir speichern dafür nur die Adresse, die dieser Dienst deinem Gerät gibt, und löschen sie, wenn du die Benachrichtigungen ausschaltest, dich abmeldest oder gehst.",

	"consent.heading": "Was du mit dem Verbinden erlaubst",
	"consent.organisers":
		"Die Organisatorinnen und Organisatoren des Teams sehen deinen Vornamen von Strava, deine Rynke mit Aufschlüsselung, was dir noch fehlt, ob du dich qualifiziert hast, deine Teilnahme an Team-Events und Korrekturen.",
	"consent.team":
		"Alle anderen im Team sehen deine gesammelten Rynke, insgesamt und pro Woche, ohne deinen Namen.",
	"consent.required": "Lesen und Teilen sind Voraussetzung fürs Mitmachen.",
	"consent.write":
		"Freiwillig kannst du RynkePoints auf Strava erlauben, deine Aktivitäten zu bearbeiten. Sobald es die Funktion gibt, schreiben wir dann einen kurzen Rynke-Abschnitt in die Beschreibung deiner Fahrten; deinen eigenen Text ändern wir nie. Den Abschnitt sieht, wer die Fahrt auf Strava sehen darf. Strava nennt diese Erlaubnis das Hochladen von Aktivitäten zu Strava; RynkePoints lädt nie Aktivitäten hoch. Ohne diese Erlaubnis machst du genauso mit, du kannst sie also abwählen.",
	"consent.agree":
		"Ich bin einverstanden, dass RynkePoints meine Fahrten liest und meine Rynke wie beschrieben teilt.",

	"me.title": "Deine RynkePoints",
	"me.greeting": "Hallo {firstName}! 🦧",
	"me.status.connected": "Mit Strava verbunden",
	"me.status.needsReconnect": "Die Verbindung zu Strava muss erneuert werden.",
	"me.reconnect": "Erneut verbinden",
	"me.scope.readAll": "Einschließlich deiner privaten Aktivitäten",
	"me.scope.sharedOnly":
		"Nur geteilte Aktivitäten – private („Nur du“) Aktivitäten werden nicht importiert.",
	"me.scope.write":
		"Schreibzugriff erteilt: Sobald es die Funktion gibt, schreibt RynkePoints einen Rynke-Abschnitt in deine Fahrtbeschreibungen.",
	"me.scope.noWrite":
		"Kein Schreibzugriff: RynkePoints schreibt nichts in deine Fahrtbeschreibungen.",
	"me.changePermissions": "Berechtigungen auf Strava ändern",
	"me.consent.heading": "Deine Zustimmung",
	"me.consent.accepted": "Zugestimmt am {date} (Version {version}):",
	"me.consent.none":
		"Für dich ist noch keine Zustimmung gespeichert. Lies bitte, was du mit dem Verbinden erlaubst, und stimme zu; Strava fragt dann noch einmal nach deinen Berechtigungen. Bis dahin sieht niemand im Team etwas von dir.",
	"me.consent.renew.heading": "Bitte stimme erneut zu",
	"me.consent.renew.older":
		"Du hast am {date} Version {accepted} zugestimmt. Version {version} ändert Folgendes:",
	"me.consent.renew.strava":
		"Dafür braucht RynkePoints eine weitere Berechtigung; Strava fragt dich danach.",
	"me.consent.renew.button": "Zustimmen und weiter",
	"me.consent.renew.leave":
		"Wenn du nicht zustimmen möchtest, kannst du die Verbindung trennen; dabei werden alle deine Daten gelöscht.",
	"me.recent.heading": "Deine Fahrten",
	"me.recent.none": "Noch keine Fahrten in dieser Saison.",
	"me.recent.col.distance": "Distanz",
	"me.disconnect.button": "Verbindung trennen und meine Daten löschen",

	"units.km": "{value} km",
	"units.m": "{value} m",
	"units.percent": "{value} %",
	"units.kmh": "{value} km/h",
	"units.mPerH": "{value} m/h",
	"units.duration": "{h} h {min} min",
	"units.durationMin": "{min} min",
	"sport.Ride": "Radfahrt",
	"sport.MountainBikeRide": "Mountainbike-Fahrt",
	"sport.GravelRide": "Gravel-Fahrt",
	"sport.EBikeRide": "E-Bike-Fahrt",
	"sport.EMountainBikeRide": "E-Mountainbike-Fahrt",
	"sport.VirtualRide": "Virtuelle Fahrt",

	"rynke.training": "Trainingsrynke",
	"rynke.team": "Teamrynke",
	"rynke.withoutVirtual": "Trainingsrynke ohne virtuelle Fahrten",
	"waiting.heading": "Deine Fahrten werden geholt",
	"waiting.body":
		"Weil du dich gerade verbunden hast, holen wir einmalig deine Fahrten seit dem {date} von Strava. Das passiert nur dieses eine Mal. Schau in etwa 5 Minuten wieder vorbei – diese Seite aktualisiert sich von selbst.",
	"rynke.summary.heading": "Deine Rynke",
	"rynke.verdict.in":
		"Du bist dabei: Du hast alles, was du für die Tour brauchst. Auf nach Paris! 🗼",
	"rynke.verdict.notYet": "Noch nicht dabei 🍌 Dir fehlen:",
	"rynke.missing.training": "{n} Trainingsrynke",
	"rynke.missing.team": "{n} Teamrynke",
	"rynke.missing.withoutVirtual":
		"{n} Trainingsrynke aus Fahrten draußen (nicht virtuell)",
	"rynke.summary.ofTarget": "{value} von {target}",
	"rynke.summary.missing": "{n} fehlen noch",
	"rynke.summary.reached": "erreicht ✓",
	"rynke.rides.col.elevationTotal": "Für die Höhenmeter",
	"rynke.rides.position": "Fahrten {from}–{to} von {total}",
	"rynke.pager.label": "Seiten",
	"rynke.pager.first": "« Neueste",
	"rynke.pager.previous": "‹ Neuere",
	"rynke.pager.next": "Ältere ›",
	"rynke.pager.last": "Älteste »",
	"rynke.notice.updating":
		"Die Regeln haben sich geändert: Seit dem {date} gelten neue Regeln. Deine Zahlen werden gerade neu berechnet; bis dahin siehst du sie nach Regel-Version {version}.",
	"rynke.rules.heading": "Regeln",
	"rynke.rules.version":
		"Berechnet nach Regel-Version {version}, gültig seit dem {date}.",
	"rynke.rules.window": "Es zählt alles ab dem {start}.",
	"rynke.rules.windowDeadline":
		"Es zählt alles vom {start} bis zum {deadline}.",
	"rynke.rules.handout": "So funktionieren die Rynke (Regeln zum Nachlesen)",
	"rynke.ride.counts": "zählt 🪙",
	"rynke.ride.doesNotCount": "zählt nicht",
	"rynke.ride.beingEvaluated": "🦧 wird ausgewertet",
	"rynke.ride.virtual": "virtuell",
	"rynke.ride.fixHint":
		"Du kannst die Fahrt auf Strava korrigieren oder dich an das Orga-Team wenden.",
	"rynke.reason.flagged":
		"Strava hat die Fahrt markiert. Wenn du anderer Meinung bist, kläre das bitte mit Strava.",
	"rynke.reason.pause":
		"Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit – mehr als die Hälfte ist nicht erlaubt.",
	"rynke.reason.pause.share":
		"Zu lange Pause: {paused} Pause bei {moving} Bewegungszeit – mehr als {share} ist nicht erlaubt.",
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
	"rynke.reason.excluded_sport_type": "{sport} zählt nicht für die Rynke.",
	"rynke.reason.outside_window": "Vor dem Saisonstart am {date}.",
	"rynke.reason.outside_window.afterDeadline": "Nach dem Stichtag am {date}.",
	"rynke.reason.outside_window.afterDeadlineNoDate": "Nach dem Stichtag.",
	"rynke.reason.overlap":
		"Doppelt aufgezeichnet: Deine Fahrt vom {date}, {time} Uhr, {distance} zählt stattdessen.",
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
		"Höhenmeter bis zu den nächsten {stepRynke} Trainingsrynke: {value} von {target} · {percent} · noch {missing}",
	"rynke.source.distance": "Distanz",
	"rynke.source.elevation": "Höhenmeter",
	"rynke.source.team_training": "Teamtraining",
	"rynke.source.training_weekend_day": "Tag Trainingswochenende",
	"rynke.source.technique_training": "Techniktraining",
	"rynke.breakdown.heading": "Woher deine Rynke kommen",
	"rynke.breakdown.trainingRynke": "{n} Trainingsrynke",
	"rynke.breakdown.elevation":
		"{metres} gesamt → {rynke} Trainingsrynke, noch {toNext} bis zu den nächsten {stepRynke}",
	"rynke.breakdown.elevationNoStep":
		"{metres} gesamt → {rynke} Trainingsrynke, noch {toNext} bis zur nächsten Stufe",
	"rynke.breakdown.total": "Gesamt",
	"rynke.breakdown.totals": "{training} Trainingsrynke · {team} Teamrynke",
	"rynke.breakdown.kind":
		"{count} × dabei → {team} Teamrynke, {training} Trainingsrynke",
	"rynke.events.heading": "Deine Teamtermine",
	"rynke.events.none": "Für dich ist noch kein Teamtermin eingetragen.",
	"rynke.events.notCounting": "zählt nicht: außerhalb des Wertungszeitraums",

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
	"notice.consentRequired.title": "Bitte stimme zuerst zu",
	"notice.consentRequired.body":
		"Ohne deine Zustimmung können wir dich nicht verbinden. Lies auf der Startseite, was RynkePoints liest und teilt, und setze den Haken.",
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
	"push.rise.training": "+{n} Trainingsrynke",
	"push.rise.team": "+{n} Teamrynke",
	"notifications.heading": "Benachrichtigungen",
	"notifications.explain":
		"Auf Wunsch sagt dir dieses Gerät Bescheid, wenn du neue Rynke hast: wie viele und was dir noch fehlt.",
	"notifications.on": "Benachrichtigungen sind auf diesem Gerät an.",
	"notifications.off": "Benachrichtigungen sind auf diesem Gerät aus.",
	"notifications.blocked":
		"Benachrichtigungen bleiben aus, weil dein Gerät sie für RynkePoints blockiert. Du kannst sie in den Einstellungen des Browsers oder Geräts erlauben.",
	"notifications.needsHomeScreen":
		"Auf dem iPhone gibt es Benachrichtigungen nur, wenn RynkePoints auf dem Home-Bildschirm liegt. Öffne es dann von dort.",
	"notifications.unsupported":
		"Dieser Browser kann keine Benachrichtigungen anzeigen.",
	"notifications.failed":
		"Das hat nicht geklappt. Versuch es bitte noch einmal.",

	// Feature 011: the app shell's sections, navigation and Settings groups.
	// Strava ships its white assets in English only, as with the others.
	"nav.label": "Bereiche",
	"nav.overview": "Übersicht",
	"nav.rides": "Fahrten",
	"nav.team": "Team",
	"nav.settings": "Einstellungen",
	"shell.refresh": "Aktualisieren",
	"shell.title": "{section} – RynkePoints",
	"team.placeholder.heading": "Die Teamansicht kommt bald",
	"team.placeholder.body":
		"Hier siehst du bald, wie es im ganzen Team auf dem Weg von Hamburg nach Paris läuft. 🦧🚴",
	"hero.training": "{n} Trainingsrynke",
	"hero.team": "und {n} Teamrynke – auf dem Weg nach Paris",
	"celebrate.training": "+{n} Trainingsrynke seit deinem letzten Besuch 🎉",
	"celebrate.team": "+{n} Teamrynke seit deinem letzten Besuch 🎉",
	"celebrate.both":
		"+{training} Trainingsrynke und +{team} Teamrynke seit deinem letzten Besuch 🎉",
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
	"organiser.link": "Zu den Orga-Seiten",
	"organiser.back": "Zurück zu den Terminen",
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
		"Das löscht den Termin und seine Teilnahmen; die Rynke der Fahrenden passen sich an.",
	"organiser.event.deleteConfirm": "Ja, löschen",
	"organiser.attendance.heading": "Wer war dabei?",
	"organiser.attendance.save": "Teilnahme speichern",
	"organiser.attendance.profile": "Auf Strava ansehen",
	"organiser.attendance.future":
		"Die Teilnahme lässt sich eintragen, sobald der Termin war.",
	"organiser.attendance.none":
		"Noch ist niemand verbunden, der seine Daten mit dem Team teilt.",
	"organiser.riders.link": "Fahrende und Korrekturen",
	"organiser.riders.heading": "Fahrende",
	"organiser.riders.none":
		"Noch ist niemand verbunden, der seine Daten mit dem Team teilt.",
	"organiser.riders.back": "Zurück zu den Fahrenden",
	"organiser.corrections.heading": "Korrekturen für {name}",
	"organiser.corrections.none": "Noch keine Korrekturen.",
	"organiser.corrections.new": "Neue Korrektur",
	"organiser.corrections.training": "{amount} Trainingsrynke",
	"organiser.corrections.team": "{amount} Teamrynke",
	"organiser.field.training": "Trainingsrynke (+ oder −, leer ist 0)",
	"organiser.field.team": "Teamrynke (+ oder −, leer ist 0)",
	"organiser.field.reason": "Grund",
	"organiser.corrections.remove": "Entfernen…",
	"organiser.corrections.removeWarning":
		"Das entfernt die Korrektur; die Rynke der Person passen sich an.",
	"organiser.corrections.removeConfirm": "Ja, entfernen",
} satisfies Record<string, string>;
