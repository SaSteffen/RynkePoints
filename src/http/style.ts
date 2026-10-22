// The site's whole stylesheet, linked from every page by `layout()` (feature
// 011 research R4, issue #183), in Team Rynkeby's yellow, black and green
// (issue #51). The tokens of contracts/design-tokens.md come first; every
// other rule takes its colours from them through `var(--…)` (FR-031). No
// `url(` to another origin and no `@import` (FR-037).

import { BADGE_RIBBON_MASK } from "../badges/outline";
import { TOUR_TARGETS } from "./tour-targets";

/**
 * The Rynke coin's own colours (feature 012), the same in both schemes: the
 * coin looks like the coin. Listed in both so both define the same names.
 */
const COIN =
	"--rp-coin-rim:#c99a2e;--rp-coin-ink:#1c1b13;--rp-coin-face:#fffdf5;--rp-coin-yellow:#fbe122;--rp-ribbon-text:#f7e27c;--rp-badge-shine:rgba(255,253,245,.8);--rp-ribbon-glow:0 0 2px rgba(247,226,124,.25);--rp-coin-fur:#c8641e;--rp-coin-muzzle:#f0a868;--rp-coin-sky:#a9d6f2;--rp-coin-glass:#e8f3fb;--rp-coin-brick:#b5562f;--rp-coin-water:#3a8fd0;--rp-coin-team:#8cc4f0";

/**
 * The Team page's fixed accents (feature 016, the Claude Design draft): the
 * team total and the other gold-rimmed hero cards sit on a warm dark a step
 * softer than the coin's ink, so they don't read as a black hole, and the quote is a white speech bubble in
 * both schemes. Feature 019's green
 * "Bin dabei", its red "Doch nicht dabei" and the count of open reports keep
 * theirs too.
 */
const TEAM =
	"--rp-hero:#24221a;--rp-hero-label:#e6d9a8;--rp-hero-week:#bfe3c6;--rp-push-accent:#e8833a;--rp-ok-accent:#2e8b57;--rp-bubble:#ffffff;--rp-yes:#1d6b35;--rp-no:#b3261e;--rp-on-yes-no:#ffffff;--rp-on-hero:var(--rp-coin-face);--rp-hero-accent:var(--rp-coin-yellow);--rp-primary-text:var(--md-sys-color-primary);--rp-selected-edge:var(--md-sys-color-primary-container);";

/** The colour roles of the dark scheme, for the system setting and a choice. */
const DARK = `--rp-badge-edge:drop-shadow(2px 0 0 #fffdf5) drop-shadow(-2px 0 0 #fffdf5) drop-shadow(0 2px 0 #fffdf5) drop-shadow(0 -2px 0 #fffdf5) drop-shadow(0 2px 2px rgba(0,0,0,.6));--rp-badge-lift:drop-shadow(2px 0 0 #fffdf5) drop-shadow(-2px 0 0 #fffdf5) drop-shadow(0 2px 0 #fffdf5) drop-shadow(0 -2px 0 #fffdf5) drop-shadow(0 6px 6px rgba(0,0,0,.6));--rp-quote-art-shadow:drop-shadow(0 0 .6px rgba(0,0,0,.8)) drop-shadow(0 3px 5px rgba(0,0,0,.55));--md-sys-color-surface:#12110c;--md-sys-color-surface-container-low:#1a1913;--md-sys-color-surface-container:#201f18;--md-sys-color-surface-container-high:#2b2a21;--md-sys-color-on-surface:#eeebdd;--md-sys-color-on-surface-variant:#cec9b3;--md-sys-color-outline:#979279;--md-sys-color-outline-variant:#4a4633;--md-sys-color-primary:#fbe122;--md-sys-color-on-primary:#1c1b13;--md-sys-color-primary-container:#fbe122;--md-sys-color-on-primary-container:#1c1b13;--md-sys-color-secondary-container:#fbe122;--md-sys-color-on-secondary-container:#1c1b13;--md-sys-color-error:#ffb4ab;--md-sys-color-error-container:#93000a;--md-sys-color-on-error-container:#ffdad6;--rp-ok-container:#173a22;--rp-on-ok-container:#bfe3c6;--rp-neutral-container:#2e2c22;--rp-on-neutral-container:#cec9b3;--rp-brand:#fc5200;--rp-part-1:#fbe122;--rp-part-2:#8cc4f0;--rp-part-3:#ff9a4d;--rp-part-4:#6fd1c2;--rp-part-5:#d7a6ec;--rp-part-6:#a8a6a0;--rp-reached:#7fcb92;--rp-track:#3a382c;--rp-push-container:#3a2614;--rp-on-push-container:#f6d2b0;--rp-road:#0a0906;--rp-bar:#6b6650;--rp-line-training:#a88e00;--rp-line-team:#4a94d2;--rp-line-outside:#a77fd0;--rp-line-threshold:#d64651;--rp-line-pace:#24a684;${TEAM}${COIN}`;

/** Strava's images come in both variants; the scheme shows one (R13). */
const SHOW_DARK = (root: string) =>
	`${root} .pbs-light,${root} .cws-light{display:none}${root} .pbs-dark,${root} .cws-dark{display:inline}`;

const SYSTEM_DARK = ":root:not([data-scheme=light])";

/**
 * Each tour target clears the top bar when the step's link scrolls to it, and
 * is outlined while its step shows (feature 020 FR-003).
 */
const TOUR_TARGET_RULES = (() => {
	const ids = TOUR_TARGETS.map((id) => `#${id}`).join(",");
	const pointed = TOUR_TARGETS.map(
		(id) => `body:has(.tour[data-target=${id}]) #${id}`,
	).join(",");
	return `${ids}{scroll-margin-top:calc(var(--rp-topbar-height) + env(safe-area-inset-top) + var(--rp-space-4))}
${pointed}{outline:2px solid var(--md-sys-color-primary);outline-offset:4px;border-radius:var(--md-shape-xs)}
@media (prefers-reduced-motion:no-preference){${pointed}{animation:tour-point 1.6s ease-in-out infinite}}`;
})();
const FIXED_DARK = ":root[data-scheme=dark]";

