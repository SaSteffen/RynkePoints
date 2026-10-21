import { berlinDate } from "../../config";
import { hasAgreed } from "../../consent";
import type { Ctx } from "../../ctx";
import {
	attendedStatement,
	deleteReportsStatement,
	insertReportStatement,
	isListedStatement,
	listRiderEventsStatement,
	type RiderEventRow,
} from "../../db/participation";
import {
	readTeamEventStatement,
	type TeamEventRecordRow,
} from "../../db/team-events";
import type { I18n } from "../../i18n/i18n";
import {
	hasTakenPlace,
	type ReportState,
	reportState,
} from "../../rynke/participation";
import {
	CURRENT_RULES,
	countingWindow,
	eventInWindow,
} from "../../rynke/rules";
import { isTeamEventKind } from "../../rynke/team-events";
import { miniCoin } from "../coin";
import { forbidden } from "../errors";
import { html, type SafeHtml } from "../html";
import { CHECK, CLOSE, PLUS } from "../icons";
import { redirect } from "../redirect";
import { isSameOrigin } from "../session";
import { shellPage } from "../shell";
import { readViewer, riderConsentState } from "../viewer";

// The Termine tab at `/events` (feature 019 US1–US3, contracts/pages.md,
// contracts/http-routes.md): the counting window's team events for riders who
// aren't organisers, with "Bin dabei" before an event and "Ich war dabei"
// after it. A report earns nothing (FR-008) and says nothing about other
// riders (FR-010); organisers manage attendance on the Orga pages instead.

const PATH = "/events";

/** Past events shown before "Alle zeigen" (FR-001). */
const PAST_SHOWN = 5;

const ERRORS = ["event_over", "already_attending", "event_missing"] as const;

type Refusal = (typeof ERRORS)[number];

/** One event as the tab shows it. */
interface ShownEvent {
	row: RiderEventRow;
	state: ReportState;
}

function notice(url: URL, i18n: I18n): SafeHtml | null {
	const error = url.searchParams.get("error");
	if ((ERRORS as readonly (string | null)[]).includes(error)) {
		return html`<p class="notice notice-error" role="alert">${i18n.t(`events.error.${error as Refusal}`)}</p>
`;
	}
	return null;
}

