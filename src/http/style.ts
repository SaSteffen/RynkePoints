// The site's whole stylesheet, inlined into every page by `layout()` (feature
// 011 research R4). The tokens of contracts/design-tokens.md come first; every
// other rule takes its colours from them through `var(--…)` (FR-031). No
// `url(` to another origin and no `@import` (FR-037).

/** The colour roles of the dark scheme, for the system setting and a choice. */
const DARK = `--md-sys-color-surface:#1a110e;--md-sys-color-surface-container-low:#231917;--md-sys-color-surface-container:#271d1a;--md-sys-color-surface-container-high:#322824;--md-sys-color-on-surface:#f1dfd9;--md-sys-color-on-surface-variant:#d8c2bb;--md-sys-color-outline:#a08d86;--md-sys-color-outline-variant:#53433e;--md-sys-color-primary:#ffb59b;--md-sys-color-on-primary:#5b1a00;--md-sys-color-primary-container:#812900;--md-sys-color-on-primary-container:#ffdbcf;--md-sys-color-secondary-container:#5d4035;--md-sys-color-on-secondary-container:#ffdbcf;--md-sys-color-error:#ffb4ab;--md-sys-color-error-container:#93000a;--md-sys-color-on-error-container:#ffdad6;--rp-ok-container:#1e4d22;--rp-on-ok-container:#b9f0b8;--rp-neutral-container:#3d322e;--rp-on-neutral-container:#d8c2bb;--rp-brand:#fc5200;--rp-part-1:#ff8f63;--rp-part-2:#8cc4f0;--rp-part-3:#6fd1c2;--rp-part-4:#d7a6ec;--rp-part-5:#e6c65a;--rp-part-6:#a8a8a8;--rp-reached:#81c784;--rp-track:#3d322e`;

/** Strava's images come in both variants; the scheme shows one (R13). */
const SHOW_DARK = (root: string) =>
	`${root} .pbs-light,${root} .cws-light{display:none}${root} .pbs-dark,${root} .cws-dark{display:inline}`;

const SYSTEM_DARK = ":root:not([data-scheme=light])";
const FIXED_DARK = ":root[data-scheme=dark]";

export const STYLE = `:root{color-scheme:light dark;--md-sys-color-surface:#fff8f6;--md-sys-color-surface-container-low:#fff1ec;--md-sys-color-surface-container:#fceae5;--md-sys-color-surface-container-high:#f6e5df;--md-sys-color-on-surface:#231917;--md-sys-color-on-surface-variant:#53433e;--md-sys-color-outline:#85736d;--md-sys-color-outline-variant:#d8c2bb;--md-sys-color-primary:#a63b00;--md-sys-color-on-primary:#ffffff;--md-sys-color-primary-container:#ffdbcf;--md-sys-color-on-primary-container:#380d00;--md-sys-color-secondary-container:#f7d6c9;--md-sys-color-on-secondary-container:#2c160d;--md-sys-color-error:#ba1a1a;--md-sys-color-error-container:#ffdad6;--md-sys-color-on-error-container:#410002;--rp-ok-container:#c8f0c4;--rp-on-ok-container:#0b3912;--rp-neutral-container:#f0dfd9;--rp-on-neutral-container:#53433e;--rp-brand:#fc5200;--rp-part-1:#fc5200;--rp-part-2:#1f6fb2;--rp-part-3:#2a9d8f;--rp-part-4:#8e44ad;--rp-part-5:#c9a227;--rp-part-6:#6b6b6b;--rp-reached:#2e7d32;--rp-track:#f0dfd9}
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
header.top-bar{display:flex;align-items:center;gap:var(--rp-space-2);min-height:calc(var(--rp-topbar-height) + env(safe-area-inset-top));padding:env(safe-area-inset-top) var(--rp-page-padding) 0;background:var(--md-sys-color-surface-container)}
header form{display:flex}
.wordmark{font:var(--md-type-title-large);margin-right:auto;color:var(--md-sys-color-on-surface)}
.wordmark span{color:var(--md-sys-color-primary)}
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
.placeholder{display:flex;flex-direction:column;align-items:center;gap:var(--rp-space-4);padding:var(--rp-space-6) var(--rp-space-6) 48px;text-align:center;color:var(--md-sys-color-on-surface-variant)}
.placeholder svg{width:96px;height:96px;padding:24px;border-radius:var(--md-shape-full);background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.placeholder h2,.placeholder p{margin:0}
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
nav.pager{display:flex;flex-wrap:wrap;gap:var(--rp-space-1) var(--rp-space-2);margin-top:var(--rp-space-2)}
figure.gauge{display:block;width:100%;margin:0}
figure.gauge figcaption{margin:0 0 var(--rp-space-2);font:var(--md-type-body)}
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
.gauge-key{display:inline-block;width:12px;height:12px;margin-right:var(--rp-space-1);border-radius:var(--md-shape-xs);vertical-align:middle}
.icon-button{display:inline-flex;align-items:center;justify-content:center;min-width:var(--rp-tap);min-height:var(--rp-tap);border-radius:var(--md-shape-full);color:var(--md-sys-color-on-surface-variant)}
nav.app-nav{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(4,1fr);height:calc(var(--rp-nav-height) + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom);background:var(--md-sys-color-surface-container);z-index:10}
nav.app-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--rp-space-1);min-height:var(--rp-tap);color:var(--md-sys-color-on-surface-variant);text-decoration:none;font:var(--md-type-label-small)}
nav.app-nav .nav-icon{display:flex;align-items:center;justify-content:center;width:64px;height:32px;border-radius:var(--md-shape-full);transition:background-color var(--rp-motion)}
nav.app-nav a[aria-current=page]{color:var(--md-sys-color-on-surface);font-weight:600}
nav.app-nav a[aria-current=page] .nav-icon{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
body.shell{padding-bottom:calc(var(--rp-nav-height) + env(safe-area-inset-bottom))}
@media (min-width:600px){:root{--rp-page-padding:32px;--rp-topbar-height:72px;--md-type-display:600 40px/48px var(--md-ref-typeface)}ol.ride-list{grid-template-columns:repeat(2,minmax(0,1fr))}.overview-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.overview-grid>*{grid-column:1/-1}.overview-grid>.card-outlined{grid-column:auto}.rynke-gauges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--rp-space-3)}.rynke-gauges>h2{grid-column:1/-1;margin:0}.rynke-gauges .card{margin:0}body.shell{position:relative;padding-bottom:0}h1.section-title{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}nav.app-nav{position:absolute;top:calc((var(--rp-topbar-height) - var(--rp-tap)) / 2 + env(safe-area-inset-top));right:calc(var(--rp-page-padding) + var(--rp-tap) + var(--rp-space-2));left:auto;bottom:auto;display:flex;gap:var(--rp-space-1);height:auto;padding:0;background:none}nav.app-nav a{flex-direction:row;gap:var(--rp-space-1);padding:0 var(--rp-space-3);border-radius:var(--md-shape-full);font:var(--md-type-label)}nav.app-nav .nav-icon{width:auto;height:auto}nav.app-nav a[aria-current=page]{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}nav.app-nav a[aria-current=page] .nav-icon{background:none}}
@media (prefers-reduced-motion:reduce){nav.app-nav .nav-icon,[role=switch]::after,.ride-why>summary::after{transition:none}}`;
