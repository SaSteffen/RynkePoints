import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import {
	type ListedRider,
	type ListedRiderRow,
	listListedRidersStatement,
	withProfileLinks,
} from "../../db/organiser";
import {
	listEventAttendeesStatement,
	readTeamEventStatement,
	type TeamEventRecordRow,
} from "../../db/team-events";
import type { I18n } from "../../i18n/i18n";
import { TeamEventRefused, teamEventChange } from "../../rynke/apply";
import { html, type SafeHtml } from "../html";
import { redirectWith, requireOrganiserPost } from "./access";

// Who attended an event (feature 014 Story 2, research R6): one checklist of
// the listed riders on the event page. Each checkbox carries the state the page
// showed, so a save applies only this organiser's ticks and unticks and leaves
// a rider another organiser ticked meanwhile alone. Riders who aren't listed
// are never touched. Attendance is recorded once the event has taken place
// (FR-022).

const LIST = "/organiser";

const eventPath = (id: number) => `/organiser/events/${id}`;

/** The listed riders and the event's attendees, for `attendanceSection`. */
export async function readAttendance(
	ctx: Ctx,
	eventId: number,
): Promise<{ riders: ListedRider[]; attendees: Set<number> }> {
	const [riderRows, attendeeRows] = await ctx.env.DB.batch([
		listListedRidersStatement(ctx.env.DB),
		listEventAttendeesStatement(ctx.env.DB, eventId),
	]);
	return {
		riders: withProfileLinks((riderRows?.results ?? []) as ListedRiderRow[]),
		attendees: new Set(
			((attendeeRows?.results ?? []) as { athlete_id: number }[]).map(
				(r) => r.athlete_id,
			),
		),
	};
}

/** Whether `date` is after today in Berlin (FR-022). */
export function isFutureEvent(ctx: Ctx, date: string): boolean {
	return date > berlinDate(ctx.now());
}

function riderItem(
	i18n: I18n,
	rider: ListedRider,
	attended: boolean,
	form: boolean,
): SafeHtml {
	const link =
		rider.profileLink === null
			? ""
			: html` <a href="${rider.profileLink}">${i18n.t("organiser.attendance.profile")}</a>`;
	if (!form) {
		return html`<li class="attendance-rider"><span class="rider-name">${rider.first_name}</span>${link}</li>`;
	}
	const id = rider.athlete_id;
	return html`<li class="attendance-rider"><label><input type="checkbox" name="attend" value="${id}"${attended ? html` checked` : ""}><span class="rider-name">${rider.first_name}</span></label><input type="hidden" name="shown" value="${id}:${attended ? 1 : 0}">${link}</li>`;
}

/**
 * The event page's checklist: one form with a checkbox per listed rider, or
 * for an event still to come only the list and a note (FR-020, FR-022).
 */
export function attendanceSection(
	i18n: I18n,
	event: { eventId: number; future: boolean },
	riders: ListedRider[],
	attendees: Set<number>,
): SafeHtml {
	const heading = html`<h2>${i18n.t("organiser.attendance.heading")}</h2>`;
	if (riders.length === 0) {
		return html`${heading}
<p>${i18n.t("organiser.attendance.none")}</p>`;
	}
	const items = (form: boolean) =>
		html`<ul class="attendance-list">${riders.map((r) =>
			riderItem(i18n, r, attendees.has(r.athlete_id), form),
		)}</ul>`;
	if (event.future) {
		return html`${heading}
<p>${i18n.t("organiser.attendance.future")}</p>
${items(false)}`;
	}
	return html`${heading}
<form method="post" action="${eventPath(event.eventId)}/attendance" class="attendance-form">
${items(true)}
<button class="button">${i18n.t("organiser.attendance.save")}</button>
</form>`;
}

/**
 * The ticks and unticks of the form: `add` ticked but shown unticked,
 * `remove` shown ticked but unticked; null when an id isn't listed or a
 * `shown` value is malformed.
 */
function attendanceDiff(
	form: FormData,
	listed: Set<number>,
): { add: number[]; remove: number[] } | null {
	const attend = new Set<number>();
	for (const value of form.getAll("attend")) {
		const id = Number(value);
		if (!listed.has(id)) return null;
		attend.add(id);
	}
	const shown = new Map<number, boolean>();
	for (const value of form.getAll("shown")) {
		const match = typeof value === "string" && value.match(/^(\d+):([01])$/);
		if (!match || !listed.has(Number(match[1]))) return null;
		shown.set(Number(match[1]), match[2] === "1");
	}
	return {
		add: [...attend].filter((id) => shown.get(id) !== true),
		remove: [...shown]
			.filter(([id, ticked]) => ticked && !attend.has(id))
			.map(([id]) => id),
	};
}

/** `POST /organiser/events/{id}/attendance`: the organiser's ticks (FR-021). */
export async function handleSaveAttendance(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
): Promise<Response> {
	const path = eventPath(eventId);
	const rider = await requireOrganiserPost(
		request,
		ctx,
		i18n,
		`${path}/attendance`,
	);
	if (rider instanceof Response) return rider;
	const form = await request.formData();
	const [eventRows, riderRows] = await ctx.env.DB.batch([
		readTeamEventStatement(ctx.env.DB, eventId),
		listListedRidersStatement(ctx.env.DB),
	]);
	const event = (eventRows?.results as TeamEventRecordRow[] | undefined)?.[0];
	if (!event) return redirectWith(LIST, "error", "event_missing");
	if (isFutureEvent(ctx, event.event_date)) {
		return redirectWith(path, "error", "future_event");
	}
	const listed = new Set(
		((riderRows?.results ?? []) as ListedRiderRow[]).map((r) => r.athlete_id),
	);
	const diff = attendanceDiff(form, listed);
	if (!diff) return redirectWith(path, "error", "rider_not_listed");
	try {
		if (diff.add.length > 0) {
			await teamEventChange(ctx, {
				kind: "add-attendance",
				eventId,
				athleteIds: diff.add,
				by: rider.athleteId,
			});
		}
		if (diff.remove.length > 0) {
			await teamEventChange(ctx, {
				kind: "remove-attendance",
				eventId,
				athleteIds: diff.remove,
			});
		}
		return redirectWith(path, "done", "attendance");
	} catch (error) {
		if (error instanceof TeamEventRefused) {
			return error.code === "event_missing"
				? redirectWith(LIST, "error", error.code)
				: redirectWith(path, "error", error.code);
		}
		throw error;
	}
}
