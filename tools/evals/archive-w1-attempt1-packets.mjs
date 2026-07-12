#!/usr/bin/env node
/** Archive immutable packet revisions for an existing W1 attempt. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const rawDir = join(root, ".omx/evidence/tastecheck-v1/raw");
const revisionsDir = join(rawDir, "packet-revisions");
const args = process.argv.slice(2);
const attemptIndex = args.includes("--attempt") ? Number(args[args.indexOf("--attempt") + 1]) : 1;
if (!Number.isInteger(attemptIndex) || attemptIndex < 1) {
  console.error("Usage: node tools/evals/archive-w1-attempt1-packets.mjs --attempt <positive index>");
  process.exit(1);
}
mkdirSync(revisionsDir, { recursive: true });

for (const file of readdirSync(rawDir).filter((name) => new RegExp(`-(?:baseline|upgraded)-seed\\d+-attempt-${attemptIndex}\\.json$`).test(name)).sort()) {
  const attempt = JSON.parse(readFileSync(join(rawDir, file), "utf8"));
  const revisionPath = join(revisionsDir, `${attempt.attempt_id}.json`);
  if (existsSync(revisionPath)) {
    console.log(`preserved ${attempt.attempt_id}`);
    continue;
  }
  const livePacket = JSON.parse(readFileSync(join(root, "evals/w1/jobs", `${attempt.job_id}.json`), "utf8"));
  const revision = {
    ...livePacket,
    skill_source_path: attempt.skill_source_path,
    skill_source_sha256: attempt.skill_source_sha256,
    assertions: attempt.assertions_result.map((entry) => entry.assertion_text),
    source_revision: {
      revision: `attempt-${attemptIndex}-archived`,
      validation: "archived",
      sha256: attempt.skill_source_sha256,
      source_path: attempt.skill_source_path,
      provenance: `attempt-${attemptIndex} immutable packet binding`,
    },
  };
  writeFileSync(revisionPath, JSON.stringify(revision, null, 2) + "\n");
  console.log(`archived ${attempt.attempt_id}`);
}
