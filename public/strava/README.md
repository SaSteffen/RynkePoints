# Strava brand assets

This folder holds Strava's official brand images, served as static assets. They
are not in git yet: the maintainer adds them before the first deploy
(quickstart §3 step 5, research R19).

## Where they come from

Download from Strava's brand guidelines page:

- `1.1-Connect-with-Strava-Buttons.zip`: the orange "Connect with Strava"
  button, 48 px height, saved as `public/strava/en/connect-with-strava.svg`.
- `1.2-Strava-API-Logos.zip`: the "Powered by Strava" logo, saved as
  `public/strava/en/powered-by-strava.svg`.

The images are never modified, re-lettered or translated. Strava's guidelines
forbid altering their logos.

## How pages use them

Pages never build these paths in code. They take them from the message catalogs
(`brand.connectWithStrava.src`, `brand.poweredByStrava.src`), so tests don't need
the files.

Strava ships these assets in English only, so the `brand.*.src` entries of
every catalog point at the `en/` files; only the alt text is translated.

## Before deploying

Every `brand.*.src` path in every catalog must exist under `public/`. Nothing
else catches a missing file, because tests don't use them:

```bash
grep -ho '"/strava/[^"]*"' src/i18n/messages/*.ts | tr -d '"' | sort -u | sed 's|^|public|' | xargs ls
```
