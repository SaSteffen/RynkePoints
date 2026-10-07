# Quickstart: Run the Daily Job on Demand

## Locally

1. `pnpm dev` (a fake Strava; its `ADMIN_TOKEN` is `fake-admin-token` from
   `dev/fake.env`, [feature 006 quickstart](../006-local-frontend-dev/quickstart.md)). Against the real Strava, add a value for
   `ADMIN_TOKEN` to `.dev.vars` (`openssl rand -base64 32`) and run
   `pnpm dev:strava` instead.
2. In another shell:

   ```bash
   ADMIN_TOKEN=fake-admin-token RYNKE_URL=http://localhost:8789 pnpm daily:run
   ```

   Expected: `daily run started on http://localhost:8789`. The dev log shows the
   run's queue messages.
3. Run it once with a wrong `ADMIN_TOKEN`. Expected: the script fails with a `404`
   and the log shows no run.

## Production setup (once, manual)

Do this before the release with this feature is merged into `main` (research R4).
Done for production on 2026-10-07.

```bash
openssl rand -base64 32          # keep it in your password manager
pnpm wrangler secret put ADMIN_TOKEN
```

## Production use

```bash
ADMIN_TOKEN=<token> pnpm daily:run
```

Expected: `daily run started on https://trhh-rynke-coins.link`. The run's outcome
shows up in the Worker logs (Observability), the same way a nightly run's does.
