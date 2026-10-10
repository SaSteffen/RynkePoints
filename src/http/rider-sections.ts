import type { Rider } from "../db/riders";
import type { I18n } from "../i18n/i18n";
import { STRAVA_ORIGIN } from "../strava/result";
import { coin, miniCoin } from "./coin";
import { html, type SafeHtml } from "./html";
import type {
	Breakdown,
	EventLine,
	Gauge,
	GaugeSource,
	Gauges,
	Pager,
	ReasonLine,
	RideLine,
	RiderView,
	RideTable,
	RulesInfo,
	Summary,
} from "./rider-view";

// The Rynke sections of the Overview and Rides (feature 005
// contracts/rider-page.md, feature 011 contracts/pages.md), rendered
// from the view model. All text from the catalogs, all numbers through
// `I18n`; the markup and class names are the contract the tests check.

const STATUS = {
	counts: { cls: "ride-counting", text: "rynke.ride.counts" },
	"does-not-count": {
		cls: "ride-not-counting",
		text: "rynke.ride.doesNotCount",
	},
	"being-evaluated": {
		cls: "ride-pending",
		text: "rynke.ride.beingEvaluated",
	},
} as const;

/**
 * Each source's colour class, the same in every gauge and legend
 * (contracts/rider-page.md); 6 is kept for feature 003 Story 6's corrections.
 */
const PART_CLASS: Record<GaugeSource, string> = {
	distance: "gauge-part-1",
	elevation: "gauge-part-2",
	team_training: "gauge-part-3",
	training_weekend_day: "gauge-part-4",
	technique_training: "gauge-part-5",
};

/** The rules handout PDF, a static asset from `pnpm docs:pdf` (research R14). */
export const RULES_HANDOUT_URL = "/rynke-punkte.pdf";

function whole(i18n: I18n, n: number): string {
	return i18n.formatNumber(n, { fractionDigits: 0 });
}

/** A configured `YYYY-MM-DD`, passed as UTC midnight like the season start. */
function day(i18n: I18n, date: string): string {
	return i18n.formatDate(`${date}T00:00:00Z`);
}

/**
 * The spinning coin and the one-time message before the first data (015
 * contracts/pages.md); the page script polls every `pollSeconds` (R5).
 */
export function renderWaiting(
	i18n: I18n,
	seasonStart: string,
	pollSeconds: number,
): SafeHtml {
	return html`<section class="waiting" role="status" data-waiting data-poll-seconds="${pollSeconds}">
${coin("front", "large")}
<h2>${i18n.t("waiting.heading")}</h2>
<p>${i18n.t("waiting.body", { date: day(i18n, seasonStart) })}</p>
</section>`;
}

/**
 * The way back to Strava for a rider whose token stopped working, on You and on
 * Team, where the app opens (issue #73).
 */
export function renderReconnect(i18n: I18n, rider: Rider): SafeHtml | null {
	if (rider.status !== "needs_reconnect") return null;
	return html`<aside class="notice notice-error">
<p>${i18n.t("me.status.needsReconnect")}</p>
<p><a class="button" href="/connect">${i18n.t("me.reconnect")}</a></p>
</aside>
`;
}

/** The rule-change notice, or nothing when the rules are current (015 R2). */
export function renderNotice(i18n: I18n, view: RiderView): SafeHtml | null {
	if (view.state !== "ready" || !view.updating) return null;
	return html`<section class="notice" role="status">
<p>${i18n.t("rynke.notice.updating", {
		date: day(i18n, view.updating.inEffectSince),
		version: String(view.rules.version),
	})}</p>
</section>`;
}

