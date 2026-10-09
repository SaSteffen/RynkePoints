# Contract: Catalog Changes

**Feature**: [../spec.md](../spec.md) | FR-017

German is the source. `en.ts` gets the same keys with English text. The wording
can be polished during implementation; the keys and placeholders are the
contract.

## Added

| Key | German |
|---|---|
| `waiting.heading` | Deine Fahrten werden geholt |
| `waiting.body` | Weil du dich gerade verbunden hast, holen wir einmalig deine Fahrten seit dem {date} von Strava. Das passiert nur dieses eine Mal. Schau in etwa 5 Minuten wieder vorbei – diese Seite aktualisiert sich von selbst. |
| `me.recent.none` | Noch keine Fahrten in dieser Saison. |
| `prompt.install.text` | Hol dir RynkePoints als App auf deinen Startbildschirm. |
| `prompt.notify.text` | Sollen wir dir Bescheid sagen, wenn du neue Rynke bekommst? |
| `prompt.notify.accept` | Benachrichtigungen einschalten |
| `prompt.notify.decline` | Nicht jetzt |
| `prompt.close` | Schließen |

## Removed

`me.import.done`, `me.recent.empty`, `rynke.notice.notWorkedOut`,
`rynke.notice.importing`, `install.dismiss`.

## Kept

`install.button` and `install.ios` are used by both the prompt and Settings, and
`rynke.notice.updating` is kept too.
