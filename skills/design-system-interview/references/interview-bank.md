# Interview technique bank

The canonical dimension list, abstention recommendations, grouping, and state rules live in
`interview-contract.generated.md`, sourced from `../../../contracts/v1/interviews/greenfield.json`. This reference adds interviewing technique;
it must not become a second dimension specification.

## Running a fast, useful round

- Start with the strongest signal already supplied. Reflect it back before asking for
  more; this proves that the interview is narrowing rather than collecting trivia.
- Follow the canonical group order, but ask one question at a time unless one answer
  truly resolves neighboring dimensions. Every prompt includes a recommendation, its
  product consequence, and a clear way to redirect it.
- Record the answer against its canonical dimension ID immediately. If the user
  abstains, record the evidence-dependent recommendation or explicit abstention and say it aloud.
- When a reply affects several IDs, mark each affected ID with the same evidence rather
  than inventing a new category. Do not ask the same thing twice in different language.

## Useful prompt shapes

Use this response shape throughout:

```markdown
I’m reading <signal>, so I recommend A because <consequence>.
A gives you <observable outcome>; B gives you <different observable outcome>.
Which direction should I commit?
```

### `reference` and `personality`

Ask for a concrete cultural, product, or material reference, then ask which tension in
that reference matters. If the answer is an adjective such as “clean”, offer a contrast
between two observable outcomes rather than a gallery of example systems.

### `aesthetic`, `type`, and `color_mode`

State a hypothesis tied to the brief: “The audience needs fast scanning, so I would
start from compact editorial hierarchy rather than a showroom composition. Is that the
right pressure?” Keep type and color as consequences of the territory, not a shopping
list. Confirm the mode separately because theme readiness changes implementation.

### `density_shape` and `structure_rhythm`

Ask about information pressure and the reading path together. Test whether the work
needs a repeated operational cadence, a paced narrative cadence, or deliberately varied
sections. Ask for a concrete hierarchy conflict before proposing a grid.

### `signature` and `imagery_iconography`

Separate one memorable behavior from decorative accumulation. Ask what earns attention
and what should recede. For imagery, establish source rights/treatment and an icon
convention; never solve uncertainty with stock-photo or emoji defaults.

### `motion`

Ask only when motion changes comprehension, rhythm, or feedback. If it is in scope,
define a reduced-motion equivalent at the same time.

## Recovery techniques

- **Vague answer:** translate it immediately: “If ‘clean’ means faster scanning, I’d use
  compact editorial hierarchy; if it means lower visual intensity, I’d use fewer layers
  and more space. Which consequence do you mean?”
- **Contradiction:** name both statements, show the implementation tradeoff, and ask
  which constraint wins. Do not quietly average them.
- **Abstention:** state the evidence basis, leave the choice pending confirmation, and make it easy to revise; never resolve toward the mean.
- **Existing direction:** count covered canonical dimensions. At the shortcut threshold,
  ask for confirmation and fill only the missing dimensions.
- **Interruption:** summarize answered IDs and resume at the first unanswered one.
- **Headless use:** expose questions and recommendations as assumptions pending
  confirmation; do not present an unconfirmed artifact as a committed system.

## Evidence note

The final record cites the user answer, supplied artifact, or evidence-dependent abstention for every
dimension. It never cites this bank’s prompt wording as design evidence.