export function renderSummary(i18n: I18n, summary: Summary): SafeHtml {
	const unmet = [
		{
			condition: summary.training,
			id: "rynke.missing.training",
			kind: "training",
		},
		{ condition: summary.team, id: "rynke.missing.team", kind: "team" },
		{
			condition: summary.withoutVirtual,
			id: "rynke.missing.withoutVirtual",
			kind: "training",
		},
	] as const;
	const missing = unmet.flatMap(({ condition, id, kind }) =>
		condition && !condition.reached
			? [
					html`<li><span class="chip">${miniCoin(kind)}${i18n.t(id, { n: whole(i18n, condition.missing) })}</span></li>`,
				]
			: [],
	);
	// The coin's Hamburg–Paris side for a rider who made it (feature 012 FR-003).
	// The gauges below carry the figures; this says only where the rider stands.
	const verdict = summary.qualified
		? html`<p class="rynke-verdict">${coin("back", "head")}${i18n.t("rynke.verdict.in")}</p>`
		: html`<p class="rynke-verdict">${i18n.t("rynke.verdict.notYet")}</p>
${
	missing.length > 0
		? html`<p>${i18n.t("rynke.verdict.missing")}</p>
<ul class="rynke-missing">${missing}</ul>`
		: null
}`;
	return html`<section id="rynke" class="rynke-summary verdict card">
${verdict}
</section>`;
}

/** One stacked gauge per condition, then the elevation step (FR-020–FR-026). */
export function renderGauges(i18n: I18n, gauges: Gauges): SafeHtml {
	const conditions = [
		{
			label: i18n.t("rynke.training"),
			gauge: gauges.training,
			kind: "training",
		},
		{ label: i18n.t("rynke.team"), gauge: gauges.team, kind: "team" },
		{
			label: i18n.t("rynke.withoutVirtual"),
			gauge: gauges.withoutVirtual,
			kind: null,
		},
	] as const;
	const figures = conditions.flatMap(({ label, gauge, kind }) =>
		gauge
			? [
					figure(
						i18n,
						gauge,
						i18n.t("rynke.gauge.caption", {
							label,
							value: whole(i18n, gauge.value),
							target: whole(i18n, gauge.target),
							percent: i18n.t("units.percent", { value: gauge.percent }),
						}),
						kind,
					),
				]
			: [],
	);
	// In decimetres within the step; shown in metres, what is still missing
	// rounded up.
	const elevation = gauges.elevation;
	const metres = (m: number) => i18n.t("units.m", { value: whole(i18n, m) });
	figures.push(
		figure(
			i18n,
			elevation,
			i18n.t("rynke.gauge.elevation", {
				value: metres(Math.floor(elevation.value / 10)),
				target: metres(elevation.target / 10),
				missing: metres(Math.ceil((elevation.target - elevation.value) / 10)),
				stepRynke: whole(i18n, elevation.stepRynke),
			}),
		),
	);
	return html`<section class="rynke-gauges">
<h2>${i18n.t("rynke.gauges.heading")}</h2>
${figures}</section>`;
}

/**
 * Ten coins, one for each tenth of the way, collected ones of the kind's
 * colour (feature 012 FR-001); the caption carries the figures.
 */
function coinRow(gauge: Gauge, kind: "training" | "team"): SafeHtml {
	const collected = Math.floor(gauge.percent / 10);
	const coins = Array.from({ length: 10 }, (_, i) =>
		i < collected ? miniCoin(kind) : html`<span class="coin-slot"></span>`,
	);
	return html`<span class="coin-row" aria-hidden="true">${coins}</span>
`;
}

/**
 * One gauge in its own card (feature 011 contracts/pages.md "Overview"); the
 * Training and Team gauges under their coin side (feature 012).
 */
function figure(
	i18n: I18n,
	gauge: Gauge,
	caption: string,
	kind: "training" | "team" | null = null,
): SafeHtml {
	const reached = gauge.reached
		? html` · ${i18n.t("rynke.gauge.reached")}`
		: null;
	// Widths are numbers the view model computed, never user input.
	const bar =
		gauge.parts.length === 0
			? html`<span class="gauge-fill" style="width:${gauge.percent}%"></span>`
			: gauge.parts.map(
					(part) =>
						html`<span class="gauge-part ${PART_CLASS[part.source]}" style="width:${part.widthPercent.toFixed(2)}%"></span>`,
				);
	const legend =
		gauge.parts.length === 0
			? null
			: html`<ul class="gauge-legend">${gauge.parts.map(
					(part) =>
						html`<li><span class="gauge-key ${PART_CLASS[part.source]}" aria-hidden="true"></span>${i18n.t(`rynke.source.${part.source}`)}: ${whole(i18n, part.value)}</li>`,
				)}</ul>`;
	return html`<section class="card">
<figure class="gauge${gauge.reached ? " gauge-reached" : ""}">
<figcaption>${kind ? coin(kind === "team" ? "back" : "front", "head") : null}${caption}${reached}</figcaption>
${kind ? coinRow(gauge, kind) : null}<div class="gauge-bar" aria-hidden="true">${bar}</div>
${legend}</figure>
</section>
`;
}

