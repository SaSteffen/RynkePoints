# Contract: Privacy page messages

Every ID in both catalogs (`src/i18n/messages/de.ts`, `en.ts`), checked by
`test/unit/catalogs.test.ts`. German is the source text.

`privacy.updated` takes `{date}`. `privacy.contact.body` and
`privacy.rights.body` take `{email}`, a `mailto:` link to `CONTACT_EMAIL`.
`privacy.recipients.strava` takes `{stravaPrivacy}`, a link to Strava's privacy
policy whose text is `privacy.recipients.stravaPrivacy`. `privacy.link` is the
footer link on every page.

| ID |
|---|
| `privacy.link` |
| `privacy.title` |
| `privacy.updated` |
| `privacy.intro` |
| `privacy.controller.heading` |
| `privacy.controller.body` |
| `privacy.contact.body` |
| `privacy.purpose.heading` |
| `privacy.purpose.body` |
| `privacy.strava.heading` |
| `privacy.strava.rider` |
| `privacy.strava.rides` |
| `privacy.strava.runsSwims` |
| `privacy.strava.private` |
| `privacy.strava.never` |
| `privacy.strava.how` |
| `privacy.team.heading` |
| `privacy.team.body` |
| `privacy.team.derived` |
| `privacy.technical.heading` |
| `privacy.technical.cookies` |
| `privacy.technical.push` |
| `privacy.technical.logs` |
| `privacy.visibility.heading` |
| `privacy.visibility.you` |
| `privacy.visibility.team` |
| `privacy.visibility.organisers` |
| `privacy.visibility.public` |
| `privacy.legal.heading` |
| `privacy.legal.body` |
| `privacy.retention.heading` |
| `privacy.retention.body` |
| `privacy.retention.deletion` |
| `privacy.retention.backups` |
| `privacy.recipients.heading` |
| `privacy.recipients.cloudflare` |
| `privacy.recipients.push` |
| `privacy.recipients.strava` |
| `privacy.recipients.stravaPrivacy` |
| `privacy.recipients.usage` |
| `privacy.rights.heading` |
| `privacy.rights.body` |
| `privacy.changes.heading` |
| `privacy.changes.body` |
