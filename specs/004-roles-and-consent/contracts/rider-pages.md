# Contract: changes to rider-facing pages and messages

**Feature**: [spec.md](../spec.md) | **Research**: R1, R7, R14

User Stories 1–3 add or remove no route; User Story 4 adds `POST /me/consent`
([re-consent.md](re-consent.md)). 001's routes ([001 contracts/http-routes.md](../../001-strava-connect-webhook/contracts/http-routes.md))
keep their behaviour, except the `/me` consent section below.

## The consent form, shared

`consentForm(i18n, version): SafeHtml` in a new `src/http/consent-form.ts`, where
`version` is the current one from `ctx.consentVersions` (research R11), renders
exactly what the landing page renders today:

```html
<form method="post" action="/connect">
<p><label><input type="checkbox" name="consent" value="{version}" required> {consent.agree}</label></p>
<button><img src="{brand.connectWithStrava.src}" alt="{brand.connectWithStrava.alt}"></button>
</form>
```

`GET /` uses it in place of its inline form; its markup doesn't change.

## `GET /me`, rider without a consent record

With US4 this is the consent gate in its `missing` state: it takes the place of
the rest of `/me` ([re-consent.md](re-consent.md)). It shows, in this order:

1. `me.consent.none` (reworded, below);
2. `consent.short.notRead`, `consent.short.read` and `consent.short.shown`;
3. `details.more` with the summary `consent.details`, holding the full text in
   the order of feature 001's
   [messages.md](../../001-strava-connect-webhook/contracts/messages.md)
   "Consent", then `consent.required`;
4. `consentForm(i18n)`.

These are the texts of consent version 1 (001 research R21). Submitting the form
is the existing `POST /connect` → Strava → `GET /auth/callback`, which records
the consent for the existing rider and updates their scopes (001 R21; callback
test "records consent for an existing rider without one"). A rider whose
consent is current sees `/me` and its consent section as today.

## Messages

Changed key here; US4's new keys are in [re-consent.md](re-consent.md). Both
catalogs change together (001 FR-028).

| ID | de | en |
|---|---|---|
| `me.consent.none` | Bitte stimme zu, damit wir deine Fahrten auswerten können. Strava fragt danach noch einmal nach den Berechtigungen. Bis dahin sieht das Team nichts von dir. | Please agree so we can count your rides. Strava then asks for the permissions again. Until then, the team sees nothing of yours. |

Wording may be polished during implementation; the file and tests change in the
same change.
