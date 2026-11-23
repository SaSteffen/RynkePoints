# Data Model: Administrators Give and Take Roles

## Migration `0036_roles.sql` (add only)

```sql
ALTER TABLE riders ADD COLUMN role_since INTEGER;
ALTER TABLE riders ADD COLUMN role_seen INTEGER;
ALTER TABLE riders ADD COLUMN role_changed_by TEXT;
ALTER TABLE riders ADD COLUMN role_changed_at INTEGER;
```

The previous release never names these columns. The trigger `riders_organiser_cleared`
(migration 0012) stays: the app's writes clear `organiser` exactly when a role goes to none, so a
rider made organiser again sees the Orga-Rundgang again (FR-010).

## Rider's role (derived)

| Role | `organiser` | `administrator` | Written by the app as |
|---|---|---|---|
| none | 0 | 0 | `(0, 0)` |
| Orga | 1 | 0 | `(1, 0)` |
| Admin | any | 1 | `(1, 1)` |

- `toRider`: `organiser = organiser = 1 OR administrator = 1 OR guest`; `administrator =
  administrator = 1 OR guest` (unchanged).
- Role code for `role_seen`: none 0, Orga 1, Admin 2.
- Own administrator: `administrator = 1 AND guest = 0`.

## Role change (one statement)

For target `T`, new role `r`, administrator `A`, time `now`, old role `o` read in the same request:

```sql
UPDATE riders SET
  organiser = :org, administrator = :adm, role_since = :now,
  role_seen = COALESCE(role_seen, :o), role_changed_by = :aName, role_changed_at = :now
WHERE athlete_id = :T AND guest = 0 AND athlete_id IN (<listed>)
```

- Same role as now: nothing is written (FR-008 idempotence), still a success.
- No row updated: the rider isn't listed → `error=unknown` (FR-013).

## Role card (Du page)

| `role_seen` | current role | Card |
|---|---|---|
| NULL | any | none |
| = current | any | none; the three columns are cleared |
| 0 or 1 → Orga | Orga | "Du bist jetzt in der Orga" |
| any → Admin | Admin | "Du bist jetzt Admin" |
| 2 → Orga | Orga | "Du bist kein Admin mehr" |
| 1 or 2 → none | none | "Du bist nicht mehr in der Orga" |

Closing or starting the tour sets all three columns to NULL. They go with the rider's data on
leaving or removal (the row is deleted).

## Validation

- `role` ∈ {`none`, `orga`, `admin`}, else 400.
- `athlete` ≠ the sender (FR-012), else `error=self`.
- Removal: refused when the target is an own administrator and the own administrators number 1
  (FR-014).
