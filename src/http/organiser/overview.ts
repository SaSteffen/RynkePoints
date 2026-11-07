import {
	berlinDate,
	type OrganiserFigures,
	organiserFigures,
	organiserProgressGraph,
	rideFigures,
} from "../../config";
import type { Ctx } from "../../ctx";
import { withProfileLinks } from "../../db/organiser";
import {
	organiserGraphsStatement,
	toGraphRows,
} from "../../db/organiser-graphs";
import {
	listOpenRequestsStatement,
	type OpenRequestRow,
} from "../../db/participation";
import {
	readTeam,
	rideRidersStatement,
	type TeamRider,
	toRideRiders,
} from "../../db/team";
import type { I18n } from "../../i18n/i18n";
import { evenPace, type RiderStatus, riderStatus } from "../../rynke/pace";
import { figuresOf, shownKm } from "../../rynke/ride-figures";
import {
	type CountingWindow,
	countingWindow,
	currentRules,
	type RynkeRules,
} from "../../rynke/rules";
import type { RideEntry } from "../../rynke/summary";
import { virtualShareRequired } from "../../rynke/tally";
import type { TeamEventSum } from "../../rynke/team-events";
import { dayNumber } from "../../rynke/weeks";
import type { CoinArt } from "../../teams/types";
import { SINCE_VERSION } from "../../visibility";
import { thresholdBars } from "../charts";
import { coinArt, miniCoin, SHARED_COIN } from "../coin";
import { FUN_BURSTS, FUN_SPARKLES } from "../fun";
import { html, type SafeHtml } from "../html";
import { CHART_SCRIPTS } from "../progress-section";
import { renderExampleNote } from "../rider-sections";
import { statusArt } from "../status-art";
import { exampleTeam } from "../tour-example";
import { noticeFromQuery, organiserPage, organiserSwitch } from "./access";
import { organiserGraphsView, renderProgressGraphs } from "./progress-graphs";
import { decisionNotice, riderRequestLines } from "./requests";

// The organiser overview at `/organiser/riders` (feature 016 US4, FR-030–FR-035,
// contracts/pages.md): the deadline, who qualifies, and every listed rider by
// first name in the groups of `riderStatus`, as one-line rows below 1100 px
// (feature 029) and a table from 1100 px, where all its columns fit. It only
// reads (FR-003). The body is pure, so the tests can set the day.

/** `requests`: riders with open requests (feature 019 FR-034). */
export type Group = RiderStatus | "all" | "requests";

const GROUPS: readonly Group[] = ["requests", "push", "on_track", "in", "all"];

/**
 * Each rider's counting rides where their consent shares sessions by name
 * (feature 032); a rider missing from it shows "–". Null with the ride
 * figures off.
 */
export type RiderRides = ReadonlyMap<number, readonly RideEntry[]> | null;

/** A rider's season sessions and typical ride, or null below version 3. */
function seasonSessions(
	rides: RiderRides,
	athleteId: number,
	window: CountingWindow,
): { sessions: number; typicalM: number | null } | null {
	const own = rides?.get(athleteId);
	if (!own) return null;
	return figuresOf(own, { from: window.seasonStart, to: window.deadline });
}

/** Each listed rider's open requests, newest event first (019 FR-034). */
export type RiderRequests = ReadonlyMap<number, readonly OpenRequestRow[]>;

/** An amount still missing, flagged when the rider is behind its even pace. */
export interface Missing {
	amount: number;
	behind: boolean;
}

/**
 * `value` as a whole percent of `threshold`, from 0 to 100, rounded down, so
 * 100 % means the threshold is reached (`ORGANISER_FIGURES` "percent").
 */
export function percentOf(value: number, threshold: number): number {
	if (threshold <= 0) return 100;
	return Math.min(100, Math.max(0, Math.floor((100 * value) / threshold)));
}

/** The even pace of each amount today; none once the deadline has passed. */
export interface Pace {
	training: number;
	team: number;
	outdoor: number;
}

export interface OverviewRider {
	athleteId: number;
	firstName: string;
	profileLink: string | null;
	status: RiderStatus;
	training: number;
	team: number;
	outdoorTraining: number;
	pace: Pace | null;
	missing: { training: Missing; team: Missing; outdoor: Missing };
	breakdown: {
		distanceRynke: number;
		elevationRynke: number;
		teamEvents: TeamEventSum[];
		corrections: { training: number; team: number };
		/** Virtual rides' share of Training, in whole percent. */
		virtualShare: number;
	};
}

/** The even pace of each amount on `today`, or none after the deadline. */
export function overviewPace(
	rules: RynkeRules,
	window: CountingWindow,
	today: string,
): Pace | null {
	if (today > window.deadline) return null;
	const pace = (amount: number) =>
		evenPace(amount, window.seasonStart, window.deadline, today);
	return {
		training: pace(rules.trainingThreshold),
		team: pace(rules.teamThreshold),
		outdoor: pace(virtualShareRequired(rules)),
	};
}

