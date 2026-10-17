# Contract: the Abzeichen section

Part B (see [../plan.md](../plan.md)). The layout of
[../drafts/abzeichen-mobile.png](../drafts/abzeichen-mobile.png) and
[../drafts/abzeichen-desktop.png](../drafts/abzeichen-desktop.png) as markup the
tests check. Text in quotes is the German catalog text; class names and
attributes are the contract.

## Where

Its own section `/me/badges` ("Abzeichen"), between Rides and Orga/Settings
in the navigation: the rider's own badges, then the team's. While the waiting
state shows, or for a rider without a balance, the page shows only the waiting
state, as Rides does (FR-005). The Overview and the Team page have no badges.

The reveal is not inside the section: it sits at the top of the page, before
it, with new own badges and new team badges together.

## Markup

```html
<section class="badges" aria-labelledby="badges-heading">
  <h2 id="badges-heading" class="visually-hidden">Abzeichen</h2> <!-- the top bar already says it -->

  <!-- the personal group first -->
  <section class="badge-group badge-group-personal" aria-labelledby="…">
    <h3>Meine Abzeichen</h3>
    <ul class="badge-cards">
      <li class="badge-card" data-category="distance">
        <h4>Distanz</h4>                       <!-- the category's name, bold -->
        <p class="badge-about">Alle Kilometer deiner Radfahrten in dieser Saison, die für Trainings-Rynke zählen.</p>
        <button class="badge" popovertarget="badge-distance-1000" aria-label="Hamburg–Paris, 1.000 km">
          <img src="/badges/distance-1000-ribbon.svg" alt="" loading="lazy" width="200" height="200">
          <span class="badge-ribbon-text">1.000 km</span>
        </button>
        <div class="badge-progress">          <!-- absent when the category is complete (FR-004) -->
          <span class="badge-next">Nächstes Abzeichen</span>   <!-- "Erstes Abzeichen" on a card without a badge -->
          <span class="bar"><span style="width:33%"></span></span>
          <span class="badge-missing">Noch 1.500 km</span>
        </div>
      </li>
      <!-- after the cards with a badge, in catalog order: a category without one -->
      <li class="badge-card badge-card-empty" data-category="running">
        <h4>Laufen gesamt</h4>
        <p class="badge-about">Alle Kilometer deiner Läufe in dieser Saison, …</p>  <!-- also on phones -->
        <span class="badge-slot" aria-hidden="true"></span>                       <!-- dotted outline, card width up to 200 px -->
        <div class="badge-progress">…<span class="badge-missing">Noch 10 km</span></div>
      </li>
    </ul>
    <!-- the gallery only once the group has a badge -->
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

  <!-- then the team group: -->
  <section class="badge-group badge-group-team">…"Team-Abzeichen", "Alle Team-Abzeichen (5)"…</section>

  <!-- one popover per earned badge, outside the cards -->
  <div popover id="badge-distance-1000" class="badge-large">
    <button type="button" class="icon-button badge-large-close" popovertarget="badge-distance-1000" popovertargetaction="hide" aria-label="Schließen">…</button>
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
- **Not yet**: one `li.badge-card.badge-card-empty` per category of the
  page's group without an earned badge, after the other cards, with the group's
  bar colour; the gallery is left out while the group has no badge.
- **Large view**: a `popover` per earned badge, opened by its buttons (tap,
  click, keyboard); with a mouse also on hover (`public/app.js`). It fits 360 px
  (FR-002b). A close button (×) sits in its top right corner, except while
  hover holds it open (`.badge-large-hover`): then it floats beside the mouse
  and follows it, and leaving the badge closes it.
- **Reveal**: present only when badges of the page's group are new for this
  rider, at the top of the page next to the coin celebration; a GET writes
  their `badge_reveals`, a HEAD doesn't (like `rynke_seen`); honours reduced
  motion (feature 012).
- **Sizes**: cards as wide as they allow, up to 200 px; 96 px gallery, 280 px popover (FR-002a/b); two cards
  per row at every width; below 600 px only cards without a badge keep the
  category sentence; no
  horizontal scrolling (SC-005).

## Part C: winter months and decimals (2026-10-12)

- **Winter month over** (FR-004a, research R25): once today's Berlin date is
  past the last day of a winter category's month in this season, its card has
  no `.badge-progress`, earned or not. Without a badge the
  `li.badge-card.badge-card-empty` stays, with its outline and its sentence,
  and no bar. Before and during the month, both behave like any other
  category.
- **Decimals** (research R28): the ribbon, the gallery value and "Noch …" show
  one decimal for run length, swim length and swimming ("1,9 km", "Noch 0,7
  km"); every other category whole units.
- **Days**: winter categories read "Noch 4 Tage", "Noch 1 Tag"; their ribbons
  "5 Tage".

## Part D: surprise badges (2026-10-12)

- The "Überraschungen" card: `<p class="badge-about">?</p>` under its name, in
  the card and the gallery; never a `.badge-progress`. With a badge it shows
  the newest earned surprise badge with `badges.surprise.<name>` on the ribbon;
  without one the dotted outline.
- The gallery lists the earned surprise badges newest first, then one
  `li.badge-slot` per surprise badge still to earn.
- A surprise badge's large view says `badges.surprise.<name>.for` instead of
  the category's `badges.for.*`.
- No unearned surprise badge's id, name, picture, ribbon or why-text is in the
  HTML (SC-003).


## Part F: surprise badges from cycling traditions (2026-10-14)

No markup change. The gallery shows one `li.badge-slot` per surprise badge
still to earn, now up to thirteen for "Überraschungen" and seven for
"Team-Überraschungen"; the rules of Part D hold for the eight new badges,
including that nothing of an unearned one reaches the HTML (SC-003).


## Part G: aligned cards, the sentence in the outline, the next badge (2026-10-17)

The look follows the Claude Design mock-up "RynkePoints Badges"
(https://claude.ai/artifact/7iWpX7C5ero9BjnbAACnDM). Supersedes the card
markup above where they differ.

```html
<li class="badge-card" data-category="distance">
  <h4>Distanz</h4>                              <!-- no sentence: the picture fills the circle -->
  <button class="badge" …>…</button>
  <div class="badge-progress">
    <span class="badge-next">Nächstes Abzeichen</span>
    <span class="bar" aria-hidden="true"><span style="width:40%"></span></span>
    <span class="badge-missing">Noch 1.500 km</span>
  </div>
