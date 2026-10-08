# Strava brand assets

This folder holds Strava's official brand images, served as static assets and
kept in git.

## Where they come from

Download from Strava's brand guidelines page:

- `1.1-Connect-with-Strava-Buttons.zip`: the orange "Connect with Strava"
  button, 48 px height, saved as `public/strava/en/connect-with-strava.svg`,
  and the white one as `public/strava/en/connect-with-strava-white.svg`.
- `1.2-Strava-API-Logos.zip`: the "Powered by Strava" logo, saved as
  `public/strava/en/powered-by-strava.svg`, and the white one as
  `public/strava/en/powered-by-strava-white.svg`.

The images are never modified, re-lettered or translated. Strava's guidelines
forbid altering their logos.

## How pages use them

Pages never build these paths in code. They take them from the message catalogs
(`brand.connectWithStrava.src`, `brand.poweredByStrava.src`, and for the white
variants `brand.connectWithStrava.srcDark`, `brand.poweredByStrava.srcDark`), so
tests don't need the files.

Every page renders both variants of each image (`cws-light`/`cws-dark`,
`pbs-light`/`pbs-dark`), and the colour scheme CSS shows the one that fits the
light or dark scheme (feature 011 research R13).

Strava ships these assets in English only, so the `brand.*.src` and
`brand.*.srcDark` entries of
every catalog point at the `en/` files; only the alt text is translated.

## Before deploying

Every `brand.*.src` path in every catalog must exist under `public/`. Nothing
else catches a missing file, because tests don't use them:

```bash
grep -ho '"/strava/[^"]*"' src/i18n/messages/*.ts | tr -d '"' | sort -u | sed 's|^|public|' | xargs ls
```
