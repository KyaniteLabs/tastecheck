# Brownfield inspection state machine

Read this whenever evidence is incomplete, readiness is not high, a question may be
needed, a redesign could be material, or an interrupted inspection resumes.

## States

Run `inspect → infer → score → ask_or_skip → approve → execute → verify`. Resume from
the last completed state and re-read preserved signals; never restart by discarding
prior evidence.

## Evidence and inference

Label every direct observation **EVIDENCE**. Label every derived claim **INFERRED**.
Every claim about the existing system carries exactly one label. Preserve recognized
brand signals such as the logo mark, primary brand color, typographic voice, and
domain-specific terminology unless the user explicitly approves a change.

## Readiness and questions

Score brand coherence, visual consistency, content clarity, accessibility baseline,
performance signals, and navigation clarity from 0 to 10. At 6 or above, proceed with
targeted improvements. Medium readiness may use at most three questions. Low readiness
requires a scope decision. Each question names its unresolved dimension and explains
why the answer changes implementation. If evidence is sufficient, state what was
inferred and use the no-question path.

## Approval and verification

A material redesign changes visual identity, structural layout, or brand voice beyond
incremental improvement. State alternatives and wait for explicit approval before it.
After execution, re-test changed behavior and report preserved signals, removed drift,
evidence, and remaining ambiguity.