/** The disclosure's chevron, a mask in the text's colour (022 contracts/controls.md). */
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`;

export const STYLE = `:root{color-scheme:light dark;--md-sys-color-surface:#fffdf5;--md-sys-color-surface-container-low:#fcf9ec;--md-sys-color-surface-container:#f6f2e0;--md-sys-color-surface-container-high:#efead3;--md-sys-color-on-surface:#1c1b13;--md-sys-color-on-surface-variant:#4a4633;--md-sys-color-outline:#7a755c;--md-sys-color-outline-variant:#d3cdb2;--md-sys-color-primary:#1c1b13;--md-sys-color-on-primary:#fbe122;--md-sys-color-primary-container:#fbe122;--md-sys-color-on-primary-container:#1c1b13;--md-sys-color-secondary-container:#fbe122;--md-sys-color-on-secondary-container:#1c1b13;--md-sys-color-error:#ba1a1a;--md-sys-color-error-container:#ffdad6;--md-sys-color-on-error-container:#410002;--rp-ok-container:#e7eee8;--rp-on-ok-container:#0f4f25;--rp-neutral-container:#efead3;--rp-on-neutral-container:#4a4633;--rp-brand:#fc5200;--rp-part-1:#fbe122;--rp-part-2:#8cc4f0;--rp-part-3:#ff9a4d;--rp-part-4:#6fd1c2;--rp-part-5:#d7a6ec;--rp-part-6:#a8a6a0;--rp-reached:#7fcb92;--rp-track:#1c1b13;--rp-push-container:#fdebd9;--rp-on-push-container:#6a3208;--rp-road:#1c1b13;--rp-bar:#7a755c;--rp-badge-edge:drop-shadow(2px 0 0 #fffdf5) drop-shadow(-2px 0 0 #fffdf5) drop-shadow(0 2px 0 #fffdf5) drop-shadow(0 -2px 0 #fffdf5) drop-shadow(0 2px 2px rgba(28,27,19,.3));--rp-badge-lift:drop-shadow(2px 0 0 #fffdf5) drop-shadow(-2px 0 0 #fffdf5) drop-shadow(0 2px 0 #fffdf5) drop-shadow(0 -2px 0 #fffdf5) drop-shadow(0 6px 6px rgba(28,27,19,.3));--rp-quote-art-shadow:drop-shadow(0 0 .6px rgba(28,27,19,.7)) drop-shadow(0 3px 4px rgba(28,27,19,.28));--rp-line-training:#8a6e00;--rp-line-team:#1f6fb2;--rp-line-outside:#7b4fa0;--rp-line-threshold:#a6344f;--rp-line-pace:#2b9667;${TEAM}${COIN}}
@media (prefers-color-scheme:dark){${SYSTEM_DARK}{color-scheme:dark;${DARK}}${SHOW_DARK(SYSTEM_DARK)}}
${FIXED_DARK}{color-scheme:dark;${DARK}}
:root[data-scheme=light]{color-scheme:light}
:root{--md-ref-typeface:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--md-type-display:600 36px/44px var(--md-ref-typeface);--md-type-headline:600 28px/34px var(--md-ref-typeface);--md-type-title-large:600 22px/28px var(--md-ref-typeface);--md-type-title:600 16px/24px var(--md-ref-typeface);--md-type-body-large:400 16px/24px var(--md-ref-typeface);--md-type-body:400 14px/20px var(--md-ref-typeface);--md-type-label:500 14px/20px var(--md-ref-typeface);--md-type-label-small:500 12px/16px var(--md-ref-typeface);--md-type-caption:400 13px/18px var(--md-ref-typeface);--rp-type-control:600 14px/20px var(--md-ref-typeface);--rp-type-status:600 12px/16px var(--md-ref-typeface);--rp-outline-width:1px;--rp-space-1:4px;--rp-space-2:8px;--rp-space-3:12px;--rp-space-4:16px;--rp-space-5:24px;--rp-space-6:32px;--rp-page-padding:16px;--rp-content-max:1040px;--rp-tap:44px;--rp-nav-height:80px;--rp-topbar-height:64px;--md-shape-xs:4px;--md-shape-sm:8px;--md-shape-md:12px;--md-shape-lg:16px;--md-shape-full:9999px;--rp-motion:150ms ease-out}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;font:var(--md-type-body-large);font-variant-numeric:tabular-nums;font-feature-settings:"tnum";color:var(--md-sys-color-on-surface);background:var(--md-sys-color-surface);-webkit-text-size-adjust:100%}
a{color:var(--md-sys-color-primary)}
:focus-visible{outline:2px solid var(--md-sys-color-primary);outline-offset:2px}
h1{font:var(--md-type-headline);margin:var(--rp-space-4) 0}
h2{font:var(--md-type-title);margin:0 0 var(--rp-space-2)}
p{margin:0 0 var(--rp-space-3)}
button{font:inherit;color:inherit;cursor:pointer}
input[type=checkbox]{width:20px;height:20px;margin:0 var(--rp-space-2) 0 0;vertical-align:middle;accent-color:var(--md-sys-color-primary)}
.pbs-dark,.cws-dark{display:none}
.pbs-light,.cws-light{display:inline}
${SHOW_DARK(FIXED_DARK)}
html{scroll-padding-top:calc(var(--rp-topbar-height) + env(safe-area-inset-top) + var(--rp-space-2))}
header.top-bar{position:sticky;top:0;z-index:9;display:flex;align-items:center;gap:var(--rp-space-2);min-height:calc(var(--rp-topbar-height) + env(safe-area-inset-top));padding:env(safe-area-inset-top) var(--rp-page-padding) 0;background:var(--md-sys-color-surface-container)}
@supports (animation-timeline:scroll()){header.top-bar{animation:top-bar-lift linear both;animation-timeline:scroll();animation-range:0 8px}}
header form{display:flex}
.wordmark{display:inline-flex;align-items:center;font:var(--md-type-title-large);margin-right:auto;color:var(--md-sys-color-on-surface)}
.wordmark-name>span{margin-left:2px;padding:0 var(--rp-space-1);border-radius:var(--md-shape-xs);background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.wordmark-name{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
h1.section-title{flex:1;margin:0;font:var(--md-type-title-large)}
main{max-width:40rem;margin:0 auto;padding:var(--rp-space-4) var(--rp-page-padding);overflow-wrap:break-word}
main:has(>.overview-grid){max-width:var(--rp-content-max)}
main:has(>.badges),main:has(>#rides>.ride-list){max-width:none}
main *{min-width:0}
footer{padding:var(--rp-space-5) var(--rp-page-padding);text-align:center}
footer img{height:24px}
.card{margin:0 0 var(--rp-space-3);padding:var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.card-outlined{border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low)}
.verdict{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.rynke-verdict{font:var(--md-type-title-large)}
.rynke-summary{display:flex;align-items:flex-start;gap:var(--rp-space-4)}
.rynke-summary>div{flex:1;min-width:0}
.rynke-summary p{margin:0 0 var(--rp-space-2)}
.status-art{flex:none;border-radius:var(--md-shape-full);background:var(--rp-coin-face)}
.status-art-banner{width:128px;height:128px}
ul.rynke-missing{display:flex;flex-wrap:wrap;gap:var(--rp-space-2);list-style:none;margin:0 0 var(--rp-space-3);padding:0}
.verdict .chip{background:var(--rp-coin-ink);color:var(--rp-coin-face)}
.rynke-breakdown h3{font:var(--md-type-label);margin:var(--rp-space-5) 0 var(--rp-space-2)}
.breakdown-table{width:100%;border-collapse:collapse}
.breakdown-table th,.breakdown-table td{padding:var(--rp-space-2) 0;border-bottom:1px solid var(--md-sys-color-outline-variant);text-align:right}
.breakdown-table thead th,.breakdown-table thead td{padding-top:0}
.breakdown-table th[scope=row]{text-align:left;font:var(--md-type-label)}
.breakdown-table tbody td{width:4.5em;font-weight:700}
.breakdown-detail{display:block;font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.rynke-events .event-not-counting{color:var(--md-sys-color-on-surface-variant)}
.greeting{font:var(--md-type-title-large)}
.notice{margin:0 0 var(--rp-space-3);padding:var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.notice-error{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
.notice-error a.button{background:var(--md-sys-color-error);color:var(--md-sys-color-error-container)}
.overview-grid{display:grid;gap:var(--rp-space-3)}
.overview-grid>*{margin:0}
.rynke-gauges .card{margin:0 0 var(--rp-space-3)}
.waiting{display:flex;flex-direction:column;align-items:center;gap:var(--rp-space-4);padding:var(--rp-space-6);text-align:center}
.coin-flip{position:relative;perspective:600px}
.waiting .coin-flip{width:192px;height:192px}
.coin-flip-turn{position:absolute;inset:0;transform-style:preserve-3d;animation:coin-flip 3.2s cubic-bezier(.45,0,.55,1) infinite}
.coin-flip .coin-art{position:absolute;inset:0;width:100%;height:100%;-webkit-backface-visibility:hidden;backface-visibility:hidden}
.coin-flip .coin-flip-back{transform:rotateY(180deg)}
.team-total{display:flex;align-items:center;gap:var(--rp-space-4);border:2px solid var(--rp-coin-rim);border-radius:24px;background:var(--rp-hero);color:var(--rp-coin-face)}
.team-total .coin-large{width:128px;height:128px}
.team-total-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.team-total p{margin:0}
.team-total-label{font:var(--md-type-body);color:var(--rp-hero-label)}
.team-total-value{font:600 16px/22px var(--md-ref-typeface);color:var(--rp-coin-yellow)}
.team-total-value .rynke-amount{font:700 28px/34px var(--md-ref-typeface)}
.team-total-kind{font:var(--md-type-body)}
.team-total-week{padding-top:6px;font:var(--md-type-caption);color:var(--rp-hero-week)}
nav.kind-switch,nav.organiser-switch{display:flex;margin:0 0 var(--rp-space-3)}
.kind-switch .segmented,.organiser-switch .segmented{flex:1}
.kind-switch .segmented,.organiser-switch .segmented{gap:6px}
nav.organiser-switch .segmented svg{width:20px;height:20px}
.my-place{display:flex;align-items:center;gap:var(--rp-space-3);padding:var(--rp-space-3) var(--rp-space-4);background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.place-badge{flex:none;display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:var(--md-shape-full);background:var(--rp-coin-ink);color:var(--rp-coin-yellow);font:700 20px/1 var(--md-ref-typeface)}
.my-place p{margin:0}
.my-place .place{font:600 16px/22px var(--md-ref-typeface)}
.my-place .place-next{padding-top:2px;font:var(--md-type-body)}
.quote-monkey{display:flex;align-items:flex-end;gap:10px;margin:0 0 -22px;padding-right:var(--rp-space-1)}
.quote-monkey-art{position:relative;z-index:1;flex:none;width:120px;height:120px;filter:var(--rp-quote-art-shadow)}
.quote{--rp-quote-edge:var(--rp-coin-ink);--rp-quote-fill:var(--rp-bubble);position:relative;flex:1;min-width:0;margin:0 0 30px;padding:12px 16px;border:2px solid var(--rp-quote-edge);border-radius:24px 24px 24px 8px;background:var(--rp-quote-fill);color:var(--rp-coin-ink)}
.quote::before,.quote::after{content:"";position:absolute;left:-24px;bottom:6px;width:26px;height:32px;-webkit-mask:var(--rp-quote-tail) center/100% 100% no-repeat;mask:var(--rp-quote-tail) center/100% 100% no-repeat}
.quote::before{--rp-quote-tail:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 32'%3E%3Cpath d='M36,32 C25,26 14,22 2,8 C16,12 26,9 36,8 Z' stroke='%23000' stroke-width='4' stroke-linejoin='round'/%3E%3C/svg%3E");background:var(--rp-quote-edge)}
.quote::after{--rp-quote-tail:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 26 32'%3E%3Cpath d='M36,32 C25,26 14,22 2,8 C16,12 26,9 36,8 Z'/%3E%3C/svg%3E");background:var(--rp-quote-fill)}
.quote p{margin:0}
.quote p:last-child{font:600 16px/22px var(--md-ref-typeface)}
.peloton,.team-chart{margin-inline:0}
.peloton figcaption,.team-chart figcaption{display:flex;align-items:baseline;justify-content:space-between;gap:var(--rp-space-2);font:var(--md-type-title)}
.team-chart-kind{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.team-hint{margin:var(--rp-space-1) 0 var(--rp-space-3);font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.chart-axis{display:flex;justify-content:space-between;gap:var(--rp-space-2);margin:6px 0 0;font:400 12px/16px var(--md-ref-typeface);color:var(--md-sys-color-on-surface-variant)}
.peloton-road{display:block;width:100%;height:auto}
.peloton-road .road{fill:var(--rp-road)}
.peloton-road .road-middle{fill:none;stroke:var(--rp-coin-yellow);stroke-width:2;stroke-dasharray:6 4;opacity:.6}
.peloton-road .road-gap{fill:var(--md-sys-color-surface-container)}
.peloton-road .road-gap-edge{fill:none;stroke:var(--rp-coin-yellow);stroke-width:1.5}
.peloton-you rect{fill:var(--rp-coin-yellow)}
.peloton-you text{fill:var(--rp-coin-ink);font:700 11px var(--md-ref-typeface)}
.week-bars{display:block;width:100%;height:120px;border-bottom:1px solid var(--md-sys-color-outline)}
.week-bars rect{fill:var(--rp-bar)}
.week-bars rect.current{fill:var(--rp-coin-yellow);stroke:var(--md-sys-color-on-surface);stroke-width:1.5}
.week-bars path{fill:none;stroke:var(--md-sys-color-on-surface);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.chart-best{margin:var(--rp-space-3) 0;padding:var(--rp-space-2) var(--rp-space-3);border-radius:var(--md-shape-md);background:var(--rp-ok-container);color:var(--rp-on-ok-container);font:var(--md-type-caption)}
.leaderboard{padding:var(--rp-space-4) var(--rp-space-2) var(--rp-space-2);border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low)}
.leaderboard-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--rp-space-2);padding:0 var(--rp-space-2);font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.leaderboard h2{margin:0;font:var(--md-type-title);color:var(--md-sys-color-on-surface)}
.leaderboard .team-hint{margin:var(--rp-space-1) var(--rp-space-2) var(--rp-space-2)}
nav.list-scope{display:flex;gap:var(--rp-space-2);margin:0 var(--rp-space-2) 10px}
.leaderboard ol{display:grid;gap:var(--rp-space-1);margin:0;padding:0;list-style:none}
li.row{display:flex;align-items:center;gap:10px;min-height:52px;padding:var(--rp-space-1) var(--rp-space-3) var(--rp-space-1) var(--rp-space-2);border-radius:var(--md-shape-md)}
li.row.you{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
.row-place{flex:none;width:36px;text-align:center;font:700 22px/28px var(--md-ref-typeface)}
.row-line{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.row-you{font:700 13px/18px var(--md-ref-typeface)}
.row-figures{flex:none;display:flex;flex-direction:column;align-items:flex-end}
.row-total{display:inline-flex;align-items:center;gap:6px;font:700 18px/24px var(--md-ref-typeface)}
.row-total .coin-mini{width:18px;height:18px}
.row-other{display:inline-flex;align-items:center;gap:4px;font:400 12px/16px var(--md-ref-typeface);opacity:.8}
.row-other .coin-mini{width:12px;height:12px}
.sparkline{display:block;width:96px;height:22px}
.sparkline polyline,.sparkline path{fill:none;stroke:var(--md-sys-color-on-surface-variant);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
li.row.you .sparkline polyline,li.row.you .sparkline path{stroke:currentColor}
.list-hidden{margin:var(--rp-space-1) 0;text-align:center;font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.chart-table table{width:100%;border-collapse:collapse;font:var(--md-type-caption);font-variant-numeric:tabular-nums}
.chart-table th,.chart-table td{padding:var(--rp-space-1) var(--rp-space-2);border-bottom:1px solid var(--md-sys-color-outline-variant);text-align:right}
.chart-table th:first-child,.chart-table td:first-child{text-align:left}
.organiser-form{display:grid;gap:var(--rp-space-3);margin:0 0 var(--rp-space-5)}
.organiser-form label{display:grid;gap:var(--rp-space-1);font:var(--md-type-label)}
.organiser-form input,.organiser-form select{box-sizing:border-box;width:100%;min-height:var(--rp-tap);padding:0 var(--rp-space-3);border:1px solid var(--md-sys-color-outline);border-radius:var(--md-shape-xs);background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface);font:var(--md-type-body-large)}
.organiser-form button{justify-self:start}
ul.organiser-events{margin:0;padding:0;list-style:none}
.organiser-event{margin:0 0 var(--rp-space-3);padding:var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.organiser-event>a{display:grid;min-height:var(--rp-tap);color:inherit;text-decoration:none}
.organiser-event-title{font:var(--md-type-title);color:var(--md-sys-color-primary)}
.organiser-event-name{overflow-wrap:anywhere}
.change-record{margin:var(--rp-space-1) 0 0;font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
ul.attendance-list{margin:0 0 var(--rp-space-4);padding:0;list-style:none}
.attendance-rider{display:flex;flex-wrap:wrap;align-items:center;gap:var(--rp-space-2);min-height:var(--rp-tap)}
.attendance-rider label{display:flex;flex:1;align-items:center;min-height:var(--rp-tap);cursor:pointer}
.organiser-confirm{margin:var(--rp-space-5) 0 0}
.organiser-confirm>summary{color:var(--md-sys-color-error)}
.chip,.status-chip{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border-radius:var(--md-shape-sm);font:var(--rp-type-status);background:var(--rp-neutral-container);color:var(--rp-on-neutral-container)}
.ride-counting .chip{background:var(--rp-ok-container);color:var(--rp-on-ok-container)}
.ride-not-counting .chip{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
ol.ride-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:var(--rp-space-3)}
.ride-card{min-width:0;padding:var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.ride-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--rp-space-2)}
.ride-head>*{min-width:0}
.ride-date{font:var(--md-type-title)}
dl.ride-figures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--rp-space-2);margin:var(--rp-space-2) 0}
dl.ride-figures>div{min-width:0}
dl.ride-figures dt{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
dl.ride-figures dd{margin:0;font:var(--md-type-title);white-space:nowrap}
.ride-card p{margin:var(--rp-space-1) 0}
.ride-meta{font:var(--md-type-body);color:var(--md-sys-color-on-surface-variant)}
.ride-why{font:var(--md-type-body)}
summary,.more>summary,.ride-why>summary{display:flex;align-items:center;gap:var(--rp-space-2);min-height:var(--rp-tap);cursor:pointer;list-style:none;color:var(--rp-primary-text);font:var(--rp-type-control)}
summary::-webkit-details-marker{display:none}
summary::after{content:"";flex:none;width:14px;height:14px;background:currentColor;-webkit-mask:${CHEVRON} center/contain no-repeat;mask:${CHEVRON} center/contain no-repeat;transition:transform var(--rp-motion)}
details[open]>summary::after{transform:rotate(180deg)}
.ride-why ul,.ride-why p{margin:var(--rp-space-1) 0}
a.strava-activity{font-weight:700;text-decoration:underline}
.ride-name{overflow-wrap:anywhere;color:var(--md-sys-color-on-surface)}
.ride-reasons{padding-left:20px}
.tap{display:inline-flex;align-items:center;min-height:var(--rp-tap);min-width:var(--rp-tap)}
.button,.button-outlined,.button-text,.danger,button:not([class],[role=switch]){display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:var(--rp-tap);min-width:var(--rp-tap);padding:0 20px;text-align:center;border:var(--rp-outline-width) solid transparent;border-radius:var(--md-shape-full);font:var(--rp-type-control);text-decoration:none;cursor:pointer}
.button{border:0;background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary)}
.button-outlined,button:not([class],[role=switch]){border-color:var(--md-sys-color-outline);background:none;color:var(--rp-primary-text)}
.button-text{padding:0 var(--rp-space-3);border:0;background:none;color:var(--rp-primary-text)}
.button>svg,.button-outlined>svg{flex:none;width:18px;height:18px}
.danger{border-color:var(--md-sys-color-error);background:none;color:var(--md-sys-color-error)}
button:has(>img.cws){display:inline-block;min-height:0;padding:0;border:0;border-radius:0;background:none}
.cws{height:48px}
.button,.button-outlined,.button-text,.danger,.segmented,.segmented-group label,.icon-button{position:relative;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:transform var(--rp-motion)}
.button::before,.button-outlined::before,.button-text::before,.danger::before,.segmented::before,.segmented-group label::before,.icon-button::before{content:"";position:absolute;inset:0;border-radius:inherit;background:currentColor;opacity:0;pointer-events:none;transition:opacity var(--rp-motion)}
@media (hover:hover){.button:hover::before,.button-outlined:hover::before,.button-text:hover::before,.danger:hover::before,.segmented:hover::before,.segmented-group label:hover::before,.icon-button:hover::before{opacity:.08}.button:hover{box-shadow:0 1px 3px var(--md-sys-color-outline)}.button:hover::before{opacity:.18}}
:root:not(.ripples) .button:active::before,:root:not(.ripples) .button-outlined:active::before,:root:not(.ripples) .button-text:active::before,:root:not(.ripples) .danger:active::before,:root:not(.ripples) .segmented:active::before,:root:not(.ripples) .segmented-group label:active::before,:root:not(.ripples) .icon-button:active::before{opacity:.12}
:root:not(.ripples) .button:active::before{opacity:.24}
@media (prefers-reduced-motion:no-preference){.button:active,.button-outlined:active,.button-text:active,.danger:active,.icon-button:active{transform:scale(.96)}}
.ripple{position:absolute;border-radius:50%;background:currentColor;opacity:.16;pointer-events:none;transform:scale(0)}
.button .ripple{opacity:.28}
.button[aria-busy=true],.button-outlined[aria-busy=true],.danger[aria-busy=true],.segmented[aria-busy=true]{pointer-events:none}
.button[aria-busy=true]::after,.button-outlined[aria-busy=true]::after,.danger[aria-busy=true]::after,.segmented[aria-busy=true]::after{content:"";flex:none;width:16px;height:16px;margin-left:var(--rp-space-2);border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:busy-spin .8s linear infinite}
.segmented,.segmented-group label{display:inline-flex;align-items:center;justify-content:center;min-height:var(--rp-tap);min-width:var(--rp-tap);padding:0 var(--rp-space-4);border:var(--rp-outline-width) solid var(--md-sys-color-outline);background:none;color:var(--md-sys-color-on-surface);font:var(--rp-type-control);text-decoration:none;cursor:pointer}
.segmented+.segmented,.segmented-group label+label{margin-left:calc(-1 * var(--rp-outline-width))}
.segmented:first-of-type,.segmented-group label:first-of-type{border-radius:var(--md-shape-full) 0 0 var(--md-shape-full)}
.segmented:last-of-type,.segmented-group label:last-of-type{border-radius:0 var(--md-shape-full) var(--md-shape-full) 0}
.segmented[aria-current],.segmented[aria-pressed=true],.segmented-group label:has(:checked){background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.segmented-group{display:flex;margin:0 0 var(--rp-space-2);padding:0;border:0}
.segmented-group input{position:absolute;opacity:0;pointer-events:none}
.segmented-group label:has(:focus-visible){outline:2px solid var(--md-sys-color-primary);outline-offset:2px}
.chip[aria-pressed],.segmented-group.badges-filter label,.list-scope .segmented{min-height:var(--rp-tap);margin:0;padding:0 var(--rp-space-3);border:solid transparent;border-width:4px 0;border-radius:var(--md-shape-sm)/12px;background:none;box-shadow:inset 0 0 0 var(--rp-outline-width) var(--md-sys-color-outline);color:var(--md-sys-color-on-surface);font:var(--rp-type-control);cursor:pointer}
.chip[aria-pressed=true],.segmented-group.badges-filter label:has(:checked),.list-scope .segmented[aria-current]{background:var(--md-sys-color-primary-container) padding-box;box-shadow:inset 0 0 0 var(--rp-outline-width) var(--rp-selected-edge);color:var(--md-sys-color-on-primary-container)}
.segmented-group.badges-filter label::before,.list-scope .segmented::before{border-radius:var(--md-shape-sm)}
[role=switch]{position:relative;min-height:var(--rp-tap);min-width:var(--rp-tap);width:60px;padding:0;border:0;background:none}
[role=switch]::before{content:"";position:absolute;left:4px;top:6px;width:52px;height:32px;border:calc(2 * var(--rp-outline-width)) solid var(--md-sys-color-outline);border-radius:var(--md-shape-full);background:var(--md-sys-color-surface-container-high)}
[role=switch]::after{content:"";position:absolute;left:12px;top:14px;width:16px;height:16px;border-radius:var(--md-shape-full);background:var(--md-sys-color-outline);transition:left var(--rp-motion)}
[role=switch][aria-checked=true]::before{border-color:var(--md-sys-color-primary);background:var(--md-sys-color-primary)}
[role=switch][aria-checked=true]::after{left:32px;top:10px;width:24px;height:24px;background:var(--md-sys-color-on-primary)}
.settings-group{margin:0 0 var(--rp-space-3);padding:var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container);break-inside:avoid}
.settings-group .notice{margin:0;padding:0}
.settings-group form{margin:0 0 var(--rp-space-3)}
.settings-group>:last-child,.settings-group .notice p{margin-bottom:0}
#notifications{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;column-gap:var(--rp-space-3)}
#notifications>*{grid-column:1/-1}
#notifications>[data-state]{grid-column:1;margin:0}
#notifications>[role=switch]{grid-column:2}
[hidden]{display:none!important}
.page-loading{position:fixed;top:env(safe-area-inset-top);left:0;right:0;height:4px;overflow:hidden;background:var(--md-sys-color-outline-variant);pointer-events:none;z-index:12}
.page-loading::before{content:"";position:absolute;top:0;bottom:0;left:0;width:40%;background:var(--md-sys-color-primary);animation:page-loading 1.2s cubic-bezier(.4,0,.2,1) infinite}
@media (prefers-reduced-motion:reduce){.page-loading::before{width:100%;animation:none}}
.sprite{position:absolute;width:0;height:0;overflow:hidden}
.coin{display:inline-block;flex:none;vertical-align:middle}
.coin-mark{width:32px;height:32px;margin-right:var(--rp-space-2)}
.coin-head{width:32px;height:32px}
.coin-hero{width:160px;height:160px}
.coin-large{width:144px;height:144px}
.coin-mini{width:20px;height:20px}
.coin-team{--rp-coin-mini-face:var(--rp-coin-team)}
.c-rim{fill:var(--rp-coin-rim)}
.c-ink{fill:var(--rp-coin-ink)}
.c-face{fill:var(--rp-coin-face)}
.c-chain{fill:none;stroke:var(--rp-coin-rim)}
.c-star{fill:var(--rp-coin-yellow)}
.c-yellow{fill:var(--rp-coin-yellow);stroke:var(--rp-coin-ink)}
.c-fur{fill:var(--rp-coin-fur);stroke:var(--rp-coin-ink)}
.c-muzzle{fill:var(--rp-coin-muzzle)}
.c-line{fill:none;stroke:var(--rp-coin-ink)}
.c-sky{fill:var(--rp-coin-sky)}
.c-glass{fill:var(--rp-coin-glass);stroke:var(--rp-coin-ink)}
.c-brick{fill:var(--rp-coin-brick);stroke:var(--rp-coin-ink)}
.c-water{fill:var(--rp-coin-water)}
.c-mini{fill:var(--rp-coin-mini-face,var(--rp-coin-yellow));stroke:var(--rp-coin-ink)}
.hero{display:flex;align-items:center;gap:var(--rp-space-4);padding:var(--rp-space-4);border:2px solid var(--rp-coin-rim);border-radius:24px;background:var(--rp-hero);color:var(--rp-coin-face)}
.hero .coin-hero{width:128px;height:128px}
.hero p{margin:0}
.hero .greeting{font:var(--md-type-body)}
.hero-total{font:var(--md-type-label);color:var(--rp-coin-yellow)}
.rynke-amount{display:block;font:700 24px/28px var(--md-ref-typeface)}
.hero-team{color:var(--rp-coin-team)}
.celebrate{display:flex;align-items:center;gap:var(--rp-space-3);padding:var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--rp-ok-container);color:var(--rp-on-ok-container)}
.celebrate p{margin:0;font-weight:600}
.celebrate-coins{display:flex}
.celebrate-coins .coin-mini{width:28px;height:28px;animation:coin-drop 700ms cubic-bezier(.3,1.4,.5,1) both}
.celebrate-coins .coin-mini+.coin-mini{margin-left:-12px;animation-delay:150ms}
.coin-row{display:flex;gap:var(--rp-space-1);margin:0 0 var(--rp-space-2)}
.coin-row .coin-mini{width:24px;height:24px}
.coin-slot{width:24px;height:24px;border:2px dashed var(--md-sys-color-outline);border-radius:var(--md-shape-full)}
.chip .coin-mini{margin-right:6px}
dl.ride-figures dd .coin-mini{width:18px;height:18px;vertical-align:-3px}
#rides .coin-large{display:block;width:96px;height:96px;margin:var(--rp-space-4) auto}
.landing-hero{display:flex;flex-direction:column;align-items:center;gap:var(--rp-space-2);margin:var(--rp-space-4) 0;text-align:center}
.landing-hero h1{margin:0}
.tagline{margin:0;font:var(--md-type-title-large)}
.rides-total,.rides-newest{margin:0 0 var(--rp-space-2)}
.rides-more{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:var(--rp-space-2);min-height:var(--rp-tap);margin-top:var(--rp-space-3)}
.rides-status{margin:0;color:var(--md-sys-color-on-surface-variant)}
.rides-more[data-state=loading] .rides-status::before{content:"";display:inline-block;width:16px;height:16px;margin-right:var(--rp-space-2);vertical-align:-3px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:busy-spin .8s linear infinite}
@media (prefers-reduced-motion:reduce){.rides-more[data-state=loading] .rides-status::before{animation:none}}
.rides-more[data-state=added] .rides-status{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
figure.gauge{display:block;width:100%;margin:0}
figure.gauge figcaption{display:flex;align-items:center;gap:var(--rp-space-2);margin:0 0 var(--rp-space-2);font:var(--md-type-body)}
.gauge-step{white-space:nowrap}
.gauge-step .coin-mini{width:18px;height:18px;margin-left:4px;vertical-align:-4px}
.gauge-bar{display:flex;height:12px;background:var(--rp-track);border-radius:var(--md-shape-sm);overflow:hidden}
.gauge-part,.gauge-fill{display:block;height:100%}
.gauge-part+.gauge-part{border-left:2px solid var(--md-sys-color-surface-container)}
.gauge-fill,.gauge-part-1{background:var(--rp-part-1)}
.gauge-part-2{background:var(--rp-part-2)}
.gauge-part-3{background:var(--rp-part-3)}
.gauge-part-4{background:var(--rp-part-4)}
.gauge-part-5{background:var(--rp-part-5)}
.gauge-part-6{background:var(--rp-part-6)}
.gauge-reached .gauge-fill{background:var(--rp-reached)}
.gauge-card-training{border-left:6px solid var(--rp-coin-yellow)}
.gauge-card-team{border-left:6px solid var(--rp-coin-team)}
.progress-rules,.progress-help{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.progress-periods{display:flex;flex-wrap:wrap;align-items:center;gap:var(--rp-space-2);margin:0 0 var(--rp-space-3)}
.progress-chart{margin:0 0 var(--rp-space-3);padding:var(--rp-space-3);border-radius:var(--md-shape-md);background:var(--md-sys-color-surface)}
.progress-training{border-left:6px solid var(--rp-coin-yellow)}
.progress-team{border-left:6px solid var(--rp-coin-team)}
.progress-chart figcaption{display:flex;align-items:center;gap:var(--rp-space-2);margin:0 0 var(--rp-space-2);font:var(--md-type-label)}
.progress-plot{position:relative;height:11rem}
.progress-plot canvas{display:block;width:100%;height:100%;touch-action:pan-y;border-radius:var(--md-shape-xs)}
.progress-legend{display:flex;flex-wrap:wrap;gap:var(--rp-space-1) var(--rp-space-4);margin:var(--rp-space-2) 0 0;padding:0;list-style:none;font:var(--md-type-label-small);color:var(--md-sys-color-on-surface-variant)}
.progress-legend li{display:inline-flex;align-items:center;gap:var(--rp-space-2)}
.progress-key{flex:none;width:24px;height:0;border-top:2px solid var(--md-sys-color-on-surface-variant)}
.progress-training .key-curve{border-top:3px solid var(--rp-line-training)}
.progress-team .key-curve{border-top:3px solid var(--rp-line-team)}
.key-threshold{border-top-color:var(--rp-line-threshold)}
.key-pace{border-top-color:var(--rp-line-pace)}
.key-outside{border-top:3px solid var(--rp-line-outside)}
.key-needed{border-top-color:var(--rp-line-outside)}
.progress-readout{min-height:40px;margin:0 0 var(--rp-space-2);font:var(--md-type-body)}
.progress-readout-line{display:block}
.progress-table-scroll{overflow-x:auto}
.progress-table table{width:100%;border-collapse:collapse;font:var(--md-type-body)}
.progress-table th,.progress-table td{padding:var(--rp-space-1) var(--rp-space-2);border-bottom:1px solid var(--md-sys-color-outline-variant);text-align:right;white-space:nowrap}
.progress-table th[scope=row]{text-align:left;font-weight:400}
.progress-table thead th{font:var(--md-type-label-small);color:var(--md-sys-color-on-surface-variant)}
.gauge-legend{display:flex;flex-wrap:wrap;gap:0 var(--rp-space-4);list-style:none;margin:var(--rp-space-2) 0 0;padding:0;font:var(--md-type-caption)}
.gauge-key{display:inline-block;width:12px;height:12px;margin-right:var(--rp-space-1);border:1px solid var(--rp-track);border-radius:var(--md-shape-xs);vertical-align:middle}
.icon-button{display:inline-flex;align-items:center;justify-content:center;min-width:var(--rp-tap);min-height:var(--rp-tap);padding:0;border:0;background:none;border-radius:var(--md-shape-full);color:var(--md-sys-color-on-surface-variant)}
.icon-button[aria-expanded=true]{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
nav.app-nav{position:fixed;left:0;right:0;bottom:0;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);height:calc(var(--rp-nav-height) + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:var(--md-sys-color-surface-container);z-index:10}
nav.app-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--rp-space-1);min-height:var(--rp-tap);color:var(--md-sys-color-on-surface-variant);text-decoration:none;font:var(--md-type-label-small)}
nav.app-nav .nav-icon{display:flex;align-items:center;justify-content:center;width:64px;max-width:100%;height:32px;border-radius:var(--md-shape-full);transition:background-color var(--rp-motion)}
nav.app-nav .nav-label{max-width:100%;padding:0 2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
nav.app-nav .nav-label-full{display:none}
nav.app-nav a[aria-current=page]{color:var(--md-sys-color-on-surface);font-weight:600}
nav.app-nav a[aria-current=page] .nav-icon{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
body.shell{padding-bottom:calc(var(--rp-nav-height) + env(safe-area-inset-bottom))}
.app-prompt{position:fixed;left:var(--rp-page-padding);right:var(--rp-page-padding);bottom:calc(var(--rp-nav-height) + env(safe-area-inset-bottom) + var(--rp-space-3));max-width:calc(40rem - 2 * var(--rp-page-padding));margin:0 auto;padding:var(--rp-space-3) calc(var(--rp-tap) + var(--rp-space-2)) var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface);border:1px solid var(--md-sys-color-outline-variant);box-shadow:0 2px 6px var(--md-sys-color-outline);z-index:11}
.app-prompt p{margin:0 0 var(--rp-space-2)}
.app-prompt [data-action=close]{position:absolute;top:var(--rp-space-1);right:var(--rp-space-1)}
.app-prompt [data-install=prompt],.app-prompt-actions{display:flex;flex-wrap:wrap-reverse;justify-content:flex-end;gap:var(--rp-space-2);margin:var(--rp-space-3) calc(-1 * (var(--rp-tap) + var(--rp-space-2) - var(--rp-space-4))) 0 0}
.tour{position:fixed;left:var(--rp-page-padding);right:var(--rp-page-padding);bottom:calc(var(--rp-nav-height) + env(safe-area-inset-bottom) + var(--rp-space-3));max-width:calc(40rem - 2 * var(--rp-page-padding));margin:0 auto;padding:var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface);border:2px solid var(--md-sys-color-primary);box-shadow:0 2px 6px var(--md-sys-color-outline);z-index:11}
.tour p{margin:0 0 var(--rp-space-2)}
.tour .tour-progress{font:var(--md-type-label-small);color:var(--md-sys-color-on-surface-variant)}
.tour form{display:flex;flex-wrap:wrap;gap:var(--rp-space-2)}
body:has(.tour) .app-prompt{display:none}
nav.app-nav a.tour-target .nav-icon,body:has(.tour) nav.organiser-switch [aria-current]{outline:2px solid var(--md-sys-color-primary);outline-offset:2px}
@media (prefers-reduced-motion:no-preference){nav.app-nav a.tour-target .nav-icon,nav.app-nav a.tour-target,body:has(.tour) nav.organiser-switch [aria-current]{animation:tour-point 1.6s ease-in-out infinite}}
${TOUR_TARGET_RULES}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
main:has(>.team-overview){max-width:var(--rp-content-max)}
.team-overview h3{margin:0;font:600 17px/24px var(--md-ref-typeface)}
.overview-deadline{display:flex;align-items:center;gap:var(--rp-space-4);margin:0 0 var(--rp-space-3);padding:var(--rp-space-4);border:2px solid var(--rp-coin-rim);border-radius:24px;background:var(--rp-hero);color:var(--rp-coin-face)}
.overview-deadline .coin-large{width:128px;height:128px}
.overview-deadline p{margin:0;font:var(--md-type-body)}
.overview-deadline .overview-deadline-date{color:var(--rp-hero-label)}
.overview-deadline .overview-deadline-count{font:700 32px/38px var(--md-ref-typeface);color:var(--rp-coin-yellow)}
nav.group-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--rp-space-2);margin:0 0 var(--rp-space-2)}
.group-tile{position:relative;isolation:isolate;overflow:hidden;display:grid;grid-template-columns:minmax(0,1fr);align-content:center;align-items:center;gap:2px var(--rp-space-2);min-height:76px;padding:10px var(--rp-space-3);border:2px solid transparent;border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);text-decoration:none}
.tile-count{font:700 26px/32px var(--md-ref-typeface)}
.tile-label{font:600 12px/16px var(--md-ref-typeface);-webkit-hyphens:auto;hyphens:auto}
.tile-count,.tile-label{grid-column:1}
.status-art-tile,.tile-requests::after{position:absolute;z-index:-1;right:-14px;bottom:-22px;width:96px;height:96px;border-radius:0;background:none;opacity:.6;pointer-events:none}
.tile-requests::after{content:"⏳";content:"⏳"/"";bottom:-34px;font-size:72px;line-height:96px;text-align:center}
.group-tile:has(.status-art-tile),.tile-requests{padding-right:64px}
.group-tile[aria-current]{border-color:var(--md-sys-color-primary);background:var(--rp-coin-yellow);color:var(--rp-coin-ink)}
ul.rider-cards{display:grid;gap:var(--rp-space-2);margin:0 0 var(--rp-space-3);padding:0;list-style:none}
.rider-card{display:flex;flex-direction:column;gap:10px;padding:14px var(--rp-space-4) 6px;border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.rider-head{display:flex;flex-wrap:wrap;align-items:center;gap:var(--rp-space-2)}
.rider-head h3{flex:1}
.rider-head h3 a{color:inherit}
.rider-profile{display:inline-flex;align-items:center;min-height:var(--rp-tap);font:700 13px/18px var(--md-ref-typeface)}
.status-chip{flex:none;gap:4px;padding-left:2px;white-space:nowrap;background:var(--rp-push-container);color:var(--rp-on-push-container)}
.status-on_track .status-chip{background:var(--rp-ok-container);color:var(--rp-on-ok-container)}
.status-in .status-chip{background:var(--rp-coin-ink);color:var(--rp-coin-yellow)}
.status-art-chip{width:20px;height:20px}
.rider-bars{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--rp-space-3)}
.amount p{display:flex;align-items:center;gap:6px;margin:0 0 var(--rp-space-1);font:var(--md-type-caption)}
.amount .coin-mini{width:16px;height:16px}
.threshold-bar{display:block;width:100%;height:12px;overflow:visible}
.threshold-track{fill:var(--rp-track);opacity:.2}
.threshold-fill{fill:var(--rp-coin-yellow)}
.amount-team .threshold-fill,.rider-table .bar-team .threshold-fill{fill:var(--rp-coin-team)}
.pace-mark{stroke:var(--md-sys-color-on-surface);stroke-width:2}
ul.rider-missing{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.rider-missing li{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border:var(--rp-outline-width) solid var(--md-sys-color-outline);border-radius:var(--md-shape-sm);font:var(--rp-type-status)}
.rider-missing li.behind{border-color:var(--rp-push-accent);background:var(--rp-push-container);color:var(--rp-on-push-container)}
.rider-breakdown{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.rider-breakdown ul{margin:0 0 var(--rp-space-2);padding:0;list-style:none}
.rider-breakdown li{padding:6px 0;border-bottom:1px solid var(--md-sys-color-outline-variant)}
.table-scroll{overflow-x:auto;margin:0 0 var(--rp-space-3);border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--md-shape-lg)}
.rider-table{width:100%;border-collapse:collapse;font:var(--md-type-body);overflow-wrap:normal}
.rider-table thead tr{background:var(--md-sys-color-surface-container)}
.rider-table th,.rider-table td{padding:10px var(--rp-space-3);border-top:1px solid var(--md-sys-color-outline-variant);text-align:left;vertical-align:middle}
.rider-table thead th{font:var(--md-type-label);white-space:nowrap;vertical-align:bottom}
.rider-table th:first-child{padding-left:var(--rp-space-4);white-space:nowrap}
.rider-table th:last-child,.rider-table td:last-child{padding-right:var(--rp-space-4)}
.rider-table .number{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
.rider-table .bar-cell{min-width:160px;width:22%}
.bar-block+.bar-block{margin-top:6px}
.bar-figures{display:flex;align-items:baseline;justify-content:space-between;gap:var(--rp-space-2);white-space:nowrap;font-variant-numeric:tabular-nums}
.bar-figures .figure{font-weight:700}
.bar-figures .to-go{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.bar-figures .to-go.behind{color:var(--rp-on-push-container);font-weight:600}
.coin-pair{display:inline-flex;gap:var(--rp-space-3)}
.coin-pair>span{display:inline-flex;align-items:center;gap:4px}
.coin-pair .coin-mini{width:16px;height:16px}
@media (max-width:1279.98px){.rider-table th,.rider-table td{padding-left:6px;padding-right:6px}.rider-table .bar-cell{min-width:100px}}
.qualified{margin:0 0 var(--rp-space-3);padding:var(--rp-space-4);border:2px solid var(--rp-coin-rim);border-radius:24px;background:var(--rp-hero);color:var(--rp-coin-face)}
.qualified h2{margin:0 0 var(--rp-space-1);font:700 18px/24px var(--md-ref-typeface);color:var(--rp-coin-yellow)}
.qualified p{margin:0;font:var(--md-type-caption);color:var(--rp-hero-label)}
.qualified ul{display:flex;flex-wrap:wrap;gap:var(--rp-space-2);margin:var(--rp-space-3) 0 0;padding:0;list-style:none}
.qualified li{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 var(--rp-space-3) 0 var(--rp-space-1);border-radius:18px;background:var(--rp-road);font:600 14px/20px var(--md-ref-typeface)}
.qualified .coin-mini{width:28px;height:28px}
.badges h2{margin:var(--rp-space-4) 0 var(--rp-space-1);font:var(--md-type-headline)}
.badges-reveal{display:flex;align-items:center;gap:var(--rp-space-3);margin:0 0 var(--rp-space-4);padding:var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--rp-ok-container);color:var(--rp-on-ok-container)}
.badges-reveal p{margin:0;font-weight:600}
.badges-reveal-pictures{display:flex;flex:none}
.badges-reveal-pictures img{width:48px;height:48px;animation:badge-slap 700ms ease-out both}
.badges-reveal-pictures img+img{margin-left:-20px;animation-delay:120ms}
.badges-switch{position:sticky;top:calc(var(--rp-topbar-height) + env(safe-area-inset-top));z-index:8;display:flex;flex-wrap:wrap;align-items:center;gap:var(--rp-space-2) var(--rp-space-3);margin:0 calc(-1 * var(--rp-page-padding)) var(--rp-space-3);padding:var(--rp-space-2) var(--rp-page-padding);background:var(--md-sys-color-surface)}
.badges-switch nav.kind-switch{flex:1 1 160px;max-width:420px;margin:0}
.segmented-group.badges-filter{gap:var(--rp-space-2);margin:0}
.badge-group{scroll-margin-top:72px}
.badge-group h3{margin:var(--rp-space-5) 0 var(--rp-space-3);font:var(--md-type-title)}
.badge-group:first-of-type h3{margin-top:var(--rp-space-2)}
.badges:has(.badges-filter [value=all]:checked) .badge-cards,.badges:has(.badges-filter [value=all]:checked) .badges-title-newest,.badges:not(:has(.badges-filter [value=all]:checked)) .badge-gallery,.badges:not(:has(.badges-filter [value=all]:checked)) .badges-title-all{display:none}
.badges-empty{margin:0 0 var(--rp-space-3)}
.badge-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(176px,calc(50% - var(--rp-space-3) / 2)),1fr));gap:var(--rp-space-3);margin:0;padding:0;list-style:none}
.badge-card{display:grid;grid-row:span 3;grid-template-rows:subgrid;justify-items:center;align-content:start;gap:var(--rp-space-2);padding:var(--rp-space-3);border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container-low);text-align:center}
.badge-card h4{grid-row:1;margin:0;font:var(--md-type-label);font-weight:700}
.badge-card>.badge,.badge-card>.badge-slot{grid-row:2}
.badge-card>.badge-progress{grid-row:3}
.badge-about{margin:0;font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
button.badge{display:block;padding:0;border:0;border-radius:var(--md-shape-full);background:none;cursor:pointer}
.badge{position:relative;container-type:inline-size}
.badge-art{display:block;position:relative;filter:var(--rp-badge-edge)}
.badge img{display:block;width:100%;height:auto}
.badge-ribbon{position:absolute;inset:0;width:100%;height:100%}
button.badge{transform:rotate(var(--tilt,0deg));transition:transform var(--rp-motion)}
button.badge:hover,button.badge:focus-visible{transform:none}
@media (prefers-reduced-motion:no-preference){button.badge:active{transform:perspective(480px) rotateX(16deg) rotateY(-10deg) scale(1.05)}button.badge:hover::after,button.badge:focus-visible::after{animation:badge-shine 900ms ease-out}.badge-fresh::after{animation:badge-shine-new 1200ms ease-out 600ms}.badge-large:popover-open .badge::after{animation:badge-shine-new 1100ms ease-out 250ms}}
button.badge::after,.badge-large .badge::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;background:linear-gradient(115deg,transparent 38%,var(--rp-badge-shine) 50%,transparent 62%) 150% 0/250% 100% no-repeat}
button.badge:hover::after,button.badge:focus-visible::after,.badge-fresh::after{-webkit-mask:var(--badge-src) center/contain no-repeat;mask:var(--badge-src) center/contain no-repeat}
button.badge:hover:has(.badge-ribbon)::after,button.badge:focus-visible:has(.badge-ribbon)::after,.badge-fresh:has(.badge-ribbon)::after,.badge-large:popover-open .badge::after{-webkit-mask:var(--badge-src) center/contain no-repeat,${BADGE_RIBBON_MASK} center/contain no-repeat;mask:var(--badge-src) center/contain no-repeat,${BADGE_RIBBON_MASK} center/contain no-repeat}
.badge-sparkles{position:absolute;inset:-8%;pointer-events:none}
.badge-large .badge-sparkles{inset:-3%}
.badge-sparkles>span{position:absolute;width:12%;aspect-ratio:1;background:var(--rp-coin-yellow);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);filter:drop-shadow(0 0 1px var(--rp-coin-ink));animation:badge-twinkle 1.8s ease-in-out infinite}
.badge-sparkles>span:nth-child(1){top:2%;left:8%}
.badge-sparkles>span:nth-child(2){top:10%;right:2%;width:9%;animation-delay:.5s}
.badge-sparkles>span:nth-child(3){bottom:16%;left:0;width:8%;animation-delay:1s}
.badge-sparkles>span:nth-child(4){bottom:2%;right:12%;width:11%;animation-delay:1.3s}
button.badge:active .badge-art{filter:var(--rp-badge-lift)}
.badges-reveal-pictures img{filter:var(--rp-badge-edge)}
.badge-card .badge,.badge-card .badge-slot{width:100%;max-width:200px}
.badge-card{--rp-slot-ground:var(--md-sys-color-surface-container-low)}
.badge-card .badge-slot{display:flex;align-items:center;justify-content:center;aspect-ratio:1;box-sizing:border-box;padding:17% 16% 17%;container-type:inline-size}
.badge-card .badge-slot .badge-about{position:relative;font-size:15px;line-height:1.2;hyphens:auto;color:var(--md-sys-color-on-surface)}
@media (max-width:359.98px){.badge-card .badge-slot .badge-about{font-size:13px}}
.badge-card-empty[data-category$=surprise] .badge-slot .badge-about{font:700 clamp(24px,30cqi,64px)/1 var(--md-ref-typeface)}
.badge-ribbon-text{position:absolute;left:13%;top:70%;width:74%;height:14%;display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;color:var(--rp-ribbon-text);font:600 clamp(8px,8.5cqi,26px)/1 var(--md-ref-typeface);letter-spacing:.04em;text-shadow:var(--rp-ribbon-glow)}
.badge-group-team .badge-ribbon-text,.badge-large-team .badge-ribbon-text{color:var(--rp-coin-ink);text-shadow:none}
.badge-progress{display:flex;flex-direction:column;gap:var(--rp-space-1);width:100%;margin-top:var(--rp-space-3)}
.badge-next{font:var(--md-type-label-small);font-weight:400;color:var(--md-sys-color-on-surface-variant)}
.badges .bar{display:block;height:10px;border-radius:var(--md-shape-full);background:var(--md-sys-color-surface-container-high);overflow:hidden}
.badges .bar>span{display:block;min-width:10px;height:100%;box-sizing:border-box;border:1.5px solid var(--rp-coin-ink);border-radius:var(--md-shape-full);background:var(--rp-coin-yellow)}
.badge-group-team .bar>span{background:var(--rp-coin-team)}
.badge-missing{font:var(--md-type-label-small);font-weight:400;color:var(--md-sys-color-on-surface-variant)}
.badge-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr));gap:0 var(--rp-space-6)}
.badge-gallery h4{margin:var(--rp-space-3) 0 0;font:var(--md-type-label);font-weight:700}
.badge-gallery .badge-about{margin-bottom:var(--rp-space-2)}
.badge-gallery ul{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:var(--rp-space-3);margin:0;padding:0;list-style:none}
.badge-gallery li{display:flex;flex-direction:column;align-items:center;gap:var(--rp-space-1)}
.badge-gallery .badge{width:96px}
.badge-slot{position:relative}
.badge-gallery li.badge-slot{width:96px;height:96px;justify-self:center}
.badge-shape-defs{position:absolute;overflow:hidden}
.badge-outline{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.badge-outline-edge{fill:none;stroke:var(--md-sys-color-outline);stroke-width:3.2;stroke-dasharray:4 3;stroke-linejoin:round}
.badge-outline-fill{fill:var(--rp-slot-ground,var(--md-sys-color-surface));stroke:none}
.badge-outline-plain .badge-outline-edge{stroke-width:1.6;stroke-dasharray:4 3}
.badge-value{font:var(--md-type-caption)}
.badge-large{width:min(312px,calc(100vw - 2 * var(--rp-space-4)));box-sizing:border-box;padding:var(--rp-space-4);border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface);text-align:center;box-shadow:0 2px 6px var(--md-sys-color-outline)}
.badge-large-close{position:absolute;top:var(--rp-space-1);right:var(--rp-space-1);z-index:1;padding:0;border:0;background:var(--md-sys-color-surface)}
.badge-large-hover{inset:auto;margin:0;pointer-events:none}
.badge-large-hover .badge-large-close{display:none}
.badge-large .badge{display:block;width:280px;max-width:100%;margin:0 auto}
.badge-large h4{margin:var(--rp-space-3) 0 var(--rp-space-1);font:var(--md-type-title-large)}
.badge-large p{margin:0;color:var(--md-sys-color-on-surface-variant)}
.count-badge{position:absolute;top:-4px;right:-6px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border:2px solid var(--md-sys-color-surface-container);border-radius:var(--md-shape-full);background:var(--rp-no);color:var(--rp-on-yes-no);display:inline-flex;align-items:center;justify-content:center;font:800 11px/1 var(--md-ref-typeface);font-variant-numeric:tabular-nums}
nav.app-nav .nav-icon,.segmented{position:relative}
.segmented .count-badge{position:static;margin-left:2px}
.events-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--rp-space-2);margin:0 0 var(--rp-space-3)}
.events-head h2{margin:0;font:var(--md-type-title-large)}
.events-head span{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.events-note{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
.events-note p{margin:0}
.events-note-title{padding-bottom:var(--rp-space-1);font:var(--md-type-title)}
.events h3{margin:var(--rp-space-5) 0 var(--rp-space-2);font:700 18px/24px var(--md-ref-typeface);color:var(--md-sys-color-on-surface)}
ol.event-list{display:flex;flex-direction:column;gap:var(--rp-space-2);margin:0;padding:0;list-style:none}
.event-card{display:flex;gap:var(--rp-space-3);margin:0;padding:var(--rp-space-3)}
.event-date{flex:none;display:flex;flex-direction:column;align-items:center;justify-content:center;width:52px;height:60px;border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--md-shape-md);background:var(--md-sys-color-surface);font:600 11px/14px var(--md-ref-typeface);color:var(--md-sys-color-on-surface-variant);text-transform:uppercase}
.event-date .event-day{font:700 22px/24px var(--md-ref-typeface);color:var(--md-sys-color-on-surface)}
.event-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.event-body p{margin:0}
.event-kind{font:700 15px/20px var(--md-ref-typeface)}
.event-name{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.event-amounts{display:flex;flex-wrap:wrap;gap:6px}
.event-amounts .chip{gap:4px;padding:0 10px 0 4px;background:var(--md-sys-color-surface)}
.event-amounts .coin-mini{width:16px;height:16px}
.event-foot{display:flex;flex-wrap:wrap;align-items:center;gap:6px var(--rp-space-2)}
.event-foot>form,.event-foot>.event-reported,.event-foot>.event-attended{margin-left:auto}
.event-button{display:inline-grid;grid-auto-flow:column;align-items:center;justify-content:center;gap:6px;min-width:168px;min-height:var(--rp-tap);padding:0 20px;border:var(--rp-outline-width) solid var(--md-sys-color-outline);border-radius:var(--md-shape-full);background:transparent;color:var(--rp-primary-text);font:var(--rp-type-control);cursor:pointer}
.event-button svg{width:18px;height:18px}
.event-join{border-color:var(--rp-coin-ink);background:var(--rp-coin-yellow);color:var(--rp-coin-ink)}
.event-joined,.event-reported{border-color:var(--rp-yes);background:var(--rp-yes);color:var(--rp-on-yes-no)}
.event-reported{cursor:default}
.event-button>span{display:inline-flex;align-items:center;justify-content:center;gap:6px}
.event-button>.event-now,.event-button>.event-next{grid-area:1/1}
.event-button .event-next{visibility:hidden}
.event-button:hover .event-now,.event-button:focus-visible .event-now{visibility:hidden}
.event-button:hover .event-next,.event-button:focus-visible .event-next{visibility:visible}
.event-join:hover,.event-join:focus-visible,.event-report:hover,.event-report:focus-visible{border-color:var(--rp-yes);background:var(--rp-yes);color:var(--rp-on-yes-no)}
.event-joined:hover,.event-joined:focus-visible{border-color:var(--rp-no);background:var(--rp-no)}
.event-attended{display:inline-flex;align-items:center;gap:6px;min-height:var(--rp-tap);font:var(--rp-type-control);color:var(--rp-on-ok-container)}
.event-attended svg{width:18px;height:18px}
.open-requests{margin:0 0 var(--rp-space-4);padding:var(--rp-space-3);border:2px solid var(--md-sys-color-error);border-radius:var(--md-shape-lg);background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
.open-requests h2{margin:0;font:var(--md-type-title)}
.open-requests>p{margin:0 0 var(--rp-space-2);font:var(--md-type-body)}
.request-events{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:var(--rp-space-2);align-items:start}
.request-event{padding:0 var(--rp-space-3);border-radius:var(--md-shape-md);background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface)}
.request-event-head{display:flex;align-items:center;gap:var(--rp-space-2);min-height:52px}
.request-event-link{flex:1;min-width:0;padding:12px 0;color:inherit;font:700 14px/20px var(--md-ref-typeface)}
.request-event-head .request-form{flex:none}
ul.requests{margin:0;padding:0;list-style:none}
.request{display:flex;flex-wrap:wrap;align-items:center;gap:var(--rp-space-2);min-height:52px;border-top:1px solid var(--md-sys-color-outline-variant)}
.open-requests .request{min-height:48px}
.rider-requests .request{border-top:0}
.request-rider{flex:1;min-width:0;font:600 15px/20px var(--md-ref-typeface)}
.request-form{display:inline-flex;margin:0}
.request-form .icon-button svg{width:22px;height:22px}
.request-chip{flex:1;min-width:0;display:inline-flex;align-items:center;min-height:28px;padding:2px 10px;border-radius:var(--md-shape-sm);background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container);font:var(--rp-type-status);text-decoration:none}
.requests-cell{min-width:340px}
.requests-cell .request{flex-wrap:nowrap;min-height:44px}
.event-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:var(--rp-space-1)}
.chip-alert{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
.chip-team{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
.self-form{display:flex;justify-content:flex-end;margin:var(--rp-space-2) 0 0}
.notice-undo{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--rp-space-2)}
.notice-undo p,.notice-undo form{margin:0}
.notice-floating{position:fixed;left:var(--rp-page-padding);right:var(--rp-page-padding);bottom:calc(var(--rp-nav-height) + env(safe-area-inset-bottom) + var(--rp-space-3));max-width:calc(40rem - 2 * var(--rp-page-padding));margin:0 auto;border:1px solid var(--md-sys-color-outline-variant);box-shadow:0 2px 6px var(--md-sys-color-outline);z-index:12}
.group-tile.tile-alert:not([aria-current]){border-color:var(--md-sys-color-error);background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
.attendance-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--rp-space-2)}
.attendance-head span{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.tri-legend{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 var(--rp-space-3);padding:10px;border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container);list-style:none}
.tri-legend li{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;font:400 12px/15px var(--md-ref-typeface)}
.tri-box{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;box-sizing:border-box;border:2px solid var(--md-sys-color-outline);border-radius:6px;color:var(--md-sys-color-on-surface)}
.tri-requested,.tri-toggle[data-state=open] .tri-box{border-style:dashed;background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-outline)}
.tri-checked,.tri-toggle[data-state=yes] .tri-box{border-color:var(--md-sys-color-on-surface);background:var(--md-sys-color-on-surface);color:var(--md-sys-color-surface)}
.tri-requested::after,.tri-checked::after,.tri-toggle[data-state=open] .tri-box::after,.tri-toggle[data-state=yes] .tri-box::after{content:"";width:10px;height:5px;margin-top:-3px;border:solid currentColor;border-width:0 0 3px 3px;transform:rotate(-45deg)}
.attendance-requested{border-radius:var(--md-shape-md);background:var(--md-sys-color-surface-container-low)}
.tri-toggle{display:flex;flex:1;align-items:center;gap:var(--rp-space-3);min-height:var(--rp-tap);padding:0;border:0;background:transparent;color:inherit;font:600 16px/22px var(--md-ref-typeface);text-align:left;cursor:pointer}
.tri-tag{flex:none;padding:0 8px;border:1px solid var(--md-sys-color-outline);border-radius:var(--md-shape-full);font:700 11px/20px var(--md-ref-typeface);color:var(--md-sys-color-on-surface-variant)}
.tri-tag-yes{border-color:var(--rp-yes);color:var(--rp-on-ok-container)}
.tri-tag-no{border-color:var(--md-sys-color-error);color:var(--md-sys-color-error)}
.tri-summary{margin:var(--rp-space-2) 0 0;text-align:center;font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.confirm-all{margin:0 0 var(--rp-space-2)}
@media (max-width:1099.98px){.table-scroll{display:none}.rider-cards.default .rider-card:not(.status-push){display:none}.group-tiles.default .tile-push{border-color:var(--md-sys-color-primary);background:var(--rp-coin-yellow);color:var(--rp-coin-ink)}.showing-wide{display:none}}
@media (min-width:840px){nav.app-nav .nav-label-short{display:none}nav.app-nav .nav-label-full{display:block}main:has(>.team-overview){max-width:none}main:has(>.team-grid),main:has(>.settings-grid){max-width:var(--rp-content-max)}.team-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-template-rows:repeat(4,auto) 1fr;column-gap:var(--rp-space-3);align-items:start}.team-grid>*{grid-column:1}.team-grid>.leaderboard{grid-column:2;grid-row:1/-1}.settings-grid{columns:2;column-gap:var(--rp-space-3)}main:has(>.events),main:has(>section.organiser>ul.organiser-events){max-width:var(--rp-content-max)}ol.event-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(360px,100%),1fr))}ul.organiser-events{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));column-gap:var(--rp-space-3)}.organiser>.organiser-form{max-width:40rem}nav.group-tiles{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}ul.rider-cards{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}}
@media (min-width:1100px){ul.rider-cards{display:none}.group-tiles.default .tile-all{border-color:var(--md-sys-color-primary);background:var(--rp-coin-yellow);color:var(--rp-coin-ink)}.showing-phone{display:none}}
@media (min-width:600px){.wordmark-name{position:static;width:auto;height:auto;overflow:visible;clip:auto}:root{--rp-page-padding:32px;--md-type-display:600 40px/48px var(--md-ref-typeface)}.overview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.overview-grid>*{grid-column:1/-1}.overview-grid>.card-outlined{grid-column:auto}.rynke-gauges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--rp-space-3)}.rynke-gauges>h2{grid-column:1/-1;margin:0}.rynke-gauges .card{margin:0}body.shell{position:relative;padding-bottom:0}.app-prompt,.notice-floating{bottom:calc(var(--rp-space-4) + env(safe-area-inset-bottom))}.tour{top:calc(var(--rp-topbar-height) + env(safe-area-inset-top) + var(--rp-space-2));bottom:auto;left:auto;max-width:24rem}nav.app-nav a.tour-target{outline:2px solid var(--md-sys-color-primary);outline-offset:2px}nav.app-nav a.tour-target .nav-icon{outline:0;animation:none}h1.section-title{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}nav.app-nav{position:fixed;top:calc((var(--rp-topbar-height) - var(--rp-tap)) / 2 + env(safe-area-inset-top));right:calc(var(--rp-page-padding) + var(--rp-tap) + var(--rp-space-2));left:auto;bottom:auto;display:flex;gap:var(--rp-space-1);height:auto;padding:0;background:none}nav.app-nav a{flex-direction:row;gap:var(--rp-space-1);padding:0 var(--rp-space-3);border-radius:var(--md-shape-full);font:var(--md-type-label)}nav.app-nav .nav-icon{width:auto;height:auto}nav.app-nav a[aria-current=page]{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}nav.app-nav a[aria-current=page] .nav-icon{background:none}}
@media (min-width:600px){.overview-grid>.progress{grid-column:1/-1}.progress-plot{height:13rem}}
@media (min-width:600px) and (max-width:839.98px){body.shell .wordmark-name{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}
@media (min-width:600px) and (max-width:1023.98px){nav.app-nav a:not([aria-current]) .nav-label{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip:rect(0 0 0 0)}}
@media (max-width:399.98px){:root{--rp-page-padding:12px}.hero,.team-total,.overview-deadline{gap:var(--rp-space-3);padding:var(--rp-space-3)}.hero .coin-hero,.team-total .coin-large{width:96px;height:96px}.overview-deadline .coin-large{width:96px;height:96px}.overview-deadline .overview-deadline-count{font:700 28px/34px var(--md-ref-typeface)}.rynke-verdict{font:600 20px/26px var(--md-ref-typeface)}.rynke-summary{gap:var(--rp-space-3)}.status-art-banner{width:96px;height:96px}.quote-monkey-art{width:100px;height:100px}.group-tile{padding:10px}dl.ride-figures{grid-template-columns:repeat(3,auto);justify-content:space-between}nav.app-nav .nav-icon{width:56px}}
@media (prefers-reduced-motion:reduce){nav.app-nav .nav-icon,[role=switch]::after,summary::after{transition:none}.button,.button-outlined,.button-text,.danger,.icon-button{transition:none}.button[aria-busy=true]::after,.button-outlined[aria-busy=true]::after,.danger[aria-busy=true]::after,.segmented[aria-busy=true]::after{animation:none}.celebrate-coins .coin-mini{animation:none}.badges-reveal-pictures img{animation:none}button.badge{transition:none}.badge-sparkles>span{animation:none}.coin-flip-turn{animation:none}}
@keyframes top-bar-lift{from{box-shadow:none}to{box-shadow:0 1px 0 var(--md-sys-color-outline-variant)}}
@keyframes busy-spin{to{transform:rotate(360deg)}}
@keyframes tour-point{50%{outline-offset:5px}}
@keyframes coin-flip{0%,30%{transform:rotateY(0deg)}50%,80%{transform:rotateY(180deg)}100%{transform:rotateY(360deg)}}
@keyframes badge-shine{from{opacity:1;background-position:150% 0}to{opacity:1;background-position:-50% 0}}
@keyframes badge-shine-new{from{opacity:1;background-position:150% 0}to{opacity:1;background-position:-50% 0}}
@keyframes badge-twinkle{0%,100%{opacity:0;transform:scale(.3) rotate(0deg)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
@keyframes badge-slap{from{transform:scale(1.8) rotate(-14deg);opacity:0}45%{transform:scale(.9) rotate(3deg);opacity:1}70%{transform:scale(1.05) rotate(-1deg)}to{transform:none;opacity:1}}
@keyframes coin-drop{from{transform:translateY(-40px) rotate(-180deg);opacity:0}to{transform:none;opacity:1}}
@keyframes page-loading{from{transform:translateX(-100%)}to{transform:translateX(250%)}}`;
