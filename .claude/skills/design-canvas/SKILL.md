---
name: "design-canvas"
description: "Draft a UI change as a Claude Design canvas built from the real app: capture fake-mode pages as a sample rider, rebuild them with the new parts using the app's own stylesheet and classes, screenshot phone and desktop, and lay the shots out as boards with notes. Use when the user asks for a design draft, mockup, canvas, Claude Design, or wants a page redesigned or a UI/UX idea shown before it is specced or built."
argument-hint: "what to design, e.g. \"Admin › Nutzung: alerts first\""
metadata:
  source: "project-authored for RynkePoints"
user-invocable: true
disable-model-invocation: false
---

A draft shows the new parts **inside the real pages**: the app's header, tabs and
bottom navigation, its stylesheet, its copy, at phone (390) and desktop (1280)
width. Hand-drawn phone frames or isolated widgets don't show how a change fits
the app, so never build those. Everything here is scratch work: it lives in the
session's scratchpad, is never committed, and the canvas is the deliverable.

If the user already linked a canvas for this feature, read it first (Artifact
`read`) and build on it: match its look, order and helper texts.

## 1. Run fake mode

```bash
pnpm dev:hamburg   # http://localhost:8789, in the background
pnpm dev:europe    # http://europe.localhost:8790 (set BASE for the scripts)
```

A port that's taken means another checkout's server is running: it may serve
another branch, so stop it or ask. `/_dev/` lists the sample riders; who is who
is in `teams/<id>/samples.ts` (Hamburg: Alex Admin is an administrator, Olga
Organiser an organiser, Tina TrainingDone a rider in the Orga; Europe: Oskar
Organiser). Pick the rider who sees the page the draft changes, and the team
whose look it needs (Hamburg unless it is about another team).

## 2. Capture the real pages

```bash
node .claude/skills/design-canvas/scripts/capture.mjs <scratch>/cap "Alex Admin" /admin /me/settings
```

Per page it writes `<name>.html`, `<name>.txt` (the text of `<main>`) and
`<name>-390.png` / `<name>-1280.png`, full page, tours dismissed. Look at both
pictures and read the text before deciding where anything goes: the real page
often answers placement questions.

Tool output may strip HTML tags. To see the markup, print the tags with the
brackets swapped (`s.replace("<","«")`) from a short Python snippet, and get the
served stylesheet (`curl <base>/<the stylesheet link in the html>`) to grep for
the classes you want to reuse.

## 3. Build the mock pages

Write a `build.py` in the scratch folder that uses `scripts/mocklib.py`:

```python
import sys; sys.path.insert(0, "<repo>/.claude/skills/design-canvas/scripts")
from mocklib import Page, svg, write
p = Page("cap/admin.html")
write("mock", "2-overview", p.with_main(p.nav() + markup, css=EXTRA_CSS))
write("mock", "3-sheet", p.edit(old_piece, new_piece, css=EXTRA_CSS))
```

- Build from the app's own classes first: Settings' grouped lists
  (`settings-section`, `settings-list`, `details > summary.settings-row`,
  `settings-icon`, `settings-text`/`-title`/`-sub`, `settings-value`,
  `settings-panel`, `settings-note`, `settings-page` + `settings-col` for two
  columns on desktop), `button-outlined`, `notice`, `usage-mark`,
  `threshold-bar`, the `md-sys-color-*` and `rp-*` tokens. Extra CSS only for a
  truly new piece, and say so in the notes.
- Reuse captured pieces (a chart, a table) by cutting them out of the capture
  rather than redrawing them.
- Copy is real copy in the page's language, written the way the catalogs are
  (German for Hamburg), following the constitution and the team rules: no other
  team's name or place, team content as the team has it. No invented figures,
  except a state the capture can't show (an all-clear, an error); then the notes
  say the values are examples.
- Mark what is new only when the page is mostly unchanged
  (`outline:3px dashed #e8462a;outline-offset:6px`).
- One mock per state: number them (`2-overview`, `3-opened`, …) in the order the
  canvas shows them. Add the capture itself as the "today" board when the draft
  replaces a page.

Then shoot them and look at every picture, both widths, before going on:

```bash
node .claude/skills/design-canvas/scripts/shoot.mjs <scratch>
```

It prints each picture's size; the boards need the heights. Fix overflow,
cramped rows and wrapping, and shoot again.

## 4. Make the canvas

1. Artifact `quickstart` with `intent: "design"` and `design_systems: false` (the
   app's stylesheet is the design system), then publish with the Design
   `type_url`, `title: "RynkePoints <Topic>"`, `auto_open: "after_first_write"`,
   and follow the instructions that result carries.
2. Upload every shot in one call (`asset: true`, `file_paths`). Each reply gives
   a `/_blob/<id>` url.
3. One board per state, each one `.dc.html` written by hand, phone left and
   desktop right, `w` 1782, `h` = the taller picture + 96:

```html
<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Proposal: …</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{margin:0}
</style>
</helmet>
<div style="width: 1782px; height: H px; box-sizing: border-box; padding: 32px; display: flex; gap: 48px; align-items: flex-start; background: #ece8d8; font-family: system-ui, sans-serif; color: #1c1b16">
<figure style="margin: 0; display: flex; flex-direction: column; gap: 8px">
<figcaption style="font-size: 16px; font-weight: 600">Phone</figcaption>
<img src="/_blob/…" alt="what the phone shot shows" style="width: 390px; height: …px; display: block; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,.15)">
</figure>
<figure style="margin: 0; display: flex; flex-direction: column; gap: 8px">
<figcaption style="font-size: 16px; font-weight: 600">Desktop</figcaption>
<img src="/_blob/…" alt="what the desktop shot shows" style="width: 1280px; height: …px; display: block; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,.15)">
</figure>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":1782,"height":H}}'>
class Component extends DCLogic {
renderVals() { return {}; }
}
</script>
</body>
</html>
```

4. Index: boards titled `"0 · Today: …"`, `"1 · Proposal: …"`, …; tall boards
   side by side 80 px apart, short ones in rows 120 px apart. Notes: one
   `title1` above them all, then stickies beside them: orange **Proposed**
   (what changes, in plain words), blue **Open** (the questions for the user,
   numbered, with the choice you made where you made one), gray **Source** (team,
   sample rider, which values are examples).

## 5. Hand it over

Give the canvas link, one line per board, and the open questions. The canvas is
private until the user shares it. Stop the dev server you started. Notes and the
reply use plain words: feature names, not numbers; no file paths or code names
unless asked.

A later change to the draft: edit `build.py`, shoot again, upload the changed
shots and repoint only the boards that changed.
