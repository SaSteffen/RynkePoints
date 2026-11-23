# Research: Riders and Roles in One Admin Tab

Decisions behind [plan.md](plan.md). The pages follow the design draft named in the spec.

## R1 — The tab's address

**Decision**: The merged tab lives at `/admin/riders`, the Rider tab's address. `GET /admin/roles`
answers `301` to `/admin/riders` with the query string kept (R2 maps its error codes), the way
`/admin/history` already moves to `/admin`. `POST /admin/roles` stays: it is the call that sets a
role, and nothing about it changes except where it sends the administrator back to. The removal
pages (`/admin/riders/{id}/remove`) don't move at all.

**Rationale**: The removal confirmation, its refusals and every link and test that names
`/admin/riders` stay valid (FR-012 to FR-014 hold by not touching them); the tab is highlighted
on the confirmation page because that page already marks `riders` as current, and `riders` is now
the merged tab. Only Rollen's own links (the Settings row, the undo form's redirect, the tests)
change.

**Alternatives considered**: `/admin/roles` as the address (the removal flow, its notices and
about thirty test assertions would all move); a new address such as `/admin/people` (both old
addresses would redirect and nobody has used the new one; no gain).

## R2 — Old links with a notice or an error

**Decision**: Both tabs used `?error=self` and `?error=unknown`, with different meanings and
texts (own role vs. removing oneself; a rider who isn't listed for a role vs. for removal). The
merged page can only keep both if the codes differ. Rollen's two codes become `roleSelf` and
`roleUnknown`, written by `POST /admin/roles` from now on. The redirect from the old Rollen
address renames `self` and `unknown` to them; every other parameter (`done`, `athlete`, `from`) is
passed on as it is. The Rider tab's codes (`self`, `unknown`, `lastAdmin`, `done=removed`) don't
change, so its old links need no mapping. `done` never collides: role names against `removed`.

**Rationale**: FR-002 and SC-003 ask for the same notice or error from any old link. Renaming the
newer, rarer codes (Rollen's) leaves the removal flow, which has more callers,
alone.

**Alternatives considered**: a prefix on the removal codes (touches every removal redirect and
test); one shared text for both meanings (a different message from the old link, which SC-003
rules out).

## R3 — One reader for the tab

**Decision**: One function in `src/db/riders.ts` replaces `readRoles` and `readRiderOverview`.
It reads, in one batch: the listed riders (never guests) with their role flags, `role_since` and
the four facts the Rider tab showed (connection status, connected at, membership checked at,
import status); the guests with the same facts; the count of riders who have not agreed yet; and
the blocked count (`blockedCountStatement`). It splits the listed riders into admins, orga and
without a role, sorted by first name as today.

**Rationale**: The page needs all of it per row; two readers would read the same rows twice.
The facts are the Rider tab's columns, nothing more, so what reaches the page is what already
reached the admin (025 FR-019; consent unchanged, spec Assumptions).

**Alternatives considered**: keeping both readers and joining by ID in the page (two reads of
the same rows, a join in code that SQL does for free).

## R4 — Facts inside the sheet

**Decision**: Each "Ändern" row carries its facts as an inert `<template>` inside its `<li>`: the
same `dl` of four facts the Rider tab's card had, built on the server with the catalogs, a
`warn` class on the facts that need attention. `public/app.js` copies the clicked row's template
into the one dialog. The button also carries the removal address (`data-remove`) for "Entfernen".

**Rationale**: All text stays in the catalogs and on the server (rider-facing text never lives in
JavaScript or inline in pages). A template is invisible and inert, so it adds nothing to
the search or to what a screen reader reads on the page, and needs no CSS to hide it. The data is
already read for the row, so no extra request.

**Alternatives considered**: facts as JSON in `data-` attributes (the dialog's labels would then
have to come from JavaScript); one dialog per rider (hundreds of dialogs on a big team's page);
fetching the facts when the button is tapped (a request for data the page already has).

## R5 — Which sheets have a role part

**Decision**: The dialog's role part (heading "Rolle", the three choices, the line about the next
visit) and "Speichern" are in the page only when the viewer is not a guest (FR-009). For a guest
row a viewer who can change roles still gets the dialog, so the button has no `data-role` and
`app.js` hides the role part and "Speichern" for it. "Entfernen" and "Abbrechen" are always
there.

**Rationale**: The same rule as today's Rollen, now per row: guests have no role to change. The
server stays the judge: `POST /admin/roles` still answers 403 for a guest viewer and
`roleUnknown` for a guest as target (a guest is not among the riders who can get a role), so
hiding is only for tidiness.

## R6 — The Orga text on teams without Termine

**Decision**: Whole-sentence keys, chosen in code with the team's existing `hasEvents(team)`:
`admin.roles.hint` and `admin.roles.choice.orga.text` without Termine, and a `.events` twin of
each with Termine. No fragment is stitched into a sentence.

**Rationale**: The Termine clause sits in the middle of the sentence ("…aller Rider, legt Termine
an und trägt ein, wer da war"), and word order and the joining word differ between the ten
languages, so a fragment in a placeholder would be wrong in some. Which teams have Termine is
already team data (`eventKinds`), never a branch on a team's name (feature 026, 039); the role
card on the Du page chooses its Termine sentence the same way.

**Alternatives considered**: appending a second sentence "Legt Termine an und trägt ein, wer da
war." when the team has Termine (the draft and the spec use one sentence); a `{termine}`
placeholder (the grammar problem above).

## R7 — Layout

**Decision**: Keep Rollen's two columns (`settings-page.roles`, two columns from 840 px as the
Settings layout does). First column: the notice, the text, the search, Admins, Orga, Gäste.
Second column: Ohne Rolle. On a phone the columns stack, so the order there is Admins, Orga,
Gäste, Ohne Rolle. Ohne Rolle is shown to every viewer now, guests included.

**Rationale**: It is what the draft shows at both widths. Putting the few Gäste before the long
Ohne Rolle list also keeps them from sinking below it on a phone. The first draft of the spec
said Gäste last; the spec was corrected to the draft.

## R8 — The search

**Decision**: One field, in the first column under the text, over every `li[data-name]` on the
page (all four sections), by first name as today. "Niemand gefunden." sits under the field and
shows when no row is left anywhere. A section keeps its heading when its rows are all hidden.
The field is shown to every viewer.

**Rationale**: FR-006. `app.js` changes from "the rows beside the field" to "the rows of the
page"; nothing else about the filter changes.

## R9 — The red line

**Decision**: A row's sub-line under the name (after the "seit" line, if any) lists what needs
attention in words, joined with " · ": the existing "Muss sich neu verbinden" and a new "Import
läuft noch". It is `settings-sub is-warn`, the class Settings already has (error colour), semi-bold inside `.roles`. The same facts are red in the
sheet. A row with nothing to say has no line. Needs attention is `status = needs_reconnect` or
`import_status` of `pending` or `running`.

**Rationale**: FR-005 and FR-015: words carry the meaning, colour only underlines it. The two
statuses are the ones the Rider tab showed in words; the import's "Läuft noch" value reads badly
as a bare sub-line, so one new short text names it.

## R10 — Texts

**Decision**: Changed, added and removed keys are listed in [contracts/pages.md](contracts/pages.md).
German is written first, the nine other catalogs get the same meaning in their own words (Europe's
English without assumptions about group rides). Keys that have no user any more are removed from
all ten catalogs and from the catalog test's list (FR-018). The keys of the Ohne Rolle section are
renamed from `give` to `without` because "give" no longer describes it.

**Rationale**: The catalogs test fails for a missing key, so adding, renaming and removing happen
in one step across the ten files.

## R11 — Code that goes away

**Decision**: Removed with the merge: the Rider tab's card list and its `.admin-rider` styles, the
Rollen page's "Rolle geben" column code, the `KEY` icon (nothing else uses it), `AdminView`'s
`"roles"` member and the `admin.switch.roles` segment. The Rollen page's row, section, notice and
dialog builders move into the merged page.

## R12 — Tests

**Decision**: The merged page's tests are the union of the two old tabs' tests, rewritten to the
new layout (SC-002, SC-004), plus new ones: the redirect with each old notice and error (R2), the
red line, the sheet's facts, the Termine text on Hamburg's data and on Europe's (a context built
with Europe's team data, as the no-events tests do), the guest viewer. The removal tests stay as
they are because the removal flow doesn't change (R1). One Playwright test covers the dialog with
its facts and "Entfernen".
