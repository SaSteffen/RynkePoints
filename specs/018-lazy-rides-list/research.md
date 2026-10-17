# Research: Lazy-Loading Rides List

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## R1 — Which rides come next: a sort key, not a page number

- **Decision**: the next batch is asked for by the sort key of the last ride
  shown, `after=<start_date>~<activity id>`, and the read takes the rides that
  sort after it in the list's order (`start_date DESC, strava_activity_id
  DESC`): `start_date < ?2 OR (start_date = ?2 AND strava_activity_id < ?3)`.
- **Rationale**: FR-007. With page numbers, a ride worked out between two loads
  pushes every ride one place down, so the first ride of the next page repeats
  the last one shown; a deleted ride does the opposite and one is skipped. A key
  is stable whatever happens above it. The activity id breaks ties between
  rides starting in the same second, as `RIDE_PAGE_SQL` already does.
- **Alternatives considered**: fetching `/me/rides?page=N` and taking its cards
  (no server change, but repeats and skips, and a whole page per batch);
  de-duplicating by activity id in the browser (still skips on deletion).

## R2 — What the batch route returns

- **Decision**: `GET /me/rides/more` returns an HTML fragment: one
  `<ol class="ride-list">` with the cards, carrying `data-more` with the next
  batch's URL when older rides follow. The cards come from the same
  `rideCard()` as the page.
- **Rationale**: FR-006 — one renderer means an added card can't drift from a
  page card, and all text stays on the server, in the catalogs (FR-018). The
  script appends the `<li>`s it parses; the next URL travels with the cards it
  belongs to.
- **Alternatives considered**: JSON rendered by the script (duplicates the card
  and its texts in app.js, which holds no text); a header for the next URL
  (splits one answer in two places).

## R3 — Who may ask

- **Decision**: the route applies `shellPage`'s rules without the shell: no
  session or a gone rider → `401`; not agreed to the current consent version →
  `403`; no balance yet (waiting state) → `409`; a bad `after` or `limit` →
  `400`. The script reloads the page on `401`, `403` and `409`, so the rider
  meets sign-in, the consent gate or the waiting state as Rides would show them;
  other failures show "couldn't load" (FR-009, FR-010).
- **Rationale**: a fragment can't show the gate itself, and a redirect would be
  followed by `fetch` into a whole page inside the list.
- **Alternatives considered**: redirecting like a page (the fetch follows it
  silently); answering `200` with nothing (hides a lost session).

## R4 — When to load

- **Decision**: an `IntersectionObserver` watches the status block under the
  list (`div.rides-more`) with `rootMargin: "0px 0px 100% 0px"`, so a batch is
  asked for when the end comes within one screen height (FR-002). One request
  at a time (FR-008). After a batch the block is observed afresh, so a short
  batch that leaves the end in reach loads the next at once. Without
  `IntersectionObserver` the script leaves the pager in place.
- **Rationale**: no scroll handlers, works for touch, wheel, keyboard and
  screen reader navigation alike, since each of them scrolls (FR-017).
- **Alternatives considered**: scroll events with a threshold (more work per
  frame, misses focus-driven scrolling in some browsers).

## R5 — Keeping the rider's place

- **Decision**: on `pagehide` the script stores in `sessionStorage`
  (`rp-rides-place`) the page's URL, how many cards are loaded, the activity id
  of the first card whose bottom is below the top bar, and that card's distance
  from the viewport top. When the page loads by a reload or the back/forward
  buttons (`performance.getEntriesByType("navigation")[0].type` is `reload` or
  `back_forward`) and the URL matches, it asks for the missing cards in one
  request (`limit` = loaded − shown, at most 1000) and scrolls that card back to
  the same distance. It sets `history.scrollRestoration = "manual"` while lazy
  loading is active, so the browser's own restore doesn't jump first. A load by
  a link or the navigation bar (`navigate`) starts at the top (FR-013). A page
  restored from the back-forward cache keeps its DOM and needs nothing.
- **Rationale**: clarification Q1 — per tab and visit, nothing on the server.
  The card's id comes from its "Auf Strava ansehen" link, so the card markup
  the tests read stays as it is. Restoring by count, not by key, means new
  rides arriving at the top don't need to be loaded twice: the anchor ride is
  found by id wherever it ends up.
- **Alternatives considered**: putting the batch in the address
  (`history.replaceState`), which turns the top bar's refresh and shared links
  into deep pages; fetching batch by batch on restore (one round trip per 20).
- **Note**: the top bar's refresh link is a `navigate` load and starts at the
  top, as a fresh visit, like feature 011 R8 describes it.

## R6 — Text and announcements

- **Decision**: the page renders, hidden, `p.rides-total` ("87 Fahrten in
  dieser Saison"), `p.rides-newest` with its link (only on page 2 and later), and
  `div.rides-more` with a `p.rides-status` (`role="status"`) whose
  `data-loading`, `data-failed` and `data-added` hold the three texts, and a
  hidden retry button. The script shows and hides them and sets the status text.
  The "added" text is visually hidden; loading and failed show with the busy
  spinner of the buttons.
- **Rationale**: app.js holds no text (feature 010 contracts/client.md); a
  status region announces without moving focus (FR-017).

## R7 — Opening a later page

- **Decision**: `?page=N` renders that page as today. Its list carries
  `data-more` from its last ride, and `p.rides-newest` links to `/me/rides`.
  Without the script the pager does the same job and the link stays hidden.
- **Rationale**: FR-014, FR-016; old addresses keep working unchanged.

## R8 — When a load fails

- **Decision**: the cards stay; the status shows the failed text and the retry
  button. A retry starts with the button, with the browser's `online` event, or
  when the end of the list comes into reach again (the observer reports it when
  the rider scrolls away and back).
- **Rationale**: FR-009 without polling.

## R9 — Cost of a batch

- **Decision**: one D1 batch: the 21 rides after the key (one more than shown,
  to know whether older rides follow), joined to their results and the
  overlapped ride like `RIDE_PAGE_SQL`, on `activities_by_rider`. The balance
  existence check runs before it. An `EXPLAIN QUERY PLAN` test asserts the index
  is used and no whole table is scanned, like feature 005 SC-005.
- **Rationale**: free tier, and SC-002's "never waits at reading speed".
