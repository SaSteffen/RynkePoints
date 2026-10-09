import type { RynkeKind } from "../rynke/leaderboard";
import { html, type SafeHtml } from "./html";

// The Team page's charts as inline SVG (feature 016 research R5, R12): no
// library and no client script. The sparkline and the bars stretch to their
// box, so the stroke keeps its width with `vector-effect`; the peloton keeps
// its coins round. The label carries the figures.

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
const ROAD_HEIGHT = 64;
const COIN = 16;
const OWN_COIN = 24;
/** Room for the viewer's coin at either end of the road. */
const ROAD_INSET = OWN_COIN / 2 + 2;

/** One mini coin of the sprite, centred on `cx`, `cy`. */
const roadCoin = (cx: number, cy: number, size: number) =>
	html`<use href="#coin-mini" x="${coord(cx - size / 2)}" y="${coord(cy - size / 2)}" width="${size}" height="${size}"/>`;

/**
 * The listed riders as mini coins on a road, each at its total's share of the
 * largest; `own` is the viewer's index, drawn last and larger with `text.you`.
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
	// Two staggered rows, so riders close together stay apart.
	const others = totals.map((total, i) =>
		i === own ? null : roadCoin(cx(total), i % 2 ? 31 : 40, COIN),
	);
	const ownX = cx(totals[own] ?? 0);
	return html`<svg class="peloton-road${kind === "team" ? " coin-team" : ""}" viewBox="0 0 ${ROAD_WIDTH} ${ROAD_HEIGHT}" role="img" aria-label="${text.label}"><rect class="road" x="0" y="50" width="${ROAD_WIDTH}" height="6" rx="3"/>${others}${roadCoin(ownX, 36, OWN_COIN)}<text class="peloton-you" x="${coord(ownX)}" y="18" text-anchor="middle">${text.you}</text></svg>`;
}

const BARS_WIDTH = 100;
const BARS_HEIGHT = 40;
/** The share of each week's slot the bar fills. */
const BAR_SHARE = 0.7;

/** One bar per week's team total, the last one the current week. */
export function weekBars(totals: readonly number[], label: string): SafeHtml {
	const max = Math.max(0, ...totals);
	const slot = totals.length > 0 ? BARS_WIDTH / totals.length : 0;
	const bars = totals.map((total, i) => {
		const height = max > 0 ? (total / max) * BARS_HEIGHT : 0;
		const current = i === totals.length - 1 ? html` class="current"` : null;
		return html`<rect${current} x="${coord(i * slot + (slot * (1 - BAR_SHARE)) / 2)}" y="${coord(BARS_HEIGHT - height)}" width="${coord(slot * BAR_SHARE)}" height="${coord(height)}"/>`;
	});
	return html`<svg class="week-bars" viewBox="0 0 ${BARS_WIDTH} ${BARS_HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}">${bars}</svg>`;
}
