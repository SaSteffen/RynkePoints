# Contract: HTTP Routes

Only the Rollen side moves; the removal routes keep today's behaviour and addresses ([research
R1](../research.md)).

| Method, path | Who | Does | Answer |
|---|---|---|---|
| `GET /admin/riders` | administrators, guests included | the merged tab ([pages.md](pages.md)); `?done=<role>&athlete=&from=` adds the undo notice, `?done=removed` the removal notice, `?error=roleSelf\|roleUnknown\|self\|unknown\|lastAdmin` the matching error | 200; others as every admin page (visitor → `/`, no current consent → gate, not an administrator → 403) |
| `GET /admin/roles` | anyone | moved: the old Rollen address | 301 `/admin/riders` with the query string kept, `error=self` renamed `roleSelf` and `error=unknown` renamed `roleUnknown`; the target then applies its own checks |
| `POST /admin/roles` | own administrators | sets `athlete`'s role to `role` (unchanged) | 303 `/admin/riders?done=<role>&athlete=<id>&from=<old>`; `?error=roleSelf` for oneself; `?error=roleUnknown` for a rider who isn't listed or is a guest; 400 for another `role`; 403 cross-origin, visitor, no current consent, not an administrator, guest |
| `GET /admin/riders/:id/remove` | administrators (unchanged) | the confirmation page, with Rider und Rollen as the current tab | as today; refusals 303 `/admin/riders?error=self\|unknown\|lastAdmin` |
| `POST /admin/riders/:id/remove` | own administrators and guests (unchanged) | removal | 303 `/admin/riders?done=removed` or `?error=…` as today |
| `GET /admin/history` | anyone | unchanged: moves to `/admin` | 301 |

Every POST checks the origin first, as today. A role change sends the role it wants, not a step,
so a repeat or a double click changes nothing more (043 FR-008).

## Error codes on `/admin/riders`

| `error=` | Meaning | Text |
|---|---|---|
| `roleSelf` | an administrator tried to change their own role | `admin.roles.error.self` |
| `roleUnknown` | the rider is gone or isn't listed | `admin.roles.error.unknown` |
| `self` | an administrator tried to remove themselves | `admin.remove.error.self` (with the "Meine Daten löschen" link) |
| `unknown` | the rider to remove is gone or isn't listed | `admin.remove.error.unknown` |
| `lastAdmin` | removing the team's only own administrator | `admin.remove.error.lastAdmin` |

At most one notice shows: an `error` wins over `done`; an unknown `error` or `done` shows
nothing.
