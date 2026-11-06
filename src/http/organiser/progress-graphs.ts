import type { GraphRow } from "../../db/organiser-graphs";
import type { MessageId } from "../../i18n/catalogs";
import type { I18n } from "../../i18n/i18n";
import type { RiderStatus } from "../../rynke/pace";
import type { CountingWindow } from "../../rynke/rules";
import type { RideEntry } from "../../rynke/summary";
import { dayNumber, lastDay as lastDayOf } from "../../rynke/weeks";
import { html, SafeHtml } from "../html";
import { monthsBefore } from "../progress-view";

// The organiser's Progress section (feature 029 contracts/pages.md): the pure
// step from stored rows to what the graphs receive, and the markup around the
// canvases `organiserGraphs()` in `public/app.js` draws on. Every word comes
// from the catalogs; the script only fills `data-slot` spans. A daily value only
// ever reaches this file for a rider the SQL found to have agreed (FR-024).

/** What the view needs of a listed rider, from the overview's. */
export interface GraphRider {
	athleteId: number;
	firstName: string;
	status: RiderStatus;
	profileLink: string | null;
}

export interface GraphRange {
	from: number;
	to: number;
}

/** `[dayIndex, outdoorM, virtualM, elevationDm, sessions]`, sparse. */
export type GraphDay = [number, number, number, number, number];

export interface OrganiserGraphs {
	firstDay: string;
	lastDay: string;
	presets: { season: GraphRange; "3m": GraphRange; "4w": GraphRange };
	agreedCount: number;
	group: string | null;
	riders: {
		id: number;
		name: string;
		status: RiderStatus;
		requests: boolean;
		profileLink: string | null;
		days: GraphDay[];
	}[];
	teamSum: {
		outdoorM: number[];
		virtualM: number[];
		elevationDm: number[];
		sessions: number[];
	};
	/** The Sessions graph is shown (feature 032, `RIDE_FIGURES` on). */
	sessions: boolean;
	notAgreed: { name: string; status: RiderStatus; requests: boolean }[];
}

/**
 * The figures per rider, and the team's over all who agreed, whichever are shown
 * (FR-011). A day outside the season is left out (FR-005). One past today, when a
 * rider's time zone is ahead of Berlin, goes on the last day (SC-005).
 */
export function organiserGraphsView(input: {
	rows: readonly GraphRow[];
	riders: readonly GraphRider[];
	requests: ReadonlyMap<number, readonly unknown[]>;
	window: Pick<CountingWindow, "seasonStart" | "deadline">;
	today: string;
	group: string | null;
	/**
	 * The counting rides of riders whose consent shares sessions by name
	 * (feature 032); null with `RIDE_FIGURES` off.
	 */
	rides?: ReadonlyMap<number, readonly RideEntry[]> | null;
}): OrganiserGraphs {
	const { rows, riders, requests, window, today, group } = input;
	const rides = input.rides ?? null;
	const firstDay = window.seasonStart;
	const lastDay =
		today < firstDay ? firstDay : lastDayOf(today, window.deadline);
	const start = dayNumber(firstDay);
	const lastIndex = dayNumber(lastDay) - start;
	const zeros = () => new Array<number>(lastIndex + 1).fill(0);
	const teamSum = {
		outdoorM: zeros(),
		virtualM: zeros(),
		elevationDm: zeros(),
		sessions: zeros(),
	};
	const byRider = new Map(rows.map((row) => [row.athleteId, row]));
	const hasRequests = (id: number) => (requests.get(id)?.length ?? 0) > 0;
	const indexOf = (date: string): number | null => {
		if (date < firstDay || date > window.deadline) return null;
		return Math.min(dayNumber(date) - start, lastIndex);
	};
	const agreed = riders
		.filter((rider) => byRider.has(rider.athleteId))
		.sort(byName);
	return {
		firstDay,
		lastDay,
		presets: {
			season: { from: 0, to: lastIndex },
			"3m": {
				from: Math.max(0, dayNumber(monthsBefore(lastDay, 3)) - start + 1),
				to: lastIndex,
			},
			"4w": { from: Math.max(0, lastIndex - 27), to: lastIndex },
		},
		agreedCount: agreed.length,
		group,
		riders: agreed.map((rider) => {
			const row = byRider.get(rider.athleteId);
			const virtual = new Map(row?.virtualDays);
			const days = new Map<number, GraphDay>();
			for (const [date, distanceM, , elevationDm] of row?.days ?? []) {
				const index = indexOf(date);
				if (index === null) continue;
				const virtualM = virtual.get(date) ?? 0;
				const day = days.get(index) ?? [index, 0, 0, 0, 0];
				day[1] += distanceM - virtualM;
				day[2] += virtualM;
				day[3] += elevationDm;
				days.set(index, day);
			}
			for (const [date] of rides?.get(rider.athleteId) ?? []) {
				const index = indexOf(date);
				if (index === null) continue;
				const day = days.get(index) ?? [index, 0, 0, 0, 0];
				day[4] += 1;
				days.set(index, day);
			}
			const rounded = [...days.values()]
				.sort((a, b) => a[0] - b[0])
				.map(
					([index, outdoor, virtualM, elevation, sessions]): GraphDay => [
						index,
						Math.round(outdoor),
						Math.round(virtualM),
						elevation,
						sessions,
					],
				);
			for (const [index, outdoor, virtualM, elevation, sessions] of rounded) {
				teamSum.outdoorM[index] = (teamSum.outdoorM[index] ?? 0) + outdoor;
				teamSum.virtualM[index] = (teamSum.virtualM[index] ?? 0) + virtualM;
				teamSum.elevationDm[index] =
					(teamSum.elevationDm[index] ?? 0) + elevation;
				teamSum.sessions[index] = (teamSum.sessions[index] ?? 0) + sessions;
			}
			return {
				id: rider.athleteId,
				name: rider.firstName,
				status: rider.status,
				requests: hasRequests(rider.athleteId),
				profileLink: rider.profileLink,
				days: rounded,
			};
		}),
		teamSum,
		sessions: rides !== null,
		notAgreed: riders
			.filter((rider) => !byRider.has(rider.athleteId))
			.sort(byName)
			.map((rider) => ({
				name: rider.firstName,
				status: rider.status,
				requests: hasRequests(rider.athleteId),
			})),
	};
}

