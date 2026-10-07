// The version of the consent text a rider agrees to on the landing page
// (research R21): `landing.dataRead`, `landing.private`, `landing.purpose`,
// `landing.leave` and `consent.*` (contracts/messages.md). Raising it means the
// text changed what is read, written or shown; re-asking riders who agreed to
// an older version is feature 004-roles-and-consent's job (its FR-013).
// Feature 008 named the ride's name without raising it: every response read
// already carried the name, it needs no new scope or request, and only the
// rider sees it (008 FR-007, clarification Q1; constitution v2.1.0).
// Feature 010 named the push service without raising it either: notifications
// need no Strava scope or request and show nothing to anyone but the rider
// (010 research R14; constitution v2.1.0).

export const CONSENT_VERSION = 1;
