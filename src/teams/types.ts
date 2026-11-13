import type { BadgeId } from "../badges/catalog";
import type { BadgeNameMode, PhraseMode } from "../content/types";
import type { Holiday } from "../http/holidays";
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

/**
 * The team's Cloudflare resources, so the account's figures can be split by
 * team (feature 026 FR-040). `team-check` holds the Worker and database
 * against the team's Wrangler block.
 */
export interface CloudflareResources {
	/** The Worker's name, Cloudflare's `scriptName`. */
	worker: string;
	/** The D1 database's ID. */
	databaseId: string;
	/**
	 * Its queues' IDs (`wrangler queues list`); none known yet leaves queue
	 * operations unsplit.
	 */
	queueIds: readonly string[];
}

/** The rules handout (FR-022): a PDF from `pnpm docs:pdf` and its language. */
export interface RulesHandout {
	/** Under `public/`, served as a download (`public/_headers`). */
	path: ArtPath;
	/** The language it's written in; picks the link's label. */
	locale: "de" | "en";
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
	rulesHandout: RulesHandout;
	colours: TeamColours;
	art: ArtMap;
	/** Own phrases in one language, or the common ones (FR-025). */
	phrases: PhraseMode;
	/** Own badge names in one language, or the common ones (FR-052). */
	badgeNames: BadgeNameMode;
	/** The team's holidays with a seasonal quote monkey (feature 035). */
	holidays: readonly Holiday[];
	/** Other teams' Strava clubs, for the one-team-at-a-time notice (FR-012). */
	otherClubIds: readonly number[];
	/**
	 * Ride re-checks per day in normal operation (feature 036 FR-008). All
	 * teams' together are at most `RECHECK_READS`.
	 */
	recheckAllowance: number;
	dev: DevTarget;
	cloudflare: CloudflareResources;
	/**
	 * Fields of this file and vars of the team's Wrangler block still copied
	 * from another team (FR-053); empty before a production deploy.
	 */
	placeholders: readonly string[];
}
