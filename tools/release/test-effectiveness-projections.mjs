#!/usr/bin/env node
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkEffectivenessProjections, deriveEffectivenessProjections, PROJECTION_PATHS, SOURCE_PATHS } from "./project-effectiveness-evidence.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const temp = mkdtempSync(join(tmpdir(), "tastecheck-effectiveness-projections-"));
try {
  for (const path of [...Object.values(SOURCE_PATHS), ...Object.values(PROJECTION_PATHS)]) {
    mkdirSync(dirname(join(temp, path)), { recursive: true });
    cpSync(join(root, path), join(temp, path));
  }
  assert.deepEqual(checkEffectivenessProjections(temp), []);
  const derived = deriveEffectivenessProjections(temp);
  assert.equal(derived.w1.effectiveness_status, "blocked");
  assert.equal(derived.terminalV5.release_eligible, false);

  const w1Path = join(temp, SOURCE_PATHS.w1);
  const forged = JSON.parse(readFileSync(w1Path, "utf8"));
  forged.paired.pass_count = 3;
  writeFileSync(w1Path, `${JSON.stringify(forged, null, 2)}\n`);
  assert.throws(() => deriveEffectivenessProjections(temp), /immutable source facts mismatch/);
  console.log("effectiveness projection derivation tests passed");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
