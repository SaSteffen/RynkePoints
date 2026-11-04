# Data Model: Multiple Maintainers

No database change. These records live in `docs/maintainers.md`, unless noted.

## Maintainer

| Field | Notes |
|---|---|
| GitHub handle | Public. Also in the `MAINTAINER_HANDLES` repository variable |
| GitHub role | Stage 1: founding maintainer Owner, others Write. Stage 2: all Owner |
| Cloudflare role | Super Administrator or Administrator, per trial T6 |
| Rider data decision | Link to the access decision below. Needed before a Cloudflare role |

No email addresses here: the repository is public.

**Lifecycle**: proposed → on GitHub → decision recorded → on Cloudflare → (at stage 2) owner → removed.

## Access decision

Recorded by the data controller before production access (FR-017, FR-018). A personal name is fine, since the privacy page already names the controller; it needs the second person's agreement to appear in a public repository, or it's kept privately with a note saying so.

| Field | Notes |
|---|---|
| Who, date, decided by | |
| Basis | Including what Strava's API Agreement allows |
| Consent effect | Whether this is "newly shown to someone other than the rider", and the consent version if so |
| Privacy page changes | Done before access, or none needed |

## Credential record

FR-028. Secret values are never written here. Starting content:

| Credential | Lives in | Owner | Expiry | Who can replace it |
|---|---|---|---|---|
| Strava client secret, `STRAVA_CLIENT_SECRET` | Worker secret | Strava owner | None | Strava owner only |
| Strava webhook verify token, `STRAVA_WEBHOOK_VERIFY_TOKEN` | Worker secret | Project | None | Strava owner, since the subscription depends on it |
| `TOKEN_ENCRYPTION_KEY`, `SESSION_SIGNING_KEY`, `ADMIN_TOKEN`, `PUSH_VAPID_KEY` | Worker secrets | Project | None | Any maintainer on Cloudflare; the implementation lists what rotating each one breaks |
| `MAINTAINER_ALERT_EMAILS`, `CONTACT_FORWARD_EMAILS` | Worker secrets | Project | None | Any maintainer on Cloudflare |
| `CLOUDFLARE_API_TOKEN` | `production` environment | Cloudflare account | About one year; check the date | See trial T6 and research R8 |
| Release App's private key | `release` environment | Organization | None | Organization owners |
| Each maintainer's logins | Personal | That person | None | That person |
| Strava app | Strava | Strava owner | None | Not moved; see the spec's edge case |
| Domain registration | To fill in by the founding maintainer | | | |

## Stage

Stage 1 or 2, set by the state of `protect-approval` and organization owners, and named in `docs/maintainers.md`. It moves only forward, and only by the founding maintainer's decision.

## Merge queue result

FR-022, recorded in `docs/maintainers.md` and spec 027: date, outcome, what was tried, and whether spec 027's User Story 7 is dropped or kept.
