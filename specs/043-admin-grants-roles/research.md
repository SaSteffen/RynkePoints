# Research: Administrators Give and Take Roles

Decisions behind [plan.md](plan.md). The pages follow the design draft named in the spec.

## R1 — One role from the two flags we have

**Decision**: Keep `riders.organiser` and `riders.administrator`. The app writes them as a pair:
no role `(0, 0)`, Orga `(1, 0)`, Admin `(1, 1)`. `toRider` reads an administrator as an organiser
too (`organiser = organiser OR administrator OR guest`), so a flag pair a maintainer sets by hand,
or today's administrators without the organiser flag, still follow FR-007. The role is derived:
Admin if `administrator`, else Orga if `organiser`, else none.

**Rationale**: No rename or drop (migrations must keep the previous release working), every check
in the app already reads `rider.organiser` / `rider.administrator`, and the guest rule in `toRider`
is the same shape.

**Alternatives considered**: a `role` column (needs both old flags kept in sync for the previous
release, two sources of truth); a data migration setting `organiser = 1` for every administrator
(the `toRider` rule covers it and also covers later by-hand changes).

## R2 — "seit" dates on Rollen

**Decision**: New column `riders.role_since` (epoch seconds, NULL). Every role change through the
app sets it. Rollen shows "Admin seit …" / "In der Orga seit …" when it is set, and only the name
when it isn't (roles given by hand before the release).

**Rationale**: The draft shows the dates; there is no stored date today, and guessing one (for
example the connection date) would be wrong.

## R3 — The unseen role change (the role card)

**Decision**: Three new columns on `riders`:

- `role_seen` (INTEGER, NULL): the role the rider had before the first unseen change, as 0, 1 or
  2. NULL means nothing to tell.
- `role_changed_by` (TEXT, NULL): the first name of the administrator who made the latest change.
- `role_changed_at` (INTEGER, NULL): when.

A change sets `role_seen = COALESCE(role_seen, <old role>)` and overwrites the other two. The Du
page shows the card when `role_seen` is set and differs from the current role; when they are
equal (a change and its undo), it clears the three columns without a card. Closing the card or
starting the tour from it clears them too.

**Rationale**: SC-005 (one card, none after an undo) and the edge case "several changes before the
rider comes back" follow from keeping only the starting point. The administrator's first name is
copied so the card still reads right if that administrator leaves. It is a first name the team's
riders already see on the team pages, and it goes with the rider's data.

**Alternatives considered**: a separate table of changes (history, which the user ruled out); a
flag "changed" without the old role (can't tell an undo from a change).

## R4 — Routes

**Decision**:

- `GET /admin/roles`: Rollen, via `adminPage` (every administrator, guests read-only).
- `POST /admin/roles`: `athlete`, `role` (`none` | `orga` | `admin`). Only own administrators
  (`requireAdminPost` plus `!guest`). Refused for oneself (`error=self`), for an unlisted rider
  (`error=unknown`), and for a malformed role (400). On success `303` to
  `/admin/roles?done=<role>&athlete=<id>&from=<old role>`, which renders the notice with
  "Rückgängig".
- "Rückgängig" is a form posting the same route with `role=<from>`. No signed token: it is an
  ordinary change the administrator may make anyway.
- `POST /me/role-card`: `action` = `close` | `tour`. Clears the card (R3); `tour` redirects to the
  Orga-Rundgang's first step, `close` back to `/me`. For the new-organiser and new-admin cards,
  `close` ("Später") also marks the Orga-Rundgang as done, as skipping it does today (R6).

**Rationale**: Same shapes as removal (`/admin/riders/:id/remove`) and the organiser requests.

## R5 — The choice: one dialog

**Decision**: One `<dialog class="role-sheet">` on Rollen holding the form (three radio rows
"Keine", "Orga", "Admin", each with what it sees, the "told on the next visit" line, "Abbrechen",
"Speichern"). Each "Ändern" / "Rolle geben" is a button with the rider's ID, name and current role;
`app.js` fills the dialog and opens it with `showModal()`, as the badge share sheet does. Bottom
sheet below 700 px, centred dialog above (draft).

**Rationale**: One form, no per-row markup; the share sheet already proved the pattern.

## R6 — The card and the Orga-Rundgang

**Decision**: While a rider has an unseen change to Orga or Admin and hasn't done the
Orga-Rundgang, the tour's invitation ("Du bist jetzt in der Orga: …", `tour.organiser.intro`) is
not shown; the card on the Du page takes its place. "Rundgang starten" goes to the tour's first
step; "Später" counts as skipping the tour, which stays in Settings ("Orga-Rundgang noch mal
zeigen"). Administrators who are organisers by R1 without any change in the app keep today's
invitation.

**Rationale**: FR-018: the card replaces the first step instead of saying the same twice.

## R7 — The last own administrator

**Decision**: `handleRemoveRider` and the confirm page refuse (`error=lastAdmin`) when the target
is an own administrator and `SELECT COUNT(*) FROM riders WHERE administrator = 1 AND guest = 0` is
1. Role changes need no such check: only own administrators change roles and never their own
(FR-011, FR-012), so the sender stays.

## R8 — Search

**Decision**: Rollen lists every listed rider without a role in the "Rolle geben" list, sorted by
first name, behind a search field; a small filter in `app.js` hides rows whose name doesn't
contain the text. Below 1100 px the Orga page hides `.rider-search`; Rollen scopes its own rule so
the field shows at every width.

**Rationale**: A team has at most a few hundred riders, already listed in full on Admin › Rider.

## R9 — Settings row

**Decision**: For riders with `organiser` (guests included), Settings gets the row "Wer in der
Orga ist" after the consent row, listing own administrators ("(Admin)") then organisers, by first
name, guests left out. For own administrators the panel has "Mitglieder ändern" → `/admin/roles`.

## R10 — Tests that change

Feature 025's tests assume an administrator without the organiser flag has no Orga
(`test/integration/admin-access.test.ts` "doesn't show for an organiser, and shows beside Orga
with both roles", and similar). They change to: an administrator always has Orga. The pages
snapshot for the sample administrator changes the same way (run the whole file with `-u`).

## R11 — Fake mode

Alex Admin stays the sample administrator and becomes an organiser through R1. No new sample
rider is needed: Fiona (no role), Olga and Tina (Orga) and Gesa Gast (guest) cover the stories.
