# Contract: Hint Candidates (`src/badges/hints.ts`)

Pure functions, no I/O, no clock, no randomness.

```ts
hintCandidates(input: HintInput): HintCandidate[]
```

- Returns every achievable hint for the rider on `input.today`, ordered by `windowEnd`, then
  `closeness`, then `key` (research R4). Empty when nothing is achievable.
- At most one candidate per category, and one per surprise rule.
- Never a candidate for an earned badge, a team badge, Team events, Technique or Tour de Paris.
- Every candidate satisfies its row in the spec's "Hint windows" table and FR-005 to FR-007
  (data-model.md › HintCandidate rules).
- Deterministic: the same input gives the same list.

```ts
hintLine(candidate: HintCandidate, today: string): { line: LineId; variant: 0 | 1 }
```

- Picks the phrase variant from a hash of `today` and `candidate.key` (research R5), so a key keeps
  its line all day. Lines with one variant always give 0.

```ts
hintMonkey(candidate: HintCandidate, built: readonly string[] = HINT_MONKEYS): string
```

- The picture's address: the kind's monkey from data-model.md, or the first quote monkey when that
  monkey isn't built.

## Tests (`test/unit/badge-hints.test.ts`)

- Each row of "Hint windows": shown on the window's first and last day, not the day before or
  after; its "Also needs" condition on and off.
- Spec acceptance scenarios: 462 km → Distance with 38 km; 4 November days on 20 Nov → one-day
  line; 28 Nov with 1 day → none; complete category → none; Christmas Eve 17–24 Dec only;
  early bird earned → none.
- FR-006: an amount larger than days left × best day → none; a rider without a ride day → no
  amount hint.
- FR-007: no running, swimming or Dreikampf hint without a run or swim in this or the last season.
- Today counted or not (spec edge cases), 30 Nov and 1 Dec.
- SC-001: for synthetic riders over every date of a season, each candidate is checked against a
  brute-force check of its rule (enough days left at the best day for it to be earned).
- Order: the window that closes first comes first; ties by closeness.
