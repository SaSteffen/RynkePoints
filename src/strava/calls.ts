import { daysBefore } from "../usage/allowances";
import type { WorkMessage } from "../work/messages";

// Strava call counts (feature 047 data-model.md): what each call and each call
// the budget held back is counted under, and the usage view's rows. Counts
// only, never a rider or an activity (FR-016). Pure.

/** The piece of work a call is made for (research R2). */
export const STRAVA_ACTIONS = [
	"connect",
	"import",
	"ride-event",
	"club-check",
	"recheck",
	"reread",
	"leave",
	"disconnect",
	// A call made outside every action above (FR-003): there should be none.
	"unassigned",
] as const;
export type StravaAction = (typeof STRAVA_ACTIONS)[number];

/** What a call asks Strava for, as `stravaFetch` logs it. */
export const STRAVA_ENDPOINTS = [
	"GET /athlete/clubs",
	"GET /activities/{id}",
	"GET /athlete/activities",
	"POST /oauth/token",
	"POST /oauth/revoke",
] as const;
export type StravaEndpoint = (typeof STRAVA_ENDPOINTS)[number];

/** How many days the counts are kept and shown, today included (FR-017). */
export const CALL_DAYS = 30;

/** The oldest day still kept and shown. */
export function firstCallDay(today: string): string {
	return daysBefore(today, CALL_DAYS - 1);
}

/**
 * The action a message's calls count under; none for the kinds that make no
 * Strava calls, whose calls would count as unassigned.
 */
export function actionOf(message: WorkMessage): StravaAction | undefined {
	switch (message.kind) {
		case "activity-event":
			return "ride-event";
		case "import-page":
			return "import";
		case "reread-page":
			return "reread";
		case "check-membership":
			return "club-check";
		case "recheck-rider":
			return "recheck";
		case "delete-rider":
			// The others give access back as leaving does (research R2).
			return message.reason === "deauthorized" ? "disconnect" : "leave";
		case "evaluate-rider":
		case "send-notification":
		case "report-hold":
			return undefined;
	}
}

/** One day, action and endpoint's counts, as `strava_calls_daily` keeps them. */
export interface CallCount {
	day: string;
	action: StravaAction;
	endpoint: StravaEndpoint;
	calls: number;
	heldBack: number;
}

/** This team's day: its counts added up, and the day's highest Strava count. */
export interface OwnCallDay {
	day: string;
	calls: number;
	heldBack: number;
	/** The calls counted under `unassigned`. */
	unassigned: number;
	/** The highest daily total Strava reported; 0 when none was seen. */
	seen: number;
}

/** Each day with a count, added up, with the day's Strava count from `seen`. */
export function ownCallDays(
	counts: readonly CallCount[],
	seen: ReadonlyMap<string, number>,
): OwnCallDay[] {
	const days = new Map<string, OwnCallDay>();
	for (const c of counts) {
		let day = days.get(c.day);
		if (!day) {
			day = {
				day: c.day,
				calls: 0,
				heldBack: 0,
				unassigned: 0,
				seen: seen.get(c.day) ?? 0,
			};
			days.set(c.day, day);
		}
		day.calls += c.calls;
		day.heldBack += c.heldBack;
		if (c.action === "unassigned") day.unassigned += c.calls;
	}
	return [...days.values()];
}

/** Another team's day totals, as the usage exchange brought them. */
export interface PeerCallDay {
	day: string;
	calls: number;
	seen: number;
}

/** A row of the usage view's day table (contracts/usage-view.md). */
export interface CallDayRow {
	day: string;
	calls: number;
	heldBack: number;
	/**
	 * Every other team's calls together; "missing" when a team's day didn't
	 * come; null while no other team has counted yet.
	 */
	others: number | "missing" | null;
	/** This team's and the others' calls; null when a team's day is missing. */
	all: number | null;
	/** Strava's count, the highest any team saw; null when unknown. */
	strava: number | null;
	marked: boolean;
}

