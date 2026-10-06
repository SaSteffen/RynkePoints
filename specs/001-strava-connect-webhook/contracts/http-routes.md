# Contract: HTTP routes

All routes are served by the single Worker (`src/index.ts`).

Rider-facing HTML pages are server-rendered in the visitor's language, German by
default. All their text comes from the message catalogs; message IDs are in
[messages.md](messages.md) (research R16). Each page carries Strava attribution
("Powered by Strava") per the brand guidelines.

Cookies:

- `rp_session`: signed session, `HttpOnly; Secure; SameSite=Lax; Path=/`, 30 days
  (research R9).
- `rp_oauth_state`: signed OAuth state, 10 minutes. Its value is
  `<state>:<consentVersion>`; `0` means the rider didn't agree on the way in
  (research R21).
- `rp_lang`: picked language, `Path=/; Max-Age=31536000; SameSite=Lax; Secure;
  HttpOnly`. Unsigned, and never stored server-side (research R18).

## Common to every rider-facing page

- **Language** is resolved per request (research R17):
  1. `rp_lang`, if it names a shipped locale;
  2. otherwise the best supported `Accept-Language` range;
  3. otherwise `en`, if `Accept-Language` names only unsupported languages;
  4. otherwise `de` (no header, or no language named).
- **Response headers**: `Content-Type: text/html; charset=utf-8`,
  `Content-Language: <locale>`, `Vary: Accept-Language, Cookie`. The page starts
  `<html lang="<locale>">`.
- **Layout** (`layout()` in `src/http/html.ts`):
  - **Title**: from the page's title message.
  - **Language switcher**: `<form method="post" action="/lang">`. It holds a
    hidden `next` set to the current page's path, plus one `<button
    name="lang" value="<locale>" lang="<locale>">` per shipped locale. Each button
    is labelled with that catalog's `meta.languageName`, and the current one is
    marked `aria-current="true"`. It works without JavaScript; no script is
    shipped.
  - **Footer**: `<img src="{brand.poweredByStrava.src}"
    alt="{brand.poweredByStrava.alt}">`.
- **Pages covered**: `/`, `/me`, `/me/disconnect` and `/notice/:id`, plus the
  rider-facing `404`/`403` pages (`error.notFound`, `error.forbidden`).
- **Not covered**: the Strava-facing and operational routes return plain
  responses in English that aren't catalogued.

## Rider-facing

### `GET /`

- Signed in → `302 /me`.
- Otherwise `200` HTML containing:
  - a plain explanation of what is read and why, who can join (club link), how
    to leave, and that deleted data stays in backups for up to 7 days (FR-002,
    FR-022a);
  - the consent of feature 004 (its FR-010, FR-011): what write access is for
    and that it is optional, who sees what, and that reading and sharing are
    required (`consent.*`);
  - which cookies are set (`landing.cookies`);
  - the consent form (FR-001, FR-002, research R19, R21):

    ```html
    <form method="post" action="/connect">
      <label><input type="checkbox" name="consent" value="{CONSENT_VERSION}" required>
        {consent.agree}</label>
      <button><img src="{brand.connectWithStrava.src}"
        alt="{brand.connectWithStrava.alt}"></button>
    </form>
    ```

### `POST /connect`

The rider agreed and goes to Strava (research R21). No session needed.

- **`Origin`** missing or foreign → `403` page (`error.forbidden`).
- **`consent`** (form field) ≠ the current `CONSENT_VERSION` →
  `303 /notice/consent-required`. Not sent to Strava, no cookie set.
- Otherwise `302` to `https://www.strava.com/oauth/authorize` with `client_id`,
  `redirect_uri=<origin>/auth/callback`, `response_type=code`,
  `approval_prompt=force`,
  `scope=read,activity:read,activity:read_all,activity:write` (research R1), and
  `state=<random>`. Sets `rp_oauth_state` to `<state>:<CONSENT_VERSION>`.
- Strava's approval screen uses the language the rider set on Strava; the app
  can't influence it (spec Assumptions). The rider may untick private
  activities and write access there.

### `GET /connect`

