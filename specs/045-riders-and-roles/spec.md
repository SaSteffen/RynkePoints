# Feature Specification: Riders and Roles in One Admin Tab

**Feature Branch**: `045-riders-and-roles`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "the rider and role tabs in the admin view can be combined. the roles
tab looks great. can we add the rider tab's functionality there? … the new Tab would be called
"Riders and Roles"". From the design draft: the search moves to the top and finds everyone;
sections Admins, Orga, Ohne Rolle and Gäste; a red line on a row only when its connection needs
attention; one sheet per rider with the connection facts, the role and Entfernen; the note under
Orga reads "Admins haben ebenfalls Orga-Rechte."; the Orga is described in plain words, with
Termine only on teams that have them.

**Design draft**: Claude Design canvas "RynkePoints Roles"
(https://claude.ai/artifact/BwjhMTn1HpksgarG4DgeQ4), rows 8–10 ("Rider und Rollen"). The pages
follow it.

## Context

The admin view has three tabs: **Nutzung** (feature 025: how much of the app's allowances the
team uses), **Rider** (feature 025 US3: the listed riders and guests as cards with their
connection, the dates of their connection and last membership check, their import, and
"Entfernen") and **Rollen** (feature 043: who is Admin, who is in the Orga, and the choice to
give or take a role).

Rider and Rollen show the same people twice, sorted differently, and an administrator who wants
to know about one rider has to look in both. This feature folds the Rider tab into Rollen. The
result is one tab, **Rider und Rollen** (English "Riders and Roles"): Rollen's lists and look,
with the Rider tab's facts and "Entfernen" behind each row's "Ändern".

Nothing about what roles are, who may change them, removal, the role cards or the Settings row
changes: feature 043 and feature 025 hold, except where this spec says otherwise.

**Terms**:

- **Listed rider**, **own administrator**, **guest**, **role**: as in feature 043.
- **Rider und Rollen**: the merged tab, the second after Nutzung.
- **Facts**: what the Rider tab shows today per rider: Verbindung (connected, or must reconnect),
  Verbunden am, Mitgliedschaft zuletzt geprüft, Import (running or done).
- **Needs attention**: a rider whose connection must be renewed or whose import is still running.
- **Team with Termine**: a team whose site has team events (Hamburg today; Europe has none).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - One tab for riders and their roles (Priority: P1)

An administrator opens the admin view and finds two tabs, Nutzung and Rider und Rollen. The new
tab starts with a short text on what the Orga and the admins do, then a search that finds
everyone on the page, then the lists: Admins, Orga, Gäste and, beside them on a wide screen,
Ohne Rolle. A row only says
something about its connection when that needs attention, in red: "Muss sich neu verbinden",
"Import läuft noch", or both. The counts the Rider tab showed at the top (listed, waiting for
consent, blocked) are in the note under Ohne Rolle.

**Why this priority**: This is the merge itself; everything else hangs off it.

**Independent Test**: In fake mode, sign in as the sample administrator, open the admin view:
two tabs; Rider und Rollen lists every rider the Rider tab listed, each exactly once, in the
section of their role, guests under Gäste; the sample rider who must reconnect and the one whose
import is running carry the red line, nobody else does.

**Acceptance Scenarios**:

1. **Given** an administrator, **When** they open the admin view, **Then** the tabs are Nutzung
   and Rider und Rollen, the latter with the people icon the Rider tab had.
2. **Given** Rider und Rollen, **When** it opens, **Then** it shows the text on the roles, the
   search, Admins, Orga and Gäste (if the team has any) in the first column, and Ohne Rolle in a
   second column beside them, as the design draft shows; on a phone the columns stack in that
   order.
3. **Given** the lists, **When** compared with today's Rider tab, **Then** every listed rider and
   every guest is on the page exactly once, and nobody else is.
4. **Given** a rider who must reconnect or whose import is still running, **When** the page
   shows them, **Then** their row has a red line saying which, in words, in any section.
5. **Given** a rider whose connection is fine and whose import is done, **When** the page shows
   them, **Then** their row has no line about the connection.
6. **Given** the search, **When** the administrator types part of a name, **Then** only matching
   rows stay visible in every section, and "Niemand gefunden." shows when none is left.
7. **Given** the note under Ohne Rolle, **When** read, **Then** it says that only riders who
   share their data with the team are listed, and gives the numbers listed, waiting for consent
   and blocked.
8. **Given** the note under Orga, **When** read, **Then** it says "Admins haben ebenfalls
   Orga-Rechte."
9. **Given** an old link or bookmark to the Rider tab or the Rollen tab, **When** opened,
   **Then** it leads to Rider und Rollen.

---

### User Story 2 - Ändern shows the facts, the role and Entfernen (Priority: P1)

An administrator taps "Ändern" on any row but their own. One sheet opens (a dialog on wider
screens) with the rider's name, the rider's facts (problems in red), the role choice Keine, Orga
or Admin, the line that the rider is told on their next visit, and at the bottom "Entfernen" on
the left and "Abbrechen" and "Speichern" on the right. Saving a role works as on Rollen today,
with the notice and "Rückgängig".

**Why this priority**: The facts and removal are what the Rider tab was for; without this the
merge drops them.

**Independent Test**: In fake mode, as the sample administrator, open "Ändern" for the rider who
must reconnect: the facts match today's Rider tab card for them, with the problems in red; give
them the Orga role, save, see the notice, undo it.

**Acceptance Scenarios**:

1. **Given** a row in Admins, Orga or Ohne Rolle other than the viewer's own, **When** the
   administrator taps "Ändern", **Then** the sheet shows the rider's name as its title, their
   four facts, the role choice with the current role selected, and "Entfernen", "Abbrechen" and
   "Speichern".
2. **Given** a fact that needs attention, **When** the sheet shows it, **Then** it is in red and
   in words, not by colour alone.
3. **Given** the sheet, **When** the administrator picks another role and saves, **Then** it
   behaves as feature 043's choice: the rider moves to their new section, a notice says what
   changed and offers "Rückgängig".
4. **Given** the sheet, **When** the administrator taps "Abbrechen", **Then** nothing changes.
5. **Given** the viewer's own row, **When** shown, **Then** it is marked "Du" and has no "Ändern",
   as on Rollen today.
6. **Given** a row in Ohne Rolle, **When** shown, **Then** its button reads "Ändern", like every
   other row (Rollen's "Rolle geben" is gone).

---

### User Story 3 - Removing a rider from the merged tab (Priority: P1)

An administrator taps "Entfernen" in a rider's sheet. Today's confirmation page opens, with the
merged tab highlighted in the admin tabs. Confirming removes and blocks the rider as today and
leads back to Rider und Rollen with "Entfernt und gesperrt." The rider is gone from the lists.
Cancelling leads back to Rider und Rollen.

**Why this priority**: Removal is the Rider tab's one action; it must keep working.

**Independent Test**: In fake mode, as the sample administrator, remove a sample rider through
their sheet: confirmation page, then the merged tab with the notice and without the rider.

**Acceptance Scenarios**:

1. **Given** a rider's sheet, **When** the administrator taps "Entfernen", **Then** the existing
   confirmation page for that rider opens, showing Rider und Rollen as the current tab.
2. **Given** the confirmation page, **When** the administrator confirms, **Then** the rider is
   removed and blocked as today and the administrator is back on Rider und Rollen with
   "Entfernt und gesperrt."
3. **Given** the confirmation page, **When** the administrator cancels, **Then** they are back on
   Rider und Rollen and nothing changed.
4. **Given** a removal that is refused (one's own entry, a rider no longer there, the team's only
   own administrator), **When** refused, **Then** Rider und Rollen shows today's message for it.

---

### User Story 4 - Guests in the merged tab (Priority: P2)

Guests (administrators of another team, feature 041) are listed under Gäste, as on the Rider tab
today. They get no role here. Their "Ändern" opens the same sheet with their facts and
"Entfernen", without the role choice and "Speichern".

**Why this priority**: Few teams have guests, but they must not get lost in the merge.

**Independent Test**: In fake mode, as the sample administrator, open "Ändern" for the sample
guest: facts and "Entfernen", no role choice.

**Acceptance Scenarios**:

1. **Given** a team with guests, **When** an administrator opens Rider und Rollen, **Then** the
   guests are under Gäste, marked "Gast", with the day they connected, and in no other section.
2. **Given** a guest's row, **When** the administrator taps "Ändern", **Then** the sheet shows
   the guest's facts and "Entfernen" and "Abbrechen", and no role choice.
3. **Given** the note under Gäste, **When** read, **Then** it says guests get no role here and
   what "Ändern" shows for them.

---

### User Story 5 - A guest viewer (Priority: P2)

A guest administrator opens Rider und Rollen. As on the Rider tab today they see every rider's
facts and can remove riders; as on Rollen today they can't change roles.

**Why this priority**: Keeps both tabs' guest rules as they are.

**Independent Test**: In fake mode, sign in as the sample guest: every row but their own has
"Ändern"; the sheet shows facts and "Entfernen" but no role choice; a role change sent anyway is
refused.

**Acceptance Scenarios**:

1. **Given** a guest viewer, **When** they open a rider's sheet, **Then** it shows the facts and
   "Entfernen" and no role choice or "Speichern".
2. **Given** a guest viewer, **When** they send a role change anyway, **Then** it is refused and
   nothing changes (feature 043 FR-011).
3. **Given** a guest viewer and the team's only own administrator, **When** they try to remove
   that administrator, **Then** it is refused as today (feature 043 FR-014).

---

### User Story 6 - The Orga in plain words (Priority: P3)

The text at the top of the tab and the Orga choice in the sheet say what the Orga does in plain
words instead of listing every figure: "Sieht Trainingszahlen und Rynke aller Rider, legt Termine
an und trägt ein, wer da war." On a team without Termine the part about Termine is left out.

**Why this priority**: Wording only; the tab works without it.

**Independent Test**: In fake mode, open the tab and the sheet on Hamburg (with Termine) and on
Europe (without): the Termine part appears only on Hamburg.

**Acceptance Scenarios**:

1. **Given** a team with Termine, **When** an administrator opens the tab, **Then** the text at
   the top reads "Die Orga sieht Trainingszahlen und Rynke aller Rider, legt Termine an und trägt
   ein, wer da war. Admins sind immer auch in der Orga und betreiben dazu die App: Nutzung, Rider
   und Rollen.", and the Orga choice reads "Sieht Trainingszahlen und Rynke aller Rider, legt
   Termine an und trägt ein, wer da war."
2. **Given** a team without Termine, **When** an administrator opens the tab or the sheet,
   **Then** both texts end after "Rynke aller Rider" and say nothing about Termine.

### Edge Cases

- **A rider with a role who needs attention**: The red line shows in their Admins or Orga row
  under the "seit" date, the same as in Ohne Rolle.
- **The viewer needs attention themselves**: Their own row shows the red line too, but has no
  "Ändern", as today.
- **No riders listed yet**: Ohne Rolle says nobody has agreed yet and still gives the numbers
  waiting and blocked.
- **No guests**: No Gäste section.
- **A guest with a needed reconnect**: Their row shows the red line like any other.
- **The search and the sections**: A section whose rows are all filtered out keeps its heading;
  only the rows are hidden. The search finds guests too.
- **"Rückgängig" after a removal**: There is none; removal stays final with its confirmation, as
  today.
- **Old links with notices or errors**: An old Rider-tab or Rollen address that carries a notice
  or an error (after a removal or a role change) shows the same notice or error on Rider und
  Rollen.
- **The Settings link "Mitglieder ändern"**: Leads to Rider und Rollen.
- **Usage alerts or other pages that link to the Rider tab**: They lead to Rider und Rollen.

## Requirements *(mandatory)*

### Functional Requirements

**The tab**

- **FR-001**: The admin view MUST have two tabs, "Nutzung" and "Rider und Rollen", the latter
  with the Rider tab's people icon. The Rider and Rollen tabs MUST be gone.
- **FR-002**: The addresses of the old Rider and Rollen tabs MUST lead to Rider und Rollen,
  keeping any notice or error they carry. Links in the app MUST point to the new tab directly.
- **FR-003**: Rider und Rollen MUST show: the text on the roles (FR-016); a search over every row
  on the page; Admins; Orga, with the note "Admins haben ebenfalls Orga-Rechte."; Gäste, if the
  team has guests, with a note that guests get no role here; and Ohne Rolle, with a note that
  only riders who share their data are listed and the numbers listed, waiting for consent and
  blocked. As in the design draft, the text, the search, Admins, Orga and Gäste make the first
  column and Ohne Rolle the second beside it; on a phone the two stack, in that order.
- **FR-004**: Every listed rider and every guest MUST appear exactly once: own administrators
  under Admins, organisers who aren't administrators under Orga, other listed riders under Ohne
  Rolle, guests under Gäste. Nobody else MUST appear.
- **FR-005**: A row MUST show a red line, in words, when the rider must reconnect or their import
  is still running, and no line about the connection otherwise. Rows under Admins and Orga keep
  their "seit" date; rows under Gäste show the day they connected.
- **FR-006**: The search MUST be shown to every viewer, guests included, filter the rows of every
  section by name, and say "Niemand gefunden." when no row is left.

**The sheet**

- **FR-007**: Every row except the viewer's own MUST have "Ändern" for every viewer, guests
  included. The viewer's own row MUST be marked "Du" and have none.
- **FR-008**: "Ändern" MUST open one sheet (from the bottom on a phone, a dialog on wider
  screens) with: the rider's name as title; the facts Verbindung, Verbunden am, Mitgliedschaft
  zuletzt geprüft and Import, those that need attention in red; under "Rolle", the choice Keine,
  Orga or Admin with the current role selected and the line that the rider is told on their next
  visit; and at the bottom "Entfernen" on the left, "Abbrechen" and "Speichern" on the right.
- **FR-009**: The sheet MUST leave out the role choice, its line and "Speichern" when the rider
  is a guest or the viewer is a guest.
- **FR-010**: Saving a role MUST behave exactly as feature 043's choice (FR-004 to FR-013 there),
  returning to Rider und Rollen with its notice and "Rückgängig".
- **FR-011**: "Abbrechen" MUST close the sheet and change nothing.

**Removal**

- **FR-012**: "Entfernen" MUST open today's confirmation page for the rider (feature 025
  FR-021), with Rider und Rollen shown as the current tab and its cancel link leading back to
  Rider und Rollen.
- **FR-013**: After a removal, and after a refused removal, the administrator MUST land on Rider
  und Rollen with today's notice ("Entfernt und gesperrt.") or message.
- **FR-014**: Removal's rules MUST stay as they are, the protection of the team's only own
  administrator (feature 043 FR-014) included.

**Not colour alone**

- **FR-015**: Problems and roles MUST NOT rely on colour alone: each red line and red fact says
  what it means in words.

**Text**

- **FR-016**: The text at the top MUST say what the Orga does in plain words, "Die Orga sieht
  Trainingszahlen und Rynke aller Rider, legt Termine an und trägt ein, wer da war.", and that
  admins are always in the Orga and also run the app. The Orga choice in the sheet MUST read
  "Sieht Trainingszahlen und Rynke aller Rider, legt Termine an und trägt ein, wer da war."
- **FR-017**: On a team without Termine both texts MUST leave out the part about Termine.
- **FR-018**: All new and changed text MUST be in the catalogs, in all ten languages, German
  first. Texts no longer shown (the Rider tab's heading and counts line, "Rolle geben", Rollen's
  old Orga note) MUST be removed from the catalogs.

**Unchanged**

- **FR-019**: Who may change roles, who may remove riders, the role cards, the Settings row "Wer
  in der Orga ist" and its text, and the Nutzung tab MUST stay as they are.

### Key Entities

No new data. The tab shows what the Rider and Rollen tabs read today: each rider's role, the
date since when, their connection, the dates of their connection and last membership check,
their import, and the team's counts of listed, waiting and blocked riders.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator finds any rider's connection facts and role, and can change the
  role or remove the rider, from one tab with one search.
- **SC-002**: In tests, the merged tab lists exactly the riders and guests the two old tabs
  listed together, each once.
- **SC-003**: Every old link to the Rider or Rollen tab, with or without a notice or error, ends
  on Rider und Rollen showing the same notice or error.
- **SC-004**: In tests, every role change and removal that was refused or allowed before is
  refused or allowed the same way from the merged tab.
- **SC-005**: On a team without Termine no text on the tab mentions Termine.

## Assumptions

- **Supersedes**: feature 043 FR-001 (Rollen as a third tab), FR-002 (its layout), FR-003 for
  guest viewers (they now get "Ändern" for facts and removal), and the "Rolle geben" button; and
  the Rider tab of feature 025 US3 (FR-018, FR-019) as a page of its own. Its content lives on in
  the merged tab.
- **The Orga description**: Shorter by choice. It no longer lists corrections or the daily
  figures; organisers can still correct Rynke and see the figures. The Settings row's text and
  the consent texts are rider-facing promises and stay as they are.
- **Guests can search**: Today guests get no search on Rollen because the search only served
  "Rolle geben". The merged search finds people, which is harmless for a viewer who may see the
  rows anyway.
- **The address of the tab**: Left to the plan; what matters is that both old addresses lead to
  it.
- **Consent**: No consent revision: administrators see the same data as before, on one page
  instead of two.
- **No new tour**: There is no admin tour (feature 043 FR-020).
