import { compareIds } from "../strava/id";
// Team events and attendance as organisers change them (feature 014), and
// the re-evaluation of every rider a change touches, in one batch (research
// R21). The evaluation itself is `reevaluate.ts`'s.

import type { TourEvent } from "../badges/evaluate";
import { badges as badgesOn } from "../config";
import type { Ctx } from "../ctx";
import { deleteReportsStatement } from "../db/participation";
import {
	deleteAttendancesStatement,
	deleteTeamEventStatement,
	insertAttendancesStatement,
	insertTeamEventStatement,
	listEventAttendeesStatement,
	listTourRidersStatement,
	readTeamEventStatement,
	riderStatusesStatement,
	type TeamEventFields,
	type TeamEventRow,
	updateTeamEventStatement,
} from "../db/team-events";
import { hasEvents } from "../teams";
import { sendAll } from "../work/messages";
import { notifyRiders } from "../work/send-notification";
import { teamBadgeNews } from "../work/team-badge-news";
import {
	BADGE_NEWS_ON,
	type BadgeNewsSwitch,
	type RiderState,
	readRiders,
	reevaluate,
	storeEvaluated,
	withCurrentRiders,
} from "./reevaluate";
import {
	type CountingWindow,
	countingWindow,
	currentRules,
	isCalendarDate,
	type RynkeRules,
} from "./rules";
import { type Attendance, isEventKind } from "./team-events";

/** An event as an organiser enters it; checked before anything is read. */
export interface TeamEventInput {
	kind: string;
	date: string;
	name: string | null;
}

/** `by` is the organiser making the change (feature 014 FR-040). */
export type TeamEventChange =
	| { kind: "create-event"; event: TeamEventInput; by?: string }
	| {
			kind: "update-event";
			eventId: number;
			event: TeamEventInput;
			by?: string;
	  }
	| { kind: "delete-event"; eventId: number }
	| {
			kind: "add-attendance";
			eventId: number;
			athleteIds: string[];
			by?: string;
	  }
	| { kind: "remove-attendance"; eventId: number; athleteIds: string[] };

/** The refusal codes of contracts/ride-evaluation.md; nothing was written. */
export class TeamEventRefused extends Error {
	readonly code:
		| "unknown_kind"
		| "invalid_date"
		| "invalid_name"
		| "event_missing"
		| "rider_not_connected";

	constructor(code: TeamEventRefused["code"]) {
		super(`team-event change refused: ${code}`);
		this.name = "TeamEventRefused";
		this.code = code;
	}
}

export interface TeamEventResult {
	eventId: number | null;
	affected: string[];
	rose: string[];
	/** The affected riders with a new personal badge (feature 013 R17). */
	earned: string[];
}

/**
 * Applies a team-event change and re-evaluates every affected rider, all in
 * one batch (research R21). Refusals throw `TeamEventRefused` before anything
 * is written. `eventId` is set for `create-event` only; `rose` lists the
 * affected riders whose Rynke rose, `earned` those with a new badge, sorted.
 */
export async function applyTeamEventChange(
	db: D1Database,
	change: TeamEventChange,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
	news: BadgeNewsSwitch = BADGE_NEWS_ON,
): Promise<TeamEventResult> {
	if (change.kind === "create-event") {
		const event = validEvent(change.event);
		const eventId = await insertTeamEventStatement(
			db,
			event,
			change.by ?? null,
			now,
		).first<number>("event_id");
		if (event.kind !== "tour_de_paris" || eventId === null) {
			return { eventId, affected: [], rose: [], earned: [] };
		}
		// A new tour day numbers the later ones anew (feature 021 FR-012).
		const day = { eventId, date: event.date };
		return withCurrentRiders(async () => {
			const others = await tourRiders(db, window);
			const { riders } = await readRiders(db, others, []);
			for (const state of riders.values()) {
				state.tourEvents = state.tourEvents.filter(
					(e) => e.eventId !== eventId,
				);
			}
			const result = reevaluateAll(
				db,
				others,
				riders,
				rules,
				window,
				now,
				news,
				(state) => {
					state.tourEvents = [...state.tourEvents, day];
				},
			);
			await storeEvaluated(db, riders, result.writes);
			return {
				eventId,
				affected: others,
				rose: result.risen,
				earned: result.earned,
			};
		});
	}
	const event =
		change.kind === "update-event" ? validEvent(change.event) : null;
	return withCurrentRiders(() =>
		storeEventChange(db, change, event, rules, window, now, news),
	);
}

