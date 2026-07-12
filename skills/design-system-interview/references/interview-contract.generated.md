

<!-- interview-contract:v1:start -->
# Interview contract (generated)

Canonical source: [`contracts/v1/interviews/greenfield.json`](../../../contracts/v1/interviews/greenfield.json). Edit the JSON, then re-project; do not hand-edit this file.

## Session rules

- Use **4–10 exchanges**; batch dimensions when useful.
- Existing direction covering at least five core dimensions short-circuits to confirmation.
- Surface contradictions and confirm a resolution; never silently pick a side.
- Samples are case studies, not a menu. Derive a new system from the evidence.
- An unanswered dimension receives an evidence-dependent recommendation or explicit abstention; never resolve toward the mean or a fixed house style.

## Required dimensions

| ID | Dimension | Group | Abstention recommendation |
| --- | --- | --- | --- |
| reference | Visual reference / personality anchor | orientation | No direction committed; derive a recommendation from audience, task, domain, and supplied references, then mark it pending confirmation |
| personality | Brand personality spectrum | orientation | Do not choose a personality pole without evidence; recommend the least-risk credible stance and mark it pending confirmation |
| aesthetic | Aesthetic territory | aesthetic | Do not select a visual territory by convention; derive one from content, audience, domain, and evidence, or abstain pending confirmation |
| type | Typography stance | aesthetic | Do not prescribe a font pairing without language, reading, brand, and performance evidence; record the unresolved choice |
| color_mode | Color and mode | aesthetic | Do not assume a hue or mode; derive semantic roles from brand, contrast, theme, and content evidence, or abstain |
| density_shape | Density and shape language | composition | Derive density and shape from content, interaction, platform, and brand evidence; do not import a token recipe |
| structure_rhythm | Layout structure and rhythm | composition | Derive structure and rhythm from content hierarchy and container evidence; do not assume a column count or base unit |
| signature | Signature element or distinctive touch | distinctiveness | Do not erase distinctiveness by default; identify a credible signature from the brief or record an explicit abstention |
| imagery_iconography | Imagery and iconography approach | distinctiveness | Do not choose an imagery or icon recipe without subject, rights, accessibility, and brand evidence; record the open decision |

## Optional dimensions

| ID | Dimension | Group | Abstention recommendation |
| --- | --- | --- | --- |
| motion | Motion and transition character | motion | Do not add motion by convention; derive purpose, interruption tolerance, and reduced-motion behavior from evidence, or abstain |

## Readiness and handoff

- `approved`: The direction is confirmed and buildable; implementation handoff is allowed
- `approval-ready`: Recommendations and tokens are complete but await confirmation; do not hand off to implementation
- `blocked`: A contradiction or missing authority prevents a safe recommendation

Only `approved` may hand off to implementation. Every required dimension needs an answer or explicit abstention with its evidence basis and confirmation state.
<!-- interview-contract:v1:end -->
