# Contract: HTTP Routes

| Method, path | Who | Does | Answer |
|---|---|---|---|
| `GET /admin/roles` | administrators, guests included | Rollen ([pages.md](pages.md)); `?done=&athlete=&from=` adds the notice, `?error=` the error | 200; others as every admin page (visitor → `/`, no current consent → gate, not an administrator → 403) |
| `POST /admin/roles` | own administrators | sets `athlete`'s role to `role` | 303 `/admin/roles?done=<role>&athlete=<id>&from=<old>`; `?error=self` for oneself; `?error=unknown` for a rider who isn't listed; 400 for another `role`; 403 cross-origin, visitor, no current consent, not an administrator, guest |
| `POST /me/role-card` | the signed-in rider | `action=close`: clears the card, and for the joined/became-admin card with the Orga-Rundgang not done marks it done; `action=tour`: clears the card, starts the Orga-Rundgang | 303 `/me` (close) or to the tour's first step (tour); 403 cross-origin or visitor |
| `POST /admin/riders/:id/remove` | own administrators and guests (unchanged) | removal, now refused for the team's only own administrator | 303 `/admin/riders?error=lastAdmin`, nothing changed |
| `GET /admin/riders/:id/remove` | administrators (unchanged) | confirm page, now redirecting with `error=lastAdmin` for the only own administrator | 303 |

Every POST checks the origin first, as today. A change sends the role it wants, not a step, so a
repeat or a double click changes nothing more (FR-008).
