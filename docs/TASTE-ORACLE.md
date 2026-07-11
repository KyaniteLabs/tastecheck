# Taste Oracle: render-grounded evaluation lane

## Current milestone

Taste Oracle is an additive, non-release evaluation lane for one hard `deslop-ui` scenario. It renders three content-equivalent implementations in real Chromium at 390×844 and 1280×900, stores content-addressed screenshot/DOM/style evidence, supports uncertainty-aware analysis, and prepares a blinded multi-family judge packet.

The canonical packet is deliberately `pending`, contains no verdict, and says `release_evidence: false`. No model or human result is included. This milestone does not change or clear the existing 1.0 release gate.

## Workflow

1. Validate `scenario.json` and `tokens.json` with `npm run test:oracle-contracts`.
2. Capture fresh browser evidence with `npm run oracle:capture -- --out .omx/taste-oracle/<unique-run-id>`. An accepted run directory is immutable: if `manifest.json` already exists and validates, capture fails closed and requires a new directory.
3. Verify the capture with `npm run test:oracle-capture`. A valid generation contains six screenshots and one manifest covering every arm/viewport combination.
4. Build or update `judge-packet.json` only from an accepted manifest. The packet exposes opaque labels and exact screenshot, DOM, and style hashes. It never embeds the operator-held unmask mapping.
5. Give judges only the packet and referenced artifacts. Each judge returns a document conforming to `contracts/v2/taste-oracle-judge-result.schema.json`.
6. Validate the pending packet:

   ```sh
   npm run oracle:judges -- \
     evals/taste-oracle/deslop-ui-hard-001/judge-packet.json \
     .omx/taste-oracle/task2-final/unmask-task4.json \
     .omx/taste-oracle/task2-final/manifest.json
   ```

7. Append at least two result paths to that command to validate quorum. Results require distinct judge identities, at least two evaluator families, all six artifacts, all three pairwise comparisons at both viewports, and citations resolving to the supplied manifest. The CLI validates the manifest structure and reads every screenshot to verify its SHA-256 before certifying the packet or panel.
8. Unmask only after result files are immutable. Preserve disagreements, ties, and abstentions; they are evidence about uncertainty, not errors to erase.
9. Convert one canonical arm pair from a validated panel into provenance-bound observations:

   ```sh
   npm run oracle:collect -- \
     evals/taste-oracle/deslop-ui-hard-001/judge-packet.json \
     .omx/taste-oracle/<run-id>/unmask.json \
     .omx/taste-oracle/<run-id>/manifest.json \
     current frozen \
     .omx/taste-oracle/<run-id>/result-a.json \
     .omx/taste-oracle/<run-id>/result-b.json
   ```

   The authoritative collector accepts paths only. It opens each packet, unmask, manifest, and result as a regular non-symlink repository file, reads each file once, and parses and hashes that same byte buffer. The unmask file must bind both the exact supplied packet path (`packet_path`) and exact packet bytes (`packet_file_sha256`). It then validates screenshot bytes, unblinds only the requested pair, carries packet/manifest/result paths and hashes into a top-level receipt, and emits opaque observation/result IDs. It never accepts caller-supplied hashes, in-memory authority objects, or creates canonical judge results. The exported structural helper is explicitly non-authoritative and cannot certify collected evidence.
10. Analyze only the collector output or the explicitly synthetic fixture. For collected input, the CLI regenerates the collector receipt from its provenance paths through the complete panel and artifact validator, then requires canonical equality before analysis. Tampered or hand-authored receipts fail. Direct structural analysis is labeled non-authoritative; collected booleans or caller-authored provenance cannot confer authority.

## Judge response contract

Every judge assesses all three opaque options at both viewports. Each artifact assessment repeats the three source hashes and cites at least one. Each viewport contains the three possible pairwise comparisons. A preference may select either option, `tie`, or `abstain`, but always needs a reason and evidence from both compared artifacts.

Identifiers are deliberately non-identifying tokens: `judge-<token>`, `family-<token>`, `observation-<token>`, and `participant-<token>`. Do not place names, handles, emails, provider account IDs, local paths, or secrets in identifier or narrative fields. Assessments and reasons are recursively checked against the same public-safety boundary.

Quorum validation is structural and provenance-oriented. It does not turn opinions into a release decision. Downstream aggregation must keep evaluator-family counts and disagreement visible rather than collapsing them into an unsupported winner.

## Threat model and fail-closed behavior

