import type { RynkeKind } from "../rynke/leaderboard";
import { html, type SafeHtml } from "./html";

// The Team page's charts as inline SVG (feature 016 research R5, R12): no
// library and no client script. The sparkline and the bars stretch to their
// box, so the strokes keep their width with `vector-effect`; the peloton
// keeps its coins round. The label carries the figures.

const WIDTH = 100;
const HEIGHT = 24;
/** Keeps the stroke inside the box at the top and bottom. */
const INSET = 2;

/** One decimal is finer than any screen draws the box. */
const coord = (value: number) => String(Math.round(value * 10) / 10);

/** A rising line of `values`, lowest at the bottom; flat when all are 0. */
export function sparkline(values: readonly number[], label: string): SafeHtml {
	const max = Math.max(0, ...values);
	const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;
	const points = values
		.map((value, i) => {
			const x = values.length > 1 ? i * step : WIDTH;
			const share = max > 0 ? value / max : 0;
			const y = HEIGHT - INSET - share * (HEIGHT - 2 * INSET);
			return `${coord(x)},${coord(y)}`;
		})
		.join(" ");
	return html`<svg class="sparkline" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}"><polyline points="${points}" vector-effect="non-scaling-stroke"/></svg>`;
}

const ROAD_WIDTH = 320;
const ROAD_HEIGHT = 76;
const COIN = 20;
const OWN_COIN = 40;
/** Room for the viewer's coin at either end of the road. */
const ROAD_INSET = OWN_COIN / 2 + 2;
/** Three staggered rows, so riders close together stay apart. */
const LANES = [18, 38, 58];
/** The "You" tag under the viewer's coin, sized for a short word. */
const TAG_HEIGHT = 16;
const tagWidth = (text: string) => 12 + 7 * [...text].length;

/** One coin of the sprite, centred on `cx`, `cy`. */
const roadCoin = (
	side: "mini" | "front",
	cx: number,
	cy: number,
	size: number,
) =>
	html`<use href="#coin-${side}" x="${coord(cx - size / 2)}" y="${coord(cy - size / 2)}" width="${size}" height="${size}"/>`;

/**
 * The listed riders as mini coins on a dark road with a dashed middle line,
 * each at its total's share of the largest; `own` is the viewer's index,
 * drawn last as the coin's front with a `text.you` tag below.
 * No threshold line (US2 scenario 3).
 */
export function peloton(
	totals: readonly number[],
	own: number,
	text: { label: string; you: string },
	kind: RynkeKind,
): SafeHtml {
	const max = Math.max(0, ...totals);
	const cx = (total: number) =>
		ROAD_INSET + (max > 0 ? total / max : 0) * (ROAD_WIDTH - 2 * ROAD_INSET);
	const others = totals
		.filter((_, i) => i !== own)
		.map((total, n) =>
			roadCoin("mini", cx(total), LANES[n % LANES.length] ?? 0, COIN),
		);
	const ownX = cx(totals[own] ?? 0);
	const width = tagWidth(text.you);
	const tagX = Math.min(Math.max(ownX, width / 2), ROAD_WIDTH - width / 2);
	const tagY = 6 + OWN_COIN + 2;
	return html`<svg class="peloton-road${kind === "team" ? " coin-team" : ""}" viewBox="0 0 ${ROAD_WIDTH} ${ROAD_HEIGHT}" role="img" aria-label="${text.label}"><rect class="road" width="${ROAD_WIDTH}" height="${ROAD_HEIGHT}" rx="12"/><path class="road-middle" d="M12 ${ROAD_HEIGHT / 2}H${ROAD_WIDTH - 12}"/>${others}${roadCoin("front", ownX, 6 + OWN_COIN / 2, OWN_COIN)}<g class="peloton-you"><rect x="${coord(tagX - width / 2)}" y="${tagY}" width="${width}" height="${TAG_HEIGHT}" rx="8"/><text x="${coord(tagX)}" y="${tagY + 12}" text-anchor="middle">${text.you}</text></g></svg>`;
}

const BARS_WIDTH = 100;
const BARS_HEIGHT = 120;
/** The share of each week's slot the bar fills. */
const BAR_SHARE = 0.8;

/** One bar per week's team total, the last one the current week. */
export function weekBars(totals: readonly number[], label: string): SafeHtml {
	const max = Math.max(0, ...totals);
	const slot = totals.length > 0 ? BARS_WIDTH / totals.length : 0;
	const bars = totals.map((total, i) => {
		const height = max > 0 ? (total / max) * BARS_HEIGHT : 0;
		const current =
			i === totals.length - 1
				? html` class="current" vector-effect="non-scaling-stroke"`
				: null;
		return html`<rect${current} x="${coord(i * slot + (slot * (1 - BAR_SHARE)) / 2)}" y="${coord(BARS_HEIGHT - height)}" width="${coord(slot * BAR_SHARE)}" height="${coord(height)}"/>`;
	});
	return html`<svg class="week-bars" viewBox="0 0 ${BARS_WIDTH} ${BARS_HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}">${bars}</svg>`;
}

const THRESHOLD_WIDTH = 100;
const THRESHOLD_HEIGHT = 10;

/**
 * `value` as a filled bar against `threshold`, with a tick at the even pace
 * when `pace` is set. Decoration: the card or table cell carries the figures.
 */
export function thresholdBars(
	value: number,
	threshold: number,
	pace: number | null,
): SafeHtml {
	const share = (n: number) =>
		threshold > 0 ? Math.min(1, Math.max(0, n / threshold)) : 1;
	const tick =
		pace === null
			? null
			: html`<line class="pace-mark" x1="${coord(share(pace) * THRESHOLD_WIDTH)}" x2="${coord(share(pace) * THRESHOLD_WIDTH)}" y1="0" y2="${THRESHOLD_HEIGHT}" vector-effect="non-scaling-stroke"/>`;
	return html`<svg class="threshold-bar" viewBox="0 0 ${THRESHOLD_WIDTH} ${THRESHOLD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect class="threshold-track" y="2" width="${THRESHOLD_WIDTH}" height="6" rx="3"/><rect class="threshold-fill" y="2" width="${coord(share(value) * THRESHOLD_WIDTH)}" height="6" rx="3"/>${tick}</svg>`;
}
