# Contract: Pages

What each page shows, in order. The look is the Claude Design mock-up
"RynkePoints Teamtermine melden" (https://claude.ai/artifact/68rCYVhqbt4QyHFqAXQvMC);
board names in brackets. Text keys are in [messages.md](messages.md). Every
control is at least 44 px tall and every page fits 360 px (FR-051).

## Navigation (all signed-in pages)

- Riders who aren't organisers: Team, Du, Fahrten, Abzeichen, **Termine**,
  Einstellungen. Organisers: the same with **Orga** instead of Termine
  (research R8).
- Organisers with open requests: a red count on Orga (`9+` above 9); its
  accessible name includes "n offene Meldungen". Nothing when 0 (FR-030).

## `/events` — Termine (board "Rider · neuer Tab „Termine“")

1. Title "Teamtermine 📅", "bis {deadline}" beside it.
2. Note: "Melde dich hier selbst an" — the app can't take participation from
   Spond or Strava yet (FR-003).
Only refusals show a notice above the title; a report or withdrawal shows
none, the button already says it.

3. "Demnächst" (bold, larger than body text, like "Vorbei"), then — only if there are upcoming events — the line that "Bin
   dabei" only tells the organisers (FR-007); without upcoming events "Noch sind
   keine Teamtermine geplant."
4. One card per upcoming event, soonest first: date block (weekday, day, month),
   kind, name, then chips "+n Team" and "+n Training" with the coins. Every card
   has the same background. At the card's right, vertically centred, a round
   button of 48 px with a caption under it (amended 2026-11-12, draft "Event
   Button Draft" variant D, https://claude.ai/artifact/RzVXMGRLs184xmL6xC3t4J; it
   was a wide labelled pill that grew after a tap). The circle and its caption
   keep the same size in every state; the card keeps room for them, so names
   and chips wrap beside them. The circle shows only an icon; its accessible
   name is the full text. Hover (only where the pointer can hover) or keyboard
   focus shows what a click leads to; a touch screen shows no hover state:
   - no report: plus in a yellow circle, "Dabei?"; hover green with a tick (form,
     research R6); name "Bin dabei";
   - intent: tick in a green circle, "Dabei"; hover red with a cross; name
     `events.joined.label`.
5. "Vorbei", newest first, five then "Alle zeigen": the same card, with
   - no attendance, no report: plus in a green-outlined circle, "Dabei?"; hover
     green with a tick; name "Ich war dabei";
   - request: tick in a green circle, "Gemeldet"; hover red with a cross (form,
     like the intent; amended 2026-11-12, it had `aria-disabled` and no form);
     name `events.reported.label`;
   - attendance: tick in a light green circle, "Eingetragen", no button; screen
     readers hear "Du warst dabei".
   The caption is hidden from screen readers; it repeats what the name says.
6. Each card has `id="event-{id}"` so a post returns to it.

No sums of Rynke, nothing about other riders (FR-003, FR-010).

## `/team` — Team (board "Rider · Team ohne Position und Peloton")

With Team Rynke (`?kind=team`): team total, Training/Team switch, quote,
Rangliste (016 FR-012–FR-015), team chart. No place card, no peloton (FR-045,
FR-046). Training keeps feature 016's page unchanged.

## `/organiser` — Orga › Termine (board "Orga · Termine")

1. Orga switch Rider | Termine, Termine current, with the red count (FR-030).
2. Notice of the last decision with **Rückgängig**, if any (FR-032).
3. If there are open requests: "n offene Meldungen ⏳" — "Rider sagen, sie waren
   dabei – bei n Terminen"; per event (newest first) a compact card: kind and
   date as the link to the event (accessible name ends "Termin öffnen"), "Alle
   n eintragen" beside it when there are several, then one row per rider (first
   name, "Auf Strava ansehen" when names clash) with **Eintragen** and **✕**
   (accessible name "Meldung von {name} ablehnen") (FR-031). The cards sit in
   a grid: one column on a phone held upright, two from about 640 px (phone
   landscape, desktop).
4. "Teamtermine dieser Saison", "Neuer Termin" (014).
5. "Demnächst": each event with "n zugesagt" when there are intents (FR-033).
6. "Vorbei": each event with "n Personen" or "n Personen, inklusive dir", the
   chip "⏳ n offen" when it has open requests, and "Ich war auch dabei" when
   the viewer isn't recorded (FR-033, FR-036).

## `/organiser/events/{id}` — event page (boards "Orga · Termin bearbeiten")

014's form, then "Wer war dabei?" (past) or "Wer kommt?" (upcoming) with the
count, then:

1. The legend: three example boxes, "Leer – nicht dabei", "Grau – Meldung, noch
   offen" ("zugesagt" for an upcoming event), "Haken – dabei, gibt Rynke".
2. Past: "Alle n Meldungen eintragen" when there are several open requests.
3. The riders, those with a report first; tags "Meldung offen", "wird
   eingetragen", "wird abgelehnt" (or "zugesagt", upcoming).
4. Past: "Teilnahme speichern" and a live line "Meldungen: n werden eingetragen,
   n abgelehnt, n offen", kept current by the script.

Each requested rider's box is a `role="checkbox"` button with
`aria-checked="mixed"` and a hidden `decide-{id}` field that the script cycles.
*(Changed 2026-10-19: the radios that stood in without script are gone; the app
requires JavaScript, constitution v2.2.0.)*

## `/organiser/riders` — overview (board "Orga · Rider-Tabelle")

- The desktop table's columns: Wer, Gruppe, **Rynke** (Training's bar above
  Team's, each with its figure and what's still missing), Virtuell, Distanz,
  Höhenmeter, Korrekturen, Meldung. 016's Training, Team and Draußen columns
  became the Rynke column; its Termine column is gone (owner's request,
  2026-10-17). Outdoor Training stays in the cards' breakdown.

- A tile "Rider mit offener Meldung" first, counting riders, styled as an
  alert while above 0 (FR-034), with a large faint ⏳ behind the text like
  the other tiles' riders.
- With all riders shown, riders with open requests come first.
- Per rider with open requests, one line per request: "⏳ Will eingetragen
  werden: {kind} · {date}" linking to the event, with ✓ and ✕ (the same forms as
  on Termine, `back` this page). Desktop: a "Meldung" column; phone: a block in
  the rider's card above its breakdown.
