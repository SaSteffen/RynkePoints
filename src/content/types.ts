import type { BadgeId } from "../badges/catalog";
import type { Locale } from "../i18n/catalogs";

// Team content sets (feature 026 data-model.md › PhraseMode, BadgeNameMode).

/** Meteorological seasons by month, on the Europe/Berlin date (016 FR-025). */
export type Season = "spring" | "summer" | "autumn" | "winter";

/** The monkey's phrases on the Team page (feature 016 FR-020–FR-025). */
export interface PhraseSet {
	/** For a rider who doesn't qualify yet and is behind the even pace. */
	push: readonly string[];
	/** For a rider who qualifies or keeps the even pace. */
	onTrack: readonly string[];
	/** Push phrases that only fit their season, picked alongside `push`. */
	seasonPush: Readonly<Record<Season, readonly string[]>>;
	/** On-track phrases that only fit their season. */
	seasonOnTrack: Readonly<Record<Season, readonly string[]>>;
}

/** A team's own phrases, in one language, or the common English ones. */
export type PhraseMode =
	| { kind: "own"; locale: Locale; set: PhraseSet }
	| { kind: "common" };

/** A team's own badge names, in one language, or the catalogs' `badge.name.<id>`. */
export type BadgeNameMode =
	| { kind: "own"; locale: Locale; names: Readonly<Record<BadgeId, string>> }
	| { kind: "common" };

/** The phrases a page shows, with the language they are written in. */
export interface Phrases {
	locale: Locale;
	set: PhraseSet;
}