/** Where the Rynke come from (FR-030–FR-033, FR-035); the hero has the totals. */
export function renderBreakdown(i18n: I18n, breakdown: Breakdown): SafeHtml {
	const metres = (m: number) => i18n.t("units.m", { value: whole(i18n, m) });
	return html`<section class="rynke-breakdown card card-outlined">
<h2>${i18n.t("rynke.breakdown.heading")}</h2>
<dl>
<dt>${i18n.t("rynke.source.distance")}</dt><dd>${i18n.t("rynke.breakdown.trainingRynke", { n: whole(i18n, breakdown.distanceRynke) })}</dd>
<dt>${i18n.t("rynke.source.elevation")}</dt><dd>${i18n.t("rynke.breakdown.elevation", { metres: metres(breakdown.elevationM), rynke: whole(i18n, breakdown.elevationRynke) })}</dd>
${breakdown.kinds.map(
	(kind) =>
		html`<dt>${i18n.t(`rynke.source.${kind.kind}`)}</dt><dd>${i18n.t(
			"rynke.breakdown.kind",
			{
				count: whole(i18n, kind.attended),
				team: whole(i18n, kind.team),
				training: whole(i18n, kind.training),
			},
		)}</dd>
`,
)}</dl>
<h3>${i18n.t("rynke.events.heading")}</h3>
${
	breakdown.events.length === 0
		? html`<p>${i18n.t("rynke.events.none")}</p>`
		: html`<ul class="rynke-events">${breakdown.events.map((event) =>
				eventItem(i18n, event),
			)}</ul>`
}
</section>`;
}

/** Date, kind, the organiser's name for it, and whether it counts (FR-033). */
function eventItem(i18n: I18n, event: EventLine): SafeHtml {
	const parts = [day(i18n, event.date), i18n.t(`rynke.source.${event.kind}`)];
	if (event.name !== null) parts.push(event.name);
	if (!event.counts) parts.push(i18n.t("rynke.events.notCounting"));
	return event.counts
		? html`<li>${parts.join(" · ")}</li>`
		: html`<li class="event-not-counting">${parts.join(" · ")}</li>`;
}

/** The rules version, the counting window and the handout (FR-050, FR-053). */
export function renderRules(i18n: I18n, rules: RulesInfo): SafeHtml {
	const window = i18n.t("rynke.rules.windowDeadline", {
		start: day(i18n, rules.seasonStart),
		deadline: day(i18n, rules.deadline),
	});
	return html`<section class="rynke-rules card card-outlined">
<h2>${i18n.t("rynke.rules.heading")}</h2>
<p>${i18n.t("rynke.rules.version", {
		version: String(rules.version),
		date: day(i18n, rules.effectiveDate),
	})}</p>
<p>${window}</p>
<p><a class="tap" href="${RULES_HANDOUT_URL}" download>${i18n.t("rynke.rules.handout")}</a></p>
</section>`;
}

export function renderRides(i18n: I18n, rides: RideTable): SafeHtml {
	const heading = html`<h2>${i18n.t("me.recent.heading")}</h2>`;
	if (rides.rows.length === 0) {
		return html`<section id="rides">
${heading}
${coin("front", "large")}
<p>${i18n.t("me.recent.none")}</p>
</section>`;
	}
	const { from, to, total } = rides.position;
	const position =
		rides.pager &&
		html`<p class="rides-position">${i18n.t("rynke.rides.position", {
			from: whole(i18n, from),
			to: whole(i18n, to),
			total: whole(i18n, total),
		})}</p>
`;
	return html`<section id="rides">
${heading}
${position}<ol class="ride-list">
${rides.rows.map((ride) => rideCard(i18n, ride))}</ol>
${rides.pager && renderPager(i18n, rides.pager)}</section>`;
}