/**
 * One try of `applyTeamEventChange` for an event already stored; `event` is
 * the checked input of `update-event`.
 */
async function storeEventChange(
	db: D1Database,
	change: Exclude<TeamEventChange, { kind: "create-event" }>,
	event: TeamEventFields | null,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
	news: BadgeNewsSwitch,
): Promise<TeamEventResult> {
	const { eventId } = change;

	const reads = [
		readTeamEventStatement(db, eventId),
		listEventAttendeesStatement(db, eventId),
		listTourRidersStatement(db, window.seasonStart),
	];
	if (change.kind === "add-attendance") {
		reads.push(riderStatusesStatement(db, change.athleteIds));
	}
	const [eventRows, attendeeRows, tourRiderRows, statusRows] =
		await db.batch(reads);
	if (!eventRows || !attendeeRows || !tourRiderRows) {
		throw new Error("D1 batch returned too few results");
	}
	const stored = (eventRows.results as TeamEventRow[])[0];
	if (!stored) throw new TeamEventRefused("event_missing");
	const attendees = new Set(
		(attendeeRows.results as { athlete_id: string }[]).map((r) => r.athlete_id),
	);

	let affected: string[];
	let statement: D1PreparedStatement | null;
	/** The rider's attendance with the change applied. */
	let edit: (attendance: Attendance[]) => Attendance[];
	/** The tour days with the change applied (feature 021 FR-012). */
	let editTour: ((tour: TourEvent[]) => TourEvent[]) | null = null;
	const without = (attendance: Attendance[]) =>
		attendance.filter((a) => a.eventId !== eventId);
	const withoutDay = (tour: TourEvent[]) =>
		tour.filter((e) => e.eventId !== eventId);
	switch (change.kind) {
		case "update-event": {
			const next = event as TeamEventFields;
			const counted =
				next.kind !== stored.kind || next.date !== stored.event_date;
			affected = counted ? [...attendees] : [];
			if (
				counted &&
				(stored.kind === "tour_de_paris" || next.kind === "tour_de_paris")
			) {
				editTour = (tour) =>
					next.kind === "tour_de_paris"
						? [...withoutDay(tour), { eventId, date: next.date }]
						: withoutDay(tour);
			}
			statement =
				counted || next.name !== stored.name
					? updateTeamEventStatement(db, eventId, next, change.by ?? null, now)
					: null;
			edit = (attendance) => [
				...without(attendance),
				{ eventId, kind: next.kind, date: next.date },
			];
			break;
		}
		case "delete-event":
			affected = [...attendees];
			statement = deleteTeamEventStatement(db, eventId);
			edit = without;
			if (stored.kind === "tour_de_paris") editTour = withoutDay;
			break;
		case "add-attendance": {
			const statuses = new Map(
				(
					(statusRows?.results ?? []) as {
						athlete_id: string;
						status: string;
					}[]
				).map((r) => [r.athlete_id, r.status]),
			);
			if (change.athleteIds.some((id) => statuses.get(id) !== "connected")) {
				throw new TeamEventRefused("rider_not_connected");
			}
			affected = [...new Set(change.athleteIds)].filter(
				(id) => !attendees.has(id),
			);
			statement =
				affected.length > 0
					? insertAttendancesStatement(
							db,
							eventId,
							affected,
							change.by ?? null,
							now,
						)
					: null;
			edit = (attendance) => [
				...attendance,
				{ eventId, kind: stored.kind, date: stored.event_date },
			];
			break;
		}
		case "remove-attendance":
			affected = [...new Set(change.athleteIds)].filter((id) =>
				attendees.has(id),
			);
			statement =
				affected.length > 0
					? deleteAttendancesStatement(db, eventId, affected)
					: null;
			edit = without;
			break;
	}
	const writes = statement ? [statement] : [];
	if (change.kind === "add-attendance") {
		// Recorded attendance replaces the riders' reports (019 research R3).
		writes.push(deleteReportsStatement(db, eventId, change.athleteIds));
	}
	// A tour day added, moved or gone numbers the days anew for every rider
	// at one (feature 021 FR-012).
	const direct = new Set(affected);
	if (editTour) {
		const others = (tourRiderRows.results as { athlete_id: string }[]).map(
			(r) => r.athlete_id,
		);
		affected = [...new Set([...affected, ...others])];
	}
	affected.sort(compareIds);
	let risen: string[] = [];
	let earned: string[] = [];
	let riders = new Map<string, RiderState>();
	if (affected.length > 0) {
		({ riders } = await readRiders(db, affected, []));
		const result = reevaluateAll(
			db,
			affected,
			riders,
			rules,
			window,
			now,
			news,
			(state, athleteId) => {
				if (direct.has(athleteId)) state.attendance = edit(state.attendance);
				if (editTour) state.tourEvents = editTour(state.tourEvents);
			},
		);
		writes.push(...result.writes);
		risen = result.risen;
		earned = result.earned;
	}
	await storeEvaluated(db, riders, writes);
	return { eventId: null, affected, rose: risen, earned };
}

