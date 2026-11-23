# Contract: Pages

German is the key source; the other nine catalogs get the same meaning in their own words. Layout
and look follow the design draft (spec header). The new parts reuse the Settings page's grouped
lists (`settings-section`, `settings-list`, `settings-row is-static`, `settings-avatar`,
`settings-chip`, `settings-note`) and the undo notice (`notice notice-undo`).

## Admin switch

`adminSwitch` gets a third segment after Nutzung and Rider: key icon, "Rollen", `/admin/roles`.

## Admin › Rollen (`/admin/roles`)

Inside `main`: the switch, then `div.settings-page.roles` with two columns on desktop (one on a
phone).

Left column:

1. The notice after a change, if any (see below).
2. Hint: "Die Orga sieht alle Rider mit Vornamen: Rynke, was fehlt, Kilometer und Höhenmeter pro
   Tag, Termine und Korrekturen. Admins sind immer auch in der Orga und betreiben dazu die App:
   Nutzung, Rider und Rollen."
3. Section "Admins": own administrators, each row avatar (initial), name, "Admin seit {date}"
   (only with `role_since`), and "Ändern" — except the viewer's row, with the chip "Du" and no
   button. Note under it, only when the viewer is the one own administrator: "Außer dir ist
   niemand Admin. Deine eigene Rolle kann nur ein anderer Admin ändern." Otherwise: "Deine eigene
   Rolle kann nur ein anderer Admin ändern."
4. Section "Orga": organisers who aren't administrators, guests left out, rows as above with "In
   der Orga seit {date}" and "Ändern". Note: "Admins stehen oben und sind hier nicht noch einmal
   aufgeführt." Empty list: "Niemand außer den Admins."

Right column (own administrators only; guests don't get it):

5. Section "Rolle geben": search field "Rider finden", the listed riders without a role, each with
   "Rolle geben"; note "Hier stehen nur Rider, die ihre Daten mit dem Team teilen." A search with
   no hit: "Niemand gefunden."

Guests see 1–4 without any button.

## The choice (`dialog.role-sheet`)

Title "Rolle für {name}". Three radio rows, the current role checked:

- "Keine" — "{name} sieht, was alle Rider sehen."
- "Orga" — "Sieht alle Rider mit Vornamen, ihre Rynke, was ihnen fehlt, Kilometer und Höhenmeter
  pro Tag. Legt Termine und Korrekturen an."
- "Admin" — "Alles aus der Orga, dazu die Nutzung der App, Rider entfernen und Rollen ändern."

Then "{name} bekommt beim nächsten Öffnen der App eine Nachricht." and the buttons "Abbrechen"
(closes, nothing sent) and "Speichern" (posts). Below 700 px a sheet from the bottom, above it a
centred dialog, over a dimmed page.

## Notice after a change

`div.notice.notice-undo[role=status]` with one sentence and a "Rückgängig" form (posts the
previous role):

- to Orga: "{name} ist jetzt in der Orga."
- to Admin: "{name} ist jetzt Admin."
- Admin → Orga: "{name} ist kein Admin mehr."
- to none: "{name} ist nicht mehr in der Orga."

Errors (`?error=`): `self` "Deine eigene Rolle kann nur ein anderer Admin ändern.", `unknown`
"Diesen Rider gibt es hier nicht mehr."

## Role card (Du page, first item of `.overview-grid`, full width)

`section.notice.role-notice[role=status]`, a heading, text, buttons:

- **Joined the Orga** — "Du bist jetzt in der Orga". "{by} hat dich am {date} in die Orga
  aufgenommen. Der Orga-Tab ist neu; der Rundgang zeigt dir, was drin ist." / "Die Rider haben
  zugestimmt, dass die Orga ihre Daten sieht. Weitergeben gehört nicht dazu." Buttons "Rundgang
  starten" (`action=tour`), "Später" (`action=close`).
- **Became Admin** — "Du bist jetzt Admin". "{by} hat dich am {date} zum Admin gemacht. Unter
  Admin siehst du die Nutzung der App und alle Rider mit ihrer Verbindung, und du vergibst die
  Rollen. In der Orga bist du damit auch." Buttons "Orga-Rundgang starten" and "Später" while the
  Orga-Rundgang isn't done; otherwise "Verstanden".
- **No longer Admin** — "Du bist kein Admin mehr". "{by} hat dir am {date} die Admin-Rolle
  genommen. In der Orga bist du weiter." Button "Verstanden".
- **Left the Orga** — "Du bist nicht mehr in der Orga". "{by} hat dich am {date} aus der Orga
  genommen. Die Rider mit Namen siehst du nicht mehr. Deine Termine findest du wieder unter
  Termine." (Without events, feature 039: the last sentence is left out.) Button "Verstanden".

## Settings row (organisers and administrators)

After the consent row in "Rynke und deine Daten": `li#settings-orga`, people icon, title "Wer in
der Orga ist", subtitle the names ("Alex Admin (Admin), Olga Organiser, Tina TrainingDone": own
administrators first, then organisers, each by first name). Opened: "Sie sehen deine Rynke,
Kilometer und Höhenmeter mit deinem Vornamen. Admins betreiben außerdem die App. Kommt jemand
dazu, steht es hier." For own administrators also the link "Mitglieder ändern" → `/admin/roles`.
