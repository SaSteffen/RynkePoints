import { berlinDate } from "../../config";
import type { Ctx } from "../../ctx";
import { withProfileLinks } from "../../db/organiser";
import { readTeam, type TeamRider } from "../../db/team";
import type { I18n } from "../../i18n/i18n";
import { evenPace, type RiderStatus, riderStatus } from "../../rynke/pace";
import {
	type CountingWindow,
	CURRENT_RULES,
	countingWindow,
	type RynkeRules,
} from "../../rynke/rules";
import { virtualShareRequired } from "../../rynke/tally";
import type { TeamEventSum } from "../../rynke/team-events";
import { dayNumber } from "../../rynke/weeks";
import { thresholdBars } from "../charts";
import { coin, miniCoin } from "../coin";
import { html, type SafeHtml } from "../html";
import { noticeFromQuery, organiserPage, organiserSwitch } from "./access";

// The organiser overview at `/organiser/riders` (feature 016 US4, FR-030–FR-035,
// contracts/pages.md): the deadline, who qualifies, and every listed rider by
// first name in the groups of `riderStatus`, as cards on a phone and a table
// from 840 px. It only reads (FR-003). The body is pure, so the tests can set
// the day.

export type Group = RiderStatus | "all";

const GROUPS: readonly Group[] = ["push", "on_track", "in", "all"];

/** An amount still missing, flagged when the rider is behind its even pace. */
export interface Missing {
	amount: number;
	behind: boolean;
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
	}
}

function renderDeadline(
	i18n: I18n,
	window: CountingWindow,
	today: string,
	riders: readonly OverviewRider[],
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const days = dayNumber(window.deadline) - dayNumber(today);
	return html`<section class="overview-deadline">
${coin("back", "large")}<div>
<p class="overview-deadline-date">${i18n.t("organiser.overview.deadline", { date: i18n.formatDate(window.deadline) })}</p>
<p class="overview-deadline-days">${
		days < 0
			? i18n.t("organiser.overview.deadlinePassed")
			: i18n.t("organiser.overview.daysLeft", { n: whole(days) })
	}</p>
<p>${i18n.t("organiser.overview.qualified", {
		n: whole(riders.filter((r) => r.status === "in").length),
		count: whole(riders.length),
	})}</p>
</div>
</section>
`;
}

function renderTiles(
	i18n: I18n,
	riders: readonly OverviewRider[],
	group: Group | null,
	passed: boolean,
): SafeHtml {
	const tiles = GROUPS.filter((g) => !(passed && g === "on_track")).map((g) => {
		const count =
			g === "all" ? riders.length : riders.filter((r) => r.status === g).length;
		return html`<a class="group-tile tile-${g}" href="/organiser/riders?group=${g}"${group === g ? html` aria-current="true"` : null}><span class="tile-count">${i18n.formatNumber(count, { fractionDigits: 0 })}</span><span class="tile-label">${groupLabel(i18n, g, passed)}</span></a>
`;
	});
	const showing = (g: Group, when: string) =>
		html`<p class="visually-hidden showing-${when}">${i18n.t("organiser.overview.showing", { group: groupLabel(i18n, g, passed) })}</p>
`;
	return html`<nav class="group-tiles${group === null ? " default" : ""}" aria-label="${i18n.t("organiser.overview.groups")}">
${tiles}</nav>
${group === null ? html`${showing("push", "phone")}${showing("all", "wide")}` : null}`;
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
	return html`<span class="status-chip">${groupLabel(i18n, rider.status, passed)}</span>`;
}

function renderCard(
	i18n: I18n,
	rules: RynkeRules,
	rider: OverviewRider,
	passed: boolean,
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
	const missing = missingItems(i18n, rider);
	return html`<li class="rider-card status-${rider.status}">
<div class="rider-head"><h3>${nameLinks(i18n, rider)}</h3>${statusChip(i18n, rider, passed)}</div>
<div class="rider-bars">
<div class="amount amount-training"><p>${miniCoin("training")}${i18n.t("organiser.overview.training", { n: whole(rider.training), threshold: whole(rules.trainingThreshold) })}</p>${thresholdBars(rider.training, rules.trainingThreshold, rider.pace?.training ?? null)}</div>
<div class="amount amount-team"><p>${miniCoin("team")}${i18n.t("organiser.overview.team", { n: whole(rider.team), threshold: whole(rules.teamThreshold) })}</p>${thresholdBars(rider.team, rules.teamThreshold, rider.pace?.team ?? null)}</div>
</div>
${
	missing.length > 0
		? html`<ul class="rider-missing">${missing.map((m) => html`<li${m.behind ? html` class="behind"` : null}>${m.text}</li>`)}</ul>
`
		: null
}<details class="rider-breakdown"><summary class="tap">${i18n.t("organiser.overview.breakdown")}</summary>
<ul>${parts.map((part) => html`<li>${part}</li>`)}</ul>
</details>
</li>
`;
}

