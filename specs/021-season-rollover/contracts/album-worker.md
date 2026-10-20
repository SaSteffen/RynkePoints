# Contract: the local album Worker (`album/`)

Started only by `pnpm season:album` under `wrangler dev`; never deployed
(research R12). Answers only requests whose host is `127.0.0.1` or `localhost`
(anything else: 404).

## Configuration (`album/wrangler.jsonc`)

| Key | Value |
|-----|-------|
| `name` | `rynke-album` |
| `main` | `worker.ts` (the entry; the routes are in `routes.ts`, so tests run them without Wrangler) |
| `workers_dev` | `false`; no `routes` |
| `assets` | `{ "directory": "../public" }` (badges, coin, placeholders) |
| `d1_databases` | `DB`: the production `database_id`, `"remote": true` |
| vars | none; `SEASON_START_DATE` and `QUALIFICATION_DEADLINE` come as `--var` from the root config |

## Routes

| Method, path | Answer |
|--------------|--------|
| `GET /riders?cutoff=YYYY-MM-DD` | `200` JSON `[{ "athleteId": 101, "file": "anna-1" }, …]`: every listed rider (feature 014) at the time of the request, in first-name order; `file` is the PDF's file stem. |
| `GET /album/:athleteId?cutoff=YYYY-MM-DD` | `200` HTML: the rider's whole album as one document (`<section class="page">` per A4 page), in German, the default language: the app does not store a rider's language (migration `0001`; it lives in the rider's browser), so FR-039's "rider's app language" is open. `404` for a rider who is not listed. |
| `GET /album.css`, `GET /fonts/*` | The album's stylesheet (`album/style.ts`) and font (`album/fonts/`, bundled by `wrangler.jsonc`'s `Data` rule). |
| `GET /badges/*`, `/coin/*`, … | Static assets from `public/`. |
| anything else | `404` |

`cutoff` is required on both data routes; an invalid date answers `400`.

## Read-only guard (`album/guard.ts`)

The Worker wraps `env.DB` before anything reads it:

| D1 method | Allowed |
|-----------|---------|
| `prepare(sql)` | only when `sql`, with leading comments and whitespace removed, starts with `SELECT` or `WITH` and has no further statement after a `;` |
| `batch(statements)` | only statements that passed `prepare` |
| `exec`, `dump`, `withSession` writes | never: throws |

A rejected statement throws `ReadOnlyError` naming the first word; the route
answers `500` and the command stops (exit 3). `album-guard.test.ts` checks
INSERT, UPDATE, DELETE, REPLACE, CREATE, DROP, ALTER, PRAGMA, `WITH … DELETE`
and a `SELECT …; DELETE …` pair are rejected, and the app's real readers pass.

## Must never

- be imported by anything under `src/` (dev-guard layer 1 covers `album/`);
- call a writer from `src/db/` (reveals, rises, notices, balances);
- read Strava or the queue (it has no such bindings).
