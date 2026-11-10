// The badges page's hint lines (feature 034 contracts/hint-lines.md): German
// and English only, like the monkey's quotes (FR-014). The team picks the
// language, never the rider (research R6).

/** A next-step hint's line. */
export type NextLineId =
	| "distance"
	| "elevation"
	| "trainingRynke"
	| "running"
	| "swimming"
	| "virtualRides"
	| "rideLength"
	| "runLength"
	| "swimLength"
	| "winterOne"
	| "winterSeveral"
	| "winterNoSpare";

/** A surprise hint's line: veiled, no badge name, no rule figure (FR-009). */
export type SurpriseLineId =
	| "newYear"
	| "christmasEve"
	| "christmas"
	| "festive500"
	| "nightOwl"
	| "earlyBird"
	| "restDay"
	| "stageRider"
	| "triathlon"
	| "piDay"
	| "solsticeDecember"
	| "solsticeJune"
	| "easter"
	| "everesting"
	| "winterSleep";

export type LineId = NextLineId | SurpriseLineId;

/** A line's placeholders, already formatted in the line's language. */
export interface FormattedValues {
	n?: string;
	best?: string;
	next?: string;
	left?: string;
	month?: string;
}

/** One way to say a line. */
export type Variant = (values: FormattedValues) => string;

export interface HintLines {
	locale: "de" | "en";
	/** Above the line: "Tipp". */
	label: string;
	/** The link's last words: "Zur Karte". */
	more: string;
	/** A calendar month's name, 1 to 12. */
	monthName: (month: number) => string;
	/** The variants of each line; both sets have every line (`tsc`). */
	lines: Readonly<Record<LineId, readonly [Variant, ...Variant[]]>>;
}

/** Month names from `Intl`, in `locale`. */
export function monthNames(locale: string): (month: number) => string {
	const format = new Intl.DateTimeFormat(locale, {
		month: "long",
		timeZone: "UTC",
	});
	return (month) => format.format(Date.UTC(2026, month - 1, 15));
}
