# Launch kit — TasteCheck

Public copy for the 19-skill pack. Attach `docs/hero/six-systems.png`. Before posting,
replace placeholders, verify links, and keep claims within the evidence boundary in
`docs/VERIFICATION.md`.

The durable story is not “purple is bad.” It is: **an agent cannot preserve design intent
that was never made explicit. TasteCheck turns that intent into a build contract.**

## X / Twitter

**Post 1 — image**

> Same product story. Six different structures, type systems, color systems, and rhythms.
>
> I built TasteCheck because coding agents need design decisions they can carry through a
> build—not another prompt that says “make it polished.”
>
> [attach `docs/hero/six-systems.png`]

**Post 2 — the interaction**

> TasteCheck starts before the first component.
>
> “This product is a fast operational instrument, so I recommend compact editorial
> hierarchy with one high-signal accent. Dense and immediate, or paced and explanatory?”
>
> The answer becomes `DESIGN-SYSTEM.md`, semantic tokens, structural rules, and refusals.

**Post 3 — the system**

> Then 17 specialist skills carry that decision through type, color, spacing, themes,
> responsive layout, states, forms, motion, imagery, data viz, copy, a11y, i18n, and the
> final ship gate.
>
> Nineteen skills total. Twenty slash commands. Plain Markdown. MIT.

**Post 4 — install**

> Works with agents that can read Markdown skills. The installer creates a canonical
> `~/.agents/skills` path and links supported agent homes it detects.
>
> `git clone https://github.com/KyaniteLabs/tastecheck && ./tastecheck/install.sh`
>
> Repo: https://github.com/KyaniteLabs/tastecheck

## Hacker News — Show HN

**Title**

> Show HN: TasteCheck – design decisions and ship gates for coding agents

**First comment**

> I kept seeing a predictable failure in agent-built frontends: the brief would specify
> the product but leave hierarchy, density, type, color, and structure open. The agent had
> to fill those gaps, and unrelated products converged on familiar defaults.
>
> TasteCheck moves that work upstream. Its design-system interview reads the supplied
> evidence, recommends a concrete direction, and asks only the questions that materially
> change the build. It writes a source-controlled `DESIGN-SYSTEM.md` with semantic tokens,
> structure, refusals, accessibility constraints, and the next implementation move.
>
> The other skills each own one craft concern: typography, color, spacing, themes,
> responsive layout, component states, forms, empty states, motion, art direction, data
> visualization, copy, accessibility, internationalization, existing-site repair, and a
> fail-closed release gate. They share one token vocabulary and handoff order.
>
> The pack is plain Markdown, MIT licensed, and currently contains 19 skills plus 20 slash
> commands. `npm test` verifies repository contracts, installation, links, and demo
> behavior; those checks are engineering evidence, not a universal effectiveness claim.
>
> Repo: https://github.com/KyaniteLabs/tastecheck
>
> I’d especially value feedback on the interview output and whether the handoffs remain
> clear across different coding agents.

## Reddit — r/webdev / agent communities

**Title**

> I built a design-quality system for coding agents, from brief to ship gate

**Body**

> A vague design brief creates a hidden problem: the agent still has to choose hierarchy,
> density, type, color, structure, component behavior, and motion. If those decisions stay
> implicit, familiar defaults accumulate even when each one looks reasonable alone.
>
> TasteCheck is my attempt to make that decision chain explicit. It starts with a short,
> opinionated design-system interview, writes the result to `DESIGN-SYSTEM.md`, and hands
> the same decisions through 19 connected frontend skills. The final skill returns
> **SHIP** or **HOLD** with measured evidence and a repair path.
>
> [attach the six-system montage]
>
> It is plain Markdown, MIT licensed, and works with coding agents that can load or read
> skill files. The repo includes 20 slash commands, an installer, local verification, and
> six browser-rendered systems built from the same product story.
>
> Repo: https://github.com/KyaniteLabs/tastecheck
>
> I’m looking for concrete feedback: where does the interview still feel abstract, and
> which handoff would you trust least on a real project?

## Posting checklist

- Use the six-system montage; verify the gallery and repo links immediately before posting.
- Stagger channels so feedback from one can improve the next post.
- Answer questions with the brief → artifact → implementation → ship-gate chain.
- Describe `npm test` as repository verification, not proof of universal design improvement.
- Capture recurring objections as product inputs; do not argue with taste preferences.
