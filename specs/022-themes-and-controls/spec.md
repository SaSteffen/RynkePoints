# Feature Specification: One Set of Controls, Themes in the Header and Fun Page Switches

**Feature Branch**: `022-themes-and-controls`

**Created**: 2026-10-22

**Status**: Draft

**Mock-up**: Claude Design "RynkePoints Themes",
https://claude.ai/artifact/8yciDe8Hycvc4Lo9v8gJBN

**Input**: User description: "I think the dark theme might be too dark in general,
but let's leave it that way. First of all: I want to look at the app from a pure UI
perspective and make sure that buttons and colours are used consistently. Can we
judge that somehow? Once we have that, I want to introduce themes. I want three more
light and three more dark themes, which can be applied just by selecting them.
Light/dark/theme selection moves out of the settings page and into the app's header
(always header, independent of width, next to the reload button). In the app header
there will then be a button that opens the menu for theme switching (replaces the
light/dark selection). Let's also add 2 more high contrast themes. Use Claude
Designer to draft it all. For light and dark I want at least one 'fun' theme, which
introduces glitter, confetti and rainbows." Later in the same session: "When
switching pages in the fun and disco themes I want to show a disco ball (with the
lights coming off it while it is rotating) and confetti and rainbows respectively.
These are animations that are overlaid over the page. They appear and basically
cover the whole page at their apex. While they cover the whole page, we switch to
the other page. The animations may be as long as about 3 s – this is fun mode, we
have time for fun." Further requests in that session: a tap skips the animation;
both kinds of Rynke coins rain along with the confetti, as many coins as confetti
pieces; the palette button carries a rainbow or a disco ball in the fun themes; a
purple theme for light and for dark; the rainbow must be bright.

## The design draft is binding

