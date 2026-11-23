# Contract: Pages

German is the key source; the other nine catalogs get the same meaning in their own words. Layout
and look follow the design draft (spec header, rows 8–10). The page reuses the Settings page's
grouped lists (`settings-section`, `settings-list`, `settings-row is-static`, `settings-avatar`,
`settings-chip`, `settings-note`), the undo notice (`notice notice-undo`) and feature 043's
dialog (`dialog.role-sheet`).

## Admin switch

Two segments: Nutzung (gauge icon, `/admin`) and "Rider und Rollen" (people icon,
`/admin/riders`). The key-icon segment is gone.

## Rider und Rollen (`/admin/riders`)

Inside `main`: the switch, then `div.settings-page.roles`: two columns from 840 px, one column
below (the columns stack).

**First column**

1. The notice, if any: the undo notice after a role change, "Entfernt und gesperrt." after a
   removal, or an error ([http-routes.md](http-routes.md)).
2. The text `p.roles-hint`: with Termine "Die Orga sieht Trainingszahlen und Rynke aller Rider,
   legt Termine an und trägt ein, wer da war. Admins sind immer auch in der Orga und betreiben
   dazu die App: Nutzung, Rider und Rollen."; without Termine the same without ", legt Termine an
   und trägt ein, wer da war".
3. The search `input[type=search].rider-search[data-role-search]`, placeholder and label "Rider
   finden", and under it `p[data-role-search-none][hidden]` "Niemand gefunden.".
4. **Admins**: own administrators. Note as today: only for an own administrator viewing, "Außer
   dir ist niemand Admin. …" when they are the only one, else "Deine eigene Rolle kann nur jemand
   anderes mit Admin-Rolle ändern."
5. **Orga**: organisers who aren't administrators. Note "Admins haben ebenfalls Orga-Rechte.";
   empty list "Niemand außer den Admins."
6. **Gäste**, only if the team has guests. Note "Gäste bekommen hier keine Rolle; Ändern zeigt
   ihre Verbindung und Entfernen."

**Second column**

7. **Ohne Rolle**: listed riders without a role. Note "Hier stehen nur Rider, die ihre Daten mit
   dem Team teilen: {listed}. Zustimmung steht noch aus: {waiting}. Gesperrt: {blocked}." ({listed}:
   riders in Admins, Orga and Ohne Rolle together). Empty list: "Alle hier haben schon eine
   Rolle."; when no rider at all is listed: "Noch niemand hat zugestimmt." (the note and its
   counts stay).

Every viewer sees all of it, guests included.

### A row (`li[data-name]`)

`data-name` is the first name in lower case (the search). Inside, `div.settings-row.is-static`:

- the avatar (the initial);
- `.settings-text`: the title (first name, then the chip "Du" on the viewer's own row, "Gast" on
  a guest's row); then, in this order, only what applies: "Admin seit {date}" / "In der Orga seit
  {date}" (listed riders with a role date), "Verbunden am {date}" (guests), and the red line
  `.settings-sub.warn` ("Muss sich neu verbinden", "Import läuft noch", or both joined with " · ");
- the button "Ändern" (`button.button-outlined`) on every row but the viewer's own;
- inside the row `li`, after it, a `<template data-facts>` holding the sheet's facts (below).

The button carries `data-role-open`, `data-athlete`, `data-title` (the first name),
`data-note` ("{name} bekommt beim nächsten Öffnen der App eine Nachricht."), `data-remove`
(`/admin/riders/{id}/remove`) and, for a rider who can get a role, `data-role` (`none`, `orga` or
`admin`). A guest's button has no `data-role`.

### The facts (`<template data-facts>`)

`dl.rider-facts` of `div > dt + dd`: "Verbindung" ("Verbunden" / "Muss sich neu verbinden"),
"Verbunden am" (date), "Mitgliedschaft zuletzt geprüft" (date; not for guests), "Import"
("Läuft noch" / "Fertig"). The `dd` of a fact that needs attention has `class="warn"` (red, bold;
the words carry the meaning).

## The sheet (`dialog.role-sheet`)

One dialog per page, a bottom sheet below 700 px and a centred dialog above, over a dimmed page.
Its form posts to `/admin/roles`. From top to bottom:

1. `h2#role-sheet-title`: the rider's first name.
2. `div[data-facts]`: the clicked row's facts.
3. The role part (`div[data-role-part]`, only in the page when the viewer is not a guest; hidden
   by `app.js` for a guest's row): the hidden `athlete` field, `h3` "Rolle", the three radio rows
   with the current role checked, and the line `[data-role-note]`.
   - "Keine": "Sieht, was alle Rider sehen."
   - "Orga": with Termine "Sieht Trainingszahlen und Rynke aller Rider, legt Termine an und
     trägt ein, wer da war."; without "Sieht Trainingszahlen und Rynke aller Rider."
   - "Admin": "Alles aus der Orga, dazu die Nutzung der App, Rider entfernen und Rollen ändern."
4. `div.actions`: on the left "Entfernen" (`a.button-text.sheet-remove`, its `href` set from the
   button's `data-remove`, error colour); on the right "Abbrechen" (closes, sends nothing) and,
   when the viewer is not a guest and the row has a role part, "Speichern" (`button[data-role-save]`).

The notice after a change and its "Rückgängig" form are as in feature 043.

## Texts (German; all ten catalogs)

| Key | German | Change |
|---|---|---|
| `admin.switch.riders` | Rider und Rollen | changed |
| `admin.switch.roles` | | removed |
| `admin.roles.hint` | Die Orga sieht Trainingszahlen und Rynke aller Rider. Admins sind immer auch in der Orga und betreiben dazu die App: Nutzung, Rider und Rollen. | changed |
| `admin.roles.hint.events` | Die Orga sieht Trainingszahlen und Rynke aller Rider, legt Termine an und trägt ein, wer da war. Admins sind immer auch in der Orga und betreiben dazu die App: Nutzung, Rider und Rollen. | new |
| `admin.roles.orgaNote` | Admins haben ebenfalls Orga-Rechte. | changed |
| `admin.roles.choice.orga.text` | Sieht Trainingszahlen und Rynke aller Rider. | changed |
| `admin.roles.choice.orga.text.events` | Sieht Trainingszahlen und Rynke aller Rider, legt Termine an und trägt ein, wer da war. | new |
| `admin.roles.give.heading` → `admin.roles.without.heading` | Ohne Rolle | renamed, changed |
| `admin.roles.give.note` → `admin.roles.without.note` | Hier stehen nur Rider, die ihre Daten mit dem Team teilen: {listed}. Zustimmung steht noch aus: {waiting}. Gesperrt: {blocked}. | renamed, changed |
| `admin.roles.give.none` → `admin.roles.without.empty` | Alle hier haben schon eine Rolle. | renamed |
| `admin.roles.give.button` | | removed ("Ändern" is `admin.roles.change`) |
| `admin.roles.sheet.title` | | removed (the title is the name) |
| `admin.roles.sheet.role` | Rolle | new |
| `admin.riders.attention.import` | Import läuft noch | new |
| `admin.riders.guest.since` | Verbunden am {date} | new |
| `admin.riders.guests.note` | Gäste bekommen hier keine Rolle; Ändern zeigt ihre Verbindung und Entfernen. | new |
| `admin.riders.counts` | | removed (in `admin.roles.without.note`) |

Kept as they are: `admin.riders.status*`, `.connected`, `.checked`, `.import*`, `.remove`,
`.guests.heading`, `.guest`, `.none`; all `admin.roles.*` not named above; `admin.remove.*`;
`settings.orga.*`; the consent texts.
