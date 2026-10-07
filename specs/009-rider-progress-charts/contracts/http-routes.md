# Contract: HTTP routes changed by this feature

This adds to 005's [http-routes.md](../../005-rider-view/contracts/http-routes.md).
No route is added; one static asset is.

## `GET /me` query parameters

| Parameter | Valid values | Otherwise |
|---|---|---|
| `page` | unchanged (005): `^[1-9][0-9]{0,3}$` | page 1 |
| `period` | `3m`, `4w`, only when offered (FR-020) | whole season |
| `from`, `to` | both present, real calendar dates `YYYY-MM-DD`, `from ≤ to` | whole season |

- `period` wins over `from`/`to` when both are present.
- `from`/`to` are clamped into the axis (season start … axis end) and widened to
  at least 7 days, keeping `from` where possible (FR-022, FR-023).
- Nothing is an error, and the URL is not rewritten (as 005 does for `page`).
- **Side effects**: none. Still only `SELECT`s in one batch, no queue message, no
  Strava request (FR-003, SC-006).

### Canonical query (written by the server's links and by the script)

```text
/me[?page=N][&period=P | &from=YYYY-MM-DD&to=YYYY-MM-DD]
```

- The order is fixed and the whole season has no parameter.
- Period links end in `#progress`, pager links in `#rides`.
- Period links keep `page`, and pager links keep the period.

### Layout `path` and `safeNext` (FR-026)

- `handleMe` passes the canonical query of what it shows as the layout `path`.
- The script rewrites `next` after each change.
- `safeNext` accepts `/me` followed by a canonical query matching:

```text
^/me\?(?:page=[1-9][0-9]{0,3}(?:&|$))?(?:period=(?:3m|4w)|from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2})?$
```

- It rejects a bare `/me?`. Everything else still becomes `/`.
- `GET /me` validates the dates again; a date that matches the pattern but isn't
  a real date is not trusted.

## Static asset `GET /progress/progress.js` and `/progress/chart.js`

- Served by Workers static assets from `public/progress/`, before the Worker runs,
  with the asset server's `ETag` caching.
- No cookie and no rider data: the scripts are the same for everyone.
- `public/.assetsignore` adds `progress/tsconfig.json`.
