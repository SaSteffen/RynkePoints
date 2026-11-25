# Contract: `POST /admin/dismiss`

Marks one day warning as seen for the signed-in administrator (FR-001, FR-004, FR-006).

## Request

`application/x-www-form-urlencoded` (or multipart, as the page script's `FormData` sends it):

| Field | Value |
|---|---|
| `kind` | `calls`, `recheck` or `routing` |
| `day` | `YYYY-MM-DD` |
| `reason` | Repeated, one per reason the row showed (research R2) |

## Guard

`requireAdminPost`: same origin, a signed-in rider with a current consent and the Administrator
role. Anything else: `403`, nothing stored (FR-008).

## Handling

1. Unknown `kind`, or `day` not today or yesterday (UTC): nothing stored.
2. Reasons not known for `kind` are dropped; with none left, nothing stored.
3. Otherwise each reason is inserted for the viewer, `INSERT OR IGNORE`.

## Response

`303 See Other`, `Location: /admin`, in every case past the guard. The page script's in-place save
(`data-swap`) follows it and swaps in the page, the navigation with its Admin tab number included.
Offline or on a `5xx`, it falls back to the browser's own submit, which shows the error; the
row stays because nothing was stored.

## Logs

None beyond the router's usual line; never a reason list or a day with an athlete ID.
