#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkReceiptManifest, checkReleaseManifest } from "./check.mjs";

const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const valid = JSON.parse(readFileSync(join(root, "tools/release/fixtures/valid-manifest.json"), "utf8"));
const missing = JSON.parse(readFileSync(join(root, "tools/release/fixtures/missing-cell.json"), "utf8"));
const fixtureText = JSON.stringify({ ok: true });
valid.required_receipts[0].sha256 = (await import("node:crypto")).createHash("sha256").update(fixtureText).digest("hex");
const fake = { readText: () => fixtureText, hasFile: (path) => path === "fixture.json" };
if (checkReceiptManifest(valid, fake).length) throw new Error("valid manifest fixture failed");
if (!checkReceiptManifest(missing, fake).some((error) => error.includes("missing required receipt cell"))) throw new Error("missing-cell fixture did not fail closed");

const release = JSON.parse(readFileSync(join(root, "contracts/v1/release-receipts.json"), "utf8"));
const terminal = release.required_receipts.find((receipt) => receipt.id === "terminal-v5-synthesis");
if (!terminal) throw new Error("release contract does not pin the terminal V5 synthesis");
if (terminal.path !== "evals/replays/remediation7-v5-spacing-final-2026-07-11/blind-judge/synthesis.json") throw new Error("terminal V5 synthesis path drifted");
if (terminal.assertions?.release_eligible !== true) throw new Error("terminal V5 synthesis must require release_eligible=true");
const releaseErrors = checkReleaseManifest(release);
if (!releaseErrors.some((error) => error.startsWith("terminal-v5-synthesis: release_eligible=false"))) {
  throw new Error("terminal V5 blocked state did not fail the release contract");
}

const historical = structuredClone(valid);
historical.required_receipts[0].path = "evals/replays/full19-v1rc-2026-07-11/results/old.json";
if (!checkReleaseManifest(historical, { readText: () => fixtureText, hasFile: () => true }).some((error) => error.includes("historical full19-v1rc"))) {
  throw new Error("historical full19-v1rc evidence was accepted as current release proof");
}

console.log("release checker fixtures passed (valid + missing-cell + terminal-V5 fail-closed)");
