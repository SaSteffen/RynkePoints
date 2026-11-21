# Data Model: One Team at a Time

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

No migration. Nothing new is stored.

| What | Where | Change |
|---|---|---|
| Rider of a team | `riders`, `guest = 0` | none; "rider" in the team question means exactly this row |
| Team question answer | not stored | gains `rider: boolean` (R2) |
| Let-go request | not stored | new; carries only the athlete ID (R4) |
| Switch intent | signed OAuth state cookie, ten minutes | new `switch` part (contracts/one-team.md) |
| Kept token | `pending_revocations` | dropped without asking when the team holds the person (R5) |
| Other teams' clubs | `TeamData.otherClubIds` | removed (R7) |

## A person across teams

```text
          connects at a new team
                   │
   held elsewhere as a rider? ── no ──▶ rider of the new team
                   │ yes
           choice page
          ┌────────┴─────────┐
        stay               switch
          │                  │
 rider of their team   their team lets them go ──▶ rider of the new team
 (unchanged)            (data deleted, no block, grant kept)
```

At no point in this diagram does a person hold two rider rows, and the grant at Strava is never
revoked on the way.
