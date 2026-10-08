// The site's whole stylesheet, inlined into every page by `layout()` (feature
// 011 research R4). No `url(` to another origin and no `@import` (FR-037).

export const STYLE = `body{font-family:system-ui,sans-serif;max-width:40rem;margin:0 auto;padding:1rem;line-height:1.5;color:#222}
header form{display:flex;gap:.5rem;justify-content:flex-end}
header button{background:none;border:1px solid #ccc;border-radius:.25rem;padding:.1rem .5rem;cursor:pointer}
header button[aria-current]{font-weight:bold;border-color:#fc5200}
a{color:#c43d00}
footer{margin-top:3rem}
footer img{height:1.5rem}
main{overflow-wrap:break-word}
.notice{border-left:.25rem solid #fc5200;background:#fff4ec;padding:.25rem 1rem;margin:1rem 0}
#install button{margin-right:.5rem}
.rynke-summary dd,.rynke-breakdown dd{margin:0 0 .5rem}
.rynke-events .event-not-counting{color:#666}
table.rides{width:100%;border-collapse:collapse}
table.rides th,table.rides td{padding:.25rem .5rem;text-align:left;vertical-align:top}
table.rides .num{white-space:nowrap;text-align:right}
tr.ride td{border-top:1px solid #ddd}
tr.ride-details td{padding-top:0;font-size:.875rem;color:#666}
tr.ride-details ul,tr.ride-details p{margin:.25rem 0}
tr.ride-details p.ride-strava{margin:0}
a.strava-activity{font-weight:700;text-decoration:underline}
.ride-name{overflow-wrap:anywhere;color:#333}
.ride-reasons{padding-left:1.25rem}
.tap{display:inline-flex;align-items:center;min-height:44px;min-width:44px}
[hidden]{display:none!important}
#notifications button{margin-right:.5rem}
nav.pager{display:flex;flex-wrap:wrap;gap:.5rem 1rem;margin-top:.5rem}
:root{--rp-part-1:#fc5200;--rp-part-2:#1f6fb2;--rp-part-3:#2a9d8f;--rp-part-4:#8e44ad;--rp-part-5:#c9a227;--rp-part-6:#6b6b6b;--rp-reached:#2e7d32;--rp-track:#e6e6e6}
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
@media (max-width:36rem){table.rides th,table.rides td{padding:.2rem .25rem}nav.pager{gap:.25rem .5rem}}`;
