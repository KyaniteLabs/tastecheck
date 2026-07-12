#!/usr/bin/env node
// Task 5 CLI: load packets and judge results, then run validateJudgeBatch.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { validateJudgeBatch } from "./lib/judges.mjs";

const args = process.argv.slice(2);
if (args.length && args[0] === "preflight") {
  console.log("effectiveness-v2 judge-validator preflight passed");
  process.exit(0);
}
if (args.length !== 2) {
  throw new Error("usage: validate-judges.mjs <packets.json> <results.json>");
}
const packetSet = JSON.parse(readFileSync(resolve(args[0]), "utf8"));
const resultsPayload = JSON.parse(readFileSync(resolve(args[1]), "utf8"));
const result = validateJudgeBatch({
  packetSet: packetSet.packets ?? packetSet,
  anchorSet: packetSet.anchor_packets ?? [],
  anchorMetadata: packetSet.anchor_metadata ?? [],
  results: resultsPayload.results ?? resultsPayload,
  families: resultsPayload.families ?? []
});
console.log(JSON.stringify(result));
process.exit(result.valid ? 0 : 1);
