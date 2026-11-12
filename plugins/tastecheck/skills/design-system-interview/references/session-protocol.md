# Greenfield session protocol

Read this whenever an interview is interrupted, contradictory, headless, or close to
handoff. The canonical model is the generated `interview-contract.generated.md`, sourced
from `../../../contracts/v1/interviews/greenfield.json`.

## Existing direction and headless use

If supplied direction covers five or more required dimensions, restate it, identify
the remaining dimensions, and get confirmation before emitting the artifact. Establish
which source is canonical when a project has competing direction documents.

In a headless or one-shot context, surface every forcing question with a recommended,
overridable assumption. Do not mark a system `approved` without confirmation, including
when the brief meets the existing-direction threshold. A user’s explicit abstention is
different: record the evidence-dependent recommendation or explicit abstention; never
resolve toward the mean.

## Contradiction, readiness, and resume

The interview is `approved` only when all nine required dimensions have an answer or
stated abstention default, confirmation is explicit, no contradiction remains unresolved,
and a trust-critical brief has a credibility rationale. Without confirmation it is at
most `approval-ready`. When signals conflict, name the conflict, show the practical
tradeoff, propose a resolution, and confirm it. Never silently choose a side.

If fewer than five dimensions are known, continue interviewing. On interruption, save
the answered dimensions and resume at the first unanswered one rather than restarting.

Use this visible resume card:

```markdown
Direction so far: <one sentence>
Committed: <dimension IDs>
Awaiting confirmation: <dimension IDs + recommendations>
Blocked: <contradiction, if any>
Resume with: <one highest-consequence question>
```

## Handoff record

Before handoff, verify that `DESIGN-SYSTEM.md` contains the direction summary, complete
canonical CSS custom-property token block, typography specimen, palette with contrast
notes, spacing scale, and component guidance. Add motion tokens only when motion is in
scope. Open assumptions require explicit approval; they are not a completed artifact.
