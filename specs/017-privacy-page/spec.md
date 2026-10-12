# Feature 017: Privacy page

## Why

Strava's API Policy asks every app for a lawful privacy policy that meets the
GDPR and the UK GDPR. It must be reachable through reasonably prominent links,
explain how personal data is collected, stored, used and transferred (§7.3),
and state that Strava may collect and use usage data (§6.5). It also asks for
easily accessible support contact information (§2.4). RynkePoints only had the
consent text on the start page.

## What

- **FR-001** `GET /privacy` shows the privacy notice. It is public: no session,
  no rider data. It is in every shipped language, with all text in the catalogs
  ([contracts/messages.md](contracts/messages.md)).
- **FR-002** Every page's footer links to it ("Datenschutz und Kontakt"), next
  to the Strava attribution, so it is one click from the start page and from
  every signed-in section.
- **FR-003** The notice names the controller (`PRIVACY_CONTROLLER`: a name,
  optionally more lines such as an address) and a contact address for support and data
  requests (`CONTACT_EMAIL`), both settings in `wrangler.jsonc`. A missing or
  malformed value is an error, not a blank.
- **FR-004** It covers: purpose; the data read from Strava, field by field, and
  what is never read; data entered by the team and what is worked out; cookies,
  notifications and logs; who sees what; the legal bases; retention and every
  deletion trigger, backups and logs; the processors and recipients (Cloudflare,
  push services) and transfers; Strava as a separate controller, its privacy
  policy and its use of usage data (§6.5); the rider's rights; and how changes
  are handled. It carries the date it last changed (`PRIVACY_UPDATED` in
  `src/http/privacy.ts`).
- **FR-005** The notice describes the app as built. A change to what is stored,
  who sees it, or how long it is kept updates the notice and `PRIVACY_UPDATED`
  in the same change.

## Not in scope

Legal review. The text is written from the code; the maintainer has it checked
before relying on it.
