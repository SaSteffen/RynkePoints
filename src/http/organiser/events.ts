import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import {
	type ListedRiderRow,
	listListedRidersStatement,
} from "../../db/organiser";
import {
	countIntentsStatement,
	type IntentCountRow,
	listAttendedEventsStatement,
	listOpenRequestsStatement,
	type OpenRequestRow,
} from "../../db/participation";
import {
	listTeamEventsStatement,
	readTeamEventStatement,
	type TeamEventListRow,
	type TeamEventRecordRow,
} from "../../db/team-events";
import type { I18n } from "../../i18n/i18n";
import { TeamEventRefused, teamEventChange } from "../../rynke/apply";
import { hasTakenPlace } from "../../rynke/participation";
import {
	countingWindow,
	eventInWindow,
	isCalendarDate,
} from "../../rynke/rules";
import {
	EVENT_KINDS,
	type EventKind,
	isEventKind,
	TEAM_EVENT_KINDS,
} from "../../rynke/team-events";
import { notFound } from "../errors";
import { html, type SafeHtml } from "../html";
import { PLUS } from "../icons";
import { redirect } from "../redirect";
import { renderExampleNote } from "../rider-sections";
import {
	EXAMPLE_PAST_EVENT_ID,
	EXAMPLE_UPCOMING_EVENT_ID,
	exampleTeam,
} from "../tour-example";
import type { TourTarget } from "../tour-targets";
import {
	changeRecord,
	noticeFromQuery,
	organiserPage,
	organiserSwitch,
	redirectWith,
	requireOrganiserPost,
} from "./access";
import {
	attendanceNotice,
	attendanceSection,
	isFutureEvent,
	readAttendance,
} from "./attendance";
import { decisionNotice, openRequestsBlock } from "./requests";

// The organiser's team events (feature 014 Story 1, contracts/http-routes.md):
// the season's list with a new-event form at `/organiser`, and each event's
// edit form, attendance checklist and delete confirmation at
// `/organiser/events/{id}`. Every change
// goes through `teamEventChange`, so the riders' Rynke follow (FR-011–FR-013).
// The season check is this layer's (research R5); 003 checks the rest.

const LIST = "/organiser";

const eventPath = (id: number) => `/organiser/events/${id}`;

/** The form's fields, `name` trimmed and empty meaning none. */
async function eventForm(request: Request) {
	const form = await request.formData();
	const field = (key: string) => {
		const value = form.get(key);
		return typeof value === "string" ? value : "";
	};
	const name = field("name").trim();
	return {
		kind: field("kind") as EventKind,
		date: field("date"),
		name: name === "" ? null : name,
	};
}

/**
 * Whether a valid `date` falls outside the season (R5) for an event of `kind`:
 * a tour day may lie after the deadline (feature 021 FR-003). An unknown kind
 * is 003's to refuse.
 */
function outsideSeason(ctx: Ctx, kind: string, date: string): boolean {
	return (
		isCalendarDate(date) &&
		isEventKind(kind) &&
		!eventInWindow(kind, date, countingWindow(ctx.env))
	);
}

/** The kind, date and name fields, filled with `event`. */
function eventFields(
	i18n: I18n,
	event: { kind: EventKind; event_date: string; name: string | null },
): SafeHtml {
	const options = EVENT_KINDS.map(
		(kind) =>
			html`<option value="${kind}"${kind === event.kind ? html` selected` : ""}>${i18n.t(`rynke.source.${kind}`)}</option>`,
	);
	return html`<label>${i18n.t("organiser.field.kind")}<select name="kind" required>${options}</select></label>
<label>${i18n.t("organiser.field.date")}<input type="date" name="date" value="${event.event_date}" required></label>
<label>${i18n.t("organiser.field.name")}<input type="text" name="name" value="${event.name ?? ""}" maxlength="100"></label>`;
}

/** What feature 019 adds to an event in the list. */
interface ListExtras {
	past: boolean;
	/** Open requests at a past event. */
	open: number;
	/** Intents at an event still to come. */
	intents: number;
	/** Whether the viewing organiser attended. */
	you: boolean;
}

function listItem(
	i18n: I18n,
	event: TeamEventListRow,
	extras: ListExtras,
	target: TourTarget | null,
): SafeHtml {
	const count = { count: String(event.attendees) };
	const people = extras.past
		? html`<span>${i18n.t(extras.you ? "organiser.events.attendees.you" : "organiser.events.attendees", count)}</span>`
		: null;
	const open =
		extras.open > 0
			? html`<span class="chip chip-alert">${i18n.t("organiser.events.open", { count: String(extras.open) })}</span>`
			: null;
	const intents =
		extras.intents > 0
			? html`<span class="chip chip-team">${i18n.t("organiser.events.intents", { count: String(extras.intents) })}</span>`
			: null;
	const chips =
		open || intents
			? html`<span class="event-chips">${open}${intents}</span>`
			: null;
	// "Ich war auch dabei": past events only, no intent (019 FR-036).
	const self =
		extras.past && !extras.you
			? html`<form method="post" action="${eventPath(event.event_id)}/self" class="self-form" data-swap><button class="button-outlined">${PLUS}<span>${i18n.t("organiser.events.self")}</span></button></form>`
			: null;
	return html`<li class="organiser-event" id="${target ?? `event-${event.event_id}`}"><a href="${eventPath(event.event_id)}">
<span class="organiser-event-title">${i18n.formatDate(`${event.event_date}T00:00:00Z`)} · ${i18n.t(`rynke.source.${event.kind}`)}</span>
${event.name === null ? "" : html`<span class="organiser-event-name">${event.name}</span>`}
${people}${chips}</a>
${self}${changeRecord(i18n, event.changed_by_name, event.changed_at)}</li>`;
}

