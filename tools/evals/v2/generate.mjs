#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadRegistry } from "./lib/registry.mjs";
import { planGenerations } from "./lib/generate.mjs";
import { canonicalExecutorDigest } from "./lib/providers.mjs";

const root = resolve(new URL("../../../", import.meta.url).pathname);
const command = process.argv[2] ?? "preflight";
const protocolBytes = readFileSync(resolve(root, "evals/v2/protocol.json"));
const protocol = JSON.parse(protocolBytes);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const localPlanningExecutor = Object.freeze({
  call_class: "generation", provider: "local-preflight", foundation_lineage: "local-preflight",
  model_version: "planning-only", runtime_version: "planning-only",
  adapter_sha256: digest("local-preflight-adapter"), system_prompt_sha256: digest("local-preflight-prompt"),
  rubric_sha256: null, settings_sha256: digest("local-preflight-settings"),
  tool_policy_sha256: digest("local-preflight-tools"), time_budget_seconds: 900,
  family: "local-preflight", identity: "local-preflight",
  zero_cost_proof: Object.freeze({ kind: "already-provisioned", incremental_spend_usd: 0 })
});
const generatorBinding = Object.freeze({
  executor: localPlanningExecutor,
  executor_digest: canonicalExecutorDigest(localPlanningExecutor),
  resolver_attestation_sha256: digest("local-preflight-attestation")
});
const plan = planGenerations({ protocol, registry: loadRegistry(root), protocol_sha256: digest(protocolBytes), generatorBinding });
if (command === "preflight") {
  console.log(JSON.stringify({
    status: "production_not_started",
    reason: "sealed_two_provider_admissibility_not_proven",
    required_providers: 2,
    required_distinct_foundation_lineages: 2,
    incremental_spend_cap_usd: 0,
    planned_external_calls: 160,
    external_calls_started: 0,
    retries: 0
  }));
  process.exitCode = 2;
}
else if (command === "plan") console.log(JSON.stringify({ generation_calls: plan.jobs.length, external_calls_started: 0 }));
else if (command === "run") throw new Error("run requires an injected sealed executor; CLI external execution is disabled before production gates");
else throw new Error("usage: generate.mjs preflight|plan|run");
