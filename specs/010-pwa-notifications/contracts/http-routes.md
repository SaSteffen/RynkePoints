# Contract: HTTP Routes

**Feature**: [../spec.md](../spec.md) | **Research**: R2, R8, R9, R10

New and changed routes. Everything else in 001's and 005's route contracts is
unchanged. Static files in `public/` (manifest, icons, `sw.js`, `app.js`) are
served as assets and never reach the Worker ([client.md](client.md)).

## `POST /me/notifications` (new)

Called by `public/app.js` only, with `fetch` and a `FormData` body.

| Field | Value |
|---|---|
| `action` | `on`, `off` or `check` |
| `endpoint` | the device's `PushSubscription.endpoint` |

Checks, in order:

1. `Origin` must equal the site's origin (`isSameOrigin`). Otherwise `403`.
2. A valid session. Otherwise `401`.
3. `action` must be one of the three values, and `endpoint` must pass the
   validation in [data-model.md](../data-model.md). Otherwise `400`.

All failures have an empty body.

| `action` | Effect | Response `200` JSON |
|---|---|---|
| `on` | Upsert for the session's rider; trim to 10 | `{"on":true}` |
| `off` | Delete endpoint + session's rider | `{"on":false}` |
| `check` | Read only | `{"on":<row exists for endpoint + session's rider>}` |

`Cache-Control: no-store` on every response. No rider data in any response.

## `POST /logout` (changed)

Reads the optional form field `push_endpoint`. If it is present and a session
is valid, it deletes the row with that endpoint and the session's rider, the
same as `off`. It needs no validation beyond a string of at most 1024
characters: the delete simply matches nothing otherwise.

Everything else is as before: the same-origin check, clearing the cookie and
redirecting to `/`. The handler now gets `ctx`.

## `GET /offline` (new)

`?lang=<locale>` picks the catalog if it is a known locale. Otherwise the
language is resolved as for any page (`resolveLocale`).

- Renders `layout()` with the title `offline.title` and one paragraph
  `offline.body`. The language switcher posts to `/lang` as usual, which is
  harmless offline.
- **Never reads the session or D1**: the response is the same for every
  visitor, and the service worker caches it.
- `Cache-Control: no-cache`.

## `GET /notification-text` (new)

The same `lang` handling as `/offline`. It returns JSON:

```json
{ "title": "<app.name>", "body": "<push.body>" }
```

- No session, no D1, `Cache-Control: no-cache`.
- The texts are fixed per language and contain no rider data (FR-015).

## Session renewal on every GET/HEAD (changed router behaviour)

After any GET or HEAD route has produced its response, the router checks:

- the request carried a valid `rp_session`;
- `expiresAt < now + SESSION_MAX_AGE − 86400`;
- the response has no `Set-Cookie` starting with `rp_session=`.

If all three hold, it appends `Set-Cookie: rp_session=…; Max-Age=15552000` with
the same attributes as today.

`/health`, the webhook and the static assets are excluded: the first two return
before the check, and the Worker never sees the assets.
`/offline` and `/notification-text` are excluded too, so their responses are
the same for everyone before the service worker caches them.

## `/me` and `/` markup (changed)

The new sections are listed in [client.md](client.md). Pages still render
without JavaScript, with the new sections hidden.
