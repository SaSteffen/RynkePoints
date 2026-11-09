import type { BadgeId } from "../badges/catalog";
import type { BadgeNameMode, PhraseMode } from "../content/types";
import type { ThemeId } from "../http/themes";
import type { Locale } from "../i18n/catalogs";
import type { RynkeRules } from "../rynke/rules";
import type { EventKind } from "../rynke/team-events";

// A team's data (feature 026 data-model.md › TeamData, contracts/team-data.md).
// Structured data lives here; scalars a deploy may change, and everything
// Wrangler must see, live in the team's block of `wrangler.jsonc` (research
// R1). `scripts/team-check.mjs` checks both halves together.

/** A file under `public/`, as a page addresses it (`/coin/…`). */
export type ArtPath = string;

/** The team's coin as shown large; the small marks use the sprite in `coin.ts`. */
export interface CoinArt {
	/** Training Rynke's side. */
	front: ArtPath;
	/** Team Rynke's side. */
	back: ArtPath;
}

/** The install icons of the manifest and the page head (the sizes of today). */
export interface InstallIcons {
	favicon: ArtPath;
	appleTouch: ArtPath;
	icon192: ArtPath;
	icon512: ArtPath;
	maskable512: ArtPath;
	/** The monochrome badge of a push notification. */
	notificationBadge: ArtPath;
}

/** Team-specific art (data-model.md › ArtMap, research R14). */
export interface ArtMap {
	coin: CoinArt;
	icons: InstallIcons;
	/**
	 * Only the badges whose art is the team's own: its own picture, or
	 * `"placeholder"` for the neutral one. A badge missing here uses the shared
	 * picture under `public/badges/`.
	 */
	badges: Readonly<Partial<Record<BadgeId, ArtPath | "placeholder">>>;
	/**
	 * Badges whose shared picture shows this team's motifs (FR-024): every other
	 * team gives each of them an entry in its own `badges` map.
	 */
	teamSpecificBadges: readonly BadgeId[];
}

/** The team's colours (data-model.md › TeamData `colours`). */
export interface TeamColours {
	/** The theme menu's themes in menu order, from the shared `THEMES`. */
	themes: readonly ThemeId[];
	/** The manifest's `theme_color` and `background_color`. */
	manifest: { themeColor: string; backgroundColor: string };
}

/** Where `pnpm dev:<team>` serves the team (contracts/dev-commands.md). */
export interface DevTarget {
	/** `localhost` for the founding team, `<id>.localhost` otherwise. */
	host: string;
	/** Distinct across teams; never 8797, the test server's. */
	port: number;
	/** Distinct across teams; never 9237, the test server's. */
	inspectorPort: number;
}

export interface TeamData {
	/** `[a-z]+`; equals the deployment's `TEAM_ID`, unique in `TEAMS`. */
	id: string;
	/** Shown in pages, the manifest and notifications. */
	name: string;
	/** The install name (manifest `short_name`). */
	shortName: string;
	/** For a visitor who states no language (research R4). */
	defaultLocale: Locale;
	/** For a visitor who states only languages the app doesn't ship (R4). */
	foreignLocale: Locale;
	/**
	 * Every rule version ever in effect, ordered by `effectiveDate`; the last
	 * is the one in effect (research R15, FR-019). Never empty.
	 */
	rules: readonly RynkeRules[];
	/** The event kinds the team's organisers can record. */
	eventKinds: readonly EventKind[];
	colours: TeamColours;
	art: ArtMap;
	/** Own phrases in one language, or the common ones (FR-025). */
	phrases: PhraseMode;
	/** Own badge names in one language, or the common ones (FR-052). */
	badgeNames: BadgeNameMode;
	/** Other teams' Strava clubs, for the one-team-at-a-time notice (FR-012). */
	otherClubIds: readonly number[];
	dev: DevTarget;
	/**
	 * Fields of this file and vars of the team's Wrangler block still copied
	 * from another team (FR-053); empty before a production deploy.
	 */
	placeholders: readonly string[];
}
