import { type HintLines, monthNames } from "./types";

// The German hint lines, as approved in specs/034-badge-hints/hint-phrases.md.

export const HINTS_DE: HintLines = {
	locale: "de",
	label: "Tipp",
	more: "Zur Karte",
	monthName: monthNames("de"),
	lines: {
		distance: [
			({ n }) => `Noch ${n} km bis zum nächsten Distanz-Abzeichen.`,
			({ n }) =>
				`${n} km fehlen noch, dann gibt's das nächste Distanz-Abzeichen.`,
		],
		elevation: [
			({ n }) => `Noch ${n} Höhenmeter bis zum nächsten Höhenmeter-Abzeichen.`,
			({ n }) => `${n} Höhenmeter fehlen noch. Zeit für ein paar Hügel.`,
		],
		trainingRynke: [
			({ n }) => `Noch ${n} Rynke bis zum nächsten Training-Rynke-Abzeichen.`,
		],
		running: [
			({ n }) => `Noch ${n} km Laufen bis zum nächsten Lauf-Abzeichen.`,
		],
		swimming: [
			({ n }) => `Noch ${n} km im Wasser bis zum nächsten Schwimm-Abzeichen.`,
		],
		virtualRides: [
			({ n }) =>
				`Noch ${n} km auf der Rolle oder virtuell bis zum nächsten Abzeichen.`,
		],
		rideLength: [
			({ best, next }) =>
				`Deine längste Fahrt der Saison: ${best} km. Ab ${next} km gibt's das nächste Abzeichen.`,
		],
		runLength: [
			({ best, next }) =>
				`Dein längster Lauf der Saison: ${best} km. Ab ${next} km gibt's das nächste Abzeichen.`,
		],
		swimLength: [
			({ best, next }) =>
				`Deine längste Schwimmeinheit der Saison: ${best} km. Ab ${next} km gibt's das nächste Abzeichen.`,
		],
		winterOne: [
			({ month }) =>
				`Noch ein Tag draußen auf dem Rad, dann gibt's das nächste ${month}-Abzeichen.`,
		],
		winterSeveral: [
			({ n, month, left }) =>
				`Noch ${n} Tage draußen auf dem Rad bis zum nächsten ${month}-Abzeichen. Der ${month} hat noch ${left} Tage.`,
		],
		winterNoSpare: [
			({ month }) =>
				`Ab jetzt jeden Tag draußen, dann reicht's noch für das ${month}-Abzeichen.`,
		],
		newYear: [
			() => "Was machst du am 1. Januar, außer ausschlafen?",
			() => "Am Neujahrstag ist draußen wenig los. Gute Zeit für eine Runde.",
		],
		christmasEve: [
			() => "Am 24. schon was vor? Eine kurze Runde passt vor der Bescherung.",
			() => "Heiligabend vormittags sind die Straßen so leer wie sonst nie.",
		],
		christmas: [
			() => "Zwischen Braten und Plätzchen: eine Runde am 25. oder 26.?",
			() => "Zwei Feiertage. Einer davon reicht für eine Runde.",
		],
		festive500: [
			() =>
				"Zwischen Heiligabend und Silvester ist viel Zeit. Wie viele Kilometer passen da rein?",
			() => "Zwischen den Jahren zählt die Rolle auch.",
		],
		nightOwl: [
			() =>
				"Schon mal nach dem Abendessen losgefahren? Mit Licht, versteht sich.",
			() => "Spät abends noch Lust auf eine Runde? Kann sich lohnen.",
		],
		earlyBird: [
			() => "Schon mal vor dem Wecker losgefahren?",
			() => "Wer im Dunkeln startet, sieht den Sonnenaufgang vom Sattel.",
		],
		restDay: [
			({ n }) =>
				`${n} Tage am Stück aktiv. Mach weiter, irgendwann ist ein Sofatag verdient.`,
			() => "Pausen gehören dazu. Erst recht nach einer langen Serie.",
		],
		stageRider: [
			() =>
				"Wie wär's mit einem langen Wochenende auf dem Rad? Mehrere lange Tage hintereinander.",
			() => "Bei der Tour fährt man nicht einen langen Tag, sondern viele.",
		],
		triathlon: [
			() => "Rad, Laufschuhe, Badesachen: alles an einem Tag?",
			() => "Du fährst, läufst und schwimmst. Nur noch nie alles an einem Tag.",
		],
		piDay: [
			() => "Am 14. März ist Pi-Tag. Eine Runde, die zum Datum passt?",
			() => "Mathe und Radfahren passen am 14. März gut zusammen.",
		],
		solsticeDecember: [
			() => "Kürzester Tag des Jahres. Eine Runde draußen im wenigen Licht?",
			() =>
				"Um den 21. Dezember wird's am frühesten dunkel. Gerade dann draußen fahren?",
		],
		solsticeJune: [
			() =>
				"Im Dezember bist du am kürzesten Tag gefahren. Jetzt kommt der längste.",
			() => "Am längsten Tag ist viel Licht für eine Runde draußen.",
		],
		easter: [
			() => "Ostern auf dem Rad statt nur auf Eiersuche?",
			() => "Ostersonntag oder Ostermontag: beides gute Tage für eine Runde.",
		],
		everesting: [
			() =>
				"Wie viele Höhenmeter schaffst du in einem Monat? Es gibt da ein Ziel.",
			() => "Hügel rauf, Hügel runter, und das den ganzen Monat.",
		],
		winterSleep: [
			() => "Noch keine Runde draußen in diesem Jahr? Das Rad steht bereit.",
			() => "Die Rolle war gut. Draußen ist besser.",
		],
	},
};
