# Contract: changes to rider-facing pages and messages

**Feature**: [spec.md](../spec.md) | **Research**: R1, R7

No route is added or removed. 001's routes ([001 contracts/http-routes.md](../../001-strava-connect-webhook/contracts/http-routes.md))
keep their behaviour, except the `/me` consent section below.

## The consent form, shared

`consentForm(i18n): SafeHtml` in a new `src/http/consent-form.ts` renders exactly
what the landing page renders today:

```html
<form method="post" action="/connect">
<p><label><input type="checkbox" name="consent" value="{CONSENT_VERSION}" required> {consent.agree}</label></p>
<button><img src="{brand.connectWithStrava.src}" alt="{brand.connectWithStrava.alt}"></button>
</form>
```

`GET /` uses it in place of its inline form; its markup doesn't change.

## `GET /me`, rider without a consent record

The "Your consent" section shows, in this order:

1. `me.consent.none` (reworded, below);
2. `landing.dataRead`, `landing.private`, `landing.purpose`, `landing.leave`;
3. `consent.organisers`, `consent.team`, `consent.required`, `consent.write`;
4. `consentForm(i18n)`.

These are the texts of consent version 1 (001 research R21). Submitting the form
is the existing `POST /connect` → Strava → `GET /auth/callback`, which records
the consent for the existing rider and updates their scopes (001 R21; callback
test "records consent for an existing rider without one"). The rest of `/me` is
unchanged; a rider with a record sees the section as today.

## Messages

Changed key; no key is added or removed. Both catalogs change together (001 FR-028).

| ID | de | en |
|---|---|---|
| `me.consent.none` | Für dich ist noch keine Zustimmung gespeichert. Lies bitte, was du mit dem Verbinden erlaubst, und stimme zu; Strava fragt dann noch einmal nach deinen Berechtigungen. Bis dahin sieht niemand im Team etwas von dir. | No consent is recorded for you yet. Please read what you agree to by connecting, and agree; Strava then asks for your permissions again. Until then, nobody on the team sees anything of yours. |

Wording may be polished during implementation; the file and tests change in the
same change.
