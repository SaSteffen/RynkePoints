# Research: Season Album – Making It in Cloudflare and Self-Service (Phase 3)

**Feature**: [spec.md](spec.md) · **Date**: 2026-10-20

The spec makes the albums on the maintainer's computer (Phase 1). This research
answers whether the albums could instead be made in the app's Cloudflare account
and downloaded by riders themselves (Phase 3), within the free tier (constitution
Principle IV). Limits were read from Cloudflare's documentation on 2026-10-20 and
change over time; re-check them when Phase 3 is planned.

## R1 – How large and how slow is an album?

A test album was rendered with headless Chromium (Playwright 1.56, the engine the
repo's e2e tests already use) from an HTML page with A4 print CSS: two summary
pages and 11 sticker pages with 12 slots each, all 121 badge pictures of
`public/badges/` (traced SVG, 20.5 MB uncompressed, 4.4 MB gzipped), stickers
rotated and moved as FR-036 asks.

| Album | Pages | Render time (laptop-class VM) | PDF size |
|-------|-------|-------------------------------|----------|
| Every badge earned (worst case) | 13 | 13–14 s | 17.4 MB |
| Half the badges earned (typical) | 13 | 6 s | 9.3 MB |

The pictures stay vectors in the PDF, so the size grows with the earned badges'
path complexity, not with resolution. The largest pictures (e.g.
`big-training-30.svg`, 0.9 MB) dominate; simplifying the few heaviest traces would
shrink every album. A drop shadow per sticker did not change the size.

**Decision**: Phase 1 renders the album as an HTML page and prints it to PDF with
headless Chromium on the maintainer's computer. 60 riders take about 10 minutes
(FR-027). **Rationale**: Playwright is already a dev dependency; the same HTML page
can later serve Phase 3 (R5). **Alternatives**: a PDF library writing pages
directly (more code for the sticker layout, and the SVG pictures would need
converting).

## R2 – A PDF library inside a Worker

Workers Free gives **10 ms CPU time per HTTP request** and per cron trigger, and
128 MB memory per isolate. Laying out 13 pages and embedding several MB of vector
paths takes seconds of CPU, not milliseconds.

**Decision**: Not feasible on Workers Free. On Workers Paid ($5/month, CPU limit
configurable up to minutes) it would be possible, but breaks the free-tier rule
without a documented need.

## R3 – Cloudflare Browser Rendering ("Browser Run")

The Worker hands the album's HTML to a headless browser in Cloudflare and gets a
PDF back (binding or `/pdf` quick action, which accepts HTML, A4 and background
printing; request bodies up to 50 MB). Waiting for the browser is I/O, not the
Worker's CPU.

Workers Free limits: **10 minutes browser time per day**, 3 concurrent browsers,
one new browser every 20 s, **60 s browser timeout**, quick actions one request
per 10 s. Workers Paid includes 10 browser hours per month, then $0.09 per hour.

With R1's times (6–14 s per album, likely slower in a shared cloud browser), one
day's budget makes roughly 40–100 albums: enough for a 60-rider team if riders
download on demand and not all on the same day, but with no margin for retries,
re-downloads or a heavier catalog. A 13-page album also needs to stay well under
the 60 s timeout.

**Decision**: Feasible on paper, fragile in practice. Keep as fallback for Phase 3.

## R4 – Where would a made album be kept?

- **D1**: at most 2 MB per row or blob; an album is 9–17 MB. Not usable without
  splitting files, which is not worth it.
- **R2**: 10 GB-month storage free, 1 million writes and 10 million reads per
  month, no egress fees; 60 albums of 17 MB are about 1 GB. Fits easily.
  Enabling R2 in the dashboard asks for a payment method (to be confirmed when
  Phase 3 is planned); Cloudflare's pricing page does not say. It is also a new
  store of personal data in the cloud, which the privacy page must name and which
  must be deleted with the rider (feature 001 FR-022).
- **Not stored at all**: render on each download and stream it out (R3) –
  costs browser time on every download.
- **Static assets**: never. Assets are public, and albums are personal data.

## R5 – Let the rider's own browser make the PDF

The app serves the album as a page for the signed-in rider, built from the same
HTML and print CSS as Phase 1 (R1), with a button "Als PDF speichern" that opens
the browser's print dialog (`window.print()`); the rider saves it as PDF or prints
it directly. The badge pictures are the app's existing static assets.

- Costs: one ordinary page view (a few D1 reads), no CPU-heavy work in the
  Worker, no browser time, no storage, no copy of personal data on the
  maintainer's computer.
- Phones: iOS Safari and Android Chrome can both save a printed page as PDF; the
  layout follows each browser's print engine, so the sticker pages need a test in
  all three engines (the e2e setup already runs Chromium, Firefox and WebKit).
- The page can show the album at any time of the season, not only in August
  (a product decision for Phase 3).
- The repo already prints a document to PDF from HTML (`docs/print.css`,
  `public/rynke-punkte.pdf`).

**Recommendation**: R5. It fits the free tier with room to
spare and removes the maintainer's manual step and the local copy of the data.
**Alternatives**: R3 with R2 storage as a fallback if print layouts differ too much
between browsers; Workers Paid if the team ever decides the $5/month is worth it.

## R6 – Consequence for Phase 1

Build the album as an HTML page with A4 print CSS (one page template, the sticker
layout of FR-036 computed deterministically per rider and badge, FR-026), and let
the Phase 1 command render that page to PDF with headless Chromium against data
read from production. Phase 3 then only needs a route that serves the same page to
the signed-in rider, plus the button. Nothing of Phase 1 is thrown away.

## R7 – Owner's decision (2026-10-20)

Phase 3 builds the albums locally, as Phase 1 does, and the command then uploads
them to R2; riders download their own album from the app. This keeps the PDF's
look identical for every rider (one print engine, not three) and costs no browser
time in Cloudflare. What Phase 3 needs, from R4:

- R2 enabled on the account (check whether it asks for a payment method; the free
  tier itself costs nothing at this size: about 1 GB for 60 albums).
- An upload credential on the maintainer's computer only, never in the repo or in
  the Worker's secrets beyond read access.
- A download route that serves a rider only their own album, streamed from R2
  (no egress fees, no Worker CPU spent on the PDF).
- Deletion: an album goes when its rider leaves (feature 001 FR-022) and after a
  retention period the Phase 3 spec sets; the privacy page names R2 as a store.
- The local folder can then be emptied automatically after a successful upload.

Phase 1 builds locally only and uploads nothing (spec FR-020).

## R8 – Which tools build the PDF (owner open to Python or Node, 2026-10-20)

| Option | For | Against |
|--------|-----|---------|
| **Node + TypeScript + Playwright** (HTML page, print to PDF) | Same language and repo tooling as the app (pnpm, Biome, tsc, Vitest); Playwright is already a dev dependency and its Chromium already installed for e2e; can import the app's own badge catalog (`src/badges/catalog.ts`), badge evaluation, i18n catalogs and coin/badge SVGs directly, so album and app can't disagree; the same HTML page serves Phase 3 later; CSS grid and transforms make the sticker layout a few lines; SVGs stay vectors (R1) | Needs a headless Chromium on the maintainer's computer (one `pnpm exec playwright install chromium`) |
| Python + WeasyPrint | Good print CSS (`@page`), no browser | Second language and toolchain in the repo; would re-implement the catalog, badge rules and i18n in Python or read them through an export; weaker SVG and CSS transform support |
| Python + ReportLab / Node + pdf-lib (draw pages directly) | No browser | Sticker layout, text wrapping and SVG embedding by hand; much more code |

**Decision**: Node + TypeScript + Playwright, as in the R1 test. **Rationale**:
the easiest libraries are the ones the repo already has, and reusing the app's
own code for badges and figures is what keeps the album's numbers equal to the
app's (SC-003). It stays a script under `scripts/`, outside `src/`, so nothing
reaches the Worker bundle; reading production data goes through `wrangler d1
execute --remote` (read-only SQL) or a `wrangler d1 export`, run by the maintainer
(CLAUDE.md manual steps). Details belong to `/speckit-plan`.

## Sources

- Cloudflare Browser Rendering limits: https://developers.cloudflare.com/browser-rendering/limits/
- Cloudflare Browser Rendering pricing: https://developers.cloudflare.com/browser-rendering/platform/pricing
- Browser Rendering `/pdf` quick action: https://developers.cloudflare.com/browser-rendering/quick-actions/pdf-endpoint/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits
- R2 pricing: https://developers.cloudflare.com/r2/pricing/
- D1 limits: https://developers.cloudflare.com/d1/platform/limits/