The look of everything in this spec is agreed in the Claude Design canvas
"RynkePoints Themes" (https://claude.ai/artifact/8yciDe8Hycvc4Lo9v8gJBN). Its
boards are part of this specification:

| Board | What it fixes |
|-------|---------------|
| "Kopfzeile + Farbschema-Menü (klickbar)" | The header with the palette button next to the reload button, the theme menu, its groups, preview tiles, the "Glitzer" chip and the device note |
| "Konfetti (hell) und Disco (dunkel)" | The two fun themes on a page: background, glitter, rainbow strips and bars, glow, the badge on the palette button |
| "Ein Satz Bedienelemente" | Today's inconsistencies and the one set of controls, shown in four themes |
| "Alle zwölf Themes" | The colours of all twelve themes |
| "Seitenwechsel: Konfetti und Disco (klickbar)" | Both page-switch animations, their timing, the coin rain, Rynke's place and movement, tap to skip and the reduced-motion fade |
| "Rynke in den Seitenwechseln (Entwurf)" | Rynke on the unicorn (Konfetti) and in the disco outfit (Disco): the pose, the outfit and the draft scene text for the generated pictures. The drawings there are hand-made stand-ins; the app gets generated pictures (FR-048) |

Planning MUST read the canvas with the Artifact tool and write its look (colour
values, sizes, timings, the order of elements) into the design contracts.
Implementation MUST match the canvas, not just the contracts' markup. Where the
canvas and this text disagree, the canvas wins for look and this text wins for
behaviour; the disagreement is noted and resolved with the owner.

## Delivery phases

- **Phase 1**: one set of controls (US1). It changes no colours and can ship on
  its own.
- **Phase 2**: the theme menu in the header and the twelve themes (US2, US3).
- **Phase 3**: the fun themes' page-switch animations (US4).
- **Out of scope**: making the dark themes lighter (the owner thinks they may be
  too dark but wants them left as they are), and whether the reload button is still
  needed (issue #208). The palette button sits next to the reload button until
  #208 decides otherwise.

## Clarifications

### Session 2026-10-22

- Q: How do we judge whether buttons and colours are used consistently? → A: By
  measuring every control's computed look (height, border, weight, colours) on
  every page in both schemes and grouping identical looks. The audit found about 30
  distinct looks per scheme. The active state of a selection control is yellow
  (primary-container) on Settings, Orga and Du, but near-black (beige in dark) on
  the Team and Badges filters. The request yes/no buttons are 40 px high with a
  2 px border at weight 700, while other buttons are 44 px with a 1 px border at
  weight 500. Disclosure summaries come in 13, 14 and 16 px, and chips in 24, 32
  and 44 px. No text fails 4.5 : 1. The findings are on the canvas board "Ein Satz
  Bedienelemente".
- Q: How many themes? → A: Twelve. Light: Rynke Tag (today's light), Ostsee,
  Paris, Flieder and the fun theme Konfetti. Dark: Rynke Nacht (today's dark),
  Nachtfahrt, Wald, Pflaume and the fun theme Disco. High contrast: Kontrast hell
  and Kontrast dunkel. Flieder and Pflaume are the purple ones the owner asked for.
- Q: Where does the theme choice live? → A: Only in the header, behind a palette
  button next to the reload button, at every width. The colour-scheme choice
  leaves the Settings page.
- Q: Which page switches animate? → A: Following a link or tab to another page
  of the app. A reload, a tap on the current tab, and the browser's back and
  forward never animate. A tap during the animation skips it.
- Q: Is Rynke in the shows? → A: Yes, at the base of each: riding a unicorn in
  Konfetti, in a disco outfit with the Saturday-Night-Fever pose in Disco. The
  canvas has hand-drawn drafts; the final pictures are generated like the quote
  monkeys.
- Q: How bright is the rainbow? → A: Bright and saturated, without dark bands
  (no deep purple, navy or dark red), and the same rainbow everywhere in Konfetti.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Controls look and behave the same everywhere (Priority: P1)

A rider moves between Team, Du, Badges, Orga and Settings. A button, a filter, a
chip or an expandable section looks the same on each page: the same height, text
size and weight, border, and the same colour for "selected".

**Why this priority**: The themes are built on top of these controls. If controls
take their colours from different roles today, every theme would show the
inconsistency again, in twelve variants.

**Independent Test**: Measure every control on every page in light and dark
before and after; each control type has one look per state, as on the canvas board
"Ein Satz Bedienelemente".

**Acceptance Scenarios**:

1. **Given** the Team filter and the Settings choices, **When** one option is
   selected in each, **Then** both selected options have the same fill and text
   colour.
2. **Given** the request yes/no buttons and any other button, **When** they are
   shown, **Then** they have the same height, border and text weight as other
   buttons of their kind.
3. **Given** any card, **When** it is shown, **Then** it has at most one filled
   button.
4. **Given** a high-contrast theme (after Phase 2), **When** controls are shown,
   **Then** their outlines are thicker as on the canvas, and everything else
   follows the same rules.

---

### User Story 2 - Pick a theme from the header (Priority: P1)

A rider taps the palette button in the header on any page. A menu opens with
"Automatisch" and the themes in three groups (Hell, Dunkel, Hoher Kontrast), each
with a small preview. Choosing one applies it at once to the whole app on that
device.

**Why this priority**: It is the feature the owner asked for, and the fun themes
and animations depend on it.

**Independent Test**: On a phone-width and a desktop-width screen, open the menu
from the header of every page, choose each theme, reload, sign out and in again;
the choice stays, and the Settings page no longer offers a colour scheme.

**Acceptance Scenarios**:

1. **Given** any page at any width, **When** the header is shown, **Then** the
   palette button sits next to the reload button.
2. **Given** the menu is open, **When** the rider picks "Wald", **Then** the page
   turns to Wald at once, without a reload, and the menu shows Wald as chosen.
3. **Given** "Automatisch", **When** the device is in dark mode, **Then** the app
   shows Rynke Nacht, and Rynke Tag in light mode.
4. **Given** a rider who had picked "Dunkel" in Settings before this feature,
   **When** they open the app after the update, **Then** it shows Rynke Nacht
   ("Hell" becomes Rynke Tag, "System" becomes Automatisch).
5. **Given** a theme was picked, **When** any page loads, including public pages,
   **Then** it appears in that theme from the first paint, without a flash of
   another theme.
6. **Given** the menu is open, **When** the rider presses Escape or taps outside,
   **Then** it closes and focus returns to the palette button.

---

### User Story 3 - The fun themes Konfetti and Disco (Priority: P2)

A rider picks Konfetti (light) or Disco (dark). The app gets glitter, confetti
and rainbows (Konfetti) or a disco glow (Disco), as on the canvas, while every
page stays readable and usable.

**Why this priority**: The owner asked for "at least one fun theme" in light
and in dark; it builds on US2.

**Independent Test**: Pick each fun theme and walk through every page; the
effects from the canvas appear, the text contrast holds, and with reduced motion
nothing moves.

**Acceptance Scenarios**:

1. **Given** Konfetti, **When** the header is shown, **Then** the palette button
   carries a small rainbow; in Disco it carries a small disco ball.
2. **Given** a fun theme, **When** the menu is open, **Then** the fun themes have
   the "Glitzer" chip.
3. **Given** a fun theme and a device that asks for reduced motion, **When** a
   page is shown, **Then** the decorations are still there but do not move.

---

### User Story 4 - A show when switching pages in the fun themes (Priority: P3)

In Konfetti, tapping another tab grows a bright rainbow from the bottom until it
covers the page, the Rynke coin spins in the middle, and confetti and both kinds
of Rynke coins rain through it. In Disco, the room goes dark, a disco ball drops in
on its wire and turns, and beams and coloured spots of light sweep the page. At the
peak the page underneath changes, and the show clears to reveal it.

**Why this priority**: The cherry on top; it needs US3.

**Independent Test**: In each fun theme, switch tabs and watch the show; tap
during it to skip; set reduced motion and see a short fade instead; reload and
tap the current tab and see no show.

**Acceptance Scenarios**:

1. **Given** Konfetti or Disco, **When** the rider taps another tab, **Then** the
   show plays for about 3.2 s, covers the whole page at about 1.6 s, and the new
   page is underneath when it clears.
2. **Given** a show is playing, **When** the rider taps, **Then** the show stops
   and the new page is shown at once.
3. **Given** reduced motion, **When** the rider switches page, **Then** a fade of
   about 0.5 s replaces the show.
4. **Given** a fun theme, **When** the rider reloads, taps the current tab or uses
   the browser's back or forward, **Then** no show plays.
5. **Given** a non-fun theme, **When** the rider switches page, **Then** no show
   plays.
6. **Given** the new page takes longer to load than the show, **When** the show
   reaches its end, **Then** the rider does not see a blank or broken page in
   between (the cover holds, or the page's usual loading state shows).

---

### Edge Cases

- The stored choice names a theme that no longer exists, or storage is blocked
  (private window): the app uses "Automatisch".
- The choice is made on one device: other devices of the same rider keep their own
  choice (it is a device setting, not rider data).
- The theme changes while a page-switch show is playing: the show finishes or is
  skipped; the new theme applies to the new page.
- A page has a celebration of its own (feature 012) right after a show: the
  celebration still plays once, after the show has cleared.
- Very narrow screens (320 px): the header still fits the title, the palette
  button and the reload button; the menu fits the screen and scrolls if needed.
- Keyboard and screen-reader users: the palette button has a label, the menu is
  reachable and operable with the keyboard, and the chosen theme is announced as
  chosen.
- The show is decorative: screen readers do not announce it, and it never takes
  focus.
- Slow devices: the rain of 220 pieces must not make the switch feel stuck; if it
  stutters on the owner's test phones, both counts are reduced by the same amount,
  keeping as many coins as confetti pieces.

## Requirements *(mandatory)*

### Functional Requirements

**Controls (Phase 1)**

- **FR-001**: Each control type – filled button, outlined button, text button,
  icon button, segmented choice, filter chip, chip, disclosure summary, switch –
  MUST have one look per state on every page, as on the canvas board "Ein Satz
  Bedienelemente".
- **FR-002**: Touch targets MUST be at least 44 px high; button and choice text
  MUST use one size and weight (14 px, semi-bold, as on the canvas).
- **FR-003**: The selected state of every selection control (segmented choices,
  filters, the theme menu) MUST use the same colour role (primary-container and
  its text colour).
- **FR-004**: Control outlines MUST be 1 px, and 2 px in the high-contrast themes.
- **FR-005**: A card MUST have at most one filled button; other actions on it use
  the outlined or text style.
- **FR-006**: Controls MUST take their colours only from the shared design tokens
  (feature 011 FR-031), never from fixed colour values, so every theme restyles
  them.
- **FR-007**: The request yes/no buttons, the Team and Badges filters, the
  disclosure summaries and the chips MUST be brought in line with FR-001 to FR-006
  (the audit's findings).

**Theme menu and themes (Phase 2)**

- **FR-010**: Every page with the app header MUST show a palette button next to the
  reload button, at every width. It opens the theme menu.
- **FR-011**: The menu MUST offer "Automatisch" and the twelve themes in the groups
  Hell, Dunkel and Hoher Kontrast, each with a preview tile, the "Glitzer" chip on
  the fun themes and the note "Gilt nur für dieses Gerät.", as on the canvas board
  "Kopfzeile + Farbschema-Menü".
- **FR-012**: Choosing a theme MUST apply it at once to the whole page without a
  reload, and close or update the menu as on the canvas.
- **FR-013**: "Automatisch" MUST follow the device's light or dark mode, showing
  Rynke Tag or Rynke Nacht, and MUST be the default.
- **FR-014**: The choice MUST be remembered on that device only, apply to every
  page there (public pages included) from the first paint without flashing
  another theme, and survive signing out. It is not rider data and is not stored
  on the server (as feature 011 FR-032a).
- **FR-015**: An existing choice from Settings MUST carry over: System →
  Automatisch, Hell → Rynke Tag, Dunkel → Rynke Nacht.
- **FR-016**: The Settings page MUST no longer offer the colour scheme. This
  replaces feature 011 FR-032a's place for the choice.
- **FR-017**: The themes MUST have the colours of the canvas board "Alle zwölf
  Themes". Rynke Tag and Rynke Nacht MUST stay as today.
- **FR-018**: In every theme, text and controls MUST meet 4.5 : 1 for body text
  and 3 : 1 for large text, icons and outlines (feature 011 FR-033). In the two
  high-contrast themes all text MUST meet at least 7 : 1.
- **FR-019**: The browser's theme colour (address bar, installed app) MUST match the
  chosen theme's background.
- **FR-020**: The gauges MUST keep their meaning, parts and colour key in every
  theme (feature 011 FR-035); the "Powered by Strava" attribution MUST use the
  variant for the theme's background (light or dark).
- **FR-021**: Theme names, group names, the note and every label of the menu MUST
  be in the message catalogs, in every language (the canvas shows German).

**Fun themes (Phase 2)**

- **FR-030**: Konfetti and Disco MUST show the decorations of the canvas board
  "Konfetti (hell) und Disco (dunkel)": glitter in the background, sparkles round
  the coin, rainbow strips and bars, confetti on the qualified card, the rainbow
  tab highlight (Konfetti), and the glow (Disco).
- **FR-031**: Konfetti MUST use one rainbow everywhere: bright, saturated bands from
  violet through blue, turquoise, green, lime, yellow and orange to red and pink,
  with no dark bands, as on the canvas.
- **FR-032**: In Konfetti the palette button MUST carry a small rainbow; in Disco a
  small faceted disco ball whose facets move.
- **FR-033**: Decorations MUST never cover or blur text or controls, and MUST NOT
  move when the device asks for reduced motion.

**Page-switch shows (Phase 3)**

- **FR-040**: In Konfetti and Disco, following a link or tab to another page of
  the app MUST play that theme's show over the page, as on the canvas board
  "Seitenwechsel: Konfetti und Disco": about 3.2 s in total, covering the whole
  page at about 1.6 s, when the page underneath changes.
- **FR-041**: Konfetti's show: a bright rainbow (FR-031) grows from the bottom until
  it covers the page and then shrinks away; the Rynke coin spins in the middle at
  the peak; confetti and Rynke coins rain through it all, as many coins as confetti
  pieces, training and Team coins in turn, the coins a little larger than the
  confetti and flipping as they fall.
- **FR-042**: Disco's show: the room darkens, a disco ball drops in on its wire
  with a bounce and turns, light beams rotate from it and coloured spots sweep the
  page.
- **FR-042a**: Rynke, the app's monkey, MUST be part of both shows, at their base.
  In Konfetti, Rynke rides a unicorn with a rainbow mane and tail, comes up from the
  bottom with the rainbow, gallops at its foot while it covers the page, and goes
  back down with it. In Disco, Rynke stands on the dance floor under the ball in a
  disco outfit, in the classic disco pose (one arm pointing up diagonally, the other
  down, hip out), appears as the room darkens, sways to the beat, and leaves with
  the room. Placement and movement as on the canvas board "Seitenwechsel".
- **FR-048**: The two Rynke pictures MUST be generated like the quote monkeys
  (`art/quotes/`, `pnpm badge-art` and `pnpm badge-build`), from the same
  reference and prompt rules, so Rynke looks as everywhere else in the app: the
  yellow helmet stays on, the figure stays androgynous, no jewellery. The scenes
  start from the draft texts on the canvas board "Rynke in den Seitenwechseln".
  The unicorn's mane and tail MAY use the bright rainbow of FR-031, the only
  colours beyond the art's usual palette.
- **FR-049**: Until a picture is built, its show plays without Rynke; the hand-drawn
  drafts from the canvas never ship.
- **FR-043**: A tap or key press during the show MUST stop it and show the new
  page at once.
- **FR-044**: A reload, a tap on the current tab, and the browser's back and
  forward MUST NOT play a show. Non-fun themes MUST NOT play a show.
- **FR-045**: With reduced motion the show MUST be replaced by a fade of about
  0.5 s.
- **FR-046**: The show MUST be hidden from assistive technology, never take focus,
  and the new page MUST get focus and be announced as any page switch is today.
- **FR-047**: The show MUST NOT make the switch slower than without it when the
  rider skips it, and MUST NOT leave the rider on a blank or half-drawn page.

### Key Entities

- **Theme**: a named set of colours (and, for the fun themes, decorations and a
  page-switch show), in one of the groups Hell, Dunkel, Hoher Kontrast. Twelve
  exist; they are fixed in the app, not edited by anyone.
- **Theme choice**: "Automatisch" or one theme, remembered per device in the
  browser; not stored with the rider.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A repeat of the audit finds one look per control type and state
  across all pages, down from about 30 distinct looks per scheme today, with no
  page using a different "selected" colour.
- **SC-002**: A rider can switch to any theme from any page in two taps, at phone
  and desktop width.
- **SC-003**: All twelve themes pass the contrast check on every page (4.5 : 1, and
  7 : 1 for the high-contrast themes).
- **SC-004**: No page load shows a flash of a different theme, in any theme.
- **SC-005**: The page-switch show lasts no more than 3.5 s and can be skipped
  with one tap; with reduced motion nothing moves for longer than 0.5 s.
- **SC-006**: The owner, comparing the app side by side with the canvas boards,
  finds the header, menu, themes, fun decorations and shows match.

## Assumptions

- Twelve themes are enough; riders cannot make their own.
- English theme names are chosen in planning (the canvas has the German ones).
- The fun decorations and shows are pure decoration; nothing is lost if a browser
  cannot show them.
- Phase 1 needs no new colours, only consistent use of the existing roles.
- The reload button stays until issue #208 decides otherwise.
- Manual checks of the look happen on the live site after release (owner's habit);
  automated tests cover behaviour: the choice, its persistence, the carry-over,
  the absence of the scheme choice on Settings, when a show plays and skipping it.
