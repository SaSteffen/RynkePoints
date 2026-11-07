import type { BadgeNameMode, PhraseMode } from "../content/types";
import type { Locale } from "../i18n/catalogs";

// A team's data (feature 026 data-model.md › TeamData). Release 1 needs only the
// language and content fields; the rest arrives with release 2.

export interface TeamData {
	/** `[a-z]+`; equals the deployment's `TEAM_ID`, unique in `TEAMS`. */
	id: string;
	/** For a visitor who states no language (research R4). */
	defaultLocale: Locale;
	/** For a visitor who states only languages the app doesn't ship (R4). */
	foreignLocale: Locale;
	/** Own phrases in one language, or the common ones (FR-025). */
	phrases: PhraseMode;
	/** Own badge names in one language, or the common ones (FR-052). */
	badgeNames: BadgeNameMode;
}
