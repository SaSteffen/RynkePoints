import type { Locale } from "../../i18n/catalogs";
import type { PhraseSet } from "../types";

// The common phrases for teams without their own (feature 026 FR-045–FR-047),
// one set per shipped locale, index i in every set adapting index i in English.
// Empty until the English originals are rated (tasks T031–T034); a team set to
// `common` shows no phrase for a locale that has none here.

export const COMMON_PHRASES: Partial<Record<Locale, PhraseSet>> = {};
