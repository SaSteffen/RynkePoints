// German-only badge names (feature 013 FR-041, research R20). They stay German
// in every app language, so they live beside the catalogs rather than in them,
// like quotes.de.ts. One name per badge of src/badges/catalog.ts, in catalog
// order. Drafts: the project owner confirms the list before release
// (contracts/badge-messages.md).

import type { BadgeId } from "../../badges/catalog";

export const BADGE_NAMES: Record<BadgeId, string> = {
	// Distanz
	"distance-100": "Die ersten Hundert",
	"distance-500": "Halber Tausender",
	"distance-1000": "Vierstellig",
	"distance-2500": "Neue Kette fällig",
	"distance-5000": "Viermal Paris",
	// Höhenmeter
	"elevation-1000": "Erster Höhenkilometer",
	"elevation-5000": "Mont Blanc überholt",
	"elevation-10000": "Everest abgehakt",
	"elevation-25000": "Stratosphäre",
	// Teamtermine
	"team-events-1": "Erstes Teamtreffen",
	"team-events-5": "Bekanntes Gesicht",
	"team-events-10": "Stammplatz",
	"team-events-20": "Gehört zum Inventar",
	// Techniktraining
	"technique-1": "Erste Technikstunde",
	"technique-2": "Technisch einwandfrei",
	// Trainings-Rynke
	"training-rynke-1": "Der erste Rynke",
	"training-rynke-25": "Warmgefahren",
	"training-rynke-50": "Halbe Hundert",
	"training-rynke-100": "Dreistellig",
	"training-rynke-150": "Sitzfleisch",
	"training-rynke-200": "Zweihunderter",
	"training-rynke-250": "Gut im Saft",
	"training-rynke-300": "Dauerbrenner",
	"training-rynke-400": "Kaum zu bremsen",
	"training-rynke-500": "Tourbereit",
	// Längster Lauf
	"run-length-5": "Fünf am Stück",
	"run-length-10": "Zehner",
	"run-length-half": "Halbmarathon",
	"run-length-marathon": "Marathon",
	// Laufen gesamt
	"running-10": "Laufschuhe gefunden",
	"running-25": "Zweites Standbein",
	"running-50": "Auch zu Fuß",
	"running-100": "Hundert zu Fuß",
	"running-250": "Doppelleben",
	"running-500": "Neue Sohlen fällig",
	// Längste Fahrt (part C)
	"ride-length-50": "Mit Proviant",
	"ride-length-100": "Hundert am Stück",
	"ride-length-150": "Satteltag",
	"ride-length-200": "Von früh bis spät",
	"ride-length-250": "Durch die Nacht",
	"ride-length-300": "Alles gegeben",
	// Virtuell
	"virtual-rides-50": "Rollenheld",
	"virtual-rides-100": "Gegenwind vom Ventilator",
	"virtual-rides-250": "Gegen sich selbst",
	"virtual-rides-500": "Kopfkino",
	"virtual-rides-1000": "Wohnzimmer-Weltall",
	// Längstes Schwimmen
	"swim-length-500": "Seepferdchen",
	"swim-length-1000": "Freischwimmer",
	"swim-length-1900": "Halbe Langdistanz",
	"swim-length-3800": "Langdistanz",
	// Schwimmen gesamt
	"swimming-5": "Arschbombe",
	"swimming-10": "Mit Quietscheente",
	"swimming-25": "Bahnen ziehen",
	"swimming-50": "Möwenexpress",
	"swimming-100": "Wal in Sicht",
	// Winter: November
	"winter-november-1": "Herbstlaub",
	"winter-november-5": "Schietwetter",
	"winter-november-10": "Nebelreiter",
	// Winter: Dezember
	"winter-december-1": "Erster Schnee",
	"winter-december-5": "Kakaopause",
	"winter-december-10": "Rentier auf Rädern",
	// Winter: Januar
	"winter-january-1": "Frohes Neues",
	"winter-january-5": "Eiszapfen",
	"winter-january-10": "Schneesturm",
	// Winter: Februar
	"winter-february-1": "Fasching auf dem Rad",
	"winter-february-5": "Zugefroren",
	"winter-february-10": "Winter überstanden",
	// Überraschungen (part D)
	"surprise-new-year": "Prost Neujahr",
	"surprise-christmas-eve": "Bescherung auf Rädern",
	"surprise-christmas": "Gänsebraten abgestrampelt",
	"surprise-night-owl": "Nachteule",
	"surprise-early-bird": "Frühaufsteher",
	"surprise-rest-day": "Sofaheld",
	// Trainings-Rynke gemeinsam
	"team-training-rynke-500": "Gemeinsam angerollt",
	"team-training-rynke-1000": "Tausend zusammen",
	"team-training-rynke-2500": "Volle Truppe",
	"team-training-rynke-5000": "Team in Form",
	"team-training-rynke-7500": "Läuft im Team",
	"team-training-rynke-10000": "Fünfstellig",
	"team-training-rynke-15000": "Team auf Kurs",
	"team-training-rynke-20000": "Alle bereit",
	// Kilometer gemeinsam
	"team-distance-1000": "Die ersten Tausend",
	"team-distance-5000": "Quer durch Europa",
	"team-distance-10000": "Bis Kapstadt",
	"team-distance-25000": "Halbe Weltreise",
	"team-distance-50000": "Einmal um die Erde",
	"team-distance-100000": "Zweieinhalbmal um die Erde",
	// Höhenmeter gemeinsam
	"team-elevation-10000": "Everest als Team",
	"team-elevation-50000": "Fünfmal Everest",
	"team-elevation-100000": "Kármán-Linie",
	"team-elevation-250000": "Im Orbit",
	"team-elevation-500000": "Über der ISS",
	// Laufen gemeinsam
	"team-running-100": "Team in Laufschuhen",
	"team-running-500": "Staffel",
	"team-running-1000": "Tausend gelaufen",
	"team-running-2500": "Lauftreff",
	"team-running-5000": "Fünftausend zu Fuß",
	// Große Ausfahrt
	"big-training-5": "Kleine Gruppe",
	"big-training-10": "Zweierreihe",
	"big-training-15": "Ganzes Feld",
	"big-training-20": "Peloton",
	"big-training-30": "Straße voll",
	// Teilnahmen
	"attendances-25": "Gut besucht",
	"attendances-50": "Volle Termine",
	"attendances-100": "Hundertmal dabei",
	"attendances-200": "Eingespielt",
	"attendances-400": "Alle dabei",
	// Team-Überraschungen (part E)
	"team-surprise-day-off": "Kollektiver Couchtag",
	"team-surprise-all-out": "Alle Mann an Deck",
	"team-surprise-round-the-clock": "Die Nacht durchgefahren",
	"team-surprise-relay": "Staffel ohne Ende",
	"team-surprise-new-years-eve": "Silvesterknaller",
	"team-surprise-sunday-outing": "Sonntagskarawane",
};