/**
 * The listed riders with their group and figures, the ones missing the most
 * first (the share missing of Training plus that of Team), then by first name.
 */
export function overviewRiders(
	read: readonly TeamRider[],
	rules: RynkeRules,
	window: CountingWindow,
	today: string,
): OverviewRider[] {
	const pace = overviewPace(rules, window, today);
	const profiles = new Map(
		withProfileLinks(
			read.map((r) => ({ athlete_id: r.athleteId, first_name: r.firstName })),
		).map((r) => [r.athlete_id, r.profileLink]),
	);
	const required = virtualShareRequired(rules);
	const riders = read.map((rider): OverviewRider => {
		const b = rider.balance;
		const training = b?.trainingRynke ?? 0;
		const team = b?.teamRynke ?? 0;
		const outdoorTraining = b?.trainingWithoutVirtual ?? 0;
		const missing = (amount: number, value: number, at: number | null) => ({
			amount,
			behind: amount > 0 && at !== null && value < at,
		});
		const corrections = { training: 0, team: 0 };
		for (const c of rider.corrections) {
			corrections.training += c.training;
			corrections.team += c.team;
		}
		return {
			athleteId: rider.athleteId,
			firstName: rider.firstName,
			profileLink: profiles.get(rider.athleteId) ?? null,
			status: riderStatus(b, rules, window, today),
			training,
			team,
			outdoorTraining,
			pace,
			missing: {
				training: missing(
					b?.trainingMissing ?? rules.trainingThreshold,
					training,
					pace?.training ?? null,
				),
				team: missing(
					b?.teamMissing ?? rules.teamThreshold,
					team,
					pace?.team ?? null,
				),
				outdoor: missing(
					b?.virtualShareMissing ?? required,
					outdoorTraining,
					pace?.outdoor ?? null,
				),
			},
			breakdown: {
				distanceRynke: b?.distanceRynke ?? 0,
				elevationRynke: b?.elevationRynke ?? 0,
				teamEvents: b?.teamEvents ?? [],
				corrections,
				virtualShare:
					training > 0
						? Math.round(
								(100 * Math.max(0, training - outdoorTraining)) / training,
							)
						: 0,
			},
		};
	});
	const need = (r: OverviewRider) =>
		r.missing.training.amount / rules.trainingThreshold +
		r.missing.team.amount / rules.teamThreshold;
	return riders.sort(
		(a, b) =>
			need(b) - need(a) ||
			a.firstName.localeCompare(b.firstName) ||
			a.athleteId - b.athleteId,
	);
}

/** The `group` query: one of the tiles, else none (research R9). */
export function parseGroup(
	value: string | null,
	passed: boolean,
): Group | null {
	const group = GROUPS.find((g) => g === value) ?? null;
	return passed && group === "on_track" ? "all" : group;
}

function groupLabel(i18n: I18n, group: Group, passed: boolean): string {
	switch (group) {
		case "push":
			return i18n.t(
				passed
					? "organiser.overview.group.notYet"
					: "organiser.overview.group.push",
			);
		case "on_track":
			return i18n.t("organiser.overview.group.onTrack");
		case "in":
			return i18n.t("organiser.overview.group.in");
		case "all":
			return i18n.t("organiser.overview.group.all");
		case "requests":
			return i18n.t("organiser.overview.group.requests");
	}
}

function renderDeadline(
	i18n: I18n,
	window: CountingWindow,
	today: string,
	riders: readonly OverviewRider[],
	coin: CoinArt,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const days = dayNumber(window.deadline) - dayNumber(today);
	return html`<section class="overview-deadline">
${coinArt(coin, "back", "large")}<div>
<p class="overview-deadline-date">${i18n.t("organiser.overview.deadline", { date: i18n.formatDate(window.deadline) })}</p>
<p class="overview-deadline-count">${
		days < 0
			? i18n.t("organiser.overview.deadlinePassed")
			: i18n.t("organiser.overview.daysLeft", { n: whole(days) })
	}</p>
<p>${i18n.t("organiser.overview.qualified", {
		n: whole(riders.filter((r) => r.status === "in").length),
		count: whole(riders.length),
	})}</p>
</div>${FUN_SPARKLES}
</section>
`;
}

