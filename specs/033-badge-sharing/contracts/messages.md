# Contract: Messages

All new text goes into every catalog under `src/i18n/messages/`. German is the source, English the
reference, and the other languages get proper translations (FR-028). The wording follows the mock-up
and the house rules for German: neutral words, no poster slogans. The badge's own name comes from the
existing badge names.

| Key | de | en |
| --- | --- | --- |
| `badges.share.button` | Teilen | Share |
| `badges.share.title` | Abzeichen teilen | Share badge |
| `badges.share.label` | „{name}“ teilen | Share “{name}” |
| `badges.share.formatLegend` | Als | As |
| `badges.share.format.story` | Story | Story |
| `badges.share.format.image` | Bild | Image |
| `badges.share.format.photo` | Auf Foto | On photo |
| `badges.share.shiny` | Glitzernd | Sparkling |
| `badges.share.plain` | Ohne Hintergrund | No background |
| `badges.share.pickPhoto` | Foto wählen | Choose photo |
| `badges.share.otherPhoto` | Anderes Foto | Other photo |
| `badges.share.photoPrivate` | Dein Foto bleibt auf deinem Gerät. | Your photo stays on your device. |
| `badges.share.photoUnreadable` | Dieses Foto kann dein Browser nicht öffnen. Nimm ein anderes. | Your browser can't open this photo. Choose another one. |
| `badges.share.hintTouch` | Abzeichen mit einem Finger verschieben, mit zwei Fingern drehen oder größer und kleiner ziehen. | Drag the badge with one finger, turn or pinch it with two to rotate or resize it. |
| `badges.share.hintMouse` | Abzeichen mit der Maus verschieben, am Punkt in der Ecke drehen oder größer und kleiner ziehen. | Drag the badge with the mouse, drag the dot in its corner to rotate or resize it. |
| `badges.share.turn` | Abzeichen drehen oder Größe ändern | Rotate or resize the badge |
| `badges.share.recording` | Wird gerendert … | Rendering … |
| `badges.share.send` | Teilen … | Share … |
| `badges.share.save` | Speichern | Save |
| `badges.share.copy` | Kopieren | Copy |
| `badges.share.saved` | Gespeichert. | Saved. |
| `badges.share.copied` | Kopiert: zum Einfügen bereit. | Copied: ready to paste. |
| `badges.share.failed` | Das ging hier nicht. Speichern geht immer. | That didn't work here. Saving always does. |
| `badges.share.text` | Neues Abzeichen: {name} ({value}) 🐒 | New badge: {name} ({value}) 🐒 |

New compared with the mock-up: `photoUnreadable` and `failed`, for the edge cases. Existing keys are
reused: `badges.earnedOn` for the date line, `badges.close` for the close button, and the team's app
name for the mark and the file name.