function byName(a: GraphRider, b: GraphRider): number {
	return a.firstName.localeCompare(b.firstName) || a.athleteId - b.athleteId;
}

/** An empty placeholder the script fills. */
const slot = (name: string) =>
	new SafeHtml(`<span data-slot="${name}"></span>`);

const METRICS = ["outdoor", "virtual", "elevation", "sessions"] as const;

/** The graphs shown: Sessions only with the ride figures on. */
function metricsOf(view: OrganiserGraphs): (typeof METRICS)[number][] {
	return METRICS.filter((metric) => metric !== "sessions" || view.sessions);
}

function template(name: string, content: SafeHtml | string): SafeHtml {
	return html`<template data-text="${name}">${content}</template>
`;
}

function renderFigure(i18n: I18n, metric: (typeof METRICS)[number]): SafeHtml {
	return html`<figure class="org-graph" data-metric="${metric}">
<figcaption><span class="org-graph-title">${i18n.t(`organiser.graphs.title.${metric}`)}</span><span class="org-graph-readout" data-readout></span></figcaption>
<div class="org-graph-plot"><canvas data-metric="${metric}" role="img" tabindex="0" aria-describedby="organiser-graphs-help" aria-label="${i18n.t(`organiser.graphs.title.${metric}`)}"></canvas></div>
<div class="org-graph-legend" data-legend></div>
</figure>
`;
}

function renderPicker(i18n: I18n, view: OrganiserGraphs): SafeHtml {
	const option = (
		name: SafeHtml | string,
		attribute: SafeHtml,
		checked: boolean,
	) =>
		html`<label class="org-graphs-option"${attribute}><input type="checkbox"${checked ? html` checked` : null}>${name}</label>
`;
	const names = view.notAgreed.map((rider) => rider.name).join(", ");
	return html`<div class="org-graphs-picker" data-picker>
<span class="org-graphs-label" id="organiser-graphs-picker-label">${i18n.t("organiser.graphs.picker.label")}</span>
<button type="button" class="org-graphs-toggle" data-picker-toggle aria-expanded="false" aria-labelledby="organiser-graphs-picker-label organiser-graphs-summary"><span id="organiser-graphs-summary" data-summary></span><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
<div class="org-graphs-panel" data-picker-panel hidden>
<input type="search" data-picker-query aria-label="${i18n.t("organiser.graphs.picker.find")}" placeholder="${i18n.t("organiser.graphs.picker.find")}" autocomplete="off">
<div class="org-graphs-list">
<div class="org-graphs-options">
${option(i18n.t("organiser.graphs.average"), html` data-team="average" data-name="${i18n.t("organiser.graphs.average").toLowerCase()}"`, true)}${option(i18n.t("organiser.graphs.total"), html` data-team="total" data-name="${i18n.t("organiser.graphs.total").toLowerCase()}"`, false)}${view.riders.map(
	(rider) =>
		option(
			html`<span class="rider-name">${rider.name}</span>${
				rider.profileLink === null
					? null
					: html` <a class="rider-profile" href="${rider.profileLink}">${i18n.t("organiser.attendance.profile")}</a>`
			}`,
			html` data-rider="${rider.id}" data-name="${rider.name.toLowerCase()}"`,
			false,
		),
)}</div>
<p class="org-graphs-none" data-picker-none hidden></p>
${
	view.notAgreed.length > 0
		? html`<p class="org-graphs-waiting">${i18n.t("organiser.graphs.picker.notAgreed", { names })}</p>
`
		: null
}</div>
<div class="org-graphs-panel-foot"><button type="button" class="button-outlined" data-picker-clear>${i18n.t("organiser.graphs.picker.clear")}</button><button type="button" data-picker-done>${i18n.t("organiser.graphs.picker.done")}</button></div>
</div>
</div>
`;
}