/** Weekday, day and month for the date block, in the page's language. */
function dateParts(i18n: I18n, date: string) {
	const at = new Date(`${date}T00:00:00Z`);
	const part = (options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(i18n.t("meta.intlLocale"), {
			...options,
			timeZone: "UTC",
		}).format(at);
	return {
		weekday: part({ weekday: "short" }),
		day: part({ day: "numeric" }),
		month: part({ month: "short" }),
	};
}

/** The event's button, or what it says once attendance is recorded. */
function action(i18n: I18n, event: ShownEvent): SafeHtml {
	const report = `${PATH}/${event.row.event_id}/report`;
	switch (event.state) {
		case "join":
			return html`<form method="post" action="${report}" data-swap><button class="event-button event-join"><span class="event-now">${PLUS}<span>${i18n.t("events.join")}</span></span><span class="event-next">${CHECK}<span>${i18n.t("events.join")}</span></span></button></form>`;
		case "intent":
			return html`<form method="post" action="${report}/delete" data-swap><button class="event-button event-joined" aria-pressed="true" aria-label="${i18n.t("events.joined.label")}"><span class="event-now">${CHECK}<span>${i18n.t("events.join")}</span></span><span class="event-next">${CLOSE}<span>${i18n.t("events.leave")}</span></span></button></form>`;
		case "report":
			return html`<form method="post" action="${report}" data-swap><button class="event-button event-report"><span class="event-now">${PLUS}<span>${i18n.t("events.report")}</span></span><span class="event-next">${CHECK}<span>${i18n.t("events.report")}</span></span></button></form>`;
		case "request":
			return html`<button type="button" class="event-button event-reported" aria-disabled="true" aria-label="${i18n.t("events.reported.label")}">${CHECK}<span>${i18n.t("events.report")}</span></button>`;
		case "attended":
			return html`<p class="event-attended">${CHECK}<span>${i18n.t("events.attended")}</span></p>`;
	}
}

function card(i18n: I18n, event: ShownEvent): SafeHtml {
	const { row } = event;
	const parts = dateParts(i18n, row.event_date);
	// A tour day earns nothing, so it shows no amounts (feature 021 FR-004).
	const amounts = isTeamEventKind(row.kind)
		? CURRENT_RULES.teamEvents[row.kind]
		: null;
	const date = i18n.formatDate(`${row.event_date}T00:00:00Z`);
	const name =
		row.name === null
			? null
			: html`<p class="event-name">${row.name}</p>
`;
	return html`<li class="event-card card event-state-${event.state}" id="event-${row.event_id}">
<span class="event-date" aria-hidden="true"><span>${parts.weekday}</span><span class="event-day">${parts.day}</span><span>${parts.month}</span></span>
<div class="event-body">
<p class="event-kind"><span class="visually-hidden">${date} · </span>${i18n.t(`rynke.source.${row.kind}`)}</p>
${name}<div class="event-foot">${
		amounts === null
			? null
			: html`<p class="event-amounts"><span class="chip">${miniCoin("team")}${i18n.t("events.amount.team", { n: String(amounts.team) })}</span><span class="chip">${miniCoin("training")}${i18n.t("events.amount.training", { n: String(amounts.training) })}</span></p>
`
	}${action(i18n, event)}</div>
</div>
</li>
`;
}

/** The tab's body below the notice, in the order of contracts/pages.md. */
export function eventsBody(
	i18n: I18n,
	rows: readonly RiderEventRow[],
	today: string,
	deadline: string,
	allPast: boolean,
): SafeHtml {
	const shown = rows.map((row) => ({
		row,
		state: reportState({
			date: row.event_date,
			today,
			attended: row.attended === 1,
			reported: row.reported === 1,
		}),
	}));
	const upcoming = shown.filter((e) => !hasTakenPlace(e.row.event_date, today));
	const past = shown
		.filter((e) => hasTakenPlace(e.row.event_date, today))
		.reverse();
	const pastShown = allPast ? past : past.slice(0, PAST_SHOWN);
	const list = (events: readonly ShownEvent[]) =>
		html`<ol class="event-list">
${events.map((e) => card(i18n, e))}</ol>
`;
	const more =
		pastShown.length < past.length
			? html`<p><a class="more-link" href="${PATH}?past=all#past" data-swap>${i18n.t("events.past.all")}</a></p>
`
			: null;
	return html`<section class="events">
<div class="events-head"><h2>${i18n.t("events.heading")}</h2><span>${i18n.t("events.until", { date: i18n.formatDate(`${deadline}T00:00:00Z`) })}</span></div>
<aside class="events-note card"><p class="events-note-title">${i18n.t("events.note.title")}</p><p>${i18n.t("events.note.body")}</p></aside>
<h3>${i18n.t("events.upcoming")}</h3>
${upcoming.length > 0 ? html`<p class="team-hint">${i18n.t("events.upcoming.hint")}</p>${list(upcoming)}` : html`<p class="team-hint">${i18n.t("events.upcoming.none")}</p>`}
<h3 id="past">${i18n.t("events.past")}</h3>
${past.length > 0 ? list(pastShown) : html`<p class="team-hint">${i18n.t("events.past.none")}</p>`}
${more}</section>
`;
}

/** `GET /events`: the Termine tab; organisers go to their Orga pages (R8). */
export function handleEvents(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const url = new URL(request.url);
	const allPast = url.searchParams.get("past") === "all";
	const window = countingWindow(ctx.env);
	return shellPage(
		request,
		ctx,
		i18n,
		"events",
		allPast ? `${PATH}?past=all` : PATH,
		async ({ rider }) => {
			if (rider.organiser) return redirect("/organiser", 302);
			const { results } = await listRiderEventsStatement(
				ctx.env.DB,
				rider.athleteId,
				window,
			).all<RiderEventRow>();
			return html`${notice(url, i18n)}${eventsBody(i18n, results, berlinDate(ctx.now()), window.deadline, allPast)}`;
		},
	);
}

/** `303` back to the event's card, with a notice only when refused. */
function back(eventId: number, error?: Refusal) {
	const query = error === undefined ? "" : `?error=${error}`;
	return redirect(`${PATH}${query}#event-${eventId}`, 303);
}

/**
 * Creates (`withdraw` false) or withdraws the viewer's report, after the
 * checks of research R13. Organisers and anyone not allowed get 403.
 */
async function changeReport(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
	withdraw: boolean,
): Promise<Response> {
	const path = `${PATH}/${eventId}/report${withdraw ? "/delete" : ""}`;
	if (!isSameOrigin(request)) return forbidden(i18n, path);
	const viewer = await readViewer(request, ctx);
	if (
		viewer.kind === "visitor" ||
		!hasAgreed(riderConsentState(viewer, ctx)) ||
		viewer.rider.organiser
	) {
		return forbidden(i18n, path);
	}
	const { athleteId } = viewer.rider;
	const db = ctx.env.DB;
	const [eventRows, listedRows, attendedRows] = await db.batch([
		readTeamEventStatement(db, eventId),
		isListedStatement(db, athleteId),
		attendedStatement(db, eventId, athleteId),
	]);
	if (((listedRows?.results ?? []) as { n: number }[])[0]?.n !== 1) {
		return forbidden(i18n, path);
	}
	const event = (eventRows?.results as TeamEventRecordRow[] | undefined)?.[0];
	if (
		!event ||
		!eventInWindow(event.kind, event.event_date, countingWindow(ctx.env))
	) {
		return redirect(`${PATH}?error=event_missing`, 303);
	}
	if (((attendedRows?.results ?? []) as { n: number }[])[0]?.n === 1) {
		return back(eventId, "already_attending");
	}
	if (withdraw) {
		if (hasTakenPlace(event.event_date, berlinDate(ctx.now()))) {
			return back(eventId, "event_over");
		}
		await deleteReportsStatement(db, eventId, [athleteId]).run();
		return back(eventId);
	}
	await insertReportStatement(db, eventId, athleteId, ctx.now()).run();
	return back(eventId);
}

/** `POST /events/{id}/report`: "Bin dabei" or "Ich war dabei" (FR-004, FR-005). */
export function handleReport(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
): Promise<Response> {
	return changeReport(request, ctx, i18n, eventId, false);
}

/** `POST /events/{id}/report/delete`: "Doch nicht dabei" (FR-004). */
export function handleWithdraw(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
	eventId: number,
): Promise<Response> {
	return changeReport(request, ctx, i18n, eventId, true);
}