</li>
<li class="badge-card badge-card-empty" data-category="run_length">
  <h4>Längster Lauf</h4>
  <div class="badge-slot">
    <svg class="badge-outline" viewBox="0 0 100 100" aria-hidden="true"><use href="#badge-shape"/></svg>  <!-- circle and ribbon -->
    <p class="badge-about">Dein längster Lauf am Stück, draußen.</p>     <!-- the sentence above the ribbon -->
  </div>
  <div class="badge-progress"><span class="badge-next">Erstes Abzeichen</span>…</div>
</li>
```

- **Rows**: a card spans three rows of the shared subgrid (name, badge or
  outline, progress), each child placed in its row, so badges, outlines and
  bars line up across a row at every width. This replaces "below 600 px only
  cards without a badge keep the category sentence".
- **Outline**: a badge still to earn, on a card and in the gallery
  (`li.badge-slot`), is the silhouette of a round badge (r 42 of 100, a little
  inside where the petals reach, so the tails stand out) with the milestone
  ribbon's tails: only its outer
  edge, dashed, nothing inside. The ribbon is `scripts/badge-frame.mjs`'s
  (`RIBBON.box`, `RIBBON.tail`, mirrored in `src/badges/outline.ts`, kept
  equal by `test/unit/badge-outline.test.ts`). The section defines the shape
  once (`<g id="badge-shape">` in a hidden `svg.badge-shape-defs`); each
  outline uses it twice, a dashed stroke and over it a fill in the ground's
  colour, which hides the inner half of every edge, so the band's own edges
  inside the circle don't show. In the gallery, whose badges have no ribbon,
  the outline is the dashed circle alone (`#badge-circle`, r 47, the badges'
  full size). No id, name or
  picture of the badge (SC-003).
- **Sentence**: inside the outline of a card without a badge, 15 px,
  hyphenated, every line inside the circle; the surprise categories' "?"
  large. The sentences are short (about 35 characters, so they fit from
  320 px up, in every language) and leave out "in dieser Saison": the whole
  page is the season's. A card with a badge has none, and neither has its
  large view, which already says what the badge was for; the gallery keeps
  it under each category's name.
- **Next badge**: "Nächstes Abzeichen" above the bar on a card with a badge,
  "Erstes Abzeichen" on one without (`badges.next`, `badges.first`). "Noch
  {missing}" stays below. Still no name, picture or threshold of the next
  badge (FR-003, SC-003).
- **Label**: `.badge-next` and `.badge-missing` in the small label size
  (12 px), regular weight and the muted colour, so both stay below the card's
  bold 14 px name; the progress keeps 12 px of space to the badge above.
- **Stickers** (both schemes): badge pictures get a 2 px cut-out edge in
  `#fffdf5` with a soft shadow (`--rp-badge-edge`, darker shadow in the dark
  scheme), which also keeps their black ring and ribbon apart from the dark
  card. A badge button is tilted by `--tilt`, its own angle from its id,
  2 to 6° either way in tenths (`tiltOf`), the same on card and gallery and on
  every visit; it straightens on hover and keyboard focus. The large view
  stays upright. New badges in the reveal land with `badge-slap` (too big,
  then a small wobble) instead of `badge-pop`.
- **Sticker effects** (feature 013 Part H, 2026-10-17): the button carries
  its picture as `--badge-src`, and a glossy band (`--rp-badge-shine`) masked
  to that picture sweeps across it on hover and keyboard focus
  (`badge-shine`). While pressed it lifts and tips up in 3D, as if being
  peeled (`perspective(480px) rotateX(16deg) rotateY(-10deg) scale(1.05)`,
  `--rp-badge-lift`). A badge earned today or yesterday (Berlin dates; the
  section's `freshSince` is the day before today) is `button.badge.badge-fresh`:
  four small yellow stars twinkle around it (`span.badge-sparkles`,
  `aria-hidden`), and its shine plays once on its own after the page loads
  (`badge-shine-new`). Reduced motion: no shine, no tip, the stars stand
  still.
- **Ribbon text** (supersedes its colour above): on personal badges the
  milestone is `#f7e27c` (`--rp-ribbon-text`), a softer, paler yellow than
  the ribbon's `#fbe122`, in weight 600 with 0.04em letter-spacing and a faint
  glow (`text-shadow: 0 0 2px` at 25 %), so it doesn't glare on the black
  band. Team ribbons keep `#1c1b13` without the glow. The badge pictures and
  the app's yellow stay as they are.