/**
 * The chart data for the script, with `<` escaped so it can't end the script
 * element: names from Strava are the only free text in it.
 */
function graphData(view: OrganiserGraphs): SafeHtml {
	const data = {
		...view,
		riders: view.riders.map(({ profileLink: _, ...rider }) => rider),
	};
	return new SafeHtml(JSON.stringify(data).replaceAll("<", "\\u003c"));
}

/** The section (contracts/pages.md), for an organiser with the graphs on. */
export function renderProgressGraphs(
	i18n: I18n,
	view: OrganiserGraphs,
): SafeHtml {
	const chip = (attributes: SafeHtml, id: MessageId) =>
		html`<button type="button" class="chip"${attributes} aria-pressed="false">${i18n.t(id)}</button>`;
	const value = (id: MessageId) => i18n.tHtml(id, { n: slot("n") });
	return html`<section id="organiser-graphs" class="org-graphs" aria-labelledby="organiser-graphs-heading" data-locale="${i18n.t("meta.intlLocale")}">
<h2 id="organiser-graphs-heading">${i18n.t("organiser.graphs.heading")}</h2>
<div class="org-graphs-controls">
${renderPicker(i18n, view)}<div class="org-graphs-range">
<label class="org-graphs-date">${i18n.t("organiser.graphs.from")}<input type="date" data-from min="${view.firstDay}" max="${view.lastDay}"></label>
<label class="org-graphs-date">${i18n.t("organiser.graphs.to")}<input type="date" data-to min="${view.firstDay}" max="${view.lastDay}"></label>
<div class="org-graphs-chips" role="group" aria-label="${i18n.t("organiser.graphs.range.label")}">
${chip(html` data-preset="season"`, "organiser.graphs.range.season")}${chip(html` data-preset="3m"`, "organiser.graphs.range.3m")}${chip(html` data-preset="4w"`, "organiser.graphs.range.4w")}${chip(html` data-custom`, "organiser.graphs.range.custom")}</div>
</div>
<div class="org-graphs-chips" role="group" aria-label="${i18n.t("organiser.graphs.mode.label")}">
${chip(html` data-mode="running"`, "organiser.graphs.mode.running")}${chip(html` data-mode="daily"`, "organiser.graphs.mode.daily")}</div>
</div>
<p class="org-graphs-hint org-graphs-hint-mouse">${i18n.t("organiser.graphs.hint.mouse")}</p>
<p class="org-graphs-hint org-graphs-hint-touch">${i18n.t("organiser.graphs.hint.touch")}</p>
<p id="organiser-graphs-help" class="visually-hidden">${i18n.t("progress.help")}</p>
<p class="org-graphs-note" data-note hidden></p>
<div class="org-graphs-tabs" role="group" aria-label="${i18n.t("organiser.graphs.tabs.label")}">
${metricsOf(view).map((metric) => chip(html` data-tab="${metric}"`, `organiser.graphs.tab.${metric}`))}</div>
${metricsOf(view).map((metric) => renderFigure(i18n, metric))}<p class="visually-hidden" aria-live="polite" data-live></p>
${template("title.outdoor", i18n.t("organiser.graphs.title.outdoor"))}${template("title.virtual", i18n.t("organiser.graphs.title.virtual"))}${template("title.elevation", i18n.t("organiser.graphs.title.elevation"))}${view.sessions ? html`${template("title.sessions", i18n.t("organiser.graphs.title.sessions"))}${template("sessions", value("organiser.graphs.value.sessions"))}` : null}${template("average", i18n.t("organiser.graphs.average"))}${template("total", i18n.t("organiser.graphs.total"))}${template("km", value("organiser.graphs.value.km"))}${template("m", value("organiser.graphs.value.m"))}${template("summary.riders", value("organiser.graphs.summary.riders"))}${template("summary.average", i18n.t("organiser.graphs.summary.average"))}${template("summary.total", i18n.t("organiser.graphs.summary.total"))}${template("summary.none", i18n.t("organiser.graphs.summary.none"))}${template("note.one", i18n.t("organiser.graphs.note.one"))}${template("note.other", value("organiser.graphs.note.other"))}${template("note.nobody", i18n.t("organiser.graphs.note.nobody"))}${template("noMatch", i18n.tHtml("organiser.graphs.picker.noMatch", { query: slot("query") }))}${template("range", i18n.tHtml("organiser.graphs.readout.range", { from: slot("from"), to: slot("to") }))}${template("aria", i18n.tHtml("organiser.graphs.aria", { title: slot("title"), from: slot("from"), to: slot("to"), lines: slot("lines") }))}<template data-legend-entry><button type="button" class="org-legend-entry" aria-pressed="false"><span class="org-legend-key" aria-hidden="true"></span><span class="org-legend-name" data-slot="name"></span> <span data-slot="value"></span></button></template>
<script type="application/json" id="organiser-graphs-data">${graphData(view)}</script>
</section>
`;
}