- **Label leakage:** explicit canonical-arm disclosures are forbidden case-insensitively after NFKC normalization and default-ignorable stripping. Unicode dash punctuation, U+2212, and all remaining punctuation or symbol separators become token boundaries. A real arm identity (`current`, `frozen`, or the two-token `no skill`) adjacent to `arm`, `variant`, `candidate`, or `label` is blocked in either order; exact structured identity values are blocked too. Ordinary prose such as “current visual hierarchy” remains valid. The unmask map is a separate operator-held file.
- **Evidence substitution:** packet hashes must exactly match the authoritative manifest after unmasking. Result citations must resolve to hashes for the same option and viewport. Filesystem-backed validation also checks the manifest contract, screenshot existence, screenshot bytes, and canonical DOM/style hashes.
- **Partial judging:** the packet must contain exactly three unique opaque arms and exactly one mobile plus one desktop artifact per arm. Missing, duplicated, collapsed, or extra artifacts, comparisons, citations, families, or identities reject the panel.
- **Correlated panels:** two documents from one evaluator family do not form quorum. Reused judge identities also reject.
- **False certainty:** `tie` and `abstain` are first-class outcomes. Family disagreement remains valid input and must be reported.
- **Fabricated human calibration:** a claim is rejected unless the result contains explicit human-observed records with opaque participant IDs, UTC times, recorded consent, and `human_observed` provenance. No such claim or record exists today.
- **Local-data leakage:** references are normalized repo-relative paths. Packet and result validation rejects local identities, Unix/Windows/home-relative paths, boundary-delimited email addresses, boundary-delimited secret-like assignments, and non-opaque judge, family, observation, or participant IDs. Schema and runtime consume one canonical unsafe-text regex source, with a test that rejects any schema drift. Ordinary at-sign prose and embedded identifier substrings are not treated as leaks.
- **Release laundering:** the packet is fixed to `pending` and non-release. Observation and analysis contracts are fixed to `release_scope: milestone_only`; no Oracle output contains `release_evidence_eligible`. A provenance object is accepted as collected only when it carries the validated packet, manifest, and result receipts expected from the collector. Oracle tools never write release receipts or alter release thresholds.

The validator cannot prove evaluator independence, truthfulness of a human record, or inability to infer an option from visual style. Those controls require operational separation and external audit logs.

## Evidence boundary

The accepted Task 2 manifest lives in ignored working evidence at `.omx/taste-oracle/task2-final/manifest.json`. Its file SHA-256 is `9b8fc5f2e299caa2f6e2794823bcebafa482ef08a297b22de678e29052074190`; its canonical-object SHA-256 is `4f3c69ef676ed8c9939204264a2b1a1534835a7cbd93d5d147556c815d4289b7`. The committed packet pins those values and all 18 artifact hashes but does not commit screenshots or claim that judges observed them. The corresponding unmask map is ignored operator material and is not part of the judge-visible or committed packet.

Generated evidence is immutable and ignored. A new capture requires a new run directory. `manifest.json` and its artifacts are never replaced in place; updating a packet requires explicit review of a different manifest and hashes. Never silently repoint a judged packet.

## Statistical interpretation

`npm run oracle:analyze -- <observations.json>` performs a seeded family-balanced cluster bootstrap. Judge/result documents are the independent clusters; rows from one result are never treated as independent draws. Each evaluator family receives equal weight, clusters are resampled within family, and at least two analyzable clusters per family are required for directional support. The report exposes each family's ordered `cluster_margins`, cluster counts, wins/losses/ties/abstentions/margin, and `family_disagreement`; disagreement forces `insufficient_evidence`. Abstentions remain in counts but are excluded from scoring.

Inputs conform to `contracts/v2/taste-oracle-observations.schema.json`; outputs use `contracts/v2/taste-oracle-analysis-result.schema.json`. JSON Schema owns shape and scalar bounds. The runtime `validateAnalysisResult` gate additionally recomputes per-family margins and the seeded bootstrap interval from `cluster_margins`, validates cluster/sample relationships, recomputes family disagreement and independent-cluster sufficiency, and derives the only valid status in both directions. Both synthetic and collected analyses are milestone-only and non-release.

Judge quorum and statistical support answer different questions. Quorum says the evidence packet and responses are complete and independently declared across families. Statistical analysis estimates uncertainty over collected pairwise observations. Neither alone proves product quality or release eligibility.

## Verification

```sh
npm run test:oracle
npm run test:oracle-contracts
npm run test:oracle-capture
npm run test:oracle-statistics
npm run test:oracle-judges
npm run test:oracle-e2e
npm test
npm run test:contracts
npm run test:eval-schema
npm run test:eval-remediation
npm run verify:release
```

`npm test` starts with `test:oracle`, so default verification and `verify:v1` cannot bypass this lane.

The final command is expected to remain blocked by the pre-existing release evidence/version gates. An Oracle change that makes it pass without approved release evidence is a regression.

## Limitations and roadmap

- The lane covers one scenario and one skill, so it cannot establish pack-wide quality.
- There are no collected external judge results or human calibration observations.
- Fresh integration capture now succeeds locally and produces all six expected screenshots plus a validated immutable manifest. Those generated browser artifacts remain ignored working evidence, so the committed pending packet is still not independently reproducible from a clean clone and cannot serve as release evidence.
- Model-family independence is declared metadata; future orchestration should attach provider receipts without exposing private runtime details.
- The rubric is visual and evidence-grounded but not calibrated against user outcomes.

Next steps are an adaptive interview that chooses follow-ups from measured ambiguity, a drift-watch job that recaptures fixtures and flags hash or geometry changes, and a small consented human panel used only to calibrate rubric reliability. Each remains roadmap work until real records and acceptance criteria exist.
