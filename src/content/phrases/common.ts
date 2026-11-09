import type { Locale } from "../../i18n/catalogs";
import type { PhraseSet } from "../types";
import { COMMON_EN } from "./common.en";

// The common phrases for teams without their own (feature 026 FR-045–FR-047),
// one set per shipped locale, index i in every set adapting index i in English.
// A team set to `common` shows no phrase for a locale that has none here yet
// (tasks T032–T034 add the others).

export const COMMON_PHRASES: Partial<Record<Locale, PhraseSet>> = {
	en: COMMON_EN,
};
