#!/usr/bin/env node
// Task 6: Synthesis CLI — reserve and synthesize commands.
// reserve: exclusively creates the terminal synthesis reservation, then exits.
// synthesize (default): verifies committed reservation, frozen registry,
//   opens the one-time unmask, and synthesizes the closed decision contract.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { reserveSynthesis } from "./lib/reservation.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const command = process.argv[2] ?? "synthesize";

function loadLedger(runRoot, runId) {
  const ledgerPath = join(runRoot, "evals/v2/runs", runId, "ledger.jsonl");
  if (!existsSync(ledgerPath)) throw new Error(`ledger not found: ${ledgerPath}`);
  const content = readFileSync(ledgerPath, "utf8").trim();
  return { path: ledgerPath, events: content ? content.split("\n").map(JSON.parse) : [] };
}

if (command === "reserve") {
  const runRoot = process.argv[3] ?? repoRoot;
  const runId = process.argv[4] ?? process.env.TASTECHECK_V2_RUN_ID;
  if (!runId) { console.error("synthesize reserve: runId argument or TASTECHECK_V2_RUN_ID required"); process.exit(1); }
  const ledger = loadLedger(runRoot, runId);
  const ledgerRoot = ledger.events[ledger.events.length - 1].event_sha256;
  const result = reserveSynthesis({ runRoot, runId, ledgerRoot });
  console.log(JSON.stringify({ reserved: true, reservation_sha256: result.reservation_sha256, path: result.reservationPath }, null, 2));
} else if (command === "synthesize") {
  console.error(JSON.stringify({
    status: "production_not_started",
    reason: "sealed_synthesis_execution_context_unavailable",
    external_calls_started: 0,
    claim_allowed: false
  }));
  process.exit(2);
} else {
  console.error(`Unknown command: ${command}. Use 'reserve' or 'synthesize'.`);
  process.exit(1);
}