function renderTiles(
	i18n: I18n,
	riders: readonly OverviewRider[],
	group: Group | null,
	passed: boolean,
	requests: RiderRequests,
): SafeHtml {
	const tiles = GROUPS.filter((g) => !(passed && g === "on_track")).map((g) => {
		const count = riders.filter((r) => inGroup(r, g, requests)).length;
		const alert = g === "requests" && count > 0 ? " tile-alert" : "";
		const art = g === "all" || g === "requests" ? null : statusArt(g, "tile");
		return html`<a class="group-tile tile-${g}${alert}" href="/organiser/riders?group=${g}" data-swap${group === g ? html` aria-current="true"` : null}><span class="tile-count">${i18n.formatNumber(count, { fractionDigits: 0 })}</span><span class="tile-label">${groupLabel(i18n, g, passed)}</span>${art}</a>
`;
	});
	const showing = (g: Group, when: string) =>
		html`<p class="visually-hidden showing-${when}">${i18n.t("organiser.overview.showing", { group: groupLabel(i18n, g, passed) })}</p>
`;
	return html`<nav class="group-tiles${group === null ? " default" : ""}" id="tour-groups" aria-label="${i18n.t("organiser.overview.groups")}">
${tiles}</nav>
${group === null ? html`${showing("push", "phone")}${showing("all", "wide")}` : null}`;
}

/** Whether `rider` belongs in the tile `group`. */
function inGroup(
	rider: OverviewRider,
	group: Group,
	requests: RiderRequests,
): boolean {
	if (group === "all") return true;
	if (group === "requests") return hasRequests(rider, requests);
	return rider.status === group;
}

function hasRequests(rider: OverviewRider, requests: RiderRequests): boolean {
	return (requests.get(rider.athleteId)?.length ?? 0) > 0;
}

function missingItems(
	i18n: I18n,
	rider: OverviewRider,
): { text: string; behind: boolean }[] {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	return (["training", "team", "outdoor"] as const)
		.filter((key) => rider.missing[key].amount > 0)
		.map((key) => {
			const { amount, behind } = rider.missing[key];
			const text = i18n.t(`organiser.overview.toGo.${key}`, {
				n: whole(amount),
			});
			return {
				text: behind
					? `${text} · ${i18n.t("organiser.overview.behind")}`
					: text,
				behind,
			};
		});
}

function amounts(i18n: I18n, training: number, team: number): string {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	return i18n.t("organiser.overview.amounts", {
		training: whole(training),
		team: whole(team),
	});
}

function nameLinks(i18n: I18n, rider: OverviewRider): SafeHtml {
	return html`<a href="/organiser/riders/${rider.athleteId}"><span class="rider-name">${rider.firstName}</span></a>${
		rider.profileLink === null
			? null
			: html` <a class="rider-profile" href="${rider.profileLink}">${i18n.t("organiser.attendance.profile")}</a>`
	}`;
}

function statusChip(
	i18n: I18n,
	rider: OverviewRider,
	passed: boolean,
): SafeHtml {
	return html`<span class="status-chip">${statusArt(rider.status, "chip")}${groupLabel(i18n, rider.status, passed)}</span>`;
}

/** The figure of `kind` in percent, with its bar and the even pace. */
function percentLine(
	i18n: I18n,
	kind: "training" | "team",
	rider: OverviewRider,
	rules: RynkeRules,
): SafeHtml {
	const threshold =
		kind === "training" ? rules.trainingThreshold : rules.teamThreshold;
	const n = i18n.t("organiser.overview.percent", {
		n: i18n.formatNumber(percentOf(rider[kind], threshold), {
			fractionDigits: 0,
		}),
	});
	return html`<div class="amount amount-${kind}"><p>${miniCoin(kind)}${i18n.t(`organiser.overview.${kind}.percent`, { n })}</p>${thresholdBars(rider[kind], threshold, rider.pace?.[kind] ?? null)}</div>`;
}

/**
 * Why a rider isn't there yet, without amounts: Training or Team behind the
 * even pace, and too little outdoor Training.
 */
function percentReasons(
	i18n: I18n,
	rider: OverviewRider,
): { text: string; behind: boolean }[] {
	const reasons: { text: string; behind: boolean }[] = [];
	for (const kind of ["training", "team"] as const) {
		if (rider.missing[kind].behind) {
			reasons.push({
				text: i18n.t(`organiser.overview.behind.${kind}`),
				behind: true,
			});
		}
	}
	if (rider.missing.outdoor.amount > 0) {
		reasons.push({
			text: i18n.t("organiser.overview.reason.outdoor"),
			behind: rider.missing.outdoor.behind,
		});
	}
	return reasons;
}

/** The corrections as amounts; organisers enter them, Strava has no part. */
function correctionsLine(i18n: I18n, rider: OverviewRider): string {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	return i18n.t("organiser.overview.corrections", {
		training: whole(rider.breakdown.corrections.training),
		team: whole(rider.breakdown.corrections.team),
	});
}

