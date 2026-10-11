# Contract: consent versions and the consent gate (User Story 4)

**Feature**: [spec.md](../spec.md) | **Research**: R11–R16 | **Data model**:
[data-model.md](../data-model.md) "Consent Version", "Consent state"

## `GET /me`, the gate

Shown instead of the rest of `/me` when the rider's consent state isn't `current`.
`layout` and title as `/me` (`me.title`); the `<h1>` is `me.consent.renew.heading`.
In this order:

1. The intro:
   - `missing`: `me.consent.none` (reworded in US1,
     [rider-pages.md](rider-pages.md));
   - `older`: `me.consent.renew.older` with `{accepted}`, `{date}` (the accepted
     record's day, formatted as on `/me`) and `{version}` (current), then a list
     with one item per key in `changes`.
2. The current consent: `consent.heading`, the short sentences and the
   `details.more` with the full text, then `consent.required`, as on the start
   page (feature 001 [messages.md](../../001-strava-connect-webhook/contracts/messages.md)
   "Consent").
3. The form:
   - `viaStrava`: `me.consent.renew.strava` (only for `older`; `me.consent.none`
     already says it), then `consentForm(i18n, current)` posting to `/connect`;
   - otherwise:

     ```html
     <form method="post" action="/me/consent">
     <p><label><input type="checkbox" name="consent" value="{current}" required> {consent.agree}</label></p>
     <button>{me.consent.renew.button}</button>
     </form>
     ```
4. `me.consent.renew.leave` and the link `<a href="/me/disconnect">{me.disconnect.button}</a>`.
5. The sign-out form, as on `/me`.

Not shown until the rider agrees: status, permissions, import progress, Rynke,
rides, the install hint and the notification switch. `GET /me/disconnect`,
`POST /me/disconnect`, `GET /connect` and `POST /logout` work as before
(scenario 5).

## `POST /me/consent`

| Condition, checked in this order | Answer |
|---|---|
| other origin (`isSameOrigin`) | `403`, `forbidden(i18n, "/me")` |
| no session or no rider row | `302 /` |
| form `consent` ≠ current version | `303 /me` |
| `viaStrava` | `303 /me` (the gate shows the Strava form) |
| state already `current` | `303 /me`, nothing written |
| otherwise | `recordConsent(db, athleteId, current, now)`, `303 /me` |

`recordConsent` is `INSERT OR IGNORE`, so a repeated post keeps the first
acceptance. No Strava request is made (Principle II).

## Through Strava (`viaStrava`)

Unchanged routes: `POST /connect` checks `consent` against the current version
from `ctx.consentVersions`, and the callback records it for the existing rider
and updates their scopes (001 R21). If the rider still leaves out a required
scope, the callback's existing refusal applies; if they leave out a scope that
only the new version requires, they are connected, the record is written, and
the gate stays (`viaStrava` is still true) — the callback is not changed to
refuse, since the version's requirement is enforced by the gate.

## Planned views

`requireRider(viewer)` first, then `requireConsent(viewer, ctx)`: `302 /me`
unless the state is `current` ([viewer-and-visibility.md](viewer-and-visibility.md)).
Others see a rider only as far as their accepted version allows (`maySee` with
`subjectVersion`, `sharedRiderIdsSince`).

## Messages

New keys, both catalogs (FR-040). Wording may be polished during
implementation; the catalogs and tests change together.

| ID | de | en |
|---|---|---|
| `me.consent.renew.heading` | Bitte stimme erneut zu | Please agree again |
| `me.consent.renew.older` | Du hast am {date} Version {accepted} zugestimmt. Version {version} ändert Folgendes: | You agreed to version {accepted} on {date}. Version {version} changes this: |
| `me.consent.renew.strava` | Dafür braucht RynkePoints eine weitere Berechtigung; Strava fragt dich danach. | RynkePoints needs another permission for this; Strava asks you for it. |
| `me.consent.renew.button` | Zustimmen und weiter | Agree and continue |
| `me.consent.renew.leave` | Du möchtest nicht zustimmen? Dann trenn die Verbindung; dabei löschen wir alle deine Daten. | Don't want to agree? Then disconnect; we delete all your data. |

## Publishing a new version

A code change in one PR (research R11):

1. Change the consent texts (`landing.*`, `consent.*`) in every catalog.
2. Add `consent.changes.v<N>.*` keys in every catalog saying what grew.
3. Append `{ version: N, published, requiredScopes, changes }` to
   `CONSENT_VERSIONS`; add a scope to `REQUESTED_SCOPES` in `src/http/auth.ts` if
   the version needs a new one.
4. If it shares something new, add the `RiderData` item with
   `SINCE_VERSION = N`, or raise an item's since-version if it now goes to more
   people.
5. Tests: the catalog tests cover the new keys; the gate tests run against the
   synthetic registry and need no change.

After the deploy, every rider meets the gate on their next visit to `/me` or a
planned view (SC-005).