Reconnecting and changing permissions, for a signed-in rider only.

- No session, or the rider no longer exists → `302 /`.
- Otherwise the same `302` to Strava as `POST /connect`, with `rp_oauth_state`
  set to `<state>:0` (no new agreement).

### `GET /auth/callback`

Every outcome except success redirects to a notice page with a stable GET URL,
so reloading or switching language never re-submits a used `code` (research
R18).

"Existing rider" means a `riders` row for the token response's `athlete.id`
already exists (a connected rider signing in again, or a `needs_reconnect` rider
reconnecting).

| Input | Outcome |
|---|---|
| `state` missing or ≠ the cookie's state | `303 /notice/expired`. Nothing stored or changed. |
| `error=access_denied` | `303 /notice/denied` (explanation plus retry link). Nothing stored or changed; an existing rider keeps their earlier connection. |
| accepted `scope` lacks `activity:read` or `read`, new rider | Revoke the token, then `303 /notice/denied`. Nothing stored. |
| accepted `scope` lacks `activity:read` or `read`, existing rider | Revoke the token, delete the rider (cascade, FR-006), clear `rp_session`, `303 /notice/denied-deleted`. |
| token exchange `403` | `303 /notice/team-full` (FR-008). |
| token exchange other error | `303 /notice/failed`. |
| new rider, the cookie's consent version ≠ current `CONSENT_VERSION` (including `0`) | Revoke the token, then `303 /notice/consent-required`. Nothing stored. Checked after the scope rows above and before the club check. |
| club check: not a member, new rider | Revoke the token, then `303 /notice/not-member` (club link). Nothing stored. |
| club check: not a member, existing rider | Revoke the token, delete the rider (cascade, FR-004), clear `rp_session`, `303 /notice/not-member-deleted`. |
| club check inconclusive, new rider | Revoke the token, nothing stored, `303 /notice/strava-busy`. |
| club check inconclusive, existing rider | Not a disconnection (spec Edge Cases): no revoke, continue as "success, existing rider". The daily check (FR-004a) decides membership later. |
| success, new rider | Insert rider (with `scope_write`) and their consent record in one D1 batch, then the credentials; enqueue `import-page { page: 1, after: <season start> }`, set `rp_session`, `302 /me`. |
| success, existing rider | Update scopes (including `scope_write`) and credentials, set `status=connected` and `reconnect_requested_at=NULL`. Apply the reconnect rules (data-model.md). If the cookie carries the current consent version, record it (`INSERT OR IGNORE`). Set `rp_session`, `302 /me`. |

### `GET /notice/:id`

Public outcome page. It shows no rider data, needs no session, and renders in
the resolved language.

Retry links go to `/`, where the consent form is; a signed-in rider is sent on
to `/me` from there.

| `:id` | Messages | Extra |
|---|---|---|
| `expired` | `notice.expired.*` | retry link |
| `denied` | `notice.denied.*` | retry link. No claim about stored data: an existing rider who cancelled on Strava keeps their connection. |
| `denied-deleted` | `notice.denied.*` + `notice.deleted.body` | retry link; deletion and 7-day backup sentence (FR-022a) |
| `consent-required` | `notice.consentRequired.*` + `notice.nothingStored` | retry link |
| `team-full` | `notice.teamFull.*` | — |
| `failed` | `notice.failed.*` | retry link |
| `not-member` | `notice.notMember.*` + `notice.nothingStored` | club link `https://www.strava.com/clubs/<STRAVA_CLUB_ID>` |
| `not-member-deleted` | `notice.notMember.*` + `notice.deleted.body` | club link; deletion and 7-day backup sentence (FR-022a) |
| `strava-busy` | `notice.stravaBusy.*` + `notice.nothingStored` | retry link (only new riders get here) |
| `deleted` | `notice.deleted.*` | 7-day backup sentence (FR-022a) |
| `deleted-revoke-failed` | `notice.deleted.*` + `notice.revokeFailed.body` | "My Apps" hint |

- Known `:id` → `200`. Every notice page links back to `/` (`notice.backToStart`).
- Unknown `:id` → `404` page (`error.notFound`).

