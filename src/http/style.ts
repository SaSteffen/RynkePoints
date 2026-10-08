// The site's whole stylesheet, inlined into every page by `layout()` (feature
// 011 research R4). No `url(` to another origin and no `@import` (FR-037).

export const STYLE = `body{font-family:system-ui,sans-serif;max-width:40rem;margin:0 auto;padding:1rem;line-height:1.5;color:#222}
header form{display:flex;gap:.5rem;justify-content:flex-end}
header button{min-height:var(--rp-tap);background:none;border:1px solid #ccc;border-radius:.25rem;padding:.1rem .5rem;cursor:pointer}
header button[aria-current]{font-weight:bold;border-color:#fc5200}
a{color:#c43d00}
footer{margin-top:3rem}
footer img{height:1.5rem}
main{overflow-wrap:anywhere}
main *{min-width:0}
.notice{border-left:.25rem solid #fc5200;background:#fff4ec;padding:.25rem 1rem;margin:1rem 0}
#install button{margin-right:.5rem}
.rynke-summary dd,.rynke-breakdown dd{margin:0 0 .5rem}
.rynke-events .event-not-counting{color:#666}
ol.ride-list{list-style:none;margin:0;padding:0;display:grid;gap:.75rem}
.ride-card{min-width:0;border:1px solid #ddd;border-radius:.75rem;padding:.75rem 1rem}
.ride-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem}
.ride-head>*{min-width:0}
.chip{display:inline-flex;align-items:center;min-height:2rem;padding:0 .75rem;border-radius:.5rem;border:1px solid #ccc;font-size:.875rem}
.ride-counting .chip{border-color:#2e7d32;color:#2e7d32}
.ride-not-counting .chip{color:#666}
dl.ride-figures{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem;margin:.5rem 0}
dl.ride-figures>div{min-width:0}
dl.ride-figures dt{font-size:.75rem;color:#666}
dl.ride-figures dd{margin:0;font-weight:600;white-space:nowrap}
.ride-card p{margin:.25rem 0}
.ride-meta{font-size:.875rem;color:#666}
.ride-why{font-size:.875rem}
.ride-why>summary{display:flex;align-items:center;min-height:var(--rp-tap);cursor:pointer;list-style:none}
.ride-why>summary::-webkit-details-marker{display:none}
.ride-why>summary::after{content:"";width:.5rem;height:.5rem;margin-left:.5rem;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);transition:transform .2s}
.ride-why[open]>summary::after{transform:rotate(-135deg)}
.ride-why ul,.ride-why p{margin:.25rem 0}
a.strava-activity{font-weight:700;text-decoration:underline}
.ride-name{overflow-wrap:anywhere;color:#333}
.ride-reasons{padding-left:1.25rem}
.tap{display:inline-flex;align-items:center;min-height:var(--rp-tap);min-width:var(--rp-tap)}
.button,.button-outlined,.danger{display:inline-flex;align-items:center;justify-content:center;min-height:var(--rp-tap);min-width:var(--rp-tap);padding:0 1rem;box-sizing:border-box}
.segmented,.segmented-group label{display:inline-flex;align-items:center;justify-content:center;min-height:var(--rp-tap);min-width:var(--rp-tap)}
[role=switch]{min-height:var(--rp-tap);min-width:var(--rp-tap)}
[hidden]{display:none!important}
#notifications button{margin-right:.5rem}
nav.pager{display:flex;flex-wrap:wrap;gap:.5rem 1rem;margin-top:.5rem}
:root{--rp-tap:44px;--rp-part-1:#fc5200;--rp-part-2:#1f6fb2;--rp-part-3:#2a9d8f;--rp-part-4:#8e44ad;--rp-part-5:#c9a227;--rp-part-6:#6b6b6b;--rp-reached:#2e7d32;--rp-track:#e6e6e6}
figure.gauge{display:block;width:100%;margin:0 0 1rem}
.gauge-bar{display:flex;height:1rem;background:var(--rp-track);border-radius:.25rem;overflow:hidden}
.gauge-part,.gauge-fill{display:block;height:100%;box-sizing:border-box}
.gauge-part+.gauge-part{border-left:2px solid #fff}
.gauge-fill,.gauge-part-1{background:var(--rp-part-1)}
.gauge-part-2{background:var(--rp-part-2)}
.gauge-part-3{background:var(--rp-part-3)}
.gauge-part-4{background:var(--rp-part-4)}
.gauge-part-5{background:var(--rp-part-5)}
.gauge-part-6{background:var(--rp-part-6)}
.gauge-reached .gauge-fill{background:var(--rp-reached)}
.gauge-legend{display:flex;flex-wrap:wrap;gap:0 1rem;list-style:none;margin:.25rem 0 0;padding:0;font-size:.875rem}
.gauge-key{display:inline-block;width:.75rem;height:.75rem;margin-right:.25rem;vertical-align:middle}
@media (max-width:36rem){nav.pager{gap:.25rem .5rem}}
header.top-bar{display:flex;align-items:center;gap:.5rem;padding-top:env(safe-area-inset-top)}
.wordmark{font-weight:700;margin-right:auto}
.wordmark span{color:#c43d00}
h1.section-title{flex:1;margin:0;font-size:1.375rem}
.icon-button{display:inline-flex;align-items:center;justify-content:center;min-width:var(--rp-tap);min-height:var(--rp-tap);border-radius:50%;color:inherit}
nav.app-nav{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(4,1fr);height:80px;padding-bottom:env(safe-area-inset-bottom);background:#fff;border-top:1px solid #ddd;z-index:10}
nav.app-nav a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:var(--rp-tap);color:#444;text-decoration:none;font-size:12px}
nav.app-nav .nav-icon{display:flex;align-items:center;justify-content:center;width:64px;height:32px;border-radius:16px;transition:background-color .2s}
nav.app-nav a[aria-current=page]{color:#222;font-weight:600}
nav.app-nav a[aria-current=page] .nav-icon{background:#ffdbcc}
body.shell main{padding-bottom:calc(80px + env(safe-area-inset-bottom))}
@media (min-width:600px){ol.ride-list{grid-template-columns:repeat(2,minmax(0,1fr))}body.shell{position:relative}body.shell main{padding-bottom:0}h1.section-title{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}nav.app-nav{position:absolute;top:calc(1rem + env(safe-area-inset-top));right:3.75rem;left:auto;bottom:auto;display:flex;gap:.25rem;height:auto;padding:0;border:0;background:none}nav.app-nav a{flex-direction:row;gap:.25rem;padding:0 .75rem;border-radius:22px;font-size:.875rem}nav.app-nav .nav-icon{width:auto;height:auto}nav.app-nav a[aria-current=page]{background:#ffdbcc}nav.app-nav a[aria-current=page] .nav-icon{background:none}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`;