function percentBody(
	i18n: I18n,
	rules: RynkeRules,
	rider: OverviewRider,
	passed: boolean,
	lines: SafeHtml | null,
): SafeHtml {
	const reasons = percentReasons(i18n, rider);
	const { corrections } = rider.breakdown;
	return html`<div class="rider-head"><h3>${nameLinks(i18n, rider)}</h3>${statusChip(i18n, rider, passed)}</div>
<div class="rider-bars">
${percentLine(i18n, "training", rider, rules)}
${percentLine(i18n, "team", rider, rules)}
</div>
${
	reasons.length > 0
		? html`<ul class="rider-missing">${reasons.map((m) => html`<li${m.behind ? html` class="behind"` : null}>${m.text}</li>`)}</ul>
`
		: null
}${
	corrections.training !== 0 || corrections.team !== 0
		? html`<p class="rider-corrections">${correctionsLine(i18n, rider)}</p>
`
		: null
}${lines}`;
}

function fullBody(
	i18n: I18n,
	rules: RynkeRules,
	rider: OverviewRider,
	passed: boolean,
	lines: SafeHtml | null,
	sessions: ReturnType<typeof seasonSessions> = null,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const { breakdown } = rider;
	const parts = [
		i18n.t("organiser.overview.distance", {
			n: whole(breakdown.distanceRynke),
		}),
		i18n.t("organiser.overview.elevation", {
			n: whole(breakdown.elevationRynke),
		}),
		...breakdown.teamEvents.map((sum) =>
			i18n.t("organiser.overview.event", {
				kind: i18n.t(`rynke.source.${sum.kind}`),
				attended: whole(sum.attended),
				training: whole(sum.training),
				team: whole(sum.team),
			}),
		),
		i18n.t("organiser.overview.corrections", {
			training: whole(breakdown.corrections.training),
			team: whole(breakdown.corrections.team),
		}),
		i18n.t("organiser.overview.outdoor", {
			n: whole(rider.outdoorTraining),
			required: whole(virtualShareRequired(rules)),
		}),
		i18n.t("organiser.overview.virtual", { n: whole(breakdown.virtualShare) }),
	];
	const rides =
		sessions === null
			? null
			: sessions.typicalM === null
				? i18n.t("organiser.overview.sessions", {
						n: whole(sessions.sessions),
					})
				: i18n.t("organiser.overview.sessions.typical", {
						n: whole(sessions.sessions),
						typical: i18n.formatNumber(shownKm(sessions.typicalM), {
							fractionDigits: 1,
						}),
					});
	const missing = missingItems(i18n, rider);
	return html`<div class="rider-head"><h3>${nameLinks(i18n, rider)}</h3>${statusChip(i18n, rider, passed)}</div>
<div class="rider-bars">
<div class="amount amount-training"><p>${miniCoin("training")}${i18n.t("organiser.overview.training", { n: whole(rider.training), threshold: whole(rules.trainingThreshold) })}</p>${thresholdBars(rider.training, rules.trainingThreshold, rider.pace?.training ?? null)}</div>
<div class="amount amount-team"><p>${miniCoin("team")}${i18n.t("organiser.overview.team", { n: whole(rider.team), threshold: whole(rules.teamThreshold) })}</p>${thresholdBars(rider.team, rules.teamThreshold, rider.pace?.team ?? null)}</div>
</div>
${
	rides === null
		? null
		: html`<p class="rider-sessions">${rides}</p>
`
}${
	missing.length > 0
		? html`<ul class="rider-missing">${missing.map((m) => html`<li${m.behind ? html` class="behind"` : null}>${m.text}</li>`)}</ul>
`
		: null
}${lines}<details class="rider-breakdown"><summary class="tap">${i18n.t("organiser.overview.breakdown")}</summary>
<ul>${parts.map((part) => html`<li>${part}</li>`)}</ul>
</details>
`;
}

/** Training or Team as a small bar in a row's one line, with its figure. */
function miniBar(
	i18n: I18n,
	kind: "training" | "team",
	rider: OverviewRider,
	rules: RynkeRules,
	percent: boolean,
): SafeHtml {
	const threshold =
		kind === "training" ? rules.trainingThreshold : rules.teamThreshold;
	const figure = percent
		? i18n.t("organiser.overview.percent", {
				n: i18n.formatNumber(percentOf(rider[kind], threshold), {
					fractionDigits: 0,
				}),
			})
		: i18n.formatNumber(rider[kind], { fractionDigits: 0 });
	return html`<span class="rider-mini bar-${kind}"><span class="rider-mini-figure"><span class="visually-hidden">${i18n.t(`organiser.overview.column.${kind}`)} </span>${figure}</span>${thresholdBars(rider[kind], threshold, rider.pace?.[kind] ?? null)}</span>`;
}

