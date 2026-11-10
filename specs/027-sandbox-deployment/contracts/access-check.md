# Access check (fail closed)

Where: `dev/worker.ts` (or a module under `dev/` it imports), first thing in `devFetch` when
`RYNKE_FAKE_STRAVA` is `sandbox`. Research R3.

## Modes

| `RYNKE_FAKE_STRAVA` | Hosts answered | Access token |
|---|---|---|
| `local-only` (unchanged) | `localhost`, `127.0.0.1`, `[::1]`, `*.localhost` | not checked |
| `sandbox` | exactly `SANDBOX_HOST` | required |
| anything else, or unset | none: `assertFakeMode` throws | — |

In `sandbox` mode, `assertFakeMode` also throws when `SANDBOX_HOST`, `ACCESS_TEAM_DOMAIN` or
`ACCESS_AUD` is missing or empty. Production's entry (`src/index.ts`) never reads any of these.

## Request check, in order

1. Host is `SANDBOX_HOST`. Otherwise `403`.
2. Header `Cf-Access-Jwt-Assertion` is present. Otherwise `403`.
3. The token is a JWT whose header has `alg: RS256` and a `kid`. Otherwise `403`.
4. The key for `kid` comes from `https://<ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs` (`keys`,
   JWK). Cached in the isolate for an hour; fetched again at most once per request for an
   unknown `kid`. Keys not available: `403`.
5. The signature verifies (`crypto.subtle.verify`, RSASSA-PKCS1-v1_5, SHA-256). Otherwise `403`.
6. Claims: `iss` is `https://<ACCESS_TEAM_DOMAIN>`; `aud` (string or list) contains
   `ACCESS_AUD`; `exp` > now − 60 s; `nbf`, if present, ≤ now + 60 s. Otherwise `403`.

Only then does the request reach seeding checks, `/_dev/` or the app.

**Refusal**: `403`, `Content-Type: text/plain`, body `Sandbox: access required`, no cookies set,
nothing logged but `sandbox access refused reason=<step>`. The token and its claims are never
logged.

## Tests (Vitest, red first)

Each with a key pair generated in the test and the certs URL answered by a stubbed `fetch`:
- a valid token passes and the app answers;
- no header, a malformed token, `alg: none`, `HS256`, an unknown `kid`, a bad signature, another
  `aud`, another `iss`, an expired token, a future `nbf`: each `403`, and neither the app nor
  `/_dev/` ran;
- another host with a valid token: `403`;
- the production host `trhh-rynke-coins.link` and `europe.trhh-rynke-coins.link`: `403` in both
  modes (FR-013);
- missing `ACCESS_AUD` (and each of the other two): fake mode doesn't start;
- certs URL failing: `403`;
- `local-only` mode on `localhost` works as before, without a token.
