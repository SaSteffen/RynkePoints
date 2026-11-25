# Contract: Admin › Nutzung, the list's day rows

Changes to feature 048's "Das braucht deinen Blick" (048 contracts/usage-view.md). Everything not
named here stays.

## Day row

A day row (Strava calls, ride re-check, gateway routing) keeps its link and text and gains a form
after the link, in the same list item:

```html
<li class="lage-dismissable">
  <a class="settings-row" href="#routing">…unchanged…</a>
  <form method="post" action="/admin/dismiss" class="lage-dismiss" data-swap>
    <input type="hidden" name="kind" value="routing">
    <input type="hidden" name="day" value="2026-11-25">
    <input type="hidden" name="reason" value="possible">
    <button class="button-text" aria-label="Gesehen: Gateway-Routing: 25.11.2026">Gesehen</button>
  </form>
</li>
```

- One hidden `reason` per reason the row shows.
- The button's visible text is `admin.lage.dismiss`; its label `admin.lage.dismissLabel` with
  `{title}`, the row's title.
- Figure, CPU, team and device rows have no form (FR-002).

## After dismissing

- The row is gone from the viewer's list; the head's chips and the Admin tab's number count one
  less (FR-003).
- With no mark left the head reads "Alles im Rahmen", as with none (Story 1 scenario 2). State
  hints still show in the list as before.
- The day tables (Strava calls, re-check, routing) keep the day's Warnung mark (FR-005).

## Layout

The list item lays out link and form on one row; the link takes the space, the button keeps its
width and a 48 px touch target. At phone width the title wraps, the button stays at the end.

## Text (all ten catalogs, German the key source)

| Key | de | en |
|---|---|---|
| `admin.lage.dismiss` | Gesehen | Got it |
| `admin.lage.dismissLabel` | Gesehen: {title} | Got it: {title} |