/** One rider below 1100 px: one line that opens on today's card content. */
function renderRow(
	i18n: I18n,
	rules: RynkeRules,
	rider: OverviewRider,
	passed: boolean,
	lines: SafeHtml | null,
	percent: boolean,
	hidden: boolean,
	open: boolean,
	sessions: ReturnType<typeof seasonSessions> = null,
): SafeHtml {
	return html`<li class="rider-row status-${rider.status}" data-name="${rider.firstName.toLowerCase()}"${hidden ? html` hidden` : null}>
<details${open ? html` open` : null}><summary class="rider-row-line"><span class="rider-dot" aria-hidden="true"></span><span class="rider-row-name"><span class="rider-name">${rider.firstName}</span><span class="visually-hidden">, ${groupLabel(i18n, rider.status, passed)}</span></span>${lines ? html`<span class="rider-row-report">${i18n.t("organiser.graphs.rows.report")}</span>` : null}${miniBar(i18n, "training", rider, rules, percent)}${miniBar(i18n, "team", rider, rules, percent)}</summary>
<div class="rider-row-body">${percent ? percentBody(i18n, rules, rider, passed, lines) : fullBody(i18n, rules, rider, passed, lines, sessions)}</div>
</details>
</li>
`;
}

/**
 * Everyone as one-line rows, those outside the group `hidden`, so a search can
 * reach the whole team without a request (feature 029 research R10).
 */
function renderRows(
	i18n: I18n,
	rules: RynkeRules,
	riders: readonly OverviewRider[],
	group: Group | null,
	passed: boolean,
	requests: RiderRequests,
	lines: (rider: OverviewRider) => SafeHtml | null,
	percent: boolean,
	sessionsOf: (rider: OverviewRider) => ReturnType<typeof seasonSessions>,
): SafeHtml {
	const ordered = [
		...riders.filter((r) => hasRequests(r, requests)),
		...riders.filter((r) => !hasRequests(r, requests)),
	];
	const inView = (r: OverviewRider) =>
		group === null || inGroup(r, group, requests);
	const open = group !== null && ordered.filter(inView).length <= 5;
	const find = i18n.t("organiser.graphs.picker.find");
	return html`<input type="search" class="rider-search" data-rider-search aria-label="${find}" placeholder="${find}" autocomplete="off">
<p class="rider-search-none" data-rider-none hidden></p>
<template data-rider-none-text>${i18n.tHtml("organiser.graphs.rows.noMatch", { query: html`<span data-slot="query"></span>` })}</template>
<ul class="rider-rows${group === null ? " default" : ""}">
${ordered.map((r) => renderRow(i18n, rules, r, passed, lines(r), percent, !inView(r), open, sessionsOf(r)))}</ul>
`;
}

/** Open reports on a narrow screen, where the table's column isn't there. */
function renderReports(
	i18n: I18n,
	riders: readonly OverviewRider[],
	requests: RiderRequests,
	back: string,
): SafeHtml | null {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const open = riders.flatMap((rider) =>
		(requests.get(rider.athleteId) ?? []).map((row) => ({ rider, row })),
	);
	if (open.length === 0) return null;
	return html`<section class="requests-box" aria-labelledby="requests-box-heading">
<h2 id="requests-box-heading">${i18n.t("organiser.graphs.reports", { n: open.length })}</h2>
<ul class="requests-box-lines">
${open.slice(0, 3).map(
	({ rider, row }) =>
		html`<li><span class="rider-name">${rider.firstName}</span>${riderRequestLines(i18n, [row], back)}</li>
`,
)}</ul>
${
	open.length > 3
		? html`<a class="button-outlined requests-box-all" href="/organiser/riders?group=requests&amp;view=riders">${i18n.t("organiser.graphs.reports.showAll", { n: whole(open.length) })}</a>
`
		: null
}</section>
`;
}

/** A figure with its bar and, while some is missing, how much: in the
 * push colour when the rider is behind the even pace (the bar's mark). `kind`
 * names the bar for screen readers and picks its colour. */
function barBlock(
	i18n: I18n,
	kind: "training" | "team",
	value: number,
	threshold: number,
	pace: number | null,
	missing: Missing,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const toGo =
		missing.amount > 0
			? html`<span class="to-go${missing.behind ? " behind" : ""}">${i18n.t("organiser.overview.toGo.short", { n: whole(missing.amount) })}${missing.behind ? html`<span class="visually-hidden"> · ${i18n.t("organiser.overview.behind")}</span>` : null}</span>`
			: null;
	return html`<div class="bar-block bar-${kind}"><span class="bar-figures"><span class="figure"><span class="visually-hidden">${i18n.t(`organiser.overview.column.${kind}`)} </span>${whole(value)}</span>${toGo}</span>${thresholdBars(value, threshold, pace)}</div>`;
}

/** Training and Team amounts as the two mini coins, read out in words. */
function coinPair(i18n: I18n, training: number, team: number): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	return html`<td class="number"><span class="coin-pair" aria-hidden="true"><span>${miniCoin("training")}${whole(training)}</span><span>${miniCoin("team")}${whole(team)}</span></span><span class="visually-hidden">${amounts(i18n, training, team)}</span></td>`;
}

