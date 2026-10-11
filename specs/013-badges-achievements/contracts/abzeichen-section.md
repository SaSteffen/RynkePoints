# Contract: the Abzeichen section

Part B (see [../plan.md](../plan.md)). The layout of
[../drafts/abzeichen-mobile.png](../drafts/abzeichen-mobile.png) and
[../drafts/abzeichen-desktop.png](../drafts/abzeichen-desktop.png) as markup the
tests check. Text in quotes is the German catalog text; class names and
attributes are the contract.

## Where

On the Overview (`/me`, "Du") with the rider's own badges only: after the
Rynke figures, inside the existing `overview-grid`, spanning its full width.
Not rendered while the waiting state shows (FR-005), nor for a rider without a
balance.

On the Team page (`/team`) with the team's badges only: after the
leaderboard, for every signed-in rider.

The reveal is not inside the section: it sits at the top of the page, on the
Overview right after feature 012's coin celebration (new own badges), on the
Team page right after the reconnect notice (new team badges).

## Markup

```html
<section class="badges" aria-labelledby="badges-heading">
  <h2 id="badges-heading">Abzeichen</h2>
  <p class="badges-intro">Wie weit es noch bis zum nächsten Abzeichen ist – welches es wird, bleibt geheim.</p>

  <!-- one group: personal on the Overview, team on the Team page -->
  <section class="badge-group badge-group-personal" aria-labelledby="…">
    <h3>Meine neuesten Abzeichen</h3>
    <ul class="badge-cards">
      <li class="badge-card" data-category="distance">
        <h4>Distanz</h4>                       <!-- the category's name, bold -->
        <p class="badge-about">Alle Kilometer deiner Radfahrten in dieser Saison, die für Trainings-Rynke zählen.</p>
        <button class="badge" popovertarget="badge-distance-1000" aria-label="Hamburg–Paris, 1.000 km">
          <img src="/badges/distance-1000-ribbon.svg" alt="" loading="lazy" width="128" height="128">
          <span class="badge-ribbon-text">1.000 km</span>
        </button>
        <div class="badge-progress">          <!-- absent when the category is complete (FR-004) -->
          <span class="bar"><span style="width:33%"></span></span>
          <span class="badge-missing">Noch 1.500 km</span>
        </div>
      </li>
    </ul>
    <details class="badge-gallery">
      <summary>Alle meine Abzeichen (14)</summary>
      <h4>Distanz</h4>
      <p class="badge-about">Alle Kilometer deiner Radfahrten in dieser Saison, die für Trainings-Rynke zählen.</p>
      <ul>
        <li><button class="badge" popovertarget="…"><img src="/badges/distance-1000.svg" alt="" loading="lazy" width="96" height="96"></button>
            <span class="badge-value">1.000 km</span></li>
        <!-- one per badge of the category still to earn: an empty dotted outline -->
        <li class="badge-slot" aria-hidden="true"></li>
      </ul>
    </details>
  </section>

  <!-- on the Team page instead: -->
  <section class="badge-group badge-group-team">…"Team-Abzeichen", "Alle Team-Abzeichen (5)"…</section>

  <section class="badge-not-yet" aria-labelledby="…">
    <h3>Noch kein Abzeichen</h3>
    <ul><li class="badge-not-yet-row badge-group-personal"><span class="badge-category">Höhenmeter</span> <span class="badge-about">Alle Höhenmeter deiner Radfahrten …</span> <span class="bar">…</span> Noch 380 m</li></ul>
  </section>

  <!-- one popover per earned badge, outside the cards -->
  <div popover id="badge-distance-1000" class="badge-large">
    <span class="badge"><img src="/badges/distance-1000-ribbon.svg" alt="" width="280" height="280"><span class="badge-ribbon-text">1.000 km</span></span>
    <h4>Hamburg–Paris</h4>
    <p>Du bist in dieser Saison 1.000 km Rad gefahren.</p>
    <p>erreicht am 3. Mai 2026</p>
  </div>
</section>
```

The reveal, at the top of the page (research R16):

```html
<aside class="badges-reveal" role="status">…new badges, names, one celebration…</aside>
```

## Rules the tests check

- **Order**: cards by the date their badge was earned, newest first (US1
  scenario 8); gallery groups in catalog order, badges newest first inside.
- **Images**: `/badges/<id>-ribbon.svg` on cards and in popovers,
  `/badges/<id>.svg` in the gallery, `/badges/placeholder-<group>[-ribbon].svg`
  when `BADGE_PICTURES` lacks the id. Only earned badges appear anywhere: no
  unearned badge id, name or picture is in the HTML (SC-003).
- **Ribbon text**: `.badge-ribbon-text` sits over the image at the ribbon box of
  `src/badges/ribbon.ts` (left 13 %, top 70 %, width 74 %, height 14 %), in
  `#fbe122` on personal and `#1c1b13` on team badges; long milestones shrink to
  fit (FR-040b).
- **Progress**: the bar's fill is `value / next` clamped to 0 to 100 %; yellow
  for personal, team blue for team (FR-002c); the text is "Noch {missing}" in the
  category's unit, rounded down, never "Noch 0 …" (spec Assumptions). Never the
  next badge's name, picture or the number of badges left (FR-003).
- **Gallery**: `<details>` without `open`; its count is the number of earned
  badges in the group. It has every category of the group, also those without
  a badge yet; each lists its earned badges, then one empty `li.badge-slot` per
  badge still to earn, with no id, name, picture or text (issue #109).
- **Not yet**: one row per category of the page's group without an earned
  badge, with the group's bar colour.
- **Large view**: a `popover` per earned badge, opened by its buttons (tap,
  click, keyboard); with a mouse also on hover (`public/app.js`). It fits 360 px
  and, on wider screens, opens beside the badge (FR-002b).
- **Reveal**: present only when badges of the page's group are new for this
  rider, at the top of the page next to the coin celebration; a GET writes
  their `badge_reveals`, a HEAD doesn't (like `rynke_seen`); honours reduced
  motion (feature 012).
- **Sizes**: 128 px cards, 96 px gallery, 280 px popover (FR-002a/b); two cards
  per row at 360 px, four at 1100 px; no horizontal scrolling (SC-005).
