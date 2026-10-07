# Contract: name and link in the ride table

This extends 005's [rider-page.md](../../005-rider-view/contracts/rider-page.md),
section `section#rides`. Everything not listed here is unchanged: the main row,
the pager, the reasons, unknown figures and the fix hint. The example is in
German, as tests use.

## Detail row

Each ride keeps its two rows. The detail row now starts with
`p.ride-strava`:

```html
<tr class="ride counts">…unchanged main row…</tr>
<tr class="ride-details"><td colspan="5"><p class="ride-strava"><span class="ride-name">Rund um den Sorpesee &lt;3</span> <a class="tap strava-activity" href="https://www.strava.com/activities/8000001">View on Strava</a></p>Rennrad · 640 m<ul class="ride-reasons">…</ul></td></tr>
```

Rules:

| Rule | Requirement |
|---|---|
| `span.ride-name` is present only when the stored name is not `NULL`. With no name, there is no span and no placeholder text; the paragraph holds only the link. | FR-005 |
| The name is HTML-escaped text inside the span, never in an attribute and never inside the `a`. | FR-009, FR-010 |
| `a.strava-activity` is present for every ride: counts, does not count, being evaluated, private, unnamed. | FR-011 |
| `href` is exactly `https://www.strava.com/activities/<strava_activity_id>`. There are no `target` or `rel` attributes, so it opens in the same tab (research R4). | FR-009 |
| The link text is `brand.viewOnStrava` in every language. | FR-009, FR-012 |
| The link carries `tap`, a 44 px tap height. | FR-013 |

## CSS (`src/http/html.ts`)

```css
tr.ride-details p.ride-strava{margin:0}
.ride-name{overflow-wrap:anywhere;color:#333}
a.strava-activity{font-weight:700;text-decoration:underline}
```

The link inherits the detail row's `.875rem` and is never larger than the text
around it (FR-009). It is bold and underlined, not orange (research R5). Because
of `overflow-wrap:anywhere`, a 100-character name without spaces still fits
360 px (SC-007).

## Not shown

No name appears on any other page or in any other section of `/me`: not on the
greeting, notices, gauges, breakdown, rules, consent, disconnect, landing,
notice or admin pages. The overlap reason (005 FR-042) keeps showing the other
ride by date, time and distance.
