# Contract: badge text

Part B (see [../plan.md](../plan.md)). German is the source; English mirrors the
keys (FR-028). Badge names are the one exception (FR-041, research R20).

## German-only names: `src/i18n/messages/badges.de.ts`

```ts
export const BADGE_NAMES: Record<BadgeId, string> = {
  "distance-100": "…",   // one German name per badge of the catalog, 69 in all
};
```

Used unchanged in every app language. A test checks it has exactly the
catalog's badge ids, no empty name, and no name twice. The names are written in
the implementation together with the project owner.

## Catalog keys (`de.ts`, `en.ts`)

| Key | German |
|-----|--------|
| `badges.heading` | Abzeichen |
| `badges.intro` | Wie weit es noch bis zum nächsten Abzeichen ist – welches es wird, bleibt geheim. |
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
