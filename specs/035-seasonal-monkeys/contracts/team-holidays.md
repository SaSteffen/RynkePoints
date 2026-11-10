# Contract: Team holidays

Extends feature 026 contracts/team-data.md with one required field.

```ts
type DayRef = `${string}-${string}` | { anchor: "first-advent" | "easter"; offset: number };

interface Holiday {
	id: string;
	monkey: string;
	from: DayRef;
	to: DayRef;
	kind: "short" | "long";
}

interface TeamData {
	// …
	/** The team's holidays with a seasonal quote monkey (feature 035). */
	holidays: readonly Holiday[];
}
```

Guarantees, held by unit tests:

- Every `monkey` is a `seasonal: true` entry of `art/quotes/monkeys.json`.
- Holiday ids are unique within a team; fixed days are real calendar days.
- No team lists a monkey only another team's art may show (feature 026 FR-023); the December
  monkeys show no place or team name.
- Hamburg lists exactly the four December holidays of data-model.md; Europe lists none.
