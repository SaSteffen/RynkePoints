import type { BadgeId } from "../badges/catalog";
import type { Locale, MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import type { TeamData } from "../teams/types";
import { COMMON_PHRASES } from "./phrases/common";
import type { PhraseSet, Phrases } from "./types";

// The only entry points to phrases and badge names (feature 026
// contracts/phrases.md › Lookups): a team with its own set always gets it,
// whatever language the rider picked; every other team gets the common set in
// the rider's language.

/**
 * The phrases for `team` in `locale`, or `null` when a common team has none in
 * that language yet.
 */
export function phraseSet(
	team: Pick<TeamData, "phrases">,
	locale: string,
	common: Partial<Record<Locale, PhraseSet>> = COMMON_PHRASES,
): Phrases | null {
	if (team.phrases.kind === "own") {
		return { locale: team.phrases.locale, set: team.phrases.set };
	}
	const set = common[locale as Locale];
	return set ? { locale: locale as Locale, set } : null;
}

/** A badge's name: the team's own, or `badge.name.<id>` in the rider's language. */
export function badgeName(
	team: Pick<TeamData, "badgeNames">,
	i18n: I18n,
	id: BadgeId,
): string {
	if (team.badgeNames.kind === "own") return team.badgeNames.names[id] ?? "";
	return i18n.t(`badge.name.${id}` as MessageId);
}

/** The language a badge name is written in, for its `lang` attribute. */
export function badgeNameLocale(
	team: Pick<TeamData, "badgeNames">,
	i18n: I18n,
): string {
	return team.badgeNames.kind === "own" ? team.badgeNames.locale : i18n.locale;
}
