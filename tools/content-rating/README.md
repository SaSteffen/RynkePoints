# Content rating

A small local tool for rating candidate phrases for the common phrase sets and
badge names (feature 026, FR-029 to FR-034). It is never deployed and `src/`
must not import it.

## Run a round

```bash
node tools/content-rating/server.mjs [phrases file] [round]
```

- `phrases file` defaults to `src/content/phrases/hamburg.de.ts`; `round`
  defaults to `current`.
- Open http://localhost:8790 and mark each phrase keep or cut, with an optional
  note.
- Votes land in `tools/content-rating/rounds/<round>/decisions.json`
  (git-ignored). An optional `rounds/<round>/baseline.json` (array of phrases
  already rated) flags everything else as new.

## Apply a round

```bash
node tools/content-rating/apply.mjs [phrases file] [round] [additions.json]
```

Removes every phrase voted `cut`, applies rewordings and appends new phrases
from `additions.json` (default `rounds/<round>/additions.json`, shape
`{ "rewordings": { "old": "new" }, "add": { "push/<section>": ["..."] } }`).
Review the diff before committing.