/**
 * FR-011: a finished day, unless a team's day is missing, whose Strava count
 * exceeds all teams' calls by more than 10 and more than 1% of it; or any
 * finished day with an unassigned call. Counted above Strava's count is not
 * marked: Strava's count was seen before the day's last calls.
 */
function isMarked(
	row: Omit<CallDayRow, "marked">,
	unassigned: number,
	today: string,
): boolean {
	if (row.day >= today) return false;
	if (unassigned > 0) return true;
	if (row.strava === null || row.all === null) return false;
	return row.strava - row.all > Math.max(10, Math.floor(row.strava / 100));
}

/**
 * One row per day from this team's first counted day to today, newest first,
 * at most `CALL_DAYS`; a day without counts is zero. Empty until a call is
 * counted. A team shows nothing before its first day and is missing on a later
 * day without an entry (research R7).
 */
export function callDayRows(
	today: string,
	own: readonly OwnCallDay[],
	peers: readonly (readonly PeerCallDay[])[],
): CallDayRow[] {
	const first = own.reduce<string | null>(
		(min, d) => (min === null || d.day < min ? d.day : min),
		null,
	);
	if (first === null) return [];
	const ownByDay = new Map(own.map((d) => [d.day, d]));
	const teams = peers.map((days) => ({
		first: days.reduce<string | null>(
			(min, d) => (min === null || d.day < min ? d.day : min),
			null,
		),
		byDay: new Map(days.map((d) => [d.day, d])),
	}));
	const rows: CallDayRow[] = [];
	for (let i = 0; i < CALL_DAYS; i++) {
		const day = daysBefore(today, i);
		if (day < first) break;
		const mine = ownByDay.get(day);
		let others: CallDayRow["others"] = null;
		let seen = mine?.seen ?? 0;
		for (const team of teams) {
			if (team.first === null || day < team.first) continue;
			const theirs = team.byDay.get(day);
			if (!theirs) {
				others = "missing";
				continue;
			}
			seen = Math.max(seen, theirs.seen);
			if (others !== "missing") others = (others ?? 0) + theirs.calls;
		}
		const calls = mine?.calls ?? 0;
		const row = {
			day,
			calls,
			heldBack: mine?.heldBack ?? 0,
			others,
			all: others === "missing" ? null : calls + (others ?? 0),
			strava: seen > 0 ? seen : null,
		};
		rows.push({ ...row, marked: isMarked(row, mine?.unassigned ?? 0, today) });
	}
	return rows;
}

/** A day's breakdown: a column per endpoint with calls, a row per action. */
export interface CallBreakdown {
	endpoints: StravaEndpoint[];
	rows: {
		action: StravaAction;
		/** Per endpoint, in the order of `endpoints`. */
		calls: number[];
		heldBack: number;
		total: number;
	}[];
}

/**
 * This team's `day` by action and endpoint (FR-010): only the actions with a
 * call or a held-back call, only the endpoints with a call; held back per
 * action, and each action's calls added up.
 */
export function callBreakdown(
	counts: readonly CallCount[],
	day: string,
): CallBreakdown {
	const ofDay = counts.filter((c) => c.day === day);
	const endpoints = STRAVA_ENDPOINTS.filter((endpoint) =>
		ofDay.some((c) => c.endpoint === endpoint && c.calls > 0),
	);
	const rows = STRAVA_ACTIONS.flatMap((action) => {
		const mine = ofDay.filter((c) => c.action === action);
		const calls = endpoints.map((endpoint) =>
			mine
				.filter((c) => c.endpoint === endpoint)
				.reduce((sum, c) => sum + c.calls, 0),
		);
		const heldBack = mine.reduce((sum, c) => sum + c.heldBack, 0);
		const total = calls.reduce((sum, n) => sum + n, 0);
		return total + heldBack > 0 ? [{ action, calls, heldBack, total }] : [];
	});
	return { endpoints, rows };
}
