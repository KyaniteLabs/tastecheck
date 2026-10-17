

<!-- interview-contract:v1:start -->
# Interview contract (generated)

Canonical source: [`contracts/v1/interviews/brownfield.json`](../../../contracts/v1/interviews/brownfield.json). Edit the JSON, then re-project; do not hand-edit this file.

## State machine

inspect → infer → score → ask_or_skip → approve → execute → verify

Every claim about the existing system is labeled **EVIDENCE** or **INFERRED**. Resume from the last completed state after interruption; re-read preserved signals before continuing.

## Questions and approval

- Ask at most **3** material questions; each names the unresolved dimension and why the answer changes implementation.
- If evidence is sufficient, proceed without questions and state the inference.
- Material redesign requires explicit approval before execution.

## Readiness artifact

Produce `INFERRED-SYSTEM.md` with evidence, inferences, preserved signals, readiness score, and proposed scope. Do not claim completion without verification evidence.
<!-- interview-contract:v1:end -->
