// Typed access to team settings and Strava app credentials (data-model.md,
// "Team settings").

type Settings = Pick<
	Env,
	| "STRAVA_CLUB_ID"
	| "STRAVA_EXTRA_CLUB_IDS"
	| "STRAVA_SUBSCRIPTION_ID"
	| "SEASON_START_DATE"
	| "ORGANISER_FIGURES"
	| "ORGANISER_PROGRESS_GRAPH"
	| "STRAVA_CLIENT_ID"
	| "STRAVA_CLIENT_SECRET"
	| "STRAVA_WEBHOOK_VERIFY_TOKEN"
	| "READY_POLL_SECONDS"
	| "TRAINING_LEADERBOARD"
	| "RIDE_FIGURES"
	| "RYNKE_VIEWS"
	| "BADGES"
	| "PHRASES"
	| "SEASON_ALBUM"
	| "FUN_THEMES"
	| "PRIVACY_CONTROLLER"
	| "CONTACT_EMAIL"
	| "TEAM_ID"
>;

const SEASON_TIME_ZONE = "Europe/Berlin";

function integer(name: string, value: string): number {
	if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer`);
	return Number(value);
}

/** The team's Strava club, the only one the app links to and names. */
export function clubId(env: Pick<Settings, "STRAVA_CLUB_ID">): number {
	return integer("STRAVA_CLUB_ID", env.STRAVA_CLUB_ID);
}

/**
 * Every club whose members may take part: the team's club first, then
 * `STRAVA_EXTRA_CLUB_IDS` (comma-separated, may be empty). Leaving one of
 * them doesn't count as leaving while the rider is still in another.
 */
export function memberClubIds(
	env: Pick<Settings, "STRAVA_CLUB_ID" | "STRAVA_EXTRA_CLUB_IDS">,
): number[] {
	const extra = env.STRAVA_EXTRA_CLUB_IDS.split(",")
		.map((id) => id.trim())
		.filter((id) => id !== "")
		.map((id) => integer("STRAVA_EXTRA_CLUB_IDS", id));
	return [...new Set([clubId(env), ...extra])];
}

export function subscriptionId(
	env: Pick<Settings, "STRAVA_SUBSCRIPTION_ID">,
): number {
	return integer("STRAVA_SUBSCRIPTION_ID", env.STRAVA_SUBSCRIPTION_ID);
}

/** Seconds between the waiting page's checks for the first data (015 R5). */
export function readyPollSeconds(
	env: Pick<Settings, "READY_POLL_SECONDS">,
): number {
	const seconds = integer("READY_POLL_SECONDS", env.READY_POLL_SECONDS);
	if (seconds < 1 || seconds > 60) {
		throw new Error("READY_POLL_SECONDS must be between 1 and 60");
	}
	return seconds;
}

/**
 * Whether other riders' Training Rynke may be ranked on `/team`: the place
 * card, the Training leaderboard and the Training figure beside each Team
 * row. "off" keeps the team total, the peloton and the team chart, and the
 * Team leaderboard without its Training figures.
 */
export function trainingLeaderboard(
	env: Pick<Settings, "TRAINING_LEADERBOARD">,
): boolean {
	if (env.TRAINING_LEADERBOARD === "on") return true;
	if (env.TRAINING_LEADERBOARD === "off") return false;
	throw new Error('TRAINING_LEADERBOARD must be "on" or "off"');
}

/**
 * Whether the team ranks riders by ride figures (feature 032): "Rank by" on
 * `/team`, and the Sessions column and graph for organisers. "off" reads and
 * shows nothing of it.
 */
export function rideFigures(env: Pick<Settings, "RIDE_FIGURES">): boolean {
	if (env.RIDE_FIGURES === "on") return true;
	if (env.RIDE_FIGURES === "off") return false;
	throw new Error('RIDE_FIGURES must be "on" or "off"');
}

/**
 * Whether `/team` shows Rynke (feature 032 FR-012). "off" gives the single
 * view: the team's ride figures, the km chart and the ride ranking, with no
 * kind switch, Rynke cards, peloton or quote.
 */
export function rynkeViews(env: Pick<Settings, "RYNKE_VIEWS">): boolean {
	if (env.RYNKE_VIEWS === "on") return true;
	if (env.RYNKE_VIEWS === "off") return false;
	throw new Error('RYNKE_VIEWS must be "on" or "off"');
}

/** A feature switch's value: "on" or "off", nothing else (feature 026 FR-018). */
function onOff(name: string, value: string): boolean {
	if (value === "on") return true;
	if (value === "off") return false;
	throw new Error(`${name} must be "on" or "off"`);
}

/**
 * Whether the team has badges (feature 026 FR-018): the Abzeichen section,
 * its menu entry and tour step, opening the app on new badges, and the badge
 * notifications and the team badges' check. "off" shows and sends none of it.
 */
export function badges(env: Pick<Settings, "BADGES">): boolean {
	return onOff("BADGES", env.BADGES);
}

/** Whether the Team page shows the motivational phrases (FR-018). */
export function phrases(env: Pick<Settings, "PHRASES">): boolean {
	return onOff("PHRASES", env.PHRASES);
}

/**
 * Whether the team makes season albums (FR-018): the privacy text's album
 * paragraph, and the album Worker serves none while "off".
 */
export function seasonAlbum(env: Pick<Settings, "SEASON_ALBUM">): boolean {
	return onOff("SEASON_ALBUM", env.SEASON_ALBUM);
}

/** Whether the theme menu offers the fun themes, Konfetti and Disco (FR-018). */
export function funThemes(env: Pick<Settings, "FUN_THEMES">): boolean {
	return onOff("FUN_THEMES", env.FUN_THEMES);
}

/**
 * Whether organisers get the Progress section (feature 029). It only needs
 * `ORGANISER_FIGURES` "full" as well, since it shows amounts, and it never
 * changes the consent versions (FR-028, FR-029).
 */
export function organiserProgressGraph(
	env: Pick<Settings, "ORGANISER_PROGRESS_GRAPH">,
): boolean {
	if (env.ORGANISER_PROGRESS_GRAPH === "on") return true;
	if (env.ORGANISER_PROGRESS_GRAPH === "off") return false;
	throw new Error('ORGANISER_PROGRESS_GRAPH must be "on" or "off"');
}

export function clientId(env: Pick<Settings, "STRAVA_CLIENT_ID">): string {
	return env.STRAVA_CLIENT_ID;
}

export function clientSecret(
	env: Pick<Settings, "STRAVA_CLIENT_SECRET">,
): string {
	return env.STRAVA_CLIENT_SECRET;
}

export function verifyToken(
	env: Pick<Settings, "STRAVA_WEBHOOK_VERIFY_TOKEN">,
): string {
	return env.STRAVA_WEBHOOK_VERIFY_TOKEN;
}

/** The season start of the configured `SEASON_START_DATE`. */
export function seasonStart(env: Pick<Settings, "SEASON_START_DATE">): number {
	return seasonStartEpoch(env.SEASON_START_DATE);
}

/** 00:00 Europe/Berlin on `date` (`YYYY-MM-DD`), in epoch seconds. */
export function seasonStartEpoch(date: string): number {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) throw new Error("SEASON_START_DATE must be YYYY-MM-DD");
	const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
	const utcMidnight = Date.UTC(y, m - 1, d);
	const check = new Date(utcMidnight);
	if (
		check.getUTCFullYear() !== y ||
		check.getUTCMonth() !== m - 1 ||
		check.getUTCDate() !== d
	) {
		throw new Error("SEASON_START_DATE is not a valid date");
	}
	// Berlin is never more than 2 h from UTC, and DST never switches at
	// midnight, so the offset at UTC midnight is the offset at Berlin midnight.
	return (utcMidnight - berlinOffsetMs(utcMidnight)) / 1000;
}

/** The Europe/Berlin calendar date (`YYYY-MM-DD`) at `epochSeconds`. */
export function berlinDate(epochSeconds: number): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: SEASON_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date(epochSeconds * 1000));
}

function berlinOffsetMs(epochMs: number): number {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: SEASON_TIME_ZONE,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(new Date(epochMs));
	const get = (type: string) =>
		Number(parts.find((p) => p.type === type)?.value);
	const wallClockAsUtc = Date.UTC(
		get("year"),
		get("month") - 1,
		get("day"),
		get("hour"),
		get("minute"),
		get("second"),
	);
	return wallClockAsUtc - epochMs;
}

/**
 * What the organiser overview shows of each rider's Rynke: "full" the
 * amounts, what is missing and where the Rynke come from; "percent" only
 * Training and Team as a share of their threshold, up to 100 %, with the
 * corrections as amounts.
 */
export type OrganiserFigures = "full" | "percent";

export function organiserFigures(
	env: Pick<Settings, "ORGANISER_FIGURES">,
): OrganiserFigures {
	const value = env.ORGANISER_FIGURES;
	if (value === "full" || value === "percent") return value;
	throw new Error('ORGANISER_FIGURES must be "full" or "percent"');
}

/** Who is responsible for the riders' data, one line each (a name at least). */
export function privacyController(
	env: Pick<Settings, "PRIVACY_CONTROLLER">,
): string[] {
	const lines = env.PRIVACY_CONTROLLER.split("\n")
		.map((line) => line.trim())
		.filter((line) => line !== "");
	if (lines.length === 0) throw new Error("PRIVACY_CONTROLLER is empty");
	return lines;
}

/** The address riders write to about support and their data. */
export function contactEmail(env: Pick<Settings, "CONTACT_EMAIL">): string {
	const email = env.CONTACT_EMAIL.trim();
	if (!/^[^\s@<>"]+@[^\s@<>".]+(?:\.[^\s@<>".]+)+$/.test(email)) {
		throw new Error("CONTACT_EMAIL must be an email address");
	}
	return email;
}

/** Labels this team's usage records (feature 025 research R13). */
export function teamId(env: Pick<Settings, "TEAM_ID">): string {
	if (env.TEAM_ID.trim() === "") throw new Error("TEAM_ID is empty");
	return env.TEAM_ID;
}

/** Optional secrets, set by hand, so not in `secrets.required` (feature 025). */
export interface AnalyticsSecrets {
	CLOUDFLARE_ANALYTICS_TOKEN?: string;
	CLOUDFLARE_ANALYTICS_ACCOUNT_ID?: string;
}

/** Reading Cloudflare's figures; null while either secret is missing. */
export function cloudflareAnalytics(
	env: object,
): { token: string; accountId: string } | null {
	const secrets = env as AnalyticsSecrets;
	const token = secrets.CLOUDFLARE_ANALYTICS_TOKEN;
	const accountId = secrets.CLOUDFLARE_ANALYTICS_ACCOUNT_ID;
	return token && accountId ? { token, accountId } : null;
}
