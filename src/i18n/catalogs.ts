import { de } from "./messages/de";
import { en } from "./messages/en";

// The registry of shipped locales (research R16). Adding a locale means adding
// `messages/<code>.ts` and listing it here; switcher, locale resolution and
// tests all iterate over this object.

export type MessageId = keyof typeof de;
export type Catalog = Readonly<Record<MessageId, string>>;
export type Catalogs = Readonly<Record<string, Catalog>>;

export const CATALOGS = { de, en } as const satisfies Catalogs;

export type Locale = keyof typeof CATALOGS;

/** Source catalog, and the language when the browser states no preference. */
export const DEFAULT_LOCALE: Locale = "de";
/** For browsers whose Accept-Language names only unsupported languages. */
export const FOREIGN_LOCALE: Locale = "en";
