import type { Breakaway } from "../rynke/breakaway";
import type { RynkeKind } from "../rynke/leaderboard";
import { html, type SafeHtml } from "./html";

// The Team page's charts as inline SVG (feature 016 research R5, R12): no
// library and no client script. The sparkline and the bars stretch to their
// box, so the strokes keep their width with `vector-effect`; the peloton
// keeps its coins round and puts the riders ahead of the bunch past a gap
// (R13). The label carries the figures.

const WIDTH = 100;
const HEIGHT = 24;
/** Keeps the stroke inside the box at the top and bottom. */
const INSET = 2;

/** One decimal is finer than any screen draws the box. */
const coord = (value: number) => String(Math.round(value * 10) / 10);

/**
 * A smooth path through `points` (ascending x) that never dips or overshoots
 * between them: a monotone cubic curve (Fritsch–Carlson), as the Training
 * curves on the progress charts draw it.
 */
function monotonePath(points: readonly (readonly [number, number])[]): string {
	const n = points.length;
	const [x0, y0] = points[0] ?? [0, 0];
	if (n < 2) return `M${coord(x0)} ${coord(y0)}`;
	const x = (i: number) => points[i]?.[0] ?? 0;
	const y = (i: number) => points[i]?.[1] ?? 0;
	const slopes = points.slice(1).map((_, i) => {
		const dx = x(i + 1) - x(i);
		return dx > 0 ? (y(i + 1) - y(i)) / dx : 0;
	});
	const slope = (i: number) => slopes[i] ?? 0;
	const tangents = points.map((_, i) => {
		if (i === 0) return slope(0);
		if (i === n - 1) return slope(n - 2);
		const before = slope(i - 1);
		const after = slope(i);
		return before * after <= 0 ? 0 : (before + after) / 2;
	});
	for (let i = 0; i < n - 1; i++) {
		const d = slope(i);
		if (d === 0) {
			tangents[i] = 0;
			tangents[i + 1] = 0;
			continue;
		}
		const a = (tangents[i] ?? 0) / d;
		const b = (tangents[i + 1] ?? 0) / d;
		const squares = a * a + b * b;
		if (squares > 9) {
			const t = 3 / Math.sqrt(squares);
			tangents[i] = t * a * d;
			tangents[i + 1] = t * b * d;
		}
	}
	let path = `M${coord(x0)} ${coord(y0)}`;
	for (let i = 0; i < n - 1; i++) {
		const third = (x(i + 1) - x(i)) / 3;
		path += `C${coord(x(i) + third)} ${coord(y(i) + (tangents[i] ?? 0) * third)} ${coord(x(i + 1) - third)} ${coord(y(i + 1) - (tangents[i + 1] ?? 0) * third)} ${coord(x(i + 1))} ${coord(y(i + 1))}`;
	}
	return path;
}

/**
 * A rising line of `values`, lowest at the bottom; flat when all are 0. With
 * `days` (one day number per value) the points sit by date, so the week under
 * way is only as wide as its days so far; without, they're evenly spaced.
 * `smooth` draws a monotone curve through the points instead of straight lines.
 */
