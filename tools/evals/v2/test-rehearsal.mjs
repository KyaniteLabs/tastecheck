import assert from "node:assert/strict";

import { rehearse } from "./rehearse.mjs";
import { recordQaCase } from "./lib/qa-case.mjs";

const expected = {
  generations: 48,
  render_receipts: 96,
  packets: 24,
  anchors: 4,
  production_judgments: 96,
  anchor_judgments: 16,
  simulated_external_calls: 160,
  real_external_calls_started: 0
};

const success = rehearse();
assert.deepEqual(success.report, expected);
assert.equal(success.status, "rehearsal_passed");
assert.equal(success.human_calibration_claimed, false);
assert.equal(success.unmask_opened, false);
assert.equal(success.production_artifacts_written, false);
assert.deepEqual(success.production_admission, {
  count: 1,
  before_ordinal_1: true,
  exclusions: [],
  max_external_calls: 160,
  incremental_spend_cap_usd: 0,
  retry_policy: "none"
});
assert.deepEqual({
  consumed_jobs: success.source_bindings.consumed_jobs,
  revisions: success.source_bindings.revisions
}, {
  consumed_jobs: 48,
  revisions: {
    baseline: "0f99603a603b0243345e7320a52702df67a2194e",
    candidate: "08591213f562073f9ddb0ff9012ec0e3f8ed09c2"
  }
});
assert.match(success.source_bindings.content_sha256.baseline, /^[0-9a-f]{64}$/);
assert.match(success.source_bindings.content_sha256.candidate, /^[0-9a-f]{64}$/);
assert.notEqual(success.source_bindings.content_sha256.baseline, success.source_bindings.content_sha256.candidate);
assert.equal(success.judgment_schedule_bindings, 112);
assert.deepEqual(success.external_call_capability, { mode: "fake-only", real_calls_started: 0 });
assert.deepEqual(success.ledger_ordinals, Array.from({ length: 160 }, (_, index) => index + 1));
assert.deepEqual(success.pre_admission_order, [
  "registry_and_revisions_verified", "validator_closure_verified", "randomization_committed",
  "control_artifacts_persisted", "production_admitted", "control_commit_created",
  "clean_head_revalidated", "ordinal_1_reserved"
]);

for (const failureOrdinal of [1, 49, 80, 160]) {
  const failed = rehearse({ failureOrdinal });
  assert.equal(failed.status, "production_incomplete");
  assert.equal(failed.failing_ordinal, failureOrdinal);
  assert.deepEqual(failed.ledger_ordinals, Array.from({ length: failureOrdinal }, (_, index) => index + 1));
  assert.equal(failed.retry_count, 0);
  assert.equal(failed.events_after_failure, 0);
  assert.equal(failed.unmask_opened, false);
  assert.equal(failed.real_external_calls_started, 0);
}

const invalidJudge = rehearse({ invalidJudgeOrdinal: 49 });
assert.equal(invalidJudge.status, "production_incomplete");
assert.equal(invalidJudge.failing_ordinal, 49);
assert.equal(invalidJudge.failure_status, "invalid_artifact");
assert.deepEqual(invalidJudge.ledger_ordinals, Array.from({ length: 49 }, (_, index) => index + 1));
assert.equal(invalidJudge.events_after_failure, 0);
assert.equal(invalidJudge.real_external_calls_started, 0);

assert.throws(
  () => rehearse({ swapSourceRoots: true }),
  /source.*revision|revision.*source|source.*binding/i
);
assert.throws(
  () => rehearse({ dirtySourceRoot: true }),
  /source.*revision|revision.*source|source.*binding|dirty/i
);
recordQaCase("dirty-tree-and-source-drift");
for (const admissionMutation of ["missing", "duplicate", "scenario_registry_sha256"]) {
  assert.throws(
    () => rehearse({ admissionMutation }),
    /production.*admission|admission.*production|admitted.*event/i
  );
}

const preAdmission = rehearse({ failPreAdmission: true });
assert.equal(preAdmission.status, "production_not_started");
assert.equal(preAdmission.simulated_external_calls, 0);
assert.deepEqual(preAdmission.ledger_ordinals, []);
assert.equal(preAdmission.real_external_calls_started, 0);
assert.equal(preAdmission.unmask_opened, false);

recordQaCase("ordinal-failure-no-retry-or-substitution");

console.log("effectiveness-v2 rehearsal passed; fake external calls 160; real external calls 0");
