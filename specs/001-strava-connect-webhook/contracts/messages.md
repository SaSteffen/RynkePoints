# Contract: rider-facing messages

The complete set of message IDs for this feature. These are the keys of
`src/i18n/messages/de.ts` and `src/i18n/messages/en.ts` (research R16).

- German is the default and fallback locale. Tests that assert on page output
  assert the **German** text below (constitution, Language). Tests for
  `Accept-Language: en` or `rp_lang=en` assert the English text.
- Both catalogs MUST have exactly these keys, no empty values, and the same
  `{placeholders}` per message (FR-028, SC-010).
- Wording may be polished during implementation. If it is, update this file and
  the tests that quote it in the same change.
- Placeholders marked *html* are filled with a `SafeHtml` fragment through
  `tHtml`. All other placeholders are plain text and escaped.
- Strava's own terms are quoted as the rider sees them in Strava's German UI,
  for example „Nur du“ and „Meine Apps“.

## Catalog metadata and brand assets

| ID | de | en |
|---|---|---|
| `meta.languageName` | Deutsch | English |
| `meta.intlLocale` | de-DE | en-GB |
| `app.name` | RynkePoints | RynkePoints |
| `brand.connectWithStrava.src` | `/strava/de/connect-with-strava.svg` (falls back to `/strava/en/…` if Strava ships no German button, research R19) | `/strava/en/connect-with-strava.svg` |
| `brand.connectWithStrava.alt` | Mit Strava verbinden | Connect with Strava |
| `brand.poweredByStrava.src` | `/strava/de/powered-by-strava.svg` (same fallback rule) | `/strava/en/powered-by-strava.svg` |
| `brand.poweredByStrava.alt` | Powered by Strava | Powered by Strava |

## Layout

| ID | de | en |
|---|---|---|
| `layout.switcher.label` | Sprache | Language |
| `layout.logout` | Abmelden | Sign out |

## Landing page (`GET /`)

| ID | Params | de | en |
|---|---|---|---|
| `landing.title` | | Mit Strava verbinden | Connect with Strava |
| `landing.intro` | | RynkePoints sammelt die Radfahrten von Team Rynkeby Hamburg für Punkte und Events. | RynkePoints collects Team Rynkeby Hamburg's rides for points and events. |
| `landing.who` | `clubLink` *html* | Mitmachen können nur Mitglieder {clubLink}. | Only members of {clubLink} can take part. |
| `club.linkText` | | unseres Team-Clubs auf Strava | our team club on Strava |
| `landing.dataRead` | | Wir lesen von deinen Radfahrten nur Sportart, Startzeit, Distanz, Bewegungszeit und Höhenmeter – keine GPS-Spuren, Karten, Fotos oder Gesundheitsdaten. | From your rides we only read sport type, start time, distance, moving time and elevation gain – no GPS tracks, maps, photos or health data. |
| `landing.private` | | Auf Strava entscheidest du selbst, ob auch deine privaten („Nur du“) Aktivitäten dazugehören. | On Strava you decide whether your private ("Only You") activities are included. |
| `landing.purpose` | | Wir nutzen die Daten nur für die Punkte und Events des Teams. Niemand sonst sieht deine Aktivitäten. | We use the data only for the team's points and events. Nobody else sees your activities. |
| `landing.leave` | | Du kannst jederzeit aussteigen: auf deiner RynkePoints-Seite oder indem du RynkePoints in deinen Strava-Einstellungen entfernst. Wenn du den Club verlässt, löschen wir deine Daten innerhalb von 24 Stunden. | You can leave at any time: on your RynkePoints page, or by removing RynkePoints in your Strava settings. If you leave the club, we delete your data within 24 hours. |
| `landing.backups` | | Gelöschte Daten bleiben bis zu 7 Tage in den Sicherungen unseres Hosting-Anbieters und verschwinden danach automatisch. | Deleted data stays in our hosting provider's backups for up to 7 days and then disappears automatically. |
| `landing.cookies` | | Wir setzen nur notwendige Cookies: für die Anmeldung und für deine Sprachwahl. | We only set necessary cookies: for signing in and for your language choice. |

## Rider page (`GET /me`)

| ID | Params | de | en |
|---|---|---|---|
| `me.title` | | Deine RynkePoints | Your RynkePoints |
| `me.greeting` | `firstName` | Hallo {firstName}! | Hi {firstName}! |
| `me.status.connected` | | Mit Strava verbunden | Connected to Strava |
| `me.status.needsReconnect` | | Die Verbindung zu Strava muss erneuert werden. | Your Strava connection needs to be renewed. |
| `me.reconnect` | | Erneut verbinden | Reconnect |
| `me.scope.readAll` | | Einschließlich deiner privaten Aktivitäten | Including your private activities |
| `me.scope.sharedOnly` | | Nur geteilte Aktivitäten – private („Nur du“) Aktivitäten werden nicht importiert. | Shared activities only – private ("Only You") activities are not imported. |
| `me.import.running` | `date` | Deine Fahrten seit dem {date} werden importiert … | Importing your rides since {date} … |
| `me.import.done` | | Import abgeschlossen | Import complete |
| `me.recent.heading` | | Zuletzt importierte Fahrten | Recently imported rides |
| `me.recent.empty` | | Noch keine Fahrten importiert | No rides imported yet |
| `me.recent.col.date` | | Datum | Date |
| `me.recent.col.sport` | | Sportart | Sport |
| `me.recent.col.distance` | | Distanz | Distance |
| `me.recent.col.elevation` | | Höhenmeter | Elevation |
| `me.disconnect.button` | | Verbindung trennen und meine Daten löschen | Disconnect and delete my data |

