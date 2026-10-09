// The site's whole stylesheet, inlined into every page by `layout()` (feature
// 011 research R4), in Team Rynkeby's yellow, black and green (issue #51). The
// tokens of contracts/design-tokens.md come first; every
// other rule takes its colours from them through `var(--…)` (FR-031). No
// `url(` to another origin and no `@import` (FR-037).

/**
 * The Rynke coin's own colours (feature 012), the same in both schemes: the
 * coin looks like the coin. Listed in both so both define the same names.
 */
const COIN =
	"--rp-coin-rim:#c99a2e;--rp-coin-ink:#1c1b13;--rp-coin-face:#fffdf5;--rp-coin-yellow:#fbe122;--rp-coin-fur:#c8641e;--rp-coin-muzzle:#f0a868;--rp-coin-sky:#a9d6f2;--rp-coin-glass:#e8f3fb;--rp-coin-brick:#b5562f;--rp-coin-water:#3a8fd0;--rp-coin-team:#8cc4f0";

/**
 * The Team page's fixed accents (feature 016, the Claude Design draft): the
 * team total sits on the coin's ink and the quote's edge keeps its colour in
 * both schemes.
 */
const TEAM =
	"--rp-hero-label:#e6d9a8;--rp-hero-week:#bfe3c6;--rp-push-accent:#e8833a;--rp-ok-accent:#2e8b57;";

/** The colour roles of the dark scheme, for the system setting and a choice. */
const DARK = `--md-sys-color-surface:#12110c;--md-sys-color-surface-container-low:#1a1913;--md-sys-color-surface-container:#201f18;--md-sys-color-surface-container-high:#2b2a21;--md-sys-color-on-surface:#eeebdd;--md-sys-color-on-surface-variant:#cec9b3;--md-sys-color-outline:#979279;--md-sys-color-outline-variant:#4a4633;--md-sys-color-primary:#fbe122;--md-sys-color-on-primary:#1c1b13;--md-sys-color-primary-container:#fbe122;--md-sys-color-on-primary-container:#1c1b13;--md-sys-color-secondary-container:#fbe122;--md-sys-color-on-secondary-container:#1c1b13;--md-sys-color-error:#ffb4ab;--md-sys-color-error-container:#93000a;--md-sys-color-on-error-container:#ffdad6;--rp-ok-container:#173a22;--rp-on-ok-container:#bfe3c6;--rp-neutral-container:#2e2c22;--rp-on-neutral-container:#cec9b3;--rp-brand:#fc5200;--rp-part-1:#fbe122;--rp-part-2:#8cc4f0;--rp-part-3:#ff9a4d;--rp-part-4:#6fd1c2;--rp-part-5:#d7a6ec;--rp-part-6:#a8a6a0;--rp-reached:#7fcb92;--rp-track:#3a382c;--rp-push-container:#3a2614;--rp-on-push-container:#f6d2b0;--rp-road:#2b2a21;--rp-bar:#6b6650;${TEAM}${COIN}`;

/** Strava's images come in both variants; the scheme shows one (R13). */
const SHOW_DARK = (root: string) =>
	`${root} .pbs-light,${root} .cws-light{display:none}${root} .pbs-dark,${root} .cws-dark{display:inline}`;

const SYSTEM_DARK = ":root:not([data-scheme=light])";
const FIXED_DARK = ":root[data-scheme=dark]";