/** The Sessions cell: the season count and typical ride, "–" below 3. */
function sessionsCell(
	i18n: I18n,
	sessions: ReturnType<typeof seasonSessions>,
): SafeHtml {
	if (sessions === null) return html`<td class="number">–</td>`;
	const typical =
		sessions.typicalM === null
			? null
			: html`<small class="typical">${i18n.t("organiser.overview.typical", { n: i18n.formatNumber(shownKm(sessions.typicalM), { fractionDigits: 1 }) })}</small>`;
	return html`<td class="number sessions-cell"><span>${i18n.formatNumber(sessions.sessions, { fractionDigits: 0 })}</span>${typical}</td>`;
}

function renderTable(
	i18n: I18n,
	rules: RynkeRules,
	riders: readonly OverviewRider[],
	passed: boolean,
	lines: (rider: OverviewRider) => SafeHtml | null,
	sessionsOf:
		| ((rider: OverviewRider) => ReturnType<typeof seasonSessions>)
		| null,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const column = (
		key:
			| "name"
			| "group"
			| "rynke"
			| "virtual"
			| "distance"
			| "elevation"
			| "corrections"
			| "requests",
		number = false,
	) =>
		html`<th scope="col"${number ? html` class="number"` : null}>${i18n.t(`organiser.overview.column.${key}`)}</th>`;
	// Training above Team in one Rynke column, the virtual share beside it.
	const rows = riders.map((rider) => {
		const training = barBlock(
			i18n,
			"training",
			rider.training,
			rules.trainingThreshold,
			rider.pace?.training ?? null,
			rider.missing.training,
		);
		const team = barBlock(
			i18n,
			"team",
			rider.team,
			rules.teamThreshold,
			rider.pace?.team ?? null,
			rider.missing.team,
		);
		return html`<tr class="status-${rider.status}">
<th scope="row">${nameLinks(i18n, rider)}</th>
<td>${statusChip(i18n, rider, passed)}</td>
<td class="bar-cell">${training}${team}</td>
<td class="number">${i18n.t("organiser.overview.percent", { n: whole(rider.breakdown.virtualShare) })}</td>
${sessionsOf ? sessionsCell(i18n, sessionsOf(rider)) : null}<td class="number">${whole(rider.breakdown.distanceRynke)}</td>
<td class="number">${whole(rider.breakdown.elevationRynke)}</td>
${coinPair(i18n, rider.breakdown.corrections.training, rider.breakdown.corrections.team)}
<td class="requests-cell">${lines(rider)}</td>
</tr>
`;
	});
	return html`<div class="table-scroll" tabindex="0" role="region" aria-label="${i18n.t("organiser.overview.column.name")}"><table class="rider-table">
<thead><tr>${column("name")}${column("group")}${column("rynke")}${column("virtual", true)}${
		sessionsOf
			? html`<th scope="col" class="number" title="${i18n.t("organiser.overview.column.typical.hint")}">${i18n.t("organiser.overview.column.sessions")}<span class="th-sub">${i18n.t("organiser.overview.column.typical")}</span></th>`
			: null
	}${column("distance", true)}${column("elevation", true)}${column("corrections", true)}${column("requests")}</tr></thead>
<tbody>
${rows}</tbody>
</table></div>
`;
}

/** A percent figure with its bar, and "behind pace" when the rider is. */
function percentBlock(
	i18n: I18n,
	kind: "training" | "team",
	value: number,
	threshold: number,
	pace: number | null,
	missing: Missing,
): SafeHtml {
	const n = i18n.formatNumber(percentOf(value, threshold), {
		fractionDigits: 0,
	});
	const behind = missing.behind
		? html`<span class="to-go behind">${i18n.t("organiser.overview.behind")}</span>`
		: null;
	return html`<div class="bar-block bar-${kind}"><span class="bar-figures"><span class="figure"><span class="visually-hidden">${i18n.t(`organiser.overview.column.${kind}`)} </span>${i18n.t("organiser.overview.percent", { n })}</span>${behind}</span>${thresholdBars(value, threshold, pace)}</div>`;
}

function renderPercentTable(
	i18n: I18n,
	rules: RynkeRules,
	riders: readonly OverviewRider[],
	passed: boolean,
	lines: (rider: OverviewRider) => SafeHtml | null,
): SafeHtml {
	const column = (
		key: "name" | "group" | "rynke" | "corrections" | "requests",
		number = false,
	) =>
		html`<th scope="col"${number ? html` class="number"` : null}>${i18n.t(`organiser.overview.column.${key}`)}</th>`;
	const rows = riders.map((rider) => {
		const training = percentBlock(
			i18n,
			"training",
			rider.training,
			rules.trainingThreshold,
			rider.pace?.training ?? null,
			rider.missing.training,
		);
		const team = percentBlock(
			i18n,
			"team",
			rider.team,
			rules.teamThreshold,
			rider.pace?.team ?? null,
			rider.missing.team,
		);
		// Outdoor Training is no column of its own, only a reason (2026-10-29).
		const outdoor =
			rider.missing.outdoor.amount > 0
				? html`<p class="to-go${rider.missing.outdoor.behind ? " behind" : ""}">${i18n.t("organiser.overview.reason.outdoor")}</p>`
				: null;
		return html`<tr class="status-${rider.status}">
<th scope="row">${nameLinks(i18n, rider)}</th>
<td>${statusChip(i18n, rider, passed)}${outdoor}</td>
<td class="bar-cell">${training}${team}</td>
${coinPair(i18n, rider.breakdown.corrections.training, rider.breakdown.corrections.team)}
<td class="requests-cell">${lines(rider)}</td>
</tr>
`;
	});
	return html`<div class="table-scroll" tabindex="0" role="region" aria-label="${i18n.t("organiser.overview.column.name")}"><table class="rider-table">
<thead><tr>${column("name")}${column("group")}${column("rynke")}${column("corrections", true)}${column("requests")}</tr></thead>
<tbody>
${rows}</tbody>
</table></div>
`;
}

