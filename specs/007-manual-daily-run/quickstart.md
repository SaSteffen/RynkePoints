# Quickstart: Run the Daily Job on Demand

## Locally

1. Add a value for `ADMIN_TOKEN` to `.dev.vars` (`openssl rand -base64 32`).
2. `pnpm dev`
3. In another shell:

   ```bash
   ADMIN_TOKEN=<value from .dev.vars> RYNKE_URL=http://localhost:8787 pnpm daily:run
   ```

   Expected: `daily run started on http://localhost:8787`. The dev log shows the
   run's queue messages.
4. Run it once with a wrong `ADMIN_TOKEN`. Expected: the script fails with a `404`
   and the log shows no run.

## Production setup (once, manual)

Do this before the release with this feature is merged into `main` (research R4):

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