export const STYLE = `:root{color-scheme:light dark;--md-sys-color-surface:#fffdf5;--md-sys-color-surface-container-low:#fcf9ec;--md-sys-color-surface-container:#f6f2e0;--md-sys-color-surface-container-high:#efead3;--md-sys-color-on-surface:#1c1b13;--md-sys-color-on-surface-variant:#4a4633;--md-sys-color-outline:#7a755c;--md-sys-color-outline-variant:#d3cdb2;--md-sys-color-primary:#1c1b13;--md-sys-color-on-primary:#fbe122;--md-sys-color-primary-container:#fbe122;--md-sys-color-on-primary-container:#1c1b13;--md-sys-color-secondary-container:#fbe122;--md-sys-color-on-secondary-container:#1c1b13;--md-sys-color-error:#ba1a1a;--md-sys-color-error-container:#ffdad6;--md-sys-color-on-error-container:#410002;--rp-ok-container:#e7eee8;--rp-on-ok-container:#0f4f25;--rp-neutral-container:#efead3;--rp-on-neutral-container:#4a4633;--rp-brand:#fc5200;--rp-part-1:#fbe122;--rp-part-2:#8cc4f0;--rp-part-3:#ff9a4d;--rp-part-4:#6fd1c2;--rp-part-5:#d7a6ec;--rp-part-6:#a8a6a0;--rp-reached:#7fcb92;--rp-track:#1c1b13;--rp-push-container:#fdebd9;--rp-on-push-container:#6a3208;--rp-road:#1c1b13;--rp-bar:#7a755c;${TEAM}${COIN}}
@media (prefers-color-scheme:dark){${SYSTEM_DARK}{color-scheme:dark;${DARK}}${SHOW_DARK(SYSTEM_DARK)}}
${FIXED_DARK}{color-scheme:dark;${DARK}}
:root[data-scheme=light]{color-scheme:light}
:root{--md-ref-typeface:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--md-type-display:600 36px/44px var(--md-ref-typeface);--md-type-headline:600 28px/34px var(--md-ref-typeface);--md-type-title-large:600 22px/28px var(--md-ref-typeface);--md-type-title:600 16px/24px var(--md-ref-typeface);--md-type-body-large:400 16px/24px var(--md-ref-typeface);--md-type-body:400 14px/20px var(--md-ref-typeface);--md-type-label:500 14px/20px var(--md-ref-typeface);--md-type-label-small:500 12px/16px var(--md-ref-typeface);--md-type-caption:400 13px/18px var(--md-ref-typeface);--rp-space-1:4px;--rp-space-2:8px;--rp-space-3:12px;--rp-space-4:16px;--rp-space-5:24px;--rp-space-6:32px;--rp-page-padding:16px;--rp-content-max:1040px;--rp-tap:44px;--rp-nav-height:80px;--rp-topbar-height:64px;--md-shape-xs:4px;--md-shape-sm:8px;--md-shape-md:12px;--md-shape-lg:16px;--md-shape-full:9999px;--rp-motion:150ms ease-out}
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
header.top-bar{position:sticky;top:0;z-index:9;display:flex;align-items:center;gap:var(--rp-space-2);min-height:calc(var(--rp-topbar-height) + env(safe-area-inset-top));padding:env(safe-area-inset-top) var(--rp-page-padding) 0;background:var(--md-sys-color-surface-container);animation:top-bar-lift linear both;animation-timeline:scroll();animation-range:0 8px}
header form{display:flex}
.wordmark{display:inline-flex;align-items:center;font:var(--md-type-title-large);margin-right:auto;color:var(--md-sys-color-on-surface)}
.wordmark-name>span{margin-left:2px;padding:0 var(--rp-space-1);border-radius:var(--md-shape-xs);background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
body.shell .wordmark-name{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
h1.section-title{flex:1;margin:0;font:var(--md-type-title-large)}
main{max-width:40rem;margin:0 auto;padding:var(--rp-space-4) var(--rp-page-padding);overflow-wrap:anywhere}
main:has(>.overview-grid){max-width:var(--rp-content-max)}
main *{min-width:0}
footer{padding:var(--rp-space-5) var(--rp-page-padding);text-align:center}
footer img{height:24px}
.card{margin:0 0 var(--rp-space-3);padding:var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.card-outlined{border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low)}
.verdict{background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.rynke-verdict{font:var(--md-type-title-large)}
ul.rynke-missing{display:flex;flex-wrap:wrap;gap:var(--rp-space-2);list-style:none;margin:0 0 var(--rp-space-3);padding:0}
.verdict .chip{border:1px solid var(--md-sys-color-on-primary-container);background:none;color:var(--md-sys-color-on-primary-container)}
.rynke-summary dl{margin:0}
.rynke-summary dt{font:var(--md-type-label)}
.rynke-summary dd,.rynke-breakdown dd{margin:0 0 var(--rp-space-2)}
.rynke-events .event-not-counting{color:var(--md-sys-color-on-surface-variant)}
.greeting{font:var(--md-type-title-large)}
.notice{margin:0 0 var(--rp-space-3);padding:var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.notice-error{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
.notice-error a.button{background:var(--md-sys-color-error);color:var(--md-sys-color-error-container)}
#install button,#notifications button{margin-right:var(--rp-space-2)}
.overview-grid{display:grid;gap:var(--rp-space-3)}
.overview-grid>*{margin:0}
.rynke-gauges .card{margin:0 0 var(--rp-space-3)}
.waiting{display:flex;flex-direction:column;align-items:center;gap:var(--rp-space-4);padding:var(--rp-space-6);text-align:center}
.waiting .coin{animation:coin-spin 2.4s linear infinite}
.team-total{display:flex;align-items:center;gap:var(--rp-space-4);border:2px solid var(--rp-coin-rim);border-radius:24px;background:var(--rp-coin-ink);color:var(--rp-coin-face)}
.team-total .coin-large{width:80px;height:80px}
.team-total-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.team-total p{margin:0}
.team-total-label{font:var(--md-type-body);color:var(--rp-hero-label)}
.team-total-value{font:700 32px/38px var(--md-ref-typeface);color:var(--rp-coin-yellow)}
.team-total-kind{font:var(--md-type-body)}
.team-total-week{padding-top:6px;font:var(--md-type-caption);color:var(--rp-hero-week)}
nav.kind-switch,nav.organiser-switch{display:flex;margin:0 0 var(--rp-space-3);padding:var(--rp-space-1);border:1px solid var(--md-sys-color-outline-variant);border-radius:24px;background:var(--md-sys-color-surface-container)}
.kind-switch .segmented,.organiser-switch .segmented{flex:1}
nav.kind-switch .segmented,nav.organiser-switch .segmented{gap:6px;margin:0;border:0;border-radius:20px;font-weight:600}
nav.organiser-switch .segmented svg{width:20px;height:20px}
.my-place{display:flex;align-items:center;gap:var(--rp-space-3);padding:var(--rp-space-3) var(--rp-space-4);background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.place-badge{flex:none;display:flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:var(--md-shape-full);background:var(--rp-coin-ink);color:var(--rp-coin-yellow);font:700 20px/1 var(--md-ref-typeface)}
.my-place p{margin:0}
.my-place .place{font:600 16px/22px var(--md-ref-typeface)}
.my-place .place-next{padding-top:2px;font:var(--md-type-body)}
.quote{margin:0 0 var(--rp-space-3);padding:14px var(--rp-space-4) var(--rp-space-3);border-left:6px solid var(--rp-push-accent);border-radius:var(--md-shape-lg);background:var(--rp-push-container);color:var(--rp-on-push-container)}
.quote-on-track{border-left-color:var(--rp-ok-accent);background:var(--rp-ok-container);color:var(--rp-on-ok-container)}
.quote p{margin:0}
.quote-heading{padding-bottom:6px;font:700 12px/16px var(--md-ref-typeface);letter-spacing:.04em;text-transform:uppercase}
.quote p:last-child{font:600 17px/24px var(--md-ref-typeface)}
.quote p:last-child::before{content:"„"}
.quote p:last-child::after{content:"“"}
.peloton,.team-chart{margin-inline:0}
.peloton figcaption,.team-chart figcaption{display:flex;align-items:baseline;justify-content:space-between;gap:var(--rp-space-2);font:var(--md-type-title)}
.team-chart-kind{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.team-hint{margin:var(--rp-space-1) 0 var(--rp-space-3);font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.chart-axis{display:flex;justify-content:space-between;gap:var(--rp-space-2);margin:6px 0 0;font:400 12px/16px var(--md-ref-typeface);color:var(--md-sys-color-on-surface-variant)}
.peloton-road{display:block;width:100%;height:auto}
.peloton-road .road{fill:var(--rp-road)}
.peloton-road .road-middle{fill:none;stroke:var(--rp-coin-yellow);stroke-width:2;stroke-dasharray:6 4;opacity:.6}
.peloton-road .road-gap{fill:var(--md-sys-color-surface-container)}
.peloton-you rect{fill:var(--rp-coin-yellow)}
.peloton-you text{fill:var(--rp-coin-ink);font:700 11px var(--md-ref-typeface)}
.week-bars{display:block;width:100%;height:120px;border-bottom:1px solid var(--md-sys-color-outline)}
.week-bars rect{fill:var(--rp-bar)}
.week-bars rect.current{fill:var(--rp-coin-yellow);stroke:var(--md-sys-color-on-surface);stroke-width:1.5}
.chart-best{margin:var(--rp-space-3) 0;padding:var(--rp-space-2) var(--rp-space-3);border-radius:var(--md-shape-md);background:var(--rp-ok-container);color:var(--rp-on-ok-container);font:var(--md-type-caption)}
.leaderboard{padding:var(--rp-space-4) var(--rp-space-2) var(--rp-space-2);border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface-container-low)}
.leaderboard-head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--rp-space-2);padding:0 var(--rp-space-2);font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.leaderboard h2{margin:0;font:var(--md-type-title);color:var(--md-sys-color-on-surface)}
.leaderboard .team-hint{margin:var(--rp-space-1) var(--rp-space-2) var(--rp-space-2)}
nav.list-scope{display:flex;gap:var(--rp-space-2);margin:0 var(--rp-space-2) 10px}
nav.list-scope .segmented{margin:0;padding:0 14px;border:1px solid var(--md-sys-color-outline);border-radius:var(--md-shape-sm);font-weight:600}
nav.list-scope .segmented[aria-current]{background:var(--md-sys-color-on-surface);color:var(--md-sys-color-surface)}
.leaderboard ol{display:grid;gap:var(--rp-space-1);margin:0;padding:0;list-style:none}
li.row{display:flex;align-items:center;gap:10px;min-height:52px;padding:var(--rp-space-1) var(--rp-space-3) var(--rp-space-1) var(--rp-space-2);border-radius:var(--md-shape-md)}
li.row.you{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
.row-place{flex:none;width:36px;text-align:center;font:700 22px/28px var(--md-ref-typeface)}
.row-line{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.row-you{font:700 13px/18px var(--md-ref-typeface)}
.row-figures{flex:none;display:flex;flex-direction:column;align-items:flex-end}
.row-total{display:inline-flex;align-items:center;gap:6px;font:700 18px/24px var(--md-ref-typeface)}
.row-total .coin-mini{width:18px;height:18px}
.row-other{font:400 12px/16px var(--md-ref-typeface);opacity:.8}
.sparkline{display:block;width:96px;height:22px}
.sparkline polyline{fill:none;stroke:var(--md-sys-color-on-surface-variant);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
li.row.you .sparkline polyline{stroke:currentColor}
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
.organiser-confirm>summary{display:flex;align-items:center;min-height:var(--rp-tap);cursor:pointer;color:var(--md-sys-color-error);font:var(--md-type-label)}
.chip{display:inline-flex;align-items:center;min-height:32px;padding:0 var(--rp-space-3);border-radius:var(--md-shape-sm);font:var(--md-type-label);background:var(--rp-neutral-container);color:var(--rp-on-neutral-container)}
.ride-counting .chip{background:var(--rp-ok-container);color:var(--rp-on-ok-container)}
.ride-not-counting .chip{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}
ol.ride-list{list-style:none;margin:0;padding:0;display:grid;gap:var(--rp-space-3)}
.ride-card{min-width:0;padding:var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.ride-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--rp-space-2)}
.ride-head>*{min-width:0}
.ride-date{font:var(--md-type-title)}
.ride-status{font:var(--md-type-label-small)}
dl.ride-figures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--rp-space-2);margin:var(--rp-space-2) 0}
dl.ride-figures>div{min-width:0}
dl.ride-figures dt{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
dl.ride-figures dd{margin:0;font:var(--md-type-title);white-space:nowrap}
.ride-card p{margin:var(--rp-space-1) 0}
.ride-meta{font:var(--md-type-body);color:var(--md-sys-color-on-surface-variant)}
.ride-why{font:var(--md-type-body)}
.ride-why>summary{display:flex;align-items:center;min-height:var(--rp-tap);cursor:pointer;list-style:none;color:var(--md-sys-color-primary);font:var(--md-type-label)}
.ride-why>summary::-webkit-details-marker{display:none}
.ride-why>summary::after{content:"";width:8px;height:8px;margin-left:var(--rp-space-2);border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform var(--rp-motion)}
.ride-why[open]>summary::after{transform:rotate(-135deg)}
.ride-why ul,.ride-why p{margin:var(--rp-space-1) 0}
a.strava-activity{font-weight:700;text-decoration:underline}
.ride-name{overflow-wrap:anywhere;color:var(--md-sys-color-on-surface)}
.ride-reasons{padding-left:20px}
.tap{display:inline-flex;align-items:center;min-height:var(--rp-tap);min-width:var(--rp-tap)}
.button,.button-outlined,.danger,button:not([class]){display:inline-flex;align-items:center;justify-content:center;min-height:var(--rp-tap);min-width:var(--rp-tap);padding:0 var(--rp-space-5);border:1px solid transparent;border-radius:var(--md-shape-full);font:var(--md-type-label);text-decoration:none;cursor:pointer}
.button{background:var(--md-sys-color-primary);color:var(--md-sys-color-on-primary)}
.button-outlined,button:not([class]){border-color:var(--md-sys-color-outline);background:none;color:var(--md-sys-color-primary)}
.danger{border-color:var(--md-sys-color-error);background:none;color:var(--md-sys-color-error)}
button:has(>img.cws){display:inline-block;min-height:0;padding:0;border:0;border-radius:0;background:none}
.cws{height:48px}
.segmented,.segmented-group label{display:inline-flex;align-items:center;justify-content:center;min-height:var(--rp-tap);min-width:var(--rp-tap);padding:0 var(--rp-space-4);border:1px solid var(--md-sys-color-outline);background:none;color:var(--md-sys-color-on-surface);font:var(--md-type-label);cursor:pointer}
.segmented+.segmented,.segmented-group label+label{margin-left:-1px}
.segmented:first-of-type,.segmented-group label:first-of-type{border-radius:var(--md-shape-full) 0 0 var(--md-shape-full)}
.segmented:last-of-type,.segmented-group label:last-of-type{border-radius:0 var(--md-shape-full) var(--md-shape-full) 0}
.segmented[aria-current],.segmented-group label:has(:checked){background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
.segmented-group{display:flex;margin:0 0 var(--rp-space-2);padding:0;border:0}
.segmented-group input{position:absolute;opacity:0;pointer-events:none}
.segmented-group label:has(:focus-visible){outline:2px solid var(--md-sys-color-primary);outline-offset:2px}
[role=switch]{position:relative;min-height:var(--rp-tap);min-width:var(--rp-tap);width:60px;padding:0;border:0;background:none}
[role=switch]::before{content:"";position:absolute;left:4px;top:6px;width:52px;height:32px;border:2px solid var(--md-sys-color-outline);border-radius:var(--md-shape-full);background:var(--md-sys-color-surface-container-high)}
[role=switch]::after{content:"";position:absolute;left:12px;top:14px;width:16px;height:16px;border-radius:var(--md-shape-full);background:var(--md-sys-color-outline);transition:left var(--rp-motion)}
[role=switch][aria-checked=true]::before{border-color:var(--md-sys-color-primary);background:var(--md-sys-color-primary)}
[role=switch][aria-checked=true]::after{left:32px;top:10px;width:24px;height:24px;background:var(--md-sys-color-on-primary)}
.settings-group{margin:0 0 var(--rp-space-3);padding:var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.settings-group .notice{margin:0;padding:0}
[hidden]{display:none!important}
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
.hero{display:flex;align-items:center;gap:var(--rp-space-4);padding:var(--rp-space-4);border:2px solid var(--rp-coin-rim);border-radius:24px;background:var(--rp-coin-ink);color:var(--rp-coin-face)}
.hero .coin-hero{width:88px;height:88px}
.hero p{margin:0}
.hero .greeting{font:var(--md-type-body)}
.hero-total{font:var(--md-type-title-large);color:var(--rp-coin-yellow)}
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
.rynke-verdict .coin-head{margin-right:var(--rp-space-2)}
#rides .coin-large{display:block;width:96px;height:96px;margin:var(--rp-space-4) auto}
.landing-hero{display:flex;flex-direction:column;align-items:center;gap:var(--rp-space-2);margin:var(--rp-space-4) 0;text-align:center}
.landing-hero h1{margin:0}
.tagline{margin:0;font:var(--md-type-title-large)}
nav.pager{display:flex;flex-wrap:wrap;gap:var(--rp-space-1) var(--rp-space-2);margin-top:var(--rp-space-2)}
figure.gauge{display:block;width:100%;margin:0}
figure.gauge figcaption{display:flex;align-items:center;gap:var(--rp-space-2);margin:0 0 var(--rp-space-2);font:var(--md-type-body)}
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
.gauge-legend{display:flex;flex-wrap:wrap;gap:0 var(--rp-space-4);list-style:none;margin:var(--rp-space-2) 0 0;padding:0;font:var(--md-type-caption)}
.gauge-key{display:inline-block;width:12px;height:12px;margin-right:var(--rp-space-1);border:1px solid var(--rp-track);border-radius:var(--md-shape-xs);vertical-align:middle}
.icon-button{display:inline-flex;align-items:center;justify-content:center;min-width:var(--rp-tap);min-height:var(--rp-tap);border-radius:var(--md-shape-full);color:var(--md-sys-color-on-surface-variant)}
nav.app-nav{position:fixed;left:0;right:0;bottom:0;display:grid;grid-auto-flow:column;grid-auto-columns:1fr;height:calc(var(--rp-nav-height) + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:var(--md-sys-color-surface-container);z-index:10}
nav.app-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--rp-space-1);min-height:var(--rp-tap);color:var(--md-sys-color-on-surface-variant);text-decoration:none;font:var(--md-type-label-small)}
nav.app-nav .nav-icon{display:flex;align-items:center;justify-content:center;width:64px;height:32px;border-radius:var(--md-shape-full);transition:background-color var(--rp-motion)}
nav.app-nav a[aria-current=page]{color:var(--md-sys-color-on-surface);font-weight:600}
nav.app-nav a[aria-current=page] .nav-icon{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
body.shell{padding-bottom:calc(var(--rp-nav-height) + env(safe-area-inset-bottom))}
.app-prompt{position:fixed;left:var(--rp-page-padding);right:var(--rp-page-padding);bottom:calc(var(--rp-nav-height) + env(safe-area-inset-bottom) + var(--rp-space-3));max-width:calc(40rem - 2 * var(--rp-page-padding));margin:0 auto;padding:var(--rp-space-3) calc(var(--rp-tap) + var(--rp-space-2)) var(--rp-space-3) var(--rp-space-4);border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface);border:1px solid var(--md-sys-color-outline-variant);box-shadow:0 2px 6px var(--md-sys-color-outline);z-index:11}
.app-prompt p{margin:0 0 var(--rp-space-2)}
.app-prompt [data-action=close]{position:absolute;top:0;right:0}
.visually-hidden{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
main:has(>.team-overview){max-width:var(--rp-content-max)}
.team-overview h3{margin:0;font:600 17px/24px var(--md-ref-typeface)}
.overview-deadline{display:flex;align-items:center;gap:var(--rp-space-4);margin:0 0 var(--rp-space-3);padding:var(--rp-space-4);border:2px solid var(--rp-coin-rim);border-radius:24px;background:var(--rp-coin-ink);color:var(--rp-coin-face)}
.overview-deadline .coin-large{width:72px;height:72px}
.overview-deadline p{margin:0;font:var(--md-type-body)}
.overview-deadline .overview-deadline-date{color:var(--rp-hero-label)}
.overview-deadline .overview-deadline-days{font:700 32px/38px var(--md-ref-typeface);color:var(--rp-coin-yellow)}
nav.group-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--rp-space-2);margin:0 0 var(--rp-space-2)}
.group-tile{display:flex;flex-direction:column;justify-content:center;gap:2px;min-height:76px;padding:10px var(--rp-space-3);border:2px solid transparent;border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container);color:var(--md-sys-color-on-surface);text-decoration:none}
.tile-count{font:700 26px/32px var(--md-ref-typeface)}
.tile-label{font:600 12px/16px var(--md-ref-typeface)}
.group-tile[aria-current]{border-color:var(--md-sys-color-primary);background:var(--rp-coin-yellow);color:var(--rp-coin-ink)}
ul.rider-cards{display:grid;gap:var(--rp-space-2);margin:0 0 var(--rp-space-3);padding:0;list-style:none}
.rider-card{display:flex;flex-direction:column;gap:10px;padding:14px var(--rp-space-4) 6px;border-radius:var(--md-shape-lg);background:var(--md-sys-color-surface-container)}
.rider-head{display:flex;flex-wrap:wrap;align-items:center;gap:var(--rp-space-2)}
.rider-head h3{flex:1}
.rider-head h3 a{color:inherit}
.rider-profile{display:inline-flex;align-items:center;min-height:var(--rp-tap);font:700 13px/18px var(--md-ref-typeface)}
.status-chip{flex:none;padding:0 10px;border-radius:var(--md-shape-md);font:700 12px/24px var(--md-ref-typeface);white-space:nowrap;background:var(--rp-push-container);color:var(--rp-on-push-container)}
.status-on_track .status-chip{background:var(--rp-ok-container);color:var(--rp-on-ok-container)}
.status-in .status-chip{background:var(--rp-coin-ink);color:var(--rp-coin-yellow)}
.rider-bars{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--rp-space-3)}
.amount p{display:flex;align-items:center;gap:6px;margin:0 0 var(--rp-space-1);font:var(--md-type-caption)}
.amount .coin-mini{width:16px;height:16px}
.threshold-bar{display:block;width:100%;height:12px;overflow:visible}
.threshold-track{fill:var(--rp-track);opacity:.2}
.threshold-fill{fill:var(--rp-coin-yellow)}
.amount-team .threshold-fill,.rider-table td:nth-child(4) .threshold-fill{fill:var(--rp-coin-team)}
.pace-mark{stroke:var(--md-sys-color-on-surface);stroke-width:2}
ul.rider-missing{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:0;list-style:none}
.rider-missing li{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border:1px solid var(--md-sys-color-outline);border-radius:13px;font:600 12px/16px var(--md-ref-typeface)}
.rider-missing li.behind{border-color:var(--rp-push-accent);background:var(--rp-push-container);color:var(--rp-on-push-container)}
.rider-breakdown{font:var(--md-type-caption);color:var(--md-sys-color-on-surface-variant)}
.rider-breakdown ul{margin:0 0 var(--rp-space-2);padding:0;list-style:none}
.rider-breakdown li{padding:6px 0;border-bottom:1px solid var(--md-sys-color-outline-variant)}
.table-scroll{overflow-x:auto;margin:0 0 var(--rp-space-3);border:1px solid var(--md-sys-color-outline-variant);border-radius:var(--md-shape-lg)}
.rider-table{width:100%;border-collapse:collapse;font:var(--md-type-body)}
.rider-table thead tr{background:var(--md-sys-color-surface-container)}
.rider-table th,.rider-table td{padding:10px var(--rp-space-2);border-top:1px solid var(--md-sys-color-outline-variant);text-align:left;vertical-align:middle}
.rider-table th:first-child{padding-left:var(--rp-space-4);white-space:nowrap}
.rider-table .number{text-align:right}
.rider-table .bar-cell{min-width:120px}
.rider-table .bar-cell span{display:block;font-weight:700}
.rider-table .behind{color:var(--rp-on-push-container);font-weight:600}
.qualified{margin:0 0 var(--rp-space-3);padding:var(--rp-space-4);border:2px solid var(--rp-coin-rim);border-radius:24px;background:var(--rp-coin-ink);color:var(--rp-coin-face)}
.qualified h2{margin:0 0 var(--rp-space-1);font:700 18px/24px var(--md-ref-typeface);color:var(--rp-coin-yellow)}
.qualified p{margin:0;font:var(--md-type-caption);color:var(--rp-hero-label)}
.qualified ul{display:flex;flex-wrap:wrap;gap:var(--rp-space-2);margin:var(--rp-space-3) 0 0;padding:0;list-style:none}
.qualified li{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:0 var(--rp-space-3) 0 var(--rp-space-1);border-radius:18px;background:var(--rp-road);font:600 14px/20px var(--md-ref-typeface)}
.qualified .coin-mini{width:28px;height:28px}
@media (max-width:839.98px){.table-scroll{display:none}.rider-cards.default .rider-card:not(.status-push){display:none}.group-tiles.default .tile-push{border-color:var(--md-sys-color-primary);background:var(--rp-coin-yellow);color:var(--rp-coin-ink)}.showing-wide{display:none}}
@media (min-width:840px){ul.rider-cards{display:none}nav.group-tiles{grid-template-columns:repeat(4,minmax(0,1fr))}.group-tiles.default .tile-all{border-color:var(--md-sys-color-primary);background:var(--rp-coin-yellow);color:var(--rp-coin-ink)}.showing-phone{display:none}}
@media (min-width:600px){body.shell .wordmark-name{position:static;width:auto;height:auto;overflow:visible;clip:auto}:root{--rp-page-padding:32px;--md-type-display:600 40px/48px var(--md-ref-typeface)}ol.ride-list{grid-template-columns:repeat(2,minmax(0,1fr))}.overview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.overview-grid>*{grid-column:1/-1}.overview-grid>.card-outlined{grid-column:auto}.rynke-gauges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--rp-space-3)}.rynke-gauges>h2{grid-column:1/-1;margin:0}.rynke-gauges .card{margin:0}body.shell{position:relative;padding-bottom:0}.app-prompt{bottom:calc(var(--rp-space-4) + env(safe-area-inset-bottom))}h1.section-title{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}nav.app-nav{position:fixed;top:calc((var(--rp-topbar-height) - var(--rp-tap)) / 2 + env(safe-area-inset-top));right:calc(var(--rp-page-padding) + var(--rp-tap) + var(--rp-space-2));left:auto;bottom:auto;display:flex;gap:var(--rp-space-1);height:auto;padding:0;background:none}nav.app-nav a{flex-direction:row;gap:var(--rp-space-1);padding:0 var(--rp-space-3);border-radius:var(--md-shape-full);font:var(--md-type-label)}nav.app-nav .nav-icon{width:auto;height:auto}nav.app-nav a[aria-current=page]{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}nav.app-nav a[aria-current=page] .nav-icon{background:none}}
@media (prefers-reduced-motion:reduce){nav.app-nav .nav-icon,[role=switch]::after,.ride-why>summary::after{transition:none}.celebrate-coins .coin-mini{animation:none}.waiting .coin{animation:none}}
@keyframes top-bar-lift{from{box-shadow:none}to{background:var(--md-sys-color-surface-container-high);box-shadow:0 1px 0 var(--md-sys-color-outline-variant)}}
@keyframes coin-spin{from{transform:rotateY(0deg)}to{transform:rotateY(360deg)}}
@keyframes coin-drop{from{transform:translateY(-40px) rotate(-180deg);opacity:0}to{transform:none;opacity:1}}`;
