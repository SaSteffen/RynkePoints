# Contract: Page Structure

The mock-up "RynkePoints Team Leaderboard" (Claude Design) is the visual reference;
this file fixes what must be in the markup, in order. Classes are the hooks the
tests and `style.ts` use. Text comes from [messages.md](messages.md) unless noted.

## `/team`

1. **Team total** `section.team-total`
   - The coin of the picked kind (front for Training, back for Team, 012).
   - The team total, "+{n} this week 🔥" (no badge when 0).
2. **Kind switch** `nav.kind-switch` with two links, the current one
   `aria-current="true"`.
3. **Place** `section.my-place` (left out when the viewer isn't listed)
   - "You're {place} of {count} riders 🚴", with "joint" when shared.
   - "{n} Rynke to pass the next place", or "You lead the peloton. Bring the
     others along!" for 1st.
4. **Quote** `blockquote.quote.quote-push` or `.quote-on-track`, `lang="de"`
   - A heading "Für dich 🍌" / "Für dich 🤝" is part of the quote list's meaning,
     so it comes from the catalog in each language ("For you").
   - One quote from `QUOTES_PUSH` or `QUOTES_ON_TRACK` (research R4, R10).
5. **Peloton** `figure.peloton`: an SVG road with one mini coin per listed rider at
   its total's position, the viewer's coin larger with "You"; `role="img"` and a
   catalog label (research R12). No threshold line (US2 scenario 3).
6. **Leaderboard** `section.leaderboard`
   - Toggle `nav.list-scope` ("Around you" / "Everyone"), only with more than
     seven rows.
   - "· · · {n} riders ahead · · ·" before and "· · · {n} riders behind · · ·" after
     the shown rows when some are hidden.
   - `ol` with `start` set to the first shown row's place; each `li.row`:
     - medal 🥇🥈🥉 for places 1–3, otherwise the place number;
     - "You 🦧" on the viewer's row (`li.row.you`), nothing else that identifies
       anyone;
     - total with the mini coin, the other kind in small print;
     - sparkline SVG (research R12).
7. **Team chart** `figure.team-chart`: one bar per week of the team total, the
   current week highlighted, "Best week: {date} (+{n})"; a `<details>` table of
   week end, team total and gain.
8. **Organiser entry** `p.organiser-entry` (organisers only).

## `/organiser/riders`

1. **Deadline card**: deadline date and "{n} days to go", "The deadline has
   passed", or "No deadline set yet".
2. **Qualified card**: "{n} of {count} in for Paris 🗼".
3. **Group tiles** `nav.group-tiles`: "Need a push 🍌" (or "Not yet in" without a
   running deadline), "On track 🚴" (only with a running deadline), "In for Paris
   🗼", "Everyone", each with its count (research R9).
4. **Cards** `ul.rider-cards` (below 840 px), one `li.rider-card.status-{status}`:
   - first name linking to the corrections page, "View on Strava" link when
     another listed rider shares the first name (014 `withProfileLinks`);
   - Training and Team bars against the threshold with the even-pace mark;
   - missing amounts (Training, Team, outdoor Training), "behind pace" marked;
   - `<details>` breakdown (FR-033).
5. **Table** `table.rider-table` (from 840 px): one row per rider; columns first
   name, group, Training, Team, outdoor Training, each missing amount, distance,
   elevation, team events, corrections, virtual share.
6. **Qualified list** `section.qualified`: first names of riders who qualify, or a
   line saying nobody qualifies yet (FR-034).

## Both

- 360 px wide without horizontal scrolling, light and dark (FR-040). The table
  scrolls inside its own container only from 840 px, where it fits.
- Controls are at least 44 px tall (011).
