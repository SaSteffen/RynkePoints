# Art: coin drafts for the German teams

Draft line drawings of the Rynke coin for the other German Team Rynkeby teams, in
the style of Hamburg's line drawing (`../reference/rynke-coin-line-drawing.jpeg`).
They're design drafts, not used by the app.

- **Front:** Hamburg's front. Rynke stays identical; only the lower lettering
  changes to "TEAM RYNKEBY <NAME>".
- **Back:** each team's own scene, with the climb, the riders, the Eiffel Tower and
  the three icons kept from Hamburg's, and "<NAME> • PARIS" on top.

Each scene has three things: a main motif, one support and one dry touch at the
roadside (`coins.json`). Nothing else, so it reads at 40 mm.

## Making them

1. `pnpm team-coins` writes `reference/coin-back-blank.png` (Hamburg's back with its
   scene and lettering wiped) and every team's front.
2. `pnpm badge-art coin-<team>` (or `pnpm badge-art` for all missing ones) has Gemini
   draw each back from `prompt.txt` with that team's scene, the blank back attached,
   into `originals/coin-<team>.<ext>`. Check it: the band above the arc line empty,
   no colour, nothing beyond what the scene names, no monkey.
3. `pnpm team-coins` again sets the backs' lettering and traces both sides into
   `<team>/rynke-coin-line-front.svg` and `<team>/rynke-coin-line-back.svg`.

The lettering is set by the script, not drawn by Gemini, so every name is spelled
right and any length fits: in Nunito Black, hollow like Hamburg's, on Hamburg's
arcs. A long name on the front takes the two stars' room first; a name that still
doesn't fit gets smaller letters. The script prints how each one came out.

It needs ImageMagick, potrace and Playwright's Chromium (as for the e2e tests).
