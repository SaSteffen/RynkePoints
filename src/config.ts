// Typed access to team settings and Strava app credentials (data-model.md,
// "Team settings").

type Settings = Pick<
	Env,
	| "STRAVA_CLUB_ID"
	| "STRAVA_SUBSCRIPTION_ID"
	| "SEASON_START_DATE"
	| "STRAVA_CLIENT_ID"
	| "STRAVA_CLIENT_SECRET"
	| "STRAVA_WEBHOOK_VERIFY_TOKEN"
	| "READY_POLL_SECONDS"
>;

const SEASON_TIME_ZONE = "Europe/Berlin";

function integer(name: string, value: string): number {
	if (!/^\d+$/.test(value)) throw new Error(`${name} must be an integer`);
	return Number(value);
}

export function clubId(env: Pick<Settings, "STRAVA_CLUB_ID">): number {
	return integer("STRAVA_CLUB_ID", env.STRAVA_CLUB_ID);
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