function renderTable(
	i18n: I18n,
	rules: RynkeRules,
	riders: readonly OverviewRider[],
	passed: boolean,
): SafeHtml {
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const column = (
		key:
			| "name"
			| "group"
			| "training"
			| "team"
			| "outdoor"
			| "missing"
			| "distance"
			| "elevation"
			| "events"
			| "corrections"
			| "virtual",
	) => html`<th scope="col">${i18n.t(`organiser.overview.column.${key}`)}</th>`;
	const rows = riders.map((rider) => {
		const events = rider.breakdown.teamEvents.reduce(
			(sum, e) => ({
				training: sum.training + e.training,
				team: sum.team + e.team,
			}),
			{ training: 0, team: 0 },
		);
		const missing = missingItems(i18n, rider);
		return html`<tr class="status-${rider.status}">
<th scope="row">${nameLinks(i18n, rider)}</th>
<td>${statusChip(i18n, rider, passed)}</td>
<td class="bar-cell"><span>${whole(rider.training)}</span>${thresholdBars(rider.training, rules.trainingThreshold, rider.pace?.training ?? null)}</td>
<td class="bar-cell"><span>${whole(rider.team)}</span>${thresholdBars(rider.team, rules.teamThreshold, rider.pace?.team ?? null)}</td>
<td>${whole(rider.outdoorTraining)}</td>
<td>${missing.map((m, i) => html`${i > 0 ? html`<br>` : null}<span${m.behind ? html` class="behind"` : null}>${m.text}</span>`)}</td>
<td class="number">${whole(rider.breakdown.distanceRynke)}</td>
<td class="number">${whole(rider.breakdown.elevationRynke)}</td>
<td class="number">${amounts(i18n, events.training, events.team)}</td>
<td class="number">${amounts(i18n, rider.breakdown.corrections.training, rider.breakdown.corrections.team)}</td>
<td class="number">${i18n.t("organiser.overview.percent", { n: whole(rider.breakdown.virtualShare) })}</td>
</tr>
`;
	});
	return html`<div class="table-scroll"><table class="rider-table">
<thead><tr>${column("name")}${column("group")}${column("training")}${column("team")}${column("outdoor")}${column("missing")}${column("distance")}${column("elevation")}${column("events")}${column("corrections")}${column("virtual")}</tr></thead>
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
}
</section>
`;
}

/** The page's body below the notice, in the order of contracts/pages.md. */
export function overviewBody(
	read: readonly TeamRider[],
	rules: RynkeRules,
	window: CountingWindow,
	today: string,
	group: Group | null,
	i18n: I18n,
): SafeHtml {
	const passed = today > window.deadline;
	const riders = overviewRiders(read, rules, window, today);
	const shown =
		group === null || group === "all"
			? riders
			: riders.filter((r) => r.status === group);
	const pace = overviewPace(rules, window, today);
	const whole = (n: number) => i18n.formatNumber(n, { fractionDigits: 0 });
	const list =
		riders.length === 0
			? html`<p>${i18n.t("organiser.overview.none")}</p>
`
			: html`${
					pace
						? html`<p class="team-hint">${i18n.t("organiser.overview.hint", { training: whole(pace.training), team: whole(pace.team) })}</p>
`
						: null
				}<ul class="rider-cards${group === null ? " default" : ""}">
${shown.map((r) => renderCard(i18n, rules, r, passed))}</ul>
${renderTable(i18n, rules, shown, passed)}${renderQualified(i18n, riders)}`;
	return html`<div class="team-overview">
<h2>${i18n.t("organiser.overview.heading")}</h2>
${renderDeadline(i18n, window, today, riders)}${renderTiles(i18n, riders, group, passed)}${list}</div>`;
}

/** `GET /organiser/riders`: the overview, organisers only. */
export function handleOrganiserOverview(
	request: Request,
	ctx: Ctx,
	i18n: I18n,
): Promise<Response> {
	const url = new URL(request.url);
	const window = countingWindow(ctx.env);
	const today = berlinDate(ctx.now());
	const group = parseGroup(
		url.searchParams.get("group"),
		today > window.deadline,
	);
	const path =
		group === null ? "/organiser/riders" : `/organiser/riders?group=${group}`;
	return organiserPage(request, ctx, i18n, path, async () => {
		const read = await readTeam(ctx.env.DB);
		return html`${organiserSwitch(i18n, "riders")}${noticeFromQuery(url, i18n)}${overviewBody(read, CURRENT_RULES, window, today, group, i18n)}`;
	});
}
