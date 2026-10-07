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
	"me.greeting": "Hallo {firstName}!",
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
		"Für dich ist noch keine Zustimmung gespeichert. Melde dich ab und verbinde dich auf der Startseite neu, um zuzustimmen.",
	"me.import.done": "Import abgeschlossen",
	"me.recent.heading": "Deine Fahrten",
	"me.recent.empty": "Noch keine Fahrten importiert",
	"me.recent.col.date": "Datum",
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
	"rynke.notice.notWorkedOut":
		"Deine Rynke werden gerade berechnet. Schau in ein paar Minuten wieder vorbei.",
	"rynke.summary.heading": "Deine Rynke",
	"rynke.verdict.in":
		"Du bist dabei: Du hast alles, was du für die Tour brauchst.",
	"rynke.verdict.notYet": "Noch nicht dabei. Dir fehlen:",
	"rynke.missing.training": "{n} Trainingsrynke",
	"rynke.missing.team": "{n} Teamrynke",
	"rynke.missing.withoutVirtual":
		"{n} Trainingsrynke aus Fahrten draußen (nicht virtuell)",
	"rynke.summary.ofTarget": "{value} von {target}",
	"rynke.summary.missing": "{n} fehlen noch",
	"rynke.summary.reached": "erreicht ✓",
	"rynke.rides.col.status": "Zählt?",
	"rynke.rides.col.elevationTotal": "Für die Höhenmeter",
	"rynke.rides.position": "Fahrten {from}–{to} von {total}",
	"rynke.pager.label": "Seiten",
	"rynke.pager.first": "« Neueste",
	"rynke.pager.previous": "‹ Neuere",
	"rynke.pager.next": "Ältere ›",
	"rynke.pager.last": "Älteste »",
	"rynke.notice.updating":
		"Die Regeln haben sich geändert: Seit dem {date} gelten neue Regeln. Deine Zahlen werden gerade neu berechnet; bis dahin siehst du sie nach Regel-Version {version}.",
	"rynke.notice.importing":
		"Deine Fahrten seit dem {date} werden noch importiert. Deine Rynke wachsen, sobald sie da sind.",
	"rynke.rules.heading": "Regeln",
	"rynke.rules.version":
		"Berechnet nach Regel-Version {version}, gültig seit dem {date}.",
	"rynke.rules.window": "Es zählt alles ab dem {start}.",
	"rynke.rules.windowDeadline":
		"Es zählt alles vom {start} bis zum {deadline}.",
	"rynke.rules.handout": "So funktionieren die Rynke (Regeln zum Nachlesen)",
	"rynke.ride.counts": "zählt",
	"rynke.ride.doesNotCount": "zählt nicht",
	"rynke.ride.beingEvaluated": "wird ausgewertet",
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
	"rynke.gauges.heading": "Dein Fortschritt",
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
	// the device only through /notification-text and has no placeholder (SC-008).
	"install.button": "Als App installieren",
	"install.ios":
		"Als App auf dem iPhone: Tippe in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“.",
	"install.dismiss": "Ausblenden",
	"offline.title": "Keine Verbindung",
	"offline.body":
		"RynkePoints braucht eine Internetverbindung. Versuch es gleich noch einmal.",
	"push.body": "Neue Rynke – tippe zum Ansehen",

	"error.notFound.title": "Seite nicht gefunden",
	"error.notFound.body": "Diese Seite gibt es nicht.",
	"error.forbidden.title": "Anfrage abgelehnt",
	"error.forbidden.body":
		"Bitte lade die Seite neu und versuche es noch einmal.",
} satisfies Record<string, string>;
