# Quickstart: Riders and Roles in One Admin Tab

## Prerequisites

`pnpm install`; fake mode, `pnpm dev:hamburg` (http://localhost:8789) and, for the team without
Termine, `pnpm dev:europe` (http://europe.localhost:8790); sign in through `/_dev/` with
"Connect as". Check each page at phone width (390 px) and desktop width (1280 px) against the
design draft, rows 8–10.

## 1. One tab (US1)

1. Connect as **Alex Admin** (Hamburg). The Admin page has two tabs: Nutzung and Rider und
   Rollen, the second with the people icon.
2. The tab: the text on the Orga, the search, Admins (Alex, "Du", no button), Orga ("Admins haben
   ebenfalls Orga-Rechte."), Gäste (Gesa Gast), and Ohne Rolle beside them (second column from
   840 px; below Gäste on a phone) with the counts in its note.
3. **Remy Reconnect** shows a red line "Muss sich neu verbinden · Import läuft noch"; only
   riders whose import is still running have a line besides.
4. Type "fi" in the search: only matching rows stay, in every section; "xyz" shows "Niemand
   gefunden."
5. Open `/admin/roles` and `/admin/roles?done=orga&athlete=<id>&from=none`: both end on
   `/admin/riders`, the second with the notice.

## 2. Ändern: facts, role, Entfernen (US2, US3)

1. "Ändern" on **Remy Reconnect**: the sheet shows the name, the four facts (two red), "Rolle"
   with Keine selected, the line about the next visit, "Entfernen" on the left, "Abbrechen" and
   "Speichern" on the right.
2. Pick Orga, "Speichern": Remy is under Orga, the notice says so with "Rückgängig"; undo it.
3. "Entfernen" opens the confirmation with Rider und Rollen highlighted; "Abbrechen" there goes
   back to the tab. Confirm for another rider: back on the tab with "Entfernt und gesperrt.", the
   rider gone. A removal of Alex's own entry, or of a rider who is no longer there, ends on the tab
   with today's message.

## 3. Guests and a guest viewer (US4, US5)

1. As Alex: "Ändern" on **Gesa Gast** shows her facts (no "Mitgliedschaft zuletzt geprüft") and
   "Entfernen", no role part, no "Speichern".
2. Connect as Gesa: every row but her own has "Ändern"; the sheet has facts, "Entfernen" and
   "Abbrechen" only; a POST to `/admin/roles` answers 403.

## 4. The Orga in plain words (US6)

1. Hamburg: the text at the top and the Orga choice in the sheet both mention Termine.
2. Europe (connect as **Aistė Admin**): the same texts end after "Rynke aller Rider".

## 5. Tests

`pnpm test -- test/integration/admin-riders test/integration/admin-roles test/integration/admin-remove
test/integration/admin-access test/integration/settings-orga test/unit/catalogs`, then
`pnpm test:e2e -- admin-roles` (Chromium is enough locally). Hamburg's pages snapshot only if
`pnpm test test/teams/pages-snapshot` fails: run the whole file with `-u` and read the `.snap` diff.
