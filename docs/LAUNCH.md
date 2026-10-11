# Launch kit: TasteCheck

<!-- release-facts:v1:start -->
Release inventory: v1.7.0 · 20 skills · 20 canonical commands · 1 alias · 21 command files · 8 gallery systems.
<!-- release-facts:v1:end -->

Public copy for launch. One promise runs through every post: **your AI-built UI
stops looking AI-built.** The before/after image carries it; attach
`docs/hero/before-after.png` to every post that allows an image. Do not lead
with feature counts. Before posting, verify links and keep claims inside the
evidence boundary in `docs/VERIFICATION.md` (no claim that TasteCheck is proven
to improve designs; effectiveness is still BLOCKED).

The durable story: an agent cannot keep design intent that was never made
explicit. TasteCheck makes it explicit, removes the generic tells, then checks
the result.

## X / Twitter

**Post 1 (image)**

> Your AI-built UI stops looking AI-built.
>
> Left: what the agent made by default. Right: same product, after a short
> design interview and a deslop pass.
>
> [attach `docs/hero/before-after.png`]

**Post 2 (how)**

> Three commands:
> /designsystem  interviews you, writes DESIGN-SYSTEM.md
> /deslop        removes the purple-gradient, pill-button, card-grid look
> /tastecheckpass  checks the real page, says SHIP or HOLD with evidence
>
> Plain Markdown skills. MIT.

**Post 3 (try it)**

> Try it on your own site: npx @puenteworks/tastecheck audit https://your-site
> <!-- verify audit command shipped before posting -->
>
> Install: git clone https://github.com/KyaniteLabs/tastecheck && ./tastecheck/install.sh
> Repo: https://github.com/KyaniteLabs/tastecheck

**Post 4 (honest limits)**

> What we have measured: the ship gate's own error counts on a 17-case test
> set. What we have not: that it makes designs better. Only 2 of the 17 cases
> are visual-taste tells; the rest test whether the gate can be fooled.
> Numbers and limits are in the README.

## Hacker News: Show HN

**Title**

> Show HN: Make AI-built UIs stop looking AI-built (skills for coding agents)

**First comment**

> Coding agents build interfaces that all look alike: purple gradients, pill
> buttons, centered heroes, card grids. The brief usually says what the product
> is and leaves hierarchy, density, type and color open, so the agent fills the
> gaps with the same defaults.
>
> TasteCheck is a set of Markdown skills with three entry points. /designsystem
> runs a short interview and writes a DESIGN-SYSTEM.md the agent builds against.
> /deslop finds and removes the generic tells in existing UI. /tastecheckpass
> loads the real rendered page and returns SHIP or HOLD, with one line of
> evidence per check. It fails closed: a check that did not run is a HOLD, not a
> pass.
>
> Try it on your own site: npx @puenteworks/tastecheck audit https://your-site
> <!-- verify audit command shipped before posting -->
>
> What we have and have not measured: the gate has a 17-case labeled test set
> (12 true positives, 1 false negative, 4 true negatives, 0 false positives),
> checked in CI. Only 2 of those cases are visual-taste tells; the other 15 test
> gate integrity (forged receipts, tampered ledgers, leaks). So it shows the
> gate is hard to fool, not that it has good design taste. We have not yet shown
> in a controlled comparison that it works as intended.
>
> MIT, repo: https://github.com/KyaniteLabs/tastecheck
>
> Feedback I would most like: which of the before/after changes do you think are
> real improvements, and which are just a different kind of sameness?

## Reddit: r/webdev and agent communities

**Title**

> I made a set of skills so AI-generated UIs stop looking AI-generated

**Body**

> Agent-built frontends converge on the same look because the brief leaves the
> design decisions open. TasteCheck asks those questions first (a short
> interview that writes DESIGN-SYSTEM.md), strips the usual tells from existing
> UI (/deslop), and then checks the real page and says SHIP or HOLD with
> evidence (/tastecheckpass).
>
> [attach `docs/hero/before-after.png`]
>
> Try it on your own site: npx @puenteworks/tastecheck audit https://your-site
> <!-- verify audit command shipped before posting -->
>
> Plain Markdown, MIT, works with agents that can read skill files. Limits: the
> gate's own error rate is measured on a small test set that mostly tests gate
> integrity, and we have not yet shown it improves designs in a controlled test.
>
> Repo: https://github.com/KyaniteLabs/tastecheck
>
> Where does the before/after still look generic to you?

## Posting checklist

- Use the before/after image; verify the repo and gallery links right before posting.
- Confirm the audit command works (see the HTML comments above) or delete those lines.
- Stagger channels so feedback from one improves the next.
- Describe `npm test` as repository verification, not proof of better design.
- Treat recurring objections as product input; do not argue with taste preferences.
