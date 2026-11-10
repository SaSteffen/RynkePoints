<!-- What changes and why. The title is a Conventional Commit, e.g. "feat: …". -->

## Sandboxes

- [ ] Deploy to Hamburg's sandbox
- [ ] Deploy to Europe's sandbox

<details><summary>When to skip</summary>

Ticking a box deploys this pull request's head to that sandbox, with fresh sample riders as of
`develop`; the box unticks itself and a message follows here. Tick it again to deploy again.
Pull requests into `develop` from branches of this repository only.

- **Can be skipped**: only docs, specs, tests, CI or developer tooling changed, or the change
  was already seen working.
- **Worth deploying**: migrations; anything riders see; queue, webhook, cron or rule changes;
  team settings or team data; a large change; or when unsure.
- **Which sandbox**: the team that changed, or any one for changes shared by all teams.
- **What it can't show**: anything needing the real Strava: sign-in, real webhooks, rate limits.

More in `docs/sandboxes.md`.
</details>
