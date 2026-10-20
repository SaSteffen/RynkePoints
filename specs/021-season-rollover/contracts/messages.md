# Contract: messages

New message ids in `src/i18n/messages/de.ts` (source) and `en.ts` (spec FR-039,
FR-050; constitution "Language"). Badge names go in `badges.de.ts` only, German
in every language (feature 013).

The ids below name the texts; implementation follows the catalogs' existing key
structure (e.g. nested objects) where it differs.

## Event kind

| Id | de | en |
|----|----|----|
| `eventKind.tour_de_paris` | Tour de Paris | Tour de Paris |

Wherever the existing kinds have a label (organiser event form, event lists,
Termine tab), this one is used; no amount line is shown for it (FR-004).
Implemented as `rynke.source.tour_de_paris`, next to the other kinds' labels.

## Tour badges

| Id | de | en |
|----|----|----|
| `badges.category.tour_de_paris` | Tour de Paris | Tour de Paris |
| `badges.category.tour_de_paris.sentence` | Für jeden Tag, den jemand aus dem Team auf der Tour de Paris fährt. | For every day someone from the team rides the Tour de Paris. |
| `badges.tourDay.for` | Tag {day} der Tour de Paris – der Ort folgt. | Day {day} of the Tour de Paris – the place follows. |
| `badges.unit.days` | existing ("Noch 4 Tage") | existing |

`badges.de.ts`: `tour-de-paris-1` → "Tour-Tag 1" … `tour-de-paris-8` →
"Tour-Tag 8" (stand-ins until Phase 2).

The category's sentence is implemented as `badges.about.tour_de_paris`, as
every category's sentence is.

## Album

As the mock-up words it: the name field says "Dieses Album gehört", the
figure tiles show the count apart from its label, and a line under the event
table sums it up.

| Id | de | en |
|----|----|----|
| `album.title` | Rynke-Album | Rynke album |
| `album.team.name` | Team Rynkeby Hamburg | Team Rynkeby Hamburg |
| `album.season` | Saison {season} | Season {season} |
| `album.owner` | Dieses Album gehört | This album belongs to |
| `album.coin` | Die Rynke-Münze | The Rynke coin |
| `album.rider.training` | Trainingsrynke | Training Rynke |
| `album.rider.team` | Teamrynke | Team Rynke |
| `album.rider.events` | Teamtermine dabei | Team events attended |
| `album.team.heading` | Die Saison des Teams | The team's season |
| `album.team.training` | {count} Trainingsrynke zusammen | {count} Training Rynke together |
| `album.events.date` / `.kind` / `.name` / `.riders` / `.you` | Datum / Art / Name / Rider / Du | Date / Kind / Name / Riders / You |
| `album.events.attended` | dabei | attended |
| `album.events.none` | Noch keine Teamtermine. | No team events yet. |
| `album.events.count` | {count} Teamtermine, davon {tour} Tage Tour de Paris | {count} team events, {tour} of them Tour de Paris days |
| `album.events.noTour` | {count} Teamtermine, noch keine Tour-Tage | {count} team events, no tour days yet |
| `album.events.yours` | du warst dabei ({count}) | you were there ({count}) |
| `album.continued` | {title} (Fortsetzung) | {title} (continued) |
| `album.stickers.mine` | Meine Abzeichen | My badges |
| `album.stickers.team` | Team-Abzeichen | Team badges |
| `album.stickers.count` | {earned} von {total} | {earned} of {total} |
| `album.stickers.secret` | ? | ? |
| `album.cutoff` | Stand: {date} | As of {date} |

Event kinds use `rynke.source.*`, category names `badges.category.*`.

## Privacy page (FR-040)

| Id | de | en |
|----|----|----|
| `privacy.album` | Am Ende jeder Saison erstellt der Betreiber der App für jede:n Fahrer:in ein Saisonalbum als PDF – aus den Daten, die du in der App siehst, und Summen des ganzen Teams. Das geschieht auf seinem eigenen Rechner; jedes Album bekommt nur die Person, der es gehört, und danach wird es gelöscht. | At the end of every season the app's operator makes a season album as a PDF for every rider – from the data you see in the app and sums over the whole team. This happens on their own computer; each album goes only to the person it belongs to and is deleted afterwards. |

Exact wording follows the existing privacy page's tone; the content above is
binding (feature 017).