### `GET /me`

- Not signed in, or the rider no longer exists → `302 /`.
- `200` HTML showing:
  - greeting (first name) and connection status, with a reconnect link if
    `needs_reconnect`;
  - granted level ("shared activities" / "including private") and whether write
    access was granted (`me.scope.write` / `me.scope.noWrite`), with a "change
    permissions on Strava" link to `GET /connect` (FR-025);
  - import status, with the season start date formatted for the locale;
  - the 20 newest activities of that rider only (FR-025, FR-026). Each shows the
    date, the sport type as `sport.<SportType>`, distance in km and elevation in m,
    with numbers and dates formatted via `meta.intlLocale`;
  - the consent (FR-025; feature 004, FR-014): version and date of the
    rider's current consent record and who sees what (`consent.*`), or
    `me.consent.none` if no record exists;
  - the "Disconnect and delete my data" button, which leads to the confirmation
    page;
  - a sign-out button (`POST /logout`).

### `GET /me/disconnect`

Confirmation page with a POST form. Not signed in → `302 /`.

### `POST /me/disconnect`

- Requires a session and a same-origin `Origin` header, else `403` page
  (`error.forbidden`).
- Revokes the token at Strava (one retry on 503), then hard-deletes the rider
  (cascade) and clears the session cookie.
- `303 /notice/deleted`, which confirms deletion and that backup copies expire
  within 7 days (FR-022a). If the revoke failed, it goes to
  `303 /notice/deleted-revoke-failed` instead, which also tells the rider to
  remove RynkePoints under "My Apps" in their Strava settings.

### `POST /logout`

- Requires a same-origin `Origin` header.
- Clears `rp_session` and redirects `302 /`.

### `POST /lang`

Language switcher target (FR-029a, research R18). No session needed.

- **Body**: `application/x-www-form-urlencoded`, with `lang` and `next`.
- **`Origin`** missing or foreign → `403` page (`error.forbidden`).
- **`lang`** is a shipped locale → set `rp_lang=<lang>` with the attributes above.
  Otherwise leave the cookie unchanged.
- **`next`** must be one of `/`, `/me`, `/me/disconnect` or `/notice/<known
  id>`. Anything else (absolute or protocol-relative URLs, unknown paths) is
  replaced by `/`.
- **Response**: `303` to `next`. The next GET renders in the picked language.
- **Never** writes to D1 (FR-029a).

## Strava-facing

### `GET /strava/webhook/:secret`

Subscription validation.

- `:secret` ≠ `STRAVA_WEBHOOK_VERIFY_TOKEN` → `404`.
- `hub.mode=subscribe` and `hub.verify_token` matching → `200`
  `application/json` `{"hub.challenge":"<hub.challenge>"}`.
- Otherwise `403`.

### `POST /strava/webhook/:secret`

Event delivery. MUST answer within 2 s and never call Strava (FR-011).

- `:secret` mismatch → `404`.
- Body over 1,000 bytes or not matching the event shape → `400`.
- `subscription_id ≠ STRAVA_SUBSCRIPTION_ID` → `200`, dropped.
- Otherwise enqueue one message (see [queue-messages.md](queue-messages.md)) and
  answer `200`.
  - `object_type=activity` → `activity-event { athleteId: owner_id, activityId:
    object_id, aspect, changed: keys of updates }`.
  - `object_type=athlete` with `updates.authorized == "false"` → `delete-rider {
    athleteId: owner_id, reason: "deauthorized", revoke: false }`.
  - Any other athlete update → `200`, dropped.

Accepted event shape (all other fields ignored):

```json
{
  "object_type": "activity | athlete",
  "object_id": 1234567890,
  "aspect_type": "create | update | delete",
  "updates": { "title": "…", "type": "…", "private": "true", "authorized": "false" },
  "owner_id": 123456,
  "subscription_id": 1,
  "event_time": 1760000000
}
```

## Operational

### `GET /health`

`200` `ok` (existing).

### Any other path

`404`. Rider-facing `404` page (`error.notFound`) in the resolved language.
