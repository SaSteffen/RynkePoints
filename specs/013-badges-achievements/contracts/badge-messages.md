# Contract: badge text

Part B (see [../plan.md](../plan.md)). German is the source; English mirrors the
keys (FR-028). Badge names are the one exception (FR-041, research R20).

## German-only names: `src/i18n/messages/badges.de.ts`

```ts
export const BADGE_NAMES: Record<BadgeId, string> = {
  "distance-100": "…",   // one German name per badge of the catalog, 101 in all (69 before part C)
};
```

Used unchanged in every app language. A test checks it has exactly the
catalog's badge ids, no empty name, and no name twice. The names are written in
the implementation together with the project owner.

## Catalog keys (`de.ts`, `en.ts`)

| Key | German |
|-----|--------|
| `badges.heading` | Abzeichen |
| `badges.personal.newest` | Meine Abzeichen |
| `badges.personal.all` | Alle meine Abzeichen ({n}) |
| `badges.team.newest` | Team-Abzeichen |
| `badges.team.all` | Alle Team-Abzeichen ({n}) |
| `badges.empty` | Noch kein Abzeichen – deine erste Fahrt bringt dich näher. (encouraging empty state, US1 scenario 4) |
| `badges.missing` | Noch {value} |
| `badges.earnedOn` | erreicht am {date} |
| `badges.close` | Schließen (close button of the large view) |
| `badges.label` | {name}, {value} (a badge button's accessible name) |
| `badges.reveal.one` / `badges.reveal.many` | Neues Abzeichen: {name} / {n} neue Abzeichen |
| `badges.category.<id>` | Distanz, Höhenmeter, Teamtermine, Techniktraining, Trainings-Rynke, Längster Lauf, Laufen gesamt, Trainings-Rynke gemeinsam, Kilometer gemeinsam, Höhenmeter gemeinsam, Laufen gemeinsam, Große Ausfahrt, Teilnahmen |
| `badges.about.<category>` | one sentence under each category name on how it counts: "Alle Kilometer deiner Radfahrten in dieser Saison, die für Trainings-Rynke zählen.", "Die meisten Rider, die in dieser Saison bei einem einzigen Teamtermin dabei waren.", … |
| `badges.for.<category>` | how the badge was earned, a sentence with `{value}`: "Du bist in dieser Saison {value} Rad gefahren.", "Dein längster Lauf dieser Saison: {value} am Stück.", "Alle Rider zusammen haben in dieser Saison {value} im Training gesammelt.", … |
| `badges.value.<unit>` | the milestone in its unit: "{n} km", "{n} m", "{n} Rynke", "{n} Termine", "{n} Trainings", "{n} Rider", "{n} Teilnahmen" |
| `badges.value.<unit>.one` | the singular for "Noch 1 …": events, trainings, riders, attendances ("{n} Termin", "{n} Training", "{n} Rider", "{n} Teilnahme") |
| `badges.value.half`, `badges.value.marathon` | Halbmarathon, Marathon (run length's top badges) |
| `notification.badge` | Neues Abzeichen: {name} 🏅 |
| `notification.badges` | {n} neue Abzeichen 🏅 |

Numbers and dates go through `I18n.formatNumber` and `formatDate`, so 1.000 km
in German and 1,000 km in English. Distances in the gallery and on the ribbon in
whole kilometres; run length's ladder with one decimal (21,1 km).

## Consent wording (FR-023, research R22)

`consent.short.read` and the details name runs and the team sums; no new
`CONSENT_VERSIONS` entry. Tests assert the German text mentions "Lauf" and
"Team" sums, and that the version stays 1.

## Notification text (`/me/notification-text`, research R17)

When the rider's latest rise is a badge rise: `notification.badge` with the
first new badge's German name, or `notification.badges` for several. Otherwise
the existing Rynke text.

Team badges notify since issue #125: when every badge in the rise is a team
badge, `notification.teamBadge` ("Neues Team-Abzeichen: {name} 🏅") or
`notification.teamBadges` ("{n} neue Team-Abzeichen 🏅"). Either way the
response's `url` is `/me/badges`, which the service worker opens on a click.

## Part C: more categories (2026-10-12)

- `badges.de.ts` grows to the catalog's 101 badges; the 32 new names are
  written in the implementation with the project owner, like the first 69.
- New catalog keys, German as below, English mirroring them:

| Key | German |
|-----|--------|
| `badges.category.<id>` | Längste Fahrt, Virtuell, Längstes Schwimmen, Schwimmen gesamt, Winter: November, Winter: Dezember, Winter: Januar, Winter: Februar |
| `badges.about.<category>` | "Deine längste Radfahrt dieser Saison, die für Trainings-Rynke zählt.", "Alle Kilometer deiner virtuellen Fahrten und Fahrten auf der Rolle in dieser Saison.", "Dein längstes Schwimmen dieser Saison, im Becken oder im Freiwasser.", "Alle Kilometer, die du in dieser Saison geschwommen bist.", per month: "Tage im November, an denen du draußen gefahren bist." (and Dezember, Januar, Februar) |
| `badges.for.<category>` | "Deine längste Fahrt dieser Saison: {value} am Stück.", "Du bist in dieser Saison {value} virtuell gefahren.", "Dein längstes Schwimmen dieser Saison: {value} am Stück.", "Du bist in dieser Saison {value} geschwommen.", "Im November bist du an {value} draußen gefahren." (per month) |
| `badges.value.days` / `badges.value.days.one` | {n} Tage / {n} Tag |

- Consent (research R30): `consent.short.read` names swims ("deine Rad-, Lauf-
  und Schwimmaktivitäten"); `CONSENT_VERSIONS` stays 1. A test asserts the
  German text mentions "Schwimm".

## Part D: surprise badges (2026-10-12)

- `badges.de.ts` grows to 107 names; the six surprise names are written with
  the project owner (drafts: "Prost Neujahr", "Bescherung auf Rädern",
  "Gänsebraten abgestrampelt", "Nachteule", "Frühaufsteher", "Sofaheld").
- New keys, German as below, English mirroring them:

| Key | German |
|-----|--------|
| `badges.category.surprise` | Überraschungen |
| `badges.about.surprise` | ? (the same in every language) |
| `badges.surprise.<name>` | the ribbon: Neujahr, Heiligabend, Weihnachten, Nachteule, Frühaufsteher, Ruhetag |
| `badges.surprise.<name>.for` | why it was earned: "Du warst am Neujahrstag unterwegs.", "Du warst an Heiligabend unterwegs.", "Du warst an den Weihnachtsfeiertagen unterwegs.", "Du bist nach 21:30 Uhr losgefahren.", "Du bist vor 6 Uhr losgefahren.", "Eine Woche lang jeden Tag aktiv – und dann einen Tag Pause. Verdient!" |

`<name>` is `new-year`, `christmas-eve`, `christmas`, `night-owl`,
`early-bird`, `rest-day`. None of these reaches the page for an unearned badge.

## Part E: team surprise badges (2026-10-12)

| Key | German |
|-----|--------|
| `badges.category.team_surprise` | Team-Überraschungen |
| `badges.about.team_surprise` | ? |
| `badges.surprise.<name>` | Teampause, Alle draußen, Rund um die Uhr, Staffelstab, Silvesterrunde, Sonntagsausflug |
| `badges.surprise.<name>.for` | "Ein Tag, an dem das ganze Team die Füße hochgelegt hat.", "Ein Tag, an dem wirklich alle unterwegs waren.", "Zu jeder Stunde eines Tages war jemand aus dem Team unterwegs.", "30 Tage am Stück war jeden Tag jemand aus dem Team aktiv.", "Mindestens fünf aus dem Team waren an Silvester unterwegs.", "Mindestens zehn aus dem Team an einem Sonntag ohne Teamtermin." |

`<name>`: `day-off`, `all-out`, `round-the-clock`, `relay`, `new-years-eve`,
`sunday-outing`. Names (German only): "Kollektiver Couchtag", "Alle Mann an
Deck", "Die Nacht durchgefahren", "Staffel ohne Ende", "Silvesterknaller",
"Sonntagskarawane" (the project owner confirms them).


## Part F: surprise badges from cycling traditions (2026-10-14)

`badges.de.ts` grows to 121 names. New keys, German as below, English
mirroring them:

| `<name>` | `badges.surprise.<name>` (ribbon) | `badges.surprise.<name>.for` (why) |
|----------|-----------------------------------|-------------------------------------|
| `festive-500` | Festive 500 | "Zwischen Heiligabend und Silvester 500 Kilometer gefahren." |
| `stage-rider` | Etappenfahrer | "Drei Tage am Stück je 100 Kilometer – wie auf der Tour." |
| `triathlon` | Dreikampf | "Radfahren, Laufen und Schwimmen an einem Tag." |
| `pi-day` | Kreiszahl | "Am Pi-Tag, dem 14. März, mindestens 31,4 Kilometer am Stück gefahren." |
| `solstice` | Sonnenwende | "Draußen gefahren am kürzesten und am längsten Tag des Jahres." |
| `easter` | Ostern | "An Ostern unterwegs gewesen." |
| `everesting` | Everesting | "In einem Monat 8.848 Höhenmeter gesammelt – einmal Mount Everest." |
| `festive-team` | Festive Team | "Zwischen Heiligabend und Silvester ist das ganze Team gefahren." |

Names (German only, drafts the project owner confirms): "Plätzchen
weggestrampelt", "Tour de Rynke", "Dreifach-Held", "Runde Sache", "Licht und
Schatten", "Osterhase auf Rädern", "Gipfelstürmer", "Festtags-Gang".
