# Quickstart: Administrators Give and Take Roles

## Prerequisites

`pnpm install`; fake mode, `pnpm dev:hamburg` (http://localhost:8789); sign in through `/_dev/`
with "Connect as".

## 1. Give a role (US1, US2)

1. Connect as **Alex Admin**. The navigation has Orga and Admin (an administrator is always in the
   Orga). Open Admin › **Rollen**: Alex under Admins with "Du" and no button; Olga and Tina under
   Orga with "Ändern".
2. Type "Fi" in the search, "Rolle geben" on **Fiona FarAway**, pick Orga, "Speichern". Fiona is
   under Orga; the notice says "Fiona FarAway ist jetzt in der Orga." with "Rückgängig".
3. Connect as Fiona: the Du page shows "Du bist jetzt in der Orga", Orga replaces Termine, no
   tour invitation elsewhere. "Rundgang starten" opens the Orga-Rundgang's first step; the card
   is gone on the next visit.
4. As Alex, make Fiona Admin. As Fiona: "Du bist jetzt Admin" with "Verstanden" (the tour is
   done); Orga and Admin in the navigation; Admin › Rollen works.

## 2. Take a role, undo (US3)

1. As Alex, "Ändern" on **Olga Organiser** → Keine → Speichern. Notice "… ist nicht mehr in der
   Orga." Connect as Olga: card "Du bist nicht mehr in der Orga", Termine is back, `/organiser`
   answers 403.
2. As Alex, change Tina to Keine and tap "Rückgängig" at once. Connect as Tina: no card, still in
   the Orga.

## 3. Own role and last admin (US4)

1. As Alex, a POST to `/admin/roles` for Alex's own ID ends with `?error=self`; nothing changes.
2. Connect as **Gesa Gast** (guest): Rollen shows the lists without buttons or search; a POST
   answers 403. Removing Alex from Admin › Rider ends with `?error=lastAdmin`; Alex is still there.

## 4. Settings (US5)

As Alex: Settings › "Wer in der Orga ist" lists the names and has "Mitglieder ändern". As Tina: the
row without the link. As a rider without a role (Bea Badges): no row.

## 5. Tests

`pnpm test -- test/integration/admin-roles` (and the other new files named in tasks.md); the pages
snapshot by running its whole file with `-u` and reading the `.snap` diff.
