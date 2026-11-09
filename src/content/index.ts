import type { BadgeId } from "../badges/catalog";
import type { MessageId } from "../i18n/catalogs";
import type { I18n } from "../i18n/i18n";
import type { TeamData } from "../teams/types";
import { COMMON_EN } from "./phrases/common.en";
import type { Phrases } from "./types";

// The only entry points to phrases and badge names (feature 026
// contracts/phrases.md › Lookups): a team with its own set always gets it,
// whatever language the rider picked; every other team gets the common English
// set, in every language too (FR-025: the common phrases aren't translated).

/** The phrases for `team`, whatever language the rider picked. */
export function phraseSet(team: Pick<TeamData, "phrases">): Phrases {
	if (team.phrases.kind === "own") {
		return { locale: team.phrases.locale, set: team.phrases.set };
	}
	return { locale: "en", set: COMMON_EN };
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