/** Only the links that apply; each a 44 px tap target (FR-045, FR-070). */
function renderPager(i18n: I18n, pager: Pager): SafeHtml {
	const links = PAGER_LINKS.flatMap(({ key, rel, text }) => {
		const page = pager[key];
		return page === null
			? []
			: [
					html`<a class="tap" href="/me/rides?page=${page}" rel="${rel}">${i18n.t(text)}</a>`,
				];
	});
	return html`<nav class="pager" aria-label="${i18n.t("rynke.pager.label")}">${links}</nav>
`;
}

const PAGER_LINKS = [
	{ key: "first", rel: "first", text: "rynke.pager.first" },
	{ key: "previous", rel: "prev", text: "rynke.pager.previous" },
	{ key: "next", rel: "next", text: "rynke.pager.next" },
	{ key: "last", rel: "last", text: "rynke.pager.last" },
] as const;

function kilometres(i18n: I18n, m: number): string {
	return i18n.t("units.km", {
		value: i18n.formatNumber(m / 1000, { fractionDigits: 1 }),
	});
}

/** Hours and minutes, minutes rounded down; minutes alone below an hour. */
function duration(i18n: I18n, s: number): string {
	const min = Math.floor(s / 60);
	return min < 60
		? i18n.t("units.durationMin", { min })
		: i18n.t("units.duration", { h: Math.floor(min / 60), min: min % 60 });
}

function kmh(i18n: I18n, value: number, fractionDigits: number): string {
	return i18n.t("units.kmh", {
		value: i18n.formatNumber(value, { fractionDigits }),
	});
}

/** One reason in plain words, with its figure and limit (research R12). */
function reasonText(i18n: I18n, reason: ReasonLine): string {
	switch (reason.code) {
		case "flagged":
			return i18n.t("rynke.reason.flagged");
		case "manual":
			return i18n.t("rynke.reason.manual");
		case "pause": {
			if (reason.pausedS === null) {
				return i18n.t("rynke.reason.pause.noMovingTime");
			}
			const times = {
				paused: duration(i18n, reason.pausedS),
				moving: duration(i18n, reason.movingS),
			};
			if (!reason.share) return i18n.t("rynke.reason.pause.noLimit", times);
			const { num, den } = reason.share;
			if (num === den) return i18n.t("rynke.reason.pause.moving", times);
			return num * 2 === den
				? i18n.t("rynke.reason.pause", times)
				: i18n.t("rynke.reason.pause.share", {
						...times,
						share: `${num}/${den}`,
					});
		}
		case "too_slow":
		case "too_fast": {
			const speed = kmh(i18n, reason.kmhTenths / 10, 1);
			return reason.limitKmh === null
				? i18n.t(`rynke.reason.${reason.code}.noLimit`, { speed })
				: i18n.t(`rynke.reason.${reason.code}`, {
						speed,
						// Whole today; a fractional limit must not be rounded away.
						limit: kmh(
							i18n,
							reason.limitKmh,
							Number.isInteger(reason.limitKmh) ? 0 : 1,
						),
					});
		}
		case "climbing_rate": {
			const rate = i18n.t("units.mPerH", { value: whole(i18n, reason.mPerH) });
			return reason.limitMPerH === null
				? i18n.t("rynke.reason.climbing_rate.noLimit", { rate })
				: i18n.t("rynke.reason.climbing_rate", {
						rate,
						limit: i18n.t("units.mPerH", {
							value: whole(i18n, reason.limitMPerH),
						}),
					});
		}
		case "excluded_sport_type":
			return i18n.t("rynke.reason.excluded_sport_type", {
				sport: i18n.t(`sport.${reason.sportType}`),
			});
		case "before_season":
			return i18n.t("rynke.reason.outside_window", {
				date: day(i18n, reason.date),
			});
		case "after_deadline":
			return i18n.t("rynke.reason.outside_window.afterDeadline", {
				date: day(i18n, reason.date),
			});
		case "overlap": {
			const ride = reason.countedInstead;
			return ride === null
				? i18n.t("rynke.reason.overlap.noRide")
				: i18n.t("rynke.reason.overlap", {
						date: i18n.formatDate(ride.startDateLocal),
						time: i18n.formatTime(ride.startDateLocal),
						distance: kilometres(i18n, ride.distanceM),
					});
		}
		case "unknown":
			return i18n.t("rynke.reason.unknown");
	}
}

