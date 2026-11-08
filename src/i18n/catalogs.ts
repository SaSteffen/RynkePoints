import { da } from "./messages/da";
import { de } from "./messages/de";
import { en } from "./messages/en";
import { fi } from "./messages/fi";
import { fr } from "./messages/fr";
import { is } from "./messages/is";
import { lt } from "./messages/lt";
import { nb } from "./messages/nb";
import { nl } from "./messages/nl";
import { sv } from "./messages/sv";

// The registry of shipped locales (research R16, feature 026 contracts/locales.md).
// Adding a locale means adding `messages/<code>.ts` and listing it here; picker,
// locale resolution and tests all iterate over this object.

export type MessageId = keyof typeof de;

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

/**
 * A message counted by its `n` param, one text per `Intl.PluralRules` category of
 * the catalog's locale (feature 026 research R3). `other` is always there.
 */
export type PluralMessage = { other: string } & Partial<
	Record<Exclude<PluralCategory, "other">, string>
>;

export type MessageValue = string | PluralMessage;

/**
 * A catalog: exactly the German keys, plural where German is plural, so tsc
 * rejects a missing, extra or wrongly shaped message.
 */
export type Catalog = Readonly<{
	[K in MessageId]: (typeof de)[K] extends string ? string : PluralMessage;
}>;
export type Catalogs = Readonly<Record<string, Catalog>>;

export const CATALOGS = {
	de,
	en,
	da,
	nb,
	sv,
	fi,
	is,
	fr,
	nl,
	lt,
} as const satisfies Catalogs;

export type Locale = keyof typeof CATALOGS;

/** The key source and the catalog a missing message falls back to. */
export const DEFAULT_LOCALE: Locale = "de";
