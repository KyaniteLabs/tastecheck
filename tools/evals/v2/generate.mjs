#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadRegistry } from "./lib/registry.mjs";
import { planGenerations } from "./lib/generate.mjs";

const root = resolve(new URL("../../../", import.meta.url).pathname);
const command = process.argv[2] ?? "preflight";
const protocolBytes = readFileSync(resolve(root, "evals/v2/protocol.json"));
const protocol = JSON.parse(protocolBytes);
const plan = planGenerations({ protocol, registry: loadRegistry(root), protocol_sha256: createHash("sha256").update(protocolBytes).digest("hex") });
if (command === "preflight") console.log("effectiveness-v2 preflight passed; fake/local planning only");
else if (command === "plan") console.log(JSON.stringify({ generation_calls: plan.jobs.length, external_calls_started: 0 }));
else if (command === "run") throw new Error("run requires an injected sealed executor; CLI external execution is disabled before production gates");
else throw new Error("usage: generate.mjs preflight|plan|run");
