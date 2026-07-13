import assert from "node:assert/strict";

import { rehearse } from "./rehearse.mjs";

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
assert.deepEqual(success.ledger_ordinals, Array.from({ length: 160 }, (_, index) => index + 1));
assert.deepEqual(success.pre_admission_order, [
  "registry_and_revisions_verified", "validator_closure_verified", "randomization_committed",
  "control_artifacts_persisted", "control_commit_created", "clean_head_revalidated", "ordinal_1_reserved"
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

const preAdmission = rehearse({ failPreAdmission: true });
assert.equal(preAdmission.status, "production_not_started");
assert.equal(preAdmission.simulated_external_calls, 0);
assert.deepEqual(preAdmission.ledger_ordinals, []);
assert.equal(preAdmission.real_external_calls_started, 0);
assert.equal(preAdmission.unmask_opened, false);

console.log("effectiveness-v2 rehearsal passed; fake external calls 160; real external calls 0");
