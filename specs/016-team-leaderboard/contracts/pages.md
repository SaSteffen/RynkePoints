# Contract: Page Structure

The mock-up "RynkePoints Team Leaderboard" (Claude Design) is the visual reference;
this file fixes what must be in the markup, in order. Classes are the hooks the
tests and `style.ts` use. Text comes from [messages.md](messages.md) unless noted.

## `/team`

The draft's look, section by section: colours come from the tokens in
`style.ts` (`--rp-push-*`, `--rp-ok-*`, `--rp-hero-*`, `--rp-road`, `--rp-bar`).

1. **Team total** `section.team-total`: a card on the coin's ink with its gold
   rim, the coin (front for Training, back for Team, 012) at 80 px on the left;
   beside it "Team Rynkeby Hamburg 🦧", "{n} Rynke" large in Rynkeby yellow,
   "collected together" (the coin says which kind) and "+{n} this week 🔥" (left
   out when 0).
2. **Kind switch** `nav.kind-switch`: one pill with two full-width links, each
   with its mini coin, the current one `aria-current="true"` in yellow.
3. **Place** `section.my-place` (left out when the viewer isn't listed): a
   yellow card with the place in a dark round badge, then "You're {place} of
   {count} riders 🚴" (with "joint" when shared) and "{n} Rynke to pass the
   next place", or "You lead the peloton. Bring the others along!" for 1st.
4. **Quote** `blockquote.quote.quote-push` or `.quote-on-track`, `lang="de"`:
   orange edge on a light orange card for push, green on the ok container for
   on track.
   - A heading "Für dich 🍌" / "Für dich 🤝" in small capitals is part of the
     quote list's meaning, so it comes from the catalog in each language
     ("For you").
   - One quote from `QUOTES_PUSH` or `QUOTES_ON_TRACK` (research R4, R10),
     bold, in German quotation marks. No footer under the quote (the draft's
     "Dein Tempo bis …" line is left out on purpose).
5. **Peloton** `figure.peloton`: heading "The peloton 🚴" and a one-line hint;
   a dark road with a dashed yellow middle line and one mini coin per other
   listed rider at its total's position in three lanes, the viewer as the
   coin's front at 40 px with a yellow "You" tag; `role="img"` and a catalog
   label (research R12). "Back of the bunch" and "Front 🏁" below. No
   threshold line (US2 scenario 3).
   - With a breakaway (FR-018, research R13): a slanted gap in the card's colour
     cuts the road; the breakaway riders' coins sit right of it in order of
     total, the bunch's to scale left of it. The hint, the label and the right
     end ("Breakaway 🏁") change to their breakaway text.
6. **Team chart** `figure.team-chart`: heading with the kind's mini coin on the
   right (its name for screen readers only), a
   one-line hint; one bar per week of the team total, the current week in
   yellow with an outline; the first week's date and "this week" below; "Best
   team week so far: +{n} in the week ending {date} 🔥" on the ok container; a
   `<details>` table of week end, team total and gain.
7. **Leaderboard** `section.leaderboard`: an outlined card, heading with
   "{count} riders listed" on the right and a one-line hint.
   - Toggle `nav.list-scope` ("Around you" / "Everyone") as two chips, only
     with more than seven rows.
   - "· · · {n} riders ahead · · ·" before and "· · · {n} riders behind · · ·" after
     the shown rows when some are hidden.
   - `ol` with `start` set to the first shown row's place; each `li.row` without
     a card of its own, the viewer's (`li.row.you`) in yellow:
     - medal 🥇🥈🥉 for places 1–3, otherwise the place number;
     - "You 🦧" on the viewer's row above a small sparkline SVG (research R12),
       nothing else that identifies anyone;
     - on the right the total with the mini coin, the other kind's total with
       its mini coin in small print below. No kind names are printed: each
       mini coin carries its kind's name (`rynke.training` / `rynke.team`) in
       a `span.visually-hidden`.

## `/organiser/riders`

The draft's "Organiser overview" boards (phone and desktop) give the look. The
page sits in the "Orga" tab (organisers only, left of Settings, current on every
`/organiser` page). First comes `nav.organiser-switch`: a pill like the kind
switch with "Riders" (`/organiser/riders`) and "Events" (`/organiser`), each
with its icon and the current one `aria-current="true"`. `/organiser` starts
with the same switch. Then the heading "Team overview".

1. **Deadline and qualified** `section.overview-deadline`: one card on the coin's
   ink with its gold rim, the coin's back at 72 px; "Qualification deadline ·
   {date}" small, "{n} days to go ⏳" large in Rynkeby yellow (or "The deadline
   has passed"), then "{n} of {count} reached their training goal 🎯".
2. **Group tiles** `nav.group-tiles`: links with the count large above the
   label: "Need a push 🍌" (or "Training goal not reached yet" once the deadline
   has passed), "On track 🚴" (only before the deadline), "Training goal reached
   🎯", "Everyone" (research
   R9). Two columns on a phone, four from 840 px; the picked tile (or the
   default one, `.default` without `group`) in yellow.
3. **Hint** (before the deadline only): "The tick on each bar marks the even pace
   to the deadline: today {training} Training and {team} Team." This is the text
   for the bars' ticks (FR-041).
4. **Cards** `ul.rider-cards` (below 840 px), one `li.rider-card.status-{status}`,
   the riders missing the most first (share missing of Training plus that of
   Team), then by first name:
   - first name linking to the corrections page, "View on Strava" link when
     another listed rider shares the first name (014 `withProfileLinks`), and a
     status chip (orange for push, green for on track, ink and yellow for in);
   - Training (yellow) and Team (Elbe blue) bars against the threshold with the
     even-pace tick, each under "{mini coin} Training {n} of {threshold}";
   - one chip per missing amount ("{n} Training to go", "{n} Team to go", "{n}
     outdoor Training to go"), orange with "· behind pace" when behind;
   - `<details>` "Where the Rynke come from": distance, elevation, each team-event
     kind, corrections, outdoor Training of its amount, virtual share (FR-033).
5. **Table** `table.rider-table` in `div.table-scroll` (from 840 px): one row per
   rider in the same order; columns first name, group, Training (figure and
   bar), Team (figure and bar), outdoor Training, still to go, distance,
   elevation, team events, corrections, virtual share.
6. **Qualified list** `section.qualified`: a card on the coin's ink, "Training
   goal reached 🎯", "Both thresholds and the outdoor share met." and one pill per rider
   with the mini coin; or "Nobody has reached the training goal yet." (FR-034).

With nobody listed, "No riders share their Rynke yet." stands in place of 3–6.

## Both

- 360 px wide without horizontal scrolling, light and dark (FR-040). The table
  scrolls inside its own container only from 840 px, where it fits.
- Controls are at least 44 px tall (011).
