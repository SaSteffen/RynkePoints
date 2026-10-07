import type { I18n } from "../i18n/i18n";
import { html, type SafeHtml } from "./html";
import type {
	Breakdown,
	Condition,
	Gauge,
	Gauges,
	RideLine,
	RiderView,
	RideTable,
	Summary,
} from "./rider-view";

// The Rynke sections of /me (feature 005 contracts/rider-page.md), rendered
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

function whole(i18n: I18n, n: number): string {
	return i18n.formatNumber(n, { fractionDigits: 0 });
}

/** The page's notices, or nothing when none applies. */
export function renderNotice(i18n: I18n, view: RiderView): SafeHtml | null {
	if (view.state !== "not-worked-out") return null;
	return html`<section class="notice" role="status">
<p>${i18n.t("rynke.notice.notWorkedOut")}</p>
</section>`;
}

export function renderSummary(i18n: I18n, summary: Summary): SafeHtml {
	const unmet = [
		{ condition: summary.training, id: "rynke.missing.training" },
		{ condition: summary.team, id: "rynke.missing.team" },
		{ condition: summary.withoutVirtual, id: "rynke.missing.withoutVirtual" },
	] as const;
	const missing = unmet.flatMap(({ condition, id }) =>
		condition && !condition.reached
			? [html`<li>${i18n.t(id, { n: whole(i18n, condition.missing) })}</li>`]
			: [],
	);
	const verdict = summary.qualified
		? html`<p class="rynke-verdict">${i18n.t("rynke.verdict.in")}</p>`
		: html`<p class="rynke-verdict">${i18n.t("rynke.verdict.notYet")}</p>
${missing.length > 0 ? html`<ul class="rynke-missing">${missing}</ul>` : null}`;
	const line = (label: string, condition: Condition) => {
		const value = whole(i18n, condition.value);
		const amount =
			condition.target === null
				? value
				: i18n.t("rynke.summary.ofTarget", {
						value,
						target: whole(i18n, condition.target),
					});
		const state = condition.reached
			? i18n.t("rynke.summary.reached")
			: i18n.t("rynke.summary.missing", { n: whole(i18n, condition.missing) });
		return html`<dt>${label}</dt><dd>${amount} · ${state}</dd>
`;
	};
	return html`<section id="rynke" class="rynke-summary">
<h2>${i18n.t("rynke.summary.heading")}</h2>
${verdict}
<dl>
${line(i18n.t("rynke.training"), summary.training)}${line(i18n.t("rynke.team"), summary.team)}${summary.withoutVirtual ? line(i18n.t("rynke.withoutVirtual"), summary.withoutVirtual) : null}</dl>
</section>`;
}

/** One stacked gauge per condition, then the elevation step (FR-020–FR-026). */
export function renderGauges(i18n: I18n, gauges: Gauges): SafeHtml {
	const conditions = [
		{ label: i18n.t("rynke.training"), gauge: gauges.training },
		{ label: i18n.t("rynke.team"), gauge: gauges.team },
		{ label: i18n.t("rynke.withoutVirtual"), gauge: gauges.withoutVirtual },
	];
	const figures = conditions.flatMap(({ label, gauge }) =>
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
				percent: i18n.t("units.percent", { value: elevation.percent }),
				missing: metres(Math.ceil((elevation.target - elevation.value) / 10)),
				stepRynke: whole(i18n, elevation.stepRynke),
			}),
		),
	);
	return html`<section class="rynke-gauges">
<h2>${i18n.t("rynke.gauges.heading")}</h2>
${figures}</section>`;
}

function figure(i18n: I18n, gauge: Gauge, caption: string): SafeHtml {
	const reached = gauge.reached
		? html` · ${i18n.t("rynke.gauge.reached")}`
		: null;
	// Widths are numbers the view model computed, never user input.
	const bar =
		gauge.parts.length === 0
			? html`<span class="gauge-fill" style="width:${gauge.percent}%"></span>`
			: gauge.parts.map(
					(part, i) =>
						html`<span class="gauge-part gauge-part-${i + 1}" style="width:${part.widthPercent.toFixed(2)}%"></span>`,
				);
	const legend =
		gauge.parts.length === 0
			? null
			: html`<ul class="gauge-legend">${gauge.parts.map(
					(part, i) =>
						html`<li><span class="gauge-key gauge-part-${i + 1}" aria-hidden="true"></span>${i18n.t(`rynke.source.${part.source}`)}: ${whole(i18n, part.value)}</li>`,
				)}</ul>`;
	return html`<figure class="gauge${gauge.reached ? " gauge-reached" : ""}">
<figcaption>${caption}${reached}</figcaption>
<div class="gauge-bar" aria-hidden="true">${bar}</div>
${legend}</figure>
`;
}