/** What the events page reads (feature 019 adds requests, intents, `you`). */
interface EventsRead {
	events: readonly TeamEventListRow[];
	requests: readonly OpenRequestRow[];
	intents: ReadonlyMap<number, number>;
	/** The events the viewing organiser attended. */
	attended: ReadonlySet<number>;
	listed: readonly ListedRiderRow[];
}

async function readEvents(
	ctx: Ctx,
	organiser: number,
	day: string,
): Promise<EventsRead> {
	const db = ctx.env.DB;
	const window = countingWindow(ctx.env);
	const [eventRows, requestRows, intentRows, attendedRows, listedRows] =
		await db.batch([
			listTeamEventsStatement(db, ctx.env.SEASON_START_DATE),
			listOpenRequestsStatement(db, day, window),
			countIntentsStatement(db, day, window),
			listAttendedEventsStatement(db, organiser),
			listListedRidersStatement(db),
		]);
	return {
		events: (eventRows?.results ?? []) as TeamEventListRow[],
		requests: (requestRows?.results ?? []) as OpenRequestRow[],
		intents: new Map(
			((intentRows?.results ?? []) as IntentCountRow[]).map((r) => [
				r.event_id,
				r.intents,
			]),
		),
		attended: new Set(
			((attendedRows?.results ?? []) as { event_id: number }[]).map(
				(r) => r.event_id,
			),
		),
		listed: (listedRows?.results ?? []) as ListedRiderRow[],
	};
}

/**
 * Where the organiser tour's steps point on its example (feature 020 FR-013):
 * the upcoming event and the past one.
 */
const EXAMPLE_TARGETS: ReadonlyMap<number, TourTarget> = new Map([
	[EXAMPLE_UPCOMING_EVENT_ID, "tour-later-event"],
	[EXAMPLE_PAST_EVENT_ID, "tour-past-event"],
]);

/** `GET /organiser`: the season's events, newest first, and a new one. */
export function handleOrganiserEvents(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return organiserPage(request, ctx, i18n, LIST, async ({ rider, example }) => {
		const day = berlinDate(ctx.now());
		// On the organiser tour's steps, the example team's requests and events,
		// which can't be used, around the real new-event form (feature 020
		// FR-013, FR-014).
		const read: EventsRead = example
			? exampleTeam(countingWindow(ctx.env), day)
			: await readEvents(ctx, rider.athleteId, day);
		const { events, requests, intents, attended, listed } = read;
		const inert = example ? html` inert` : null;
		const item = (e: TeamEventListRow) =>
			listItem(
				i18n,
				e,
				{
					past: hasTakenPlace(e.event_date, day),
					open: requests.filter((r) => r.event_id === e.event_id).length,
					intents: intents.get(e.event_id) ?? 0,
					you: attended.has(e.event_id),
				},
				example ? (EXAMPLE_TARGETS.get(e.event_id) ?? null) : null,
			);
		const upcoming = events
			.filter((e) => !hasTakenPlace(e.event_date, day))
			.reverse();
		const past = events.filter((e) => hasTakenPlace(e.event_date, day));
		const group = (heading: SafeHtml, list: readonly TeamEventListRow[]) =>
			list.length === 0
				? null
				: html`${heading}<ul class="organiser-events"${inert}>${list.map(item)}</ul>`;
		const list =
			events.length === 0
				? html`<p>${i18n.t("organiser.events.none")}</p>`
				: html`${group(html`<h3>${i18n.t("organiser.events.upcoming")}</h3>`, upcoming)}${group(html`<h3>${i18n.t("organiser.events.past")}</h3>`, past)}`;
		const today = {
			kind: TEAM_EVENT_KINDS[0],
			event_date: day,
			name: null,
		};
		const url = new URL(request.url);
		const notices = example
			? renderExampleNote(i18n, "tour.organiser.example")
			: html`${await decisionNotice(url, ctx, i18n, LIST)}${noticeFromQuery(url, i18n)}`;
		return html`${organiserSwitch(i18n, "events", requests.length)}${notices}${openRequestsBlock(i18n, requests, LIST, listed, example)}
<section class="organiser">
<h2>${i18n.t("organiser.events.new")}</h2>
<form method="post" action="/organiser/events" class="organiser-form" id="tour-new-event">
${eventFields(i18n, today)}
<button class="button">${i18n.t("organiser.add")}</button>
</form>
<h2>${i18n.t("organiser.events.heading")}</h2>
${list}
</section>`;
	});
}

