// The version of the consent text a rider agrees to on the landing page
// (research R21): `landing.dataRead`, `landing.private`, `landing.purpose`,
// `landing.leave` and `consent.*` (contracts/messages.md). Raising it means the
// text changed what is read, written or shown; re-asking riders who agreed to
// an older version is feature 004-roles-and-consent's job (its FR-013).

export const CONSENT_VERSION = 1;
