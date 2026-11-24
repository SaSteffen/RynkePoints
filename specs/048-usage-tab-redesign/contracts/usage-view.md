# Contract: Admin › Nutzung (`GET /admin`)

Administrators only, as today (`adminPage`). The page reads only D1 (feature 025
FR-027). Classes are Settings' (`src/http/sections/settings.ts`); the design
draft's boards 1–4 show the result.

## Order

Phone (one column) and desktop (`settings-page`, two `settings-col`):

1. Admin tab switch (`organiser-switch`), "Nutzung" with the mark count.
2. Across the top: the list or the calm block.
3. Left column: **Strava** (head "heute, UTC"), **Cloudflare** (head
   "Stand {time}").
4. Right column: **Betrieb** (head "letzte 30 Tage"), **Nutzungshinweise**.

On the phone the columns follow each other in that order.

## The list ("Das braucht deinen Blick")

```html
<section class="usage-lage" aria-labelledby="lage-h">
  <div class="lage-head">
    <span class="lage-badge is-{critical|warning|early|hint}">{icon}</span>
    <div><h2 id="lage-h">Das braucht deinen Blick</h2>
      <p class="lage-chips">
        <span class="usage-mark usage-mark-critical">1 kritisch</span>
        <span class="usage-mark usage-mark-warning">1 Warnung</span>
        <span class="usage-mark usage-mark-early">1 Hinweis</span></p></div>
    <form method="post" action="/admin/refresh"><button class="button-outlined">Jetzt aktualisieren</button></form>
  </div>
  <ul class="settings-list">
    <li><a class="settings-row" href="#cf_d1_rows_read">
      <span class="settings-icon lvl-critical">…</span>
      <span class="settings-text"><span class="settings-title">Gelesene Datenbankzeilen pro Tag</span>
        <span class="settings-sub">4.850.000 von 5.000.000 · Cloudflare, Stand 23.11.2026</span></span>
      <span class="settings-value">97 %</span></a></li>
    …
  </ul>
</section>
```

- Rows in attention order (data-model.md). A level with no item has no count
  chip. The badge icon follows the worst level.
- Figure rows: name, "{used} von {limit}" and source, percentage. Early rows say
  "über der Hinweisgrenze von {n} %".
- Day rows: "{table}: {day}" and the reason in one line (riders waited over
  24 hours / list in the wrong order; would-be miss / possible miss / too many
  events to every team; calls don't add up).
- CPU rows: "{owner}: Läufe abgebrochen", "{cut} von {runs} heute".
- Team hint: "Anderes Team hat nicht geantwortet" (or "… noch nie geantwortet"),
  "Seine Zahlen fehlen in allen Werten, bis es wieder antwortet." Several other
  teams are numbered as today ("Anderes Team 2"), never named.
- Device hint: "Du bekommst keine Nutzungshinweise", value "Einstellungen",
  linking to `/me/settings`.

**Calm** (no item at all): same section, badge `is-ok`, heading "Alles im
Rahmen", the calm line (research R10) and the refresh button; no list.

## Figure rows

```html
<li id="{allowance}" [class="is-quiet"]><details [open]>
  <summary class="settings-row meter usage-{level}">
    <span class="settings-icon [lvl-{level}]">{icon}</span>
    <span class="settings-text">
      <span class="settings-title">{name}{mark}</span>
      {thresholdBars(used, limit, null, [early, 80, 95])}
      <span class="settings-sub">{used} von {limit} · {whose}</span></span>
    <span class="settings-value">{percent} %</span></summary>
  <div class="settings-panel is-wide">
    <p>Hinweis ab {early} %, Warnung ab 80 %, kritisch ab 95 %.</p>
    {team split} {time seen} {history graph, Alle Tage}
  </div></details></li>
```

- Strava order: `strava_read_daily`, `strava_all_daily`, `strava_read_15m`,
  `strava_all_15m`, `riders_connected`. Cloudflare: `cf_worker_requests`,
  `cf_queue_operations`, `cf_d1_rows_read`, `cf_d1_rows_written`,
  `cf_d1_storage_bytes`. Fixed.
- `{mark}`: `<span class="usage-mark usage-mark-{level}">{Hinweis|Warnung|Kritisch}</span>`, none when fine.
- `{whose}`: Strava daily and riders "Dieses Team {n} · Anderes Team {m}" (or
  "Anderes Team: keine Zahlen"); 15 minutes "nur dieses Team"; Cloudflare "ganzes
  Konto".
- `is-quiet`: 15-minute rows at 0 %; hidden below Settings' breakpoint.
- A Cloudflare figure without a value: row with name and "Noch kein Wert ·
  Limit {limit}", no bar value, no mark. If Cloudflare is unavailable, the
  group's note says so (today's text).
- Notes (`settings-note`) under Strava and Cloudflare keep today's texts; the
  Strava note adds the phone-only "Bei 0 % sind sie ausgeblendet." when a row
  is quiet.
- `?days={allowance}` opens that row with its "Alle Tage" list, as today.

## Betrieb rows

`<li id="{id}"><details><summary class="settings-row">icon, title + mark, one
line, optional value</summary><div class="settings-panel is-wide">{today's
section body}</div></details></li>`, always all five:

| id | Title | One line | Value |
|---|---|---|---|
| `waiting` | Warten auf das Strava-Budget | "Nichts wartet." / "{n} Einträge warten, fertig in etwa {time}." | n, when > 0 |
| `strava-calls` | Strava-Aufrufe | "Heute {n} Aufrufe dieses Teams · {m} zurückgehalten" / "nichts zurückgehalten" | — |
| `recheck` | Nachprüfung der Fahrten | "{allowance} Prüfungen am Tag · {riders} aktive Rider · {last run or noch nicht gelaufen}" | — |
| `routing` | Gateway-Routing | "Noch keine Zahlen" / "Heute {copy} weitergegeben, keine Auffälligkeit" | — |
| `cpu` | CPU-Zeit der Worker | "Noch keine Zahlen · Limit 10 ms je Lauf" / "Heute {cut} von {runs} Läufen abgebrochen" | — |

- Mark on the summary: the highest of today's (CPU) or today's and yesterday's
  (day tables) marks.
- `?calls={day}` opens `strava-calls` with that day's breakdown, as today.

## Nutzungshinweise

```html
<section class="settings-section" id="alerts"><h2>Nutzungshinweise</h2>
<ul class="settings-list"><li><form method="post" action="/admin/alerts">
  <div class="settings-row is-static">
    <span class="settings-icon">{bell}</span>
    <span class="settings-text"><span class="settings-title" id="alerts-on">Benachrichtigung bei Hinweis, Warnung und kritisch</span>
      <span class="settings-sub [is-warn]">{levels explanation | no-device line}</span></span>
    <input type="hidden" name="admin_alerts" value="{on|off}">
    <button role="switch" aria-checked="{true|false}" aria-labelledby="alerts-on"></button>
  </div></form></li></ul>
<p class="settings-note">Die Aufzeichnung begann am {date}.</p></section>
```

## Script

`public/app.js` opens the `details` whose `li` id equals the URL hash, on load
and on `hashchange`, and scrolls it into view. No other behaviour.

## Gone

`overviewSection` ("Alle Teams"), `summary()` and its notices, the separate team
notices and the no-device notice above the figures, and the card sections. Their
catalog keys go from all ten catalogs.
