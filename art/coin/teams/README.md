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
2. `pnpm team-coins <team>` colours the line drawing itself, area by area: each
   area enclosed by its lines gets the one colour most of it has in Gemini's take,
   from the palette in `scripts/team-coins.mjs`. So the lines stay exactly the
   line drawing's, every area is one flat colour, and whatever Gemini added beyond
   the lines (Hamburg's bicycle chain) is dropped. It then paints the band black,
   sets the name in gold and traces it into `<team>/rynke-coin-back.svg`.

Where Gemini's colours are wrong, `colours.json` fixes them without it:
`regions` gives single areas another colour ([x, y, colour] on the 2048 px
canvas); `recolour` turns every area of one colour wholly inside a box into
another (`box`, `from`, `to`: a tower's see-through inside, a badge's pink
riders); and `overlay` draws an SVG of our own over Gemini's take before the
areas vote, so a pattern gets exactly the colours we drew (München's diamonds,
`reference/muenchen-ribbon-colour.svg`). The palette's `stone`, `bark` and
`chocolate` are only for these fixes: no area votes for them. A fix whose area
turns out as big as the sky gets a warning: its outline has a gap, which an
`overlay` in `coins.json` with a short line closes (`rheinruhr-handle.svg`,
`frankfurt-roemer.svg`, `niederrhein-willows.svg`, `black-forest-hill.svg`).
`badges` at the top of `colours.json` colours the band's three badges, which
every drawing keeps from Hamburg's blank, like Hamburg's on every coin: road,
mountain and the riders' jerseys yellow on the gold. A coin whose badges Gemini
moved has its own `badges` (RheinRuhr).

The arc line's ends below the band, which the drawings keep from Hamburg's
blank (where Hamburg's chain hangs), take the colour on both their sides
wherever they match, so they disappear from the sky without cutting the lines
that cross them. The areas are found with the black band already in place, so
a shape reaching up under it (Nieder-Olm's middle horn) ends at the band
instead of running through the lettering into the sky.

Flensburg's `coin-flensburg-gate-rider.png` isn't Gemini's: it's draft 6
(`coin-flensburg-merged`) with its last rider taken out and draft 5's rider
(`coin-flensburg-front`), coming out towards us, set into the gate's archway behind
the first rider, put together with ImageMagick.

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
- `muenchen-ribbon.svg`: München's ribbon as a lozengy lattice (the Bavarian
  diamonds), made once from the ribbon's area in the earlier coloured back: it
  paints that area white and draws two families of lines leaning the same angle
  either way from the ribbon's top edge (smoothed to a cubic), along its normal,
  so the cells are regular diamonds bent with the ribbon. Gemini's own grid had
  uneven cells and lines that stopped halfway. An `overlay` like the outline
  above, over the whole canvas. `muenchen-ribbon-colour.svg` is the same lattice
  with each diamond filled blue or white by its place in it, the colour pass's
  `overlay`.

A picture with `template` uses that prompt instead of `prompt.txt`:
`edit-prompt.txt` takes a finished draft as `blank` and changes only what its scene
names, so a picked draft can be fixed without drawing it anew.

The lettering is set by the script, not drawn by Gemini, so every name is spelled
right and any length fits: in Nunito Black, hollow like Hamburg's with the dot
between the words solid, on Hamburg's arcs. The letters go into the SVG as the
font's own outlines (read with fontkit), not traced, so they stay crisp. A long name on the front takes the two stars' room first; a name that still
doesn't fit gets smaller letters. The script prints how each one came out.

It needs ImageMagick, potrace and Playwright's Chromium (as for the e2e tests).