/** Where the Rynke come from, adding up to the totals (FR-030, FR-035). */
export function renderBreakdown(i18n: I18n, breakdown: Breakdown): SafeHtml {
	const metres = (m: number) => i18n.t("units.m", { value: whole(i18n, m) });
	const elevation = {
		metres: metres(breakdown.elevationM),
		rynke: whole(i18n, breakdown.elevationRynke),
		toNext: metres(breakdown.toNextStepM),
	};
	return html`<section class="rynke-breakdown">
<h2>${i18n.t("rynke.breakdown.heading")}</h2>
<dl>
<dt>${i18n.t("rynke.source.distance")}</dt><dd>${i18n.t("rynke.breakdown.trainingRynke", { n: whole(i18n, breakdown.distanceRynke) })}</dd>
<dt>${i18n.t("rynke.source.elevation")}</dt><dd>${
		breakdown.elevationStepRynke === null
			? i18n.t("rynke.breakdown.elevationNoStep", elevation)
			: i18n.t("rynke.breakdown.elevation", {
					...elevation,
					stepRynke: whole(i18n, breakdown.elevationStepRynke),
				})
	}</dd>
<dt>${i18n.t("rynke.breakdown.total")}</dt><dd>${i18n.t(
		"rynke.breakdown.totals",
		{
			training: whole(i18n, breakdown.trainingTotal),
			team: whole(i18n, breakdown.teamTotal),
		},
	)}</dd>
</dl>
</section>`;
}

export function renderRides(i18n: I18n, rides: RideTable): SafeHtml {
	const heading = html`<h2>${i18n.t("me.recent.heading")}</h2>`;
	if (rides.rows.length === 0) {
		return html`<section id="rides">
${heading}
<p>${i18n.t("me.recent.empty")}</p>
</section>`;
	}
	return html`<section id="rides">
${heading}
<table class="rides">
<thead><tr><th>${i18n.t("me.recent.col.date")}</th><th>${i18n.t("me.recent.col.distance")}</th><th>${i18n.t("rynke.rides.col.status")}</th><th>${i18n.t("rynke.training")}</th><th>${i18n.t("rynke.rides.col.elevationTotal")}</th></tr></thead>
<tbody>
${rides.rows.map((ride) => rideRows(i18n, ride))}</tbody>
</table>
</section>`;
}

function rideRows(i18n: I18n, ride: RideLine): SafeHtml {
	const status = STATUS[ride.status];
	// The rider's local date: Strava writes local wall-clock time with a `Z`.
	const date = i18n.formatDate(ride.startDateLocal);
	const km = i18n.t("units.km", {
		value: i18n.formatNumber(ride.distanceM / 1000, { fractionDigits: 1 }),
	});
	// Never 0 for a ride still being evaluated (FR-041).
	const pending = ride.status === "being-evaluated";
	const rynke = pending ? "–" : whole(i18n, ride.distanceRynke);
	const metres = pending
		? "–"
		: i18n.t("units.m", { value: whole(i18n, ride.elevationM) });
	const gain = i18n.t("units.m", { value: whole(i18n, ride.elevationGainM) });
	const virtual = ride.isVirtual
		? html` · ${i18n.t("rynke.ride.virtual")}`
		: null;
	return html`<tr class="ride ${status.cls}"><td>${date}</td><td class="num">${km}</td><td>${i18n.t(status.text)}</td><td class="num">${rynke}</td><td class="num">${metres}</td></tr>
<tr class="ride-details"><td colspan="5">${i18n.t(`sport.${ride.sportType}`)} · ${gain}${virtual}</td></tr>
`;
}
