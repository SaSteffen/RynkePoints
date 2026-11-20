# Art: coin drafts for the German teams

Draft line drawings of the Rynke coin for the other German Team Rynkeby teams, in
the style of Hamburg's line drawing (`../reference/rynke-coin-line-drawing.jpeg`).
They're design drafts, not used by the app. [`index.html`](index.html) shows every
team's drafts side by side, which one is picked, and the coloured backs: open it from
a checkout (it shows the files beside it) and keep its list up to date when a draft
is added or picked.

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

A scene whose climb or riders need another shape brings its own blank back
(`blank` in `coins.json`, a file in `reference/`), made from `coin-back-blank.png`
by hand: Gemini copies the climb and the riders from the blank, whatever the scene
says. `blackforest-blank.png` has a longer climb with a flat hilltop for the cake;
`flensburg-blank.png` has the last rider alone on a flat stretch in front of the
climb; `flensburg-empty-blank.png` has the climb without riders, for a scene that
draws its own.

## In colour

`colour/colours.json` lists the backs to colour, each with its line back's Gemini
original as `blank` and Hamburg's coloured back as reference. `colour/prompt.txt`
asks Gemini to colour the line drawing like Hamburg's: gold ring, black band, flat
enamel colours, no lettering.

1. `pnpm badge-art coin-<team>-colour` into `colour/originals/`.
2. `pnpm team-coins <team>` paints the band black, sets the name in gold and traces
   it in the palette in `scripts/team-coins.mjs` into `<team>/rynke-coin-back.svg`.

A scene can bring real photos of things in it (`references` in `coins.json`, each
with a line on what it shows); Gemini gets them after the blank back, as a model
for shape only. They live in `reference/`:

- `rheinruhr-pit-wheel.jpg`: "Duisburg, Seilscheibe der Schachtanlage
  Rheinpreussen" by Michielverbeek, CC BY-SA 4.0, Wikimedia Commons.
- `rheinruhr-spoil-heap.jpg`: "BOT-Halde Haniel-Weg zum Gipfel" by Dat doris,
  CC BY-SA 4.0, Wikimedia Commons.
- `flensburg-nordertor.jpg`: "Nordertor im Schnee (Flensburg, Januar 2014)" by
  Sönke Rahn, CC BY-SA 3.0, Wikimedia Commons (cropped).
- `flensburg-lighthouse.png`: cut from an earlier Flensburg draft, to keep the
  lighthouse that was liked best.
- `germany-outline.svg`: Germany's outline from Natural Earth's 1:10m countries
  (public domain). It isn't given to Gemini: 100 Germany's back is drawn without a
  map, and the script draws this outline over it (`overlay` in `coins.json`: the
  file and its box on the canvas, [x, y, width]), so the shape is exact.

A picture with `template` uses that prompt instead of `prompt.txt`:
`edit-prompt.txt` takes a finished draft as `blank` and changes only what its scene
names, so a picked draft can be fixed without drawing it anew.

The lettering is set by the script, not drawn by Gemini, so every name is spelled
right and any length fits: in Nunito Black, hollow like Hamburg's with the dot
between the words solid, on Hamburg's arcs. The letters go into the SVG as the
font's own outlines (read with fontkit), not traced, so they stay crisp. A long name on the front takes the two stars' room first; a name that still
doesn't fit gets smaller letters. The script prints how each one came out.

It needs ImageMagick, potrace and Playwright's Chromium (as for the e2e tests).