/**
 * `GET /organiser/events/{id}`: the edit form, the attendance checklist and the
 * delete confirmation.
 */
export function handleOrganiserEvent(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
): Promise<Response> {
	const path = eventPath(eventId);
	return organiserPage(request, ctx, i18n, path, async () => {
		const event = await readTeamEventStatement(
			ctx.env.DB,
			eventId,
		).first<TeamEventRecordRow>();
		if (!event) return notFound(i18n, path);
		const { riders, attendees, reports } = await readAttendance(ctx, eventId);
		const future = isFutureEvent(ctx, event.event_date);
		return html`${attendanceNotice(new URL(request.url), i18n)}
<section class="organiser">
<p><a href="${LIST}">${i18n.t("organiser.back")}</a></p>
<h2>${i18n.t("organiser.event.heading")}</h2>
<form method="post" action="${path}" class="organiser-form">
${eventFields(i18n, event)}
<button class="button">${i18n.t("organiser.save")}</button>
</form>
${changeRecord(i18n, event.changed_by_name, event.changed_at)}
${attendanceSection(i18n, { eventId, future }, riders, attendees, reports)}
<details class="organiser-confirm">
<summary>${i18n.t("organiser.event.delete")}</summary>
<p>${i18n.t("organiser.event.deleteWarning")}</p>
<form method="post" action="${path}/delete"><button class="danger">${i18n.t("organiser.event.deleteConfirm")}</button></form>
</details>
</section>`;
	});
}

/** `POST /organiser/events`: a new event (FR-011). */
export async function handleCreateEvent(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const rider = await requireOrganiserPost(request, ctx, i18n, LIST);
	if (rider instanceof Response) return rider;
	const event = await eventForm(request);
	if (outsideSeason(ctx, event.kind, event.date)) {
		return redirectWith(LIST, "error", "outside_season");
	}
	try {
		const { eventId } = await teamEventChange(ctx, {
			kind: "create-event",
			event,
			by: rider.athleteId,
		});
		return redirectWith(eventPath(eventId ?? 0), "done", "created");
	} catch (error) {
		if (error instanceof TeamEventRefused) {
			return redirectWith(LIST, "error", error.code);
		}
		throw error;
	}
}

/** `POST /organiser/events/{id}`: kind, date and name (FR-011, FR-012). */
export async function handleUpdateEvent(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
): Promise<Response> {
	const path = eventPath(eventId);
	const rider = await requireOrganiserPost(request, ctx, i18n, path);
	if (rider instanceof Response) return rider;
	const event = await eventForm(request);
	const stored = await readTeamEventStatement(
		ctx.env.DB,
		eventId,
	).first<TeamEventRecordRow>();
	if (!stored) return redirectWith(LIST, "error", "event_missing");
	if (
		(event.date !== stored.event_date || event.kind !== stored.kind) &&
		outsideSeason(ctx, event.kind, event.date)
	) {
		return redirectWith(path, "error", "outside_season");
	}
	try {
		await teamEventChange(ctx, {
			kind: "update-event",
			eventId,
			event,
			by: rider.athleteId,
		});
		return redirectWith(path, "done", "saved");
	} catch (error) {
		if (error instanceof TeamEventRefused) {
			return error.code === "event_missing"
				? redirectWith(LIST, "error", error.code)
				: redirectWith(path, "error", error.code);
		}
		throw error;
	}
}

/** `POST /organiser/events/{id}/delete`: the event and its attendance (FR-013). */
export async function handleDeleteEvent(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
): Promise<Response> {
	const rider = await requireOrganiserPost(
		request,
		ctx,
		i18n,
		`${eventPath(eventId)}/delete`,
	);
	if (rider instanceof Response) return rider;
	try {
		await teamEventChange(ctx, { kind: "delete-event", eventId });
		return redirectWith(LIST, "done", "deleted");
	} catch (error) {
		if (error instanceof TeamEventRefused) {
			return redirectWith(LIST, "error", error.code);
		}
		throw error;
	}
}

/**
 * `POST /organiser/events/{id}/self`: "Ich war auch dabei", the organiser's
 * own attendance at an event that has taken place (019 FR-036).
 */
export async function handleSelfAttendance(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
): Promise<Response> {
	const rider = await requireOrganiserPost(
		request,
		ctx,
		i18n,
		`${eventPath(eventId)}/self`,
	);
	if (rider instanceof Response) return rider;
	const event = await readTeamEventStatement(
		ctx.env.DB,
		eventId,
	).first<TeamEventRecordRow>();
	if (!event) return redirectWith(LIST, "error", "event_missing");
	if (isFutureEvent(ctx, event.event_date)) {
		return redirectWith(LIST, "error", "future_event");
	}
	try {
		await teamEventChange(ctx, {
			kind: "add-attendance",
			eventId,
			athleteIds: [rider.athleteId],
			by: rider.athleteId,
		});
		return redirect(`${LIST}?done=attendance#event-${eventId}`, 303);
	} catch (error) {
		if (error instanceof TeamEventRefused) {
			return redirectWith(LIST, "error", error.code);
		}
		throw error;
	}
}