`me.import.running` is shown for both `pending` and `running`; `{date}` is the
season start, formatted via `meta.intlLocale` (e.g. `01.01.2026` / `01/01/2026`).

## Units and sport types

| ID | Params | de | en |
|---|---|---|---|
| `units.km` | `value` | {value} km | {value} km |
| `units.m` | `value` | {value} m | {value} m |
| `sport.Ride` | | Radfahrt | Ride |
| `sport.MountainBikeRide` | | Mountainbike-Fahrt | Mountain bike ride |
| `sport.GravelRide` | | Gravel-Fahrt | Gravel ride |
| `sport.EBikeRide` | | E-Bike-Fahrt | E-bike ride |
| `sport.EMountainBikeRide` | | E-Mountainbike-Fahrt | E-mountain bike ride |
| `sport.VirtualRide` | | Virtuelle Fahrt | Virtual ride |

`{value}` is formatted with `Intl.NumberFormat(meta.intlLocale)`. Distance has
one decimal (`42,2` / `42.2` for 42195 m) and elevation is rounded to whole
metres (`1.234` / `1,234`). A test asserts that there's a `sport.<type>` message
for every member of `CYCLING_SPORT_TYPES`.

## Disconnect confirmation (`GET /me/disconnect`)

| ID | de | en |
|---|---|---|
| `disconnect.title` | Daten löschen? | Delete your data? |
| `disconnect.explain` | RynkePoints gibt den Zugriff auf dein Strava-Konto zurück und löscht sofort alle Daten über dich. Deine Aktivitäten auf Strava bleiben unverändert. | RynkePoints gives up its access to your Strava account and immediately deletes all data about you. Your activities on Strava stay as they are. |
| `disconnect.confirm` | Ja, alles löschen | Yes, delete everything |
| `disconnect.cancel` | Abbrechen | Cancel |

## Notice pages (`GET /notice/:id`)

| ID | Params | de | en |
|---|---|---|---|
| `notice.retry` | | Noch einmal versuchen | Try again |
| `notice.backToStart` | | Zur Startseite | Back to the start page |
| `notice.expired.title` | | Anmeldung abgelaufen | Sign-in expired |
| `notice.expired.body` | | Die Anmeldung ist abgelaufen. Bitte versuche es noch einmal. | Your sign-in expired. Please try again. |
| `notice.denied.title` | | RynkePoints braucht Lesezugriff auf deine Aktivitäten | RynkePoints needs read access to your activities |
| `notice.denied.body` | | Ohne diese Berechtigung kann RynkePoints nicht funktionieren. Wir haben nichts gespeichert. | RynkePoints can't work without this permission. We haven't stored anything. |
| `notice.teamFull.title` | | Das Team ist im Moment voll | The team is full for now |
| `notice.teamFull.body` | | Strava erlaubt RynkePoints gerade keine weiteren Fahrerinnen und Fahrer. Wir melden uns, sobald wieder Platz ist. | Strava doesn't allow RynkePoints any more riders right now. We'll let you know when there's room again. |
| `notice.failed.title` | | Verbindung fehlgeschlagen | Connection failed |
| `notice.failed.body` | | Die Verbindung zu Strava hat nicht geklappt. Bitte versuche es noch einmal. | Connecting to Strava didn't work. Please try again. |
| `notice.notMember.title` | | Nur für Club-Mitglieder | Club members only |
| `notice.notMember.body` | `clubLink` *html* | Nur Mitglieder {clubLink} können mitmachen. Tritt dem Club bei und versuche es dann noch einmal. Wir haben nichts über dich gespeichert. | Only members of {clubLink} can take part. Join the club and then try again. We haven't stored anything about you. |
| `notice.stravaBusy.title` | | Strava ist gerade ausgelastet | Strava is busy |
| `notice.stravaBusy.body` | | Bitte versuche es in ein paar Minuten noch einmal. Wir haben nichts gespeichert. | Please try again in a few minutes. We haven't stored anything. |
| `notice.deleted.title` | | Deine Daten wurden gelöscht | Your data has been deleted |
| `notice.deleted.body` | | Wir haben alle Daten über dich gelöscht. Kopien in den Sicherungen unseres Hosting-Anbieters verschwinden spätestens nach 7 Tagen. | We have deleted all data about you. Copies in our hosting provider's backups disappear after 7 days at the latest. |
| `notice.revokeFailed.body` | | Wir konnten den Zugriff bei Strava nicht zurückgeben. Bitte entferne RynkePoints in deinen Strava-Einstellungen unter „Meine Apps“. | We couldn't give up our access at Strava. Please remove RynkePoints under "My Apps" in your Strava settings. |

## Error pages

| ID | de | en |
|---|---|---|
| `error.notFound.title` | Seite nicht gefunden | Page not found |
| `error.notFound.body` | Diese Seite gibt es nicht. | This page doesn't exist. |
| `error.forbidden.title` | Anfrage abgelehnt | Request refused |
| `error.forbidden.body` | Bitte lade die Seite neu und versuche es noch einmal. | Please reload the page and try again. |

## Not catalogued (English, not rider-facing)

- Webhook responses (`/strava/webhook/:secret`) and `GET /health` (`ok`).
- Log messages and errors thrown in code.
- Queue message fields and D1 values (`status`, `import_status` and so on are
  enums, translated only when displayed).