function renderQualified(
	i18n: I18n,
	riders: readonly OverviewRider[],
): SafeHtml {
	const qualified = riders
		.filter((r) => r.status === "in")
		.sort((a, b) => a.firstName.localeCompare(b.firstName));
	return html`<section class="qualified">
<h2>${i18n.t("organiser.overview.qualifiedList")}</h2>
${
	qualified.length === 0
		? html`<p>${i18n.t("organiser.overview.nobodyYet")}</p>`
		: html`<p class="qualified-hint">${i18n.t("organiser.overview.qualifiedHint")}</p>
<ul>${qualified.map((r) => html`<li>${miniCoin("team")}<span class="rider-name">${r.firstName}</span></li>`)}</ul>`
}${FUN_BURSTS}
</section>
`;
}

/**
 * The page's body below the notice, in the order of contracts/pages.md;
 * `inert` for the organiser tour's example team (feature 020 FR-014).
 */
export function overviewBody(
	read: readonly TeamRider[],
	rules: RynkeRules,
	window: CountingWindow,
	today: string,
	group: Group | null,
	i18n: I18n,
	requests: RiderRequests = new Map(),
	inert = false,
	figures: OrganiserFigures = "full",
	graphs: SafeHtml | null = null,
	view: "graphs" | "riders" = "riders",
	rides: RiderRides = null,
	coin: CoinArt = SHARED_COIN,
): SafeHtml {
	const passed = today > window.deadline;
	const sessionsOf =
		rides === null || figures === "percent"
			? null
			: (rider: OverviewRider) =>
					seasonSessions(rides, rider.athleteId, window);
	const riders = overviewRiders(read, rules, window, today);
	// Riders with open requests first (019 FR-034), the order otherwise kept.
	const shown =
		group === null || group === "all"
			? [
					...riders.filter((r) => hasRequests(r, requests)),
					...riders.filter((r) => !hasRequests(r, requests)),
				]
			: riders.filter((r) => inGroup(r, group, requests));
	const back =
		group === null ? "/organiser/riders" : `/organiser/riders?group=${group}`;
	const lines = (rider: OverviewRider) =>
		riderRequestLines(i18n, requests.get(rider.athleteId) ?? [], back);
	const pace = overviewPace(rules, window, today);
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const percent = figures === "percent";
	const hasGraphs = graphs !== null && riders.length > 0;
	const body =
		riders.length === 0
			? html`<p>${i18n.t("organiser.overview.none")}</p>
`
			: html`${renderReports(i18n, riders, requests, back)}${hasGraphs ? renderViewSwitch(i18n, shown.length, view) : null}<div class="overview-list">
${pace ? renderHint(i18n, rules, pace, figures, whole) : null}${renderRows(i18n, rules, riders, group, passed, requests, lines, percent, sessionsOf ?? (() => null))}${percent ? renderPercentTable(i18n, rules, shown, passed, lines) : renderTable(i18n, rules, shown, passed, lines, sessionsOf)}</div>
${hasGraphs ? graphs : null}<div class="overview-qualified">${renderQualified(i18n, riders)}</div>
`;
	return html`<div class="team-overview"${hasGraphs ? html` data-view="${view}"` : null}${inert ? html` inert` : null}>
<h2>${i18n.t("organiser.overview.heading")}</h2>
${renderDeadline(i18n, window, today, riders, coin)}${renderTiles(i18n, riders, group, passed, requests)}${body}</div>`;
}

/**
 * Riders or graphs below 1100 px, instead of scrolling past one to the other:
 * the default, Riders, first. A joined segmented pill like the Riders/Events
 * switch above, so it takes the theme's colours (feature 022 controls.md).
 */