export function sparkline(
	values: readonly number[],
	label: string,
	days?: readonly number[],
	smooth = false,
): SafeHtml {
	const max = Math.max(0, ...values);
	const at = days ?? values.map((_, i) => i);
	const first = at[0] ?? 0;
	const span = (at[at.length - 1] ?? 0) - first;
	const points = values.map((value, i): [number, number] => {
		const x = span > 0 ? (((at[i] ?? 0) - first) / span) * WIDTH : WIDTH;
		const share = max > 0 ? value / max : 0;
		return [x, HEIGHT - INSET - share * (HEIGHT - 2 * INSET)];
	});
	const line = smooth
		? html`<path d="${monotonePath(points)}" vector-effect="non-scaling-stroke"/>`
		: html`<polyline points="${points.map(([x, y]) => `${coord(x)},${coord(y)}`).join(" ")}" vector-effect="non-scaling-stroke"/>`;
	return html`<svg class="sparkline" viewBox="0 0 ${WIDTH} ${HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}">${line}</svg>`;
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

/** The bubble above the road with a coin's total, sized for a short text. */
const BUBBLE_HEIGHT = 18;
const bubbleWidth = (text: string) => 12 + 6.5 * [...text].length;

/**
 * One coin of the sprite, centred on `cx`, `cy`, with `bubble` above the road
 * on hover or tap; `tabindex` lets a tap focus it, the stylesheet does the
 * rest, so the chart stays without a script.
 */
const roadCoin = (
	side: "mini" | "front",
	cx: number,
	cy: number,
	size: number,
	bubble: string,
) => {
	const width = bubbleWidth(bubble);
	const x = Math.min(Math.max(cx, width / 2), ROAD_WIDTH - width / 2);
	return html`<g class="peloton-coin" tabindex="-1"><use href="#coin-${side}" x="${coord(cx - size / 2)}" y="${coord(cy - size / 2)}" width="${size}" height="${size}"/><g class="peloton-bubble"><rect x="${coord(x - width / 2)}" y="${-6 - BUBBLE_HEIGHT}" width="${coord(width)}" height="${BUBBLE_HEIGHT}" rx="${BUBBLE_HEIGHT / 2}"/><path d="M${coord(cx - 4)} -6.5L${coord(cx)} -2L${coord(cx + 4)} -6.5Z"/><text x="${coord(x)}" y="-11" text-anchor="middle">${bubble}</text></g></g>`;
};

/** With a breakaway: its front end, and the room for the gap and around it. */
const BREAKAWAY_TO = 294;
const GAP_BEFORE = 32;
const BUNCH_BEFORE_GAP = 39;
/** The breakaway's width: room per distinct total, within these bounds. */
const BREAKAWAY_STEP = 11;
const BREAKAWAY_MIN = 25;
const BREAKAWAY_MAX = 96;
/** The extra room between two groups of the breakaway, in steps. */
const GROUP_SPACE = 0.8;
/** Half the gap's width and how far it leans at the top and bottom. */
const GAP_HALF = 3;
const GAP_LEAN = 9;

/**
 * Each total's position on the road, and the gap's if there is one. The bunch
 * spreads to scale from its last rider to its front rider, so a tight pack
 * fills the road. With a breakaway, the bunch ends left of a gap and the
 * breakaway's distinct totals follow past it in ascending order, evenly, with a
 * little more room between its groups; it widens with more riders. The riders
 * far ahead don't squash the bunch (FR-018, research R13).
 */
function roadPositions(
	totals: readonly number[],
	away: Breakaway | null,
): { x: (total: number) => number; gapAt: number | null } {
	const scale = (values: readonly number[], end: number) => {
		const min = Math.min(...values);
		const max = Math.max(0, ...values);
		// Equal totals: all at the front, or all at the back without Rynke.
		return (total: number) =>
			max > min
				? ROAD_INSET + ((total - min) / (max - min)) * (end - ROAD_INSET)
				: max > 0
					? end
					: ROAD_INSET;
	};
	if (away === null) {
		return { x: scale(totals, ROAD_WIDTH - ROAD_INSET), gapAt: null };
	}
	const slots = new Map<number, number>();
	let slot = 0;
	away.groups.forEach((group, g) => {
		if (g > 0) slot += 1 + GROUP_SPACE;
		for (const [i, total] of group.entries()) slots.set(total, slot + i);
		slot += group.length - 1;
	});
	const width = Math.min(
		BREAKAWAY_MAX,
		Math.max(BREAKAWAY_MIN, slots.size * BREAKAWAY_STEP - BREAKAWAY_STEP),
	);
	const from = BREAKAWAY_TO - width;
	const gapAt = from - GAP_BEFORE;
	const bunch = scale(
		totals.filter((total) => total <= away.fence),
		gapAt - BUNCH_BEFORE_GAP,
	);
	// One distinct total rides in the middle of the breakaway's room.
	const at = (total: number) =>
		slot > 0
			? from + ((slots.get(total) ?? 0) / slot) * width
			: BREAKAWAY_TO - 12;
	return {
		x: (total) => (total > away.fence ? at(total) : bunch(total)),
		gapAt,
	};
}

/**
 * A slanted band across the road at `at`, in the card's colour, its two cut
 * edges marked: in the dark scheme the road and the card are too close to
 * tell apart without them.
 */
const roadGap = (at: number) => {
	const left = `M${at - GAP_HALF + GAP_LEAN} 0L${at - GAP_HALF - GAP_LEAN} ${ROAD_HEIGHT}`;
	const right = `M${at + GAP_HALF + GAP_LEAN} 0L${at + GAP_HALF - GAP_LEAN} ${ROAD_HEIGHT}`;
	return html`<path class="road-gap" d="M${at - GAP_HALF + GAP_LEAN} 0L${at + GAP_HALF + GAP_LEAN} 0L${at + GAP_HALF - GAP_LEAN} ${ROAD_HEIGHT}L${at - GAP_HALF - GAP_LEAN} ${ROAD_HEIGHT}Z"/><path class="road-gap-edge" d="${left}${right}"/>`;
};

/**
 * The listed riders as mini coins on a dark road with a dashed middle line;
 * `own` is the viewer's index, drawn last as the coin's front with a `text.you`
 * tag below. With a `breakaway`, a gap cuts the road and the riders ahead of
 * the bunch ride past it. Hovering or tapping a coin shows `text.total` of it.
 * No threshold line (US2 scenario 3).
 */
export function peloton(
	totals: readonly number[],
	own: number,
	away: Breakaway | null,
	text: { label: string; you: string; total: (total: number) => string },
	kind: RynkeKind,
): SafeHtml {
	const { x, gapAt } = roadPositions(totals, away);
	const others = totals
		.filter((_, i) => i !== own)
		.map((total, n) =>
			roadCoin(
				"mini",
				x(total),
				LANES[n % LANES.length] ?? 0,
				COIN,
				text.total(total),
			),
		);
	const ownTotal = totals[own] ?? 0;
	const ownX = x(ownTotal);
	const width = tagWidth(text.you);
	const tagX = Math.min(Math.max(ownX, width / 2), ROAD_WIDTH - width / 2);
	const tagY = 6 + OWN_COIN + 2;
	return html`<svg class="peloton-road${kind === "team" ? " coin-team" : ""}" viewBox="0 0 ${ROAD_WIDTH} ${ROAD_HEIGHT}" role="img" aria-label="${text.label}"><rect class="road" width="${ROAD_WIDTH}" height="${ROAD_HEIGHT}" rx="12"/><path class="road-middle" d="M12 ${ROAD_HEIGHT / 2}H${ROAD_WIDTH - 12}"/>${gapAt === null ? null : roadGap(gapAt)}${others}${roadCoin("front", ownX, 6 + OWN_COIN / 2, OWN_COIN, text.total(ownTotal))}<g class="peloton-you"><rect x="${coord(tagX - width / 2)}" y="${tagY}" width="${width}" height="${TAG_HEIGHT}" rx="8"/><text x="${coord(tagX)}" y="${tagY + 12}" text-anchor="middle">${text.you}</text></g></svg>`;
}

const BARS_WIDTH = 100;
const BARS_HEIGHT = 120;
/** The share of each week's slot the bar fills. */
const BAR_SHARE = 0.8;
/** Keeps the running total's stroke inside the box at the top. */
const BARS_INSET = 3;

/**
 * One bar per week of what the team gained that week, the last one the
 * current week, under a smooth line of the running total through the bars'
 * middles.
 * The bars and the line each have their own scale, highest at the top.
 */
export function weekBars(
	gains: readonly number[],
	totals: readonly number[],
	label: string,
): SafeHtml {
	const maxGain = Math.max(0, ...gains);
	const maxTotal = Math.max(0, ...totals);
	const slot = gains.length > 0 ? BARS_WIDTH / gains.length : 0;
	const bars = gains.map((gain, i) => {
		const height = maxGain > 0 ? (gain / maxGain) * BARS_HEIGHT : 0;
		const current =
			i === gains.length - 1
				? html` class="current" vector-effect="non-scaling-stroke"`
				: null;
		return html`<rect${current} x="${coord(i * slot + (slot * (1 - BAR_SHARE)) / 2)}" y="${coord(BARS_HEIGHT - height)}" width="${coord(slot * BAR_SHARE)}" height="${coord(height)}"/>`;
	});
	const points = totals.map((total, i): [number, number] => {
		const share = maxTotal > 0 ? total / maxTotal : 0;
		return [(i + 0.5) * slot, BARS_HEIGHT - share * (BARS_HEIGHT - BARS_INSET)];
	});
	return html`<svg class="week-bars" viewBox="0 0 ${BARS_WIDTH} ${BARS_HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}">${bars}<path d="${monotonePath(points)}" vector-effect="non-scaling-stroke"/></svg>`;
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

const DAILY_WIDTH = 1000;
const DAILY_HEIGHT = 60;
/** From here on the bars touch: a gap between them would be under a pixel wide. */
const DAILY_TOUCHING = 90;

export interface DailyBar {
	/** Percentage of that day's limit; null: no record that day. */
	share: number | null;
	level: "ok" | "warning" | "critical";
}

/**
 * One bar per day, oldest first, with the limit as a line (feature 025 FR-014). A
 * null share is a day without a record: no bar, so a gap never reads as zero
 * (FR-015). Taller than the limit when a day went above it. One path per level,
 * not an element per day: a page draws thousands of days, within the Worker's CPU
 * limit. The table of days carries the figures.
 */
export function dailyBars(days: readonly DailyBar[], label: string): SafeHtml {
	const top = Math.max(100, ...days.map((day) => day.share ?? 0));
	const slot = days.length > 0 ? DAILY_WIDTH / days.length : 0;
	const width = coord(slot * (days.length < DAILY_TOUCHING ? BAR_SHARE : 1));
	const y = (share: number) =>
		DAILY_HEIGHT - (Math.max(0, share) / top) * DAILY_HEIGHT;
	const paths = { ok: "", warning: "", critical: "" };
	days.forEach(({ share, level }, i) => {
		if (share === null) return;
		paths[level] +=
			`M${coord(i * slot)} ${coord(y(share))}h${width}V${DAILY_HEIGHT}h-${width}z`;
	});
	return html`<svg class="usage-chart" viewBox="0 0 ${DAILY_WIDTH} ${DAILY_HEIGHT}" preserveAspectRatio="none" role="img" aria-label="${label}"><path class="usage-bars" d="${paths.ok}"/><path class="usage-bars usage-bars-warning" d="${paths.warning}"/><path class="usage-bars usage-bars-critical" d="${paths.critical}"/><line x1="0" x2="${DAILY_WIDTH}" y1="${coord(y(100))}" y2="${coord(y(100))}" vector-effect="non-scaling-stroke"/></svg>`;
}
