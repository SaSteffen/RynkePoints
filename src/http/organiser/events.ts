import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import {
	listTeamEventsStatement,
	readTeamEventStatement,
	type TeamEventListRow,
	type TeamEventRecordRow,
} from "../../db/team-events";
import type { I18n } from "../../i18n/i18n";
import { TeamEventRefused, teamEventChange } from "../../rynke/apply";
import {
	countingWindow,
	inCountingWindow,
	isCalendarDate,
} from "../../rynke/rules";
import { TEAM_EVENT_KINDS, type TeamEventKind } from "../../rynke/team-events";
import { notFound } from "../errors";
import { html, type SafeHtml } from "../html";
import {
	changeRecord,
	noticeFromQuery,
	organiserPage,
	redirectWith,
	requireOrganiserPost,
} from "./access";
import { attendanceSection, isFutureEvent, readAttendance } from "./attendance";

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
		kind: field("kind") as TeamEventKind,
		date: field("date"),
		name: name === "" ? null : name,
	};
}

/** Whether a valid `date` falls outside the season (R5). */
function outsideSeason(ctx: Ctx, date: string): boolean {
	return (
		isCalendarDate(date) && !inCountingWindow(date, countingWindow(ctx.env))
	);
}

/** The kind, date and name fields, filled with `event`. */
function eventFields(
	i18n: I18n,
	event: { kind: TeamEventKind; event_date: string; name: string | null },
): SafeHtml {
	const options = TEAM_EVENT_KINDS.map(
		(kind) =>
			html`<option value="${kind}"${kind === event.kind ? html` selected` : ""}>${i18n.t(`rynke.source.${kind}`)}</option>`,
	);
	return html`<label>${i18n.t("organiser.field.kind")}<select name="kind" required>${options}</select></label>
<label>${i18n.t("organiser.field.date")}<input type="date" name="date" value="${event.event_date}" required></label>
<label>${i18n.t("organiser.field.name")}<input type="text" name="name" value="${event.name ?? ""}" maxlength="100"></label>`;
}

function listItem(i18n: I18n, event: TeamEventListRow): SafeHtml {
	return html`<li class="organiser-event"><a href="${eventPath(event.event_id)}">
<span class="organiser-event-title">${i18n.formatDate(`${event.event_date}T00:00:00Z`)} · ${i18n.t(`rynke.source.${event.kind}`)}</span>
${event.name === null ? "" : html`<span class="organiser-event-name">${event.name}</span>`}
<span>${i18n.t("organiser.events.attendees", { count: String(event.attendees) })}</span>
</a>
${changeRecord(i18n, event.changed_by_name, event.changed_at)}</li>`;
}

/** `GET /organiser`: the season's events, newest first, and a new one. */
export function handleOrganiserEvents(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	return organiserPage(request, ctx, i18n, LIST, async () => {
		const { results } = await listTeamEventsStatement(
			ctx.env.DB,
			ctx.env.SEASON_START_DATE,
		).all<TeamEventListRow>();
		const list =
			results.length === 0
				? html`<p>${i18n.t("organiser.events.none")}</p>`
				: html`<ul class="organiser-events">${results.map((e) => listItem(i18n, e))}</ul>`;
		const today = {
			kind: TEAM_EVENT_KINDS[0],
			event_date: berlinDate(ctx.now()),
			name: null,
		};
		return html`${noticeFromQuery(new URL(request.url), i18n)}
<section class="organiser">
<p><a href="/organiser/riders">${i18n.t("organiser.riders.link")}</a></p>
<h2>${i18n.t("organiser.events.new")}</h2>
<form method="post" action="/organiser/events" class="organiser-form">
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
		const { riders, attendees } = await readAttendance(ctx, eventId);
		const future = isFutureEvent(ctx, event.event_date);
		return html`${noticeFromQuery(new URL(request.url), i18n)}
<section class="organiser">
<p><a href="${LIST}">${i18n.t("organiser.back")}</a></p>
<h2>${i18n.t("organiser.event.heading")}</h2>
<form method="post" action="${path}" class="organiser-form">
${eventFields(i18n, event)}
<button class="button">${i18n.t("organiser.save")}</button>
</form>
${changeRecord(i18n, event.changed_by_name, event.changed_at)}
${attendanceSection(i18n, { eventId, future }, riders, attendees)}
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
	if (outsideSeason(ctx, event.date)) {
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
	if (event.date !== stored.event_date && outsideSeason(ctx, event.date)) {
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