function renderViewSwitch(
	i18n: I18n,
	count: number,
	view: "graphs" | "riders",
): SafeHtml {
	const whole = i18n.formatNumber(count, { fractionDigits: 0 });
	const pick = (pick: "graphs" | "riders", label: SafeHtml | string) =>
		html`<button type="button" class="segmented" data-view-pick="${pick}" aria-pressed="${view === pick ? "true" : "false"}"><span>${label}</span></button>`;
	return html`<div class="overview-views" role="group" aria-label="${i18n.t("organiser.graphs.view.label")}">${pick("riders", i18n.tHtml("organiser.graphs.view.riders", { n: html`<span data-riders-count>${whole}</span>` }))}${pick("graphs", i18n.t("organiser.graphs.view.graphs"))}</div>
`;
}

/** What the even pace asks for today, as amounts or in percent. */
function renderHint(
	i18n: I18n,
	rules: RynkeRules,
	pace: Pace,
	figures: OrganiserFigures,
	whole: (n: number) => string,
): SafeHtml {
	const text =
		figures === "percent"
			? i18n.t("organiser.overview.hint.percent", {
					training: i18n.t("organiser.overview.percent", {
						n: whole(percentOf(pace.training, rules.trainingThreshold)),
					}),
					team: i18n.t("organiser.overview.percent", {
						n: whole(percentOf(pace.team, rules.teamThreshold)),
					}),
				})
			: i18n.t("organiser.overview.hint", {
					training: whole(pace.training),
					team: whole(pace.team),
				});
	return html`<p class="team-hint" id="tour-pace">${text}</p>
`;
}

/** The open requests by rider, in their order. */
function byRider(rows: readonly OpenRequestRow[]): RiderRequests {
	const requests = new Map<number, OpenRequestRow[]>();
	for (const row of rows) {
		requests.set(row.athlete_id, [
			...(requests.get(row.athlete_id) ?? []),
			row,
		]);
	}
	return requests;
}

/** `GET /organiser/riders`: the overview, organisers only. */
export function handleOrganiserOverview(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const url = new URL(request.url);
	const window = countingWindow(ctx.env);
	const figures = organiserFigures(ctx.env);
	const today = berlinDate(ctx.now());
	const group = parseGroup(
		url.searchParams.get("group"),
		today > window.deadline,
	);
	const path =
		group === null ? "/organiser/riders" : `/organiser/riders?group=${group}`;
	return organiserPage(request, ctx, i18n, path, async ({ example }) => {
		// On the organiser tour's steps, the example team instead, which can
		// be looked at but not used (feature 020 FR-013, FR-014).
		if (example) {
			const team = exampleTeam(window, today, currentRules(ctx.team.rules));
			return html`${organiserSwitch(i18n, "riders", team.requests.length)}${renderExampleNote(i18n, "tour.organiser.example")}${overviewBody(team.riders, currentRules(ctx.team.rules), window, today, null, i18n, byRider(team.requests), true, figures, null, "riders", null, ctx.team.art.coin)}`;
		}
		const graphsOn = figures === "full" && organiserProgressGraph(ctx.env);
		// Sessions by name only with amounts shown (032 research R8).
		const ridesOn = figures === "full" && rideFigures(ctx.env);
		const statements: D1PreparedStatement[] = [
			listOpenRequestsStatement(ctx.env.DB, today, window),
		];
		if (ridesOn) {
			statements.push(
				rideRidersStatement(ctx.env.DB, SINCE_VERSION.rideFiguresByName),
			);
		}
		if (graphsOn) statements.push(organiserGraphsStatement(ctx.env.DB));
		const [read, [openRows, ...rest]] = await Promise.all([
			readTeam(ctx.env.DB),
			ctx.env.DB.batch(statements),
		]);
		const rideRows = ridesOn ? rest[0] : undefined;
		const graphRows = graphsOn ? rest[ridesOn ? 1 : 0] : undefined;
		const rides: RiderRides = rideRows
			? new Map(
					(
						await toRideRiders(
							ctx.env.DB,
							rideRows,
							SINCE_VERSION.rideFiguresByName,
						)
					).map((r) => [r.athleteId, r.rides]),
				)
			: null;
		const results = (openRows?.results ?? []) as OpenRequestRow[];
		const requests = byRider(results);
		const graphs =
			graphRows && read.length > 0
				? renderProgressGraphs(
						i18n,
						organiserGraphsView({
							rows: await toGraphRows(ctx.env.DB, graphRows),
							riders: overviewRiders(
								read,
								currentRules(ctx.team.rules),
								window,
								today,
							),
							requests,
							window,
							today,
							group,
							rides,
						}),
					)
				: null;
		const notice = await decisionNotice(url, ctx, i18n, path);
		const view =
			url.searchParams.get("view") === "graphs" ? "graphs" : "riders";
		const body = html`${organiserSwitch(i18n, "riders", results.length)}${notice}${noticeFromQuery(url, i18n)}${overviewBody(read, currentRules(ctx.team.rules), window, today, group, i18n, requests, false, figures, graphs, view, rides, ctx.team.art.coin)}`;
		return graphs ? { body, scripts: CHART_SCRIPTS } : body;
	});
}