/**
 * Reasons, unknown figures and the fix hint in the card's disclosure, open
 * only for a ride that doesn't count (011 clarification Q5); none when
 * there is nothing to explain (FR-042–FR-044).
 */
function explanation(i18n: I18n, ride: RideLine): SafeHtml | null {
	const reasons =
		ride.reasons.length === 0
			? null
			: html`<ul class="ride-reasons">${ride.reasons.map(
					(reason) => html`<li>${reasonText(i18n, reason)}</li>`,
				)}</ul>`;
	const unknown =
		ride.unknownFigures.length === 0
			? null
			: html`<p>${[
					...ride.unknownFigures.map((code) => i18n.t(`rynke.unknown.${code}`)),
					i18n.t("rynke.unknown.mayChange"),
				].join(" ")}</p>`;
	const fixHint = ride.fixHint
		? html`<p>${i18n.t("rynke.ride.fixHint")}</p>`
		: null;
	if (!reasons && !unknown && !fixHint) return null;
	const open = ride.status === "does-not-count" ? html` open` : null;
	return html`<details class="ride-why"${open}><summary class="tap">${i18n.t("rynke.ride.why")}</summary>${reasons}${unknown}${fixHint}</details>
`;
}

/** One ride as a card (011 contracts/pages.md "Rides", research R7). */
function rideCard(i18n: I18n, ride: RideLine): SafeHtml {
	const status = STATUS[ride.status];
	// The rider's local date: Strava writes local wall-clock time with a `Z`.
	const date = i18n.formatDate(ride.startDateLocal);
	const km = kilometres(i18n, ride.distanceM);
	// Never 0 for a ride still being evaluated (FR-041).
	const pending = ride.status === "being-evaluated";
	const rynke = pending ? "–" : whole(i18n, ride.distanceRynke);
	// A mini coin for each ride that earned Training Rynke (feature 012).
	const earned =
		ride.status === "counts" && ride.distanceRynke > 0
			? html` ${miniCoin("training")}`
			: null;
	const metres = pending
		? "–"
		: i18n.t("units.m", { value: whole(i18n, ride.elevationM) });
	const gain = i18n.t("units.m", { value: whole(i18n, ride.elevationGainM) });
	const virtual = ride.isVirtual
		? html` · ${i18n.t("rynke.ride.virtual")}`
		: null;
	// Plain escaped text, never the link; same tab, like the app's other links
	// to Strava (008 research R4).
	const name =
		ride.name === null
			? null
			: html`<span class="ride-name">${ride.name}</span> `;
	return html`<li class="ride-card ${status.cls}">
<div class="ride-head"><span class="ride-date">${date}</span> <span class="chip ride-status">${i18n.t(status.text)}</span></div>
<dl class="ride-figures"><div><dt>${i18n.t("me.recent.col.distance")}</dt><dd>${km}</dd></div><div><dt>${i18n.t("rynke.training")}</dt><dd>${rynke}${earned}</dd></div><div><dt>${i18n.t("rynke.rides.col.elevationTotal")}</dt><dd>${metres}</dd></div></dl>
<p class="ride-strava">${name}<a class="tap strava-activity" href="${STRAVA_ORIGIN}/activities/${ride.activityId}">${i18n.t("brand.viewOnStrava")}</a></p>
<p class="ride-meta">${i18n.t(`sport.${ride.sportType}`)} · ${gain}${virtual}</p>
${explanation(i18n, ride)}</li>
`;
}