/**
 * Each rider's `reevaluate` with `edit`: the writes, and who rose or earned a
 * badge.
 */
function reevaluateAll(
	db: D1Database,
	athleteIds: readonly string[],
	riders: Map<string, RiderState>,
	rules: RynkeRules,
	window: CountingWindow,
	now: number,
	news: BadgeNewsSwitch,
	edit: (state: RiderState, athleteId: string) => void,
): { writes: D1PreparedStatement[]; risen: string[]; earned: string[] } {
	const writes: D1PreparedStatement[] = [];
	const risen: string[] = [];
	const earned: string[] = [];
	for (const athleteId of athleteIds) {
		const result = reevaluate(
			db,
			athleteId,
			riders.get(athleteId) as RiderState,
			rules,
			window,
			now,
			news,
			(state) => edit(state, athleteId),
		);
		writes.push(...result.writes);
		if (result.rose) risen.push(athleteId);
		if (result.badges.length > 0) earned.push(athleteId);
	}
	return { writes, risen, earned };
}

/** The riders recorded at a tour day of the season (feature 021 FR-012). */
async function tourRiders(
	db: D1Database,
	window: CountingWindow,
): Promise<string[]> {
	const { results } = await listTourRidersStatement(
		db,
		window.seasonStart,
	).all<{
		athlete_id: string;
	}>();
	return results.map((r) => r.athlete_id);
}

/**
 * `applyTeamEventChange` under the current rules, for callers outside the
 * serial queue consumer (the organiser pages). One `evaluate-rider` per
 * affected rider then settles a race with another change to the same event:
 * its stored attendees are counted, but not the event (research R21, review
 * L-18).
 * Each rider whose Rynke rose or who has a new badge gets a notification on
 * their devices (feature 013 research R17), as does each listed rider a new
 * team badge is new to (#125).
 */
export async function teamEventChange(
	ctx: Ctx,
	change: TeamEventChange,
): Promise<TeamEventResult> {
	// A team without events records none, and a kind it doesn't have is
	// refused (feature 039 research R6).
	if (
		!hasEvents(ctx.team) ||
		("event" in change && !isTeamKind(ctx, change.event.kind))
	) {
		throw new TeamEventRefused("unknown_kind");
	}
	const result = await applyTeamEventChange(
		ctx.env.DB,
		change,
		currentRules(ctx.team.rules),
		countingWindow(ctx.env),
		ctx.now(),
		{ badges: badgesOn(ctx.env) },
	);
	await sendAll(
		ctx,
		result.affected.map((athleteId) => ({ kind: "evaluate-rider", athleteId })),
	);
	const team = await teamBadgeNews(ctx, result.earned);
	await notifyRiders(
		ctx,
		[...new Set([...result.rose, ...result.earned, ...team])].sort(compareIds),
	);
	return result;
}

function isTeamKind(ctx: Ctx, kind: string): boolean {
	return (ctx.team.eventKinds as readonly string[]).includes(kind);
}

function validEvent(event: TeamEventInput): TeamEventFields {
	if (!isEventKind(event.kind)) throw new TeamEventRefused("unknown_kind");
	if (!isCalendarDate(event.date)) throw new TeamEventRefused("invalid_date");
	// Characters as SQLite's length() counts them.
	const length = event.name === null ? null : [...event.name].length;
	if (length !== null && (length < 1 || length > 100)) {
		throw new TeamEventRefused("invalid_name");
	}
	return { kind: event.kind, date: event.date, name: event.name };
}
