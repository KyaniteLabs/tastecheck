// Task 6: Synthesis reservation, frozen-registry closeout verification, and
// one-time unmask opening. This module never imports the build authority; the
// HMAC tuple contract is shared via contracts.mjs.

import { createHash, createDecipheriv } from "node:crypto";
import { execSync } from "node:child_process";
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, statSync, writeFileSync
} from "node:fs";
import { dirname, join, relative } from "node:path";

import { canonicalJson, sha256, hmacTuple, canonicalPacket } from "./contracts.mjs";
import { loadRegistry, validateCorpusSeparation } from "./registry.mjs";
import { appendEvent, validateLedger } from "./ledger.mjs";

// ---------------------------------------------------------------------------
// Run ID derivation — binds protocol, scenario registry, source revisions,
// execution manifest, exclusions, and randomization commitment digests.
// ---------------------------------------------------------------------------
export function deriveRunId({
  protocolSha256, scenarioRegistrySha256, baselineRevision,
  candidateRevision, executionManifestSha256, randomizationCommitmentSha256
}) {
  return sha256(canonicalJson({
    protocol_sha256: protocolSha256,
    scenario_registry_sha256: scenarioRegistrySha256,
    baseline_revision: baselineRevision,
    candidate_revision: candidateRevision,
    execution_manifest_sha256: executionManifestSha256,
    exclusions_sha256: sha256(canonicalJson([])),
    randomization_commitment_sha256: randomizationCommitmentSha256
  }));
}

// ---------------------------------------------------------------------------
// Registry manifest
// ---------------------------------------------------------------------------
export function loadRegistryManifest(repoRoot) {
  const raw = readFileSync(join(repoRoot, "evals/v2/scenario-registry.json"), "utf8");
  return JSON.parse(raw);
}

export function computeScenarioRegistrySha256(manifest) {
  return sha256(canonicalJson(manifest));
}

// ---------------------------------------------------------------------------
// verifyFrozenRegistryAtCloseout
// ---------------------------------------------------------------------------
function assertRegularFileWithinRoot(filePath, repoRoot) {
  const relPath = relative(repoRoot, filePath);
  if (relPath.startsWith("..")) throw new Error(`registry closeout: out-of-root file ${relPath}`);
  let stats;
  try { stats = statSync(filePath); } catch { throw new Error(`registry closeout: missing file ${relPath}`); }
  if (!stats.isFile()) throw new Error(`registry closeout: nonregular file ${relPath}`);
  const lst = lstatSync(filePath);
  if (lst.isSymbolicLink()) throw new Error(`registry closeout: symlink rejected ${relPath}`);
}

export function verifyFrozenRegistryAtCloseout(repoRoot, expectedDigest) {
  if (!repoRoot || typeof repoRoot !== "string") throw new Error("registry closeout: repoRoot required");

  const manifest = loadRegistryManifest(repoRoot);
  const actualDigest = computeScenarioRegistrySha256(manifest);
  if (expectedDigest && actualDigest !== expectedDigest) {
    throw new Error(`registry closeout: digest drift (expected ${expectedDigest.slice(0, 12)}, got ${actualDigest.slice(0, 12)})`);
  }

  const scenarioDir = join(repoRoot, "evals/v2/scenarios");
  const anchorDir = join(repoRoot, "evals/v2/anchors");
  const scenarioFiles = readdirSync(scenarioDir).filter((n) => n.endsWith(".json")).sort();
  const anchorFiles = readdirSync(anchorDir).filter((n) => n.endsWith(".json")).sort();

  if (scenarioFiles.length !== 12) throw new Error(`registry closeout: expected 12 scenario files, got ${scenarioFiles.length}`);
  if (anchorFiles.length !== 4) throw new Error(`registry closeout: expected 4 anchor files, got ${anchorFiles.length}`);

  const manifestScenarios = new Map(manifest.scenarios.map((s) => [s.scenario_id, s.sha256]));
  const manifestAnchors = new Map(manifest.anchors.map((a) => [a.anchor_id, a.sha256]));

  const verifiedScenarios = [];
  const seenHashes = new Set();
  const seenIds = new Set();
  for (const fileName of scenarioFiles) {
    const filePath = join(scenarioDir, fileName);
    assertRegularFileWithinRoot(filePath, repoRoot);
    const bytes = readFileSync(filePath);
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const parsed = JSON.parse(bytes.toString("utf8"));

    if (!parsed.scenario_id) throw new Error(`registry closeout: missing embedded scenario_id in ${fileName}`);
    if (!manifestScenarios.has(parsed.scenario_id)) {
      throw new Error(`registry closeout: embedded scenario_id "${parsed.scenario_id}" not in manifest (invented or substituted ID rejected)`);
    }
    const expectedHash = manifestScenarios.get(parsed.scenario_id);
    if (fileHash !== expectedHash) {
      throw new Error(`registry closeout: hash mismatch for scenario "${parsed.scenario_id}" (file mutated or swapped hashes)`);
    }
    if (seenHashes.has(fileHash)) throw new Error(`registry closeout: duplicate scenario hash ${fileHash.slice(0, 12)}`);
    if (seenIds.has(parsed.scenario_id)) throw new Error(`registry closeout: duplicate scenario ID ${parsed.scenario_id}`);
    seenHashes.add(fileHash);
    seenIds.add(parsed.scenario_id);
    verifiedScenarios.push({ scenario_id: parsed.scenario_id, sha256: fileHash, file: fileName, stratum: parsed.stratum });
  }

  const verifiedAnchors = [];
  const seenAnchorHashes = new Set();
  const seenAnchorIds = new Set();
  for (const fileName of anchorFiles) {
    const filePath = join(anchorDir, fileName);
    assertRegularFileWithinRoot(filePath, repoRoot);
    const bytes = readFileSync(filePath);
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    const parsed = JSON.parse(bytes.toString("utf8"));

    if (!parsed.anchor_id) throw new Error(`registry closeout: missing embedded anchor_id in ${fileName}`);
    if (!manifestAnchors.has(parsed.anchor_id)) {
      throw new Error(`registry closeout: embedded anchor_id "${parsed.anchor_id}" not in manifest`);
    }
    const expectedHash = manifestAnchors.get(parsed.anchor_id);
    if (fileHash !== expectedHash) {
      throw new Error(`registry closeout: hash mismatch for anchor "${parsed.anchor_id}" (swapped hashes rejected)`);
    }
    if (seenAnchorHashes.has(fileHash)) throw new Error(`registry closeout: duplicate anchor hash ${fileHash.slice(0, 12)}`);
    if (seenAnchorIds.has(parsed.anchor_id)) throw new Error(`registry closeout: duplicate anchor ID ${parsed.anchor_id}`);
    seenAnchorHashes.add(fileHash);
    seenAnchorIds.add(parsed.anchor_id);
    verifiedAnchors.push({ anchor_id: parsed.anchor_id, sha256: fileHash, kind: parsed.kind, expected: parsed.expected });
  }

  // Rerun closed-shape, strata, anchor, and content-separation checks
  const fullRegistry = loadRegistry(repoRoot);
  validateCorpusSeparation(fullRegistry);

  return Object.freeze({
    digest: actualDigest,
    manifest: Object.freeze(structuredClone(manifest)),
    scenarios: Object.freeze(verifiedScenarios.map(Object.freeze)),
    anchors: Object.freeze(verifiedAnchors.map(Object.freeze)),
    scenario_ids: Object.freeze(verifiedScenarios.map((s) => s.scenario_id).sort())
  });
}

// ---------------------------------------------------------------------------
// Reservation
// ---------------------------------------------------------------------------
export function reservationSha256(reservation) {
  return sha256(canonicalJson(reservation));
}

export function reserveSynthesis({ runRoot, runId, ledgerRoot }) {
  if (!runRoot) throw new Error("reserve: runRoot required");
  if (!runId) throw new Error("reserve: runId required");
  if (!ledgerRoot) throw new Error("reserve: ledgerRoot required");

  const runDir = join(runRoot, "evals/v2/runs", runId);
  mkdirSync(runDir, { recursive: true });
  const reservationPath = join(runDir, "synthesis-reservation.json");

  if (existsSync(reservationPath)) {
    throw new Error("one-time reservation: synthesis-reservation.json already exists (terminal state)");
  }

  const reservation = {
    schema_version: 2,
    kind: "effectiveness-v2-synthesis-reservation",
    run_id: runId,
    ledger_root: ledgerRoot,
    reservation_nonce: createHash("sha256").update(`${runId}|${ledgerRoot}|${process.pid}`).digest("hex")
  };
  const serialized = canonicalJson(reservation) + "\n";

  const fd = openSync(reservationPath, "wx", 0o600);
  try { writeFileSync(fd, serialized, { flush: true }); } finally { closeSync(fd); }
  try {
    const dirFd = openSync(dirname(reservationPath), "r");
    try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
  } catch { /* best-effort directory fsync */ }

  return { reservation, reservationPath, reservation_sha256: reservationSha256(reservation) };
}

// ---------------------------------------------------------------------------
// verifyCommittedReservation
// ---------------------------------------------------------------------------
function git(cwd, args) {
  return execSync(`git ${args}`, { cwd, encoding: "utf8" }).trim();
}

function gitBool(cwd, args) {
  try { execSync(`git ${args}`, { cwd, encoding: "utf8", stdio: "pipe" }); return true; } catch { return false; }
}

export function verifyCommittedReservation({ repoRoot, runId, reservationSha256: expectedSha, head }) {
  if (!repoRoot) throw new Error("committed reservation: repoRoot required");
  if (!runId) throw new Error("committed reservation: runId required");

  const isClean = gitBool(repoRoot, "diff-index --quiet HEAD --");
  if (!isClean) throw new Error("committed reservation: worktree must be clean before unmask (dirty tree)");

  let headContent;
  try {
    headContent = git(repoRoot, `show ${head}:evals/v2/runs/${runId}/synthesis-reservation.json`);
  } catch { throw new Error("committed reservation: reservation not found in HEAD (deletion or root missing)"); }
  const parsed = JSON.parse(headContent);
  if (parsed.run_id !== runId) {
    throw new Error(`committed reservation: run id mismatch (copied run root expected ${runId}, got ${parsed.run_id})`);
  }
  const actualSha = reservationSha256(parsed);
  if (actualSha !== expectedSha) {
    throw new Error(`committed reservation: reservation sha256 mismatch (expected ${expectedSha?.slice(0, 12)}, got ${actualSha.slice(0, 12)})`);
  }

  let ledgerContent;
  try {
    ledgerContent = git(repoRoot, `show ${head}:evals/v2/runs/${runId}/ledger.jsonl`);
  } catch { throw new Error("committed reservation: ledger deletion or root missing"); }
  const events = ledgerContent.trim().split("\n").filter(Boolean).map(JSON.parse);
  try { validateLedger(events); } catch (error) { throw new Error(`committed reservation: ledger chain invalid (forked predecessor): ${error.message}`); }

  if (events[0]?.type !== "run_initialized") throw new Error("committed reservation: ledger missing initial run_initialized root");
  if (events[0].run_id !== runId) throw new Error("committed reservation: ledger run_id root mismatch (copied run)");
  if (!events.some((e) => e.type === "production_admitted")) throw new Error("committed reservation: ledger missing production_admitted event");
  if (events.some((e) => e.type === "synthesis_completed" || e.type === "opening_attempted")) {
    throw new Error("one-time synthesis: prior synthesis/opening event detected (rerun prohibited)");
  }

  const ledgerRoot = events[events.length - 1].event_sha256;
  if (parsed.ledger_root !== ledgerRoot) {
    throw new Error(`committed reservation: ledger root drift (forked ledger)`);
  }

  return { run_id: runId, reservation: parsed, ledger_root: ledgerRoot, verified: true };
}

// ---------------------------------------------------------------------------
// openUnmask
// ---------------------------------------------------------------------------
export function openUnmask({
  repoRoot, protocol, registryManifest, runId, encryptedMap, packetSet,
  commitment, reservation, ledger, repoRootForReservation, head, openCapability
}) {
  if (!repoRoot) throw new Error("openUnmask: canonical repoRoot required");
  if (!protocol) throw new Error("openUnmask: protocol required");
  if (!runId) throw new Error("openUnmask: runId required");
  if (!openCapability || typeof openCapability.openCommittedMap !== "function") {
    throw new Error("openUnmask: openCapability.openCommittedMap required");
  }

  // 1. Bind the caller manifest and on-disk corpus to the registry digest that
  // was admitted in the validated ledger. This must finish before any opening
  // capability can create a marker or read the seed.
  const ledgerEvents = ledger?.events;
  if (!Array.isArray(ledgerEvents)) throw new Error("openUnmask: validated ledger events required");
  try { validateLedger(ledgerEvents); } catch (error) {
    throw new Error(`openUnmask: ledger chain invalid: ${error.message}`);
  }
  const initialized = ledgerEvents.filter((event) => event.type === "run_initialized");
  const admitted = ledgerEvents.filter((event) => event.type === "production_admitted");
  if (initialized.length !== 1) throw new Error("openUnmask: exactly one run_initialized event required");
  if (admitted.length !== 1) throw new Error("openUnmask: exactly one production_admitted event required");
  const initRegistrySha = initialized[0].scenario_registry_sha256;
  const admittedRegistrySha = admitted[0].scenario_registry_sha256;
  const digestPattern = /^[0-9a-f]{64}$/;
  if (!digestPattern.test(initRegistrySha ?? "") || !digestPattern.test(admittedRegistrySha ?? "")) {
    throw new Error("openUnmask: admitted scenario registry digest missing or invalid");
  }
  if (initRegistrySha !== admittedRegistrySha) {
    throw new Error("openUnmask: admitted scenario registry digest mismatch");
  }
  const callerRegistrySha = computeScenarioRegistrySha256(registryManifest);
  if (callerRegistrySha !== admittedRegistrySha) {
    throw new Error("openUnmask: caller registry manifest differs from admitted digest");
  }
  const verifiedRegistry = verifyFrozenRegistryAtCloseout(repoRoot, admittedRegistrySha);

  // 2. Compute the expected packet_set_sha256 from the provided packet set.
  const sortedPackets = [...packetSet].sort((a, b) => a.packet_id.localeCompare(b.packet_id));
  const expectedPacketSetSha = sha256(canonicalJson(sortedPackets.map(canonicalPacket)));

  // 3. Delegate to the open authority: marker, seed, decrypt, verify commitment.
  const opened = openCapability.openCommittedMap({
    reservationRepoRoot: repoRootForReservation ?? repoRoot,
    runId,
    reservation,
    head,
    ledgerPath: ledger?.path,
    ledgerEvents: ledger?.events,
    encryptedMap,
    expectedPacketSetSha,
    commitment,
    scenarioIds: verifiedRegistry.scenario_ids,
    seeds: protocol.seeds
  });

  // 4. Verify run_id binding
  if (opened.run_id && opened.run_id !== runId) {
    throw new Error(`unmask binding: run id mismatch (wrong run)`);
  }

  // 5. Verify packet_set_sha256 binding
  if (opened.packet_set_sha256 !== expectedPacketSetSha) {
    throw new Error(`unmask binding: packet set sha256 mismatch`);
  }

  // 6. Verify commitment binding
  if (opened.commitment_sha256 !== commitment) {
    throw new Error(`unmask binding: commitment mismatch (recomputed or swapped map)`);
  }

  // 7. Verify reservation binding
  if (reservation && opened.reservation_sha256 !== reservation.sha256) {
    throw new Error(`unmask binding: reservation sha256 mismatch (post-reservation replacement)`);
  }

  // 8. Verify map completeness: 48 rows, 24 units, slots 0/1, bijection.
  const mappings = opened.mappings;
  if (!Array.isArray(mappings) || mappings.length !== 48) {
    throw new Error(`unmask binding: expected 48 mappings, got ${Array.isArray(mappings) ? mappings.length : "n/a"}`);
  }
  const unitSlots = new Map();
  const unitScenarioSeed = new Map();
  for (const m of mappings) {
    if (m.opaque_slot !== 0 && m.opaque_slot !== 1) throw new Error(`unmask binding: invalid slot ${m.opaque_slot}`);
    if (m.arm !== "baseline" && m.arm !== "candidate") throw new Error(`unmask binding: invalid arm ${m.arm}`);
    const key = `${m.unit_id}|${m.opaque_slot}`;
    if (unitSlots.has(key)) throw new Error(`unmask binding: duplicate coordinate (unit/slot)`);
    unitSlots.set(key, m.arm);
    if (!unitScenarioSeed.has(m.unit_id)) unitScenarioSeed.set(m.unit_id, `${m.scenario_id}|${m.generation_seed}`);
    else if (unitScenarioSeed.get(m.unit_id) !== `${m.scenario_id}|${m.generation_seed}`) {
      throw new Error(`unmask binding: coordinate bijection violated for unit`);
    }
  }
  if (unitScenarioSeed.size !== 24) throw new Error(`unmask binding: expected 24 unique units, got ${unitScenarioSeed.size}`);
  for (const [unitId] of unitScenarioSeed) {
    const arm0 = unitSlots.get(`${unitId}|0`);
    const arm1 = unitSlots.get(`${unitId}|1`);
    if (!arm0 || !arm1) throw new Error(`unmask binding: unit ${unitId.slice(0, 12)} missing slot`);
    if (arm0 === arm1) throw new Error(`unmask binding: unit ${unitId.slice(0, 12)} same arm both slots`);
  }

  // 9. Canonical sort for permutation invariance.
  const sortedMappings = [...mappings].sort((a, b) => {
    const cmp = a.unit_id.localeCompare(b.unit_id);
    return cmp !== 0 ? cmp : a.opaque_slot - b.opaque_slot;
  });

  return Object.freeze({
    run_id: runId,
    packet_set_sha256: opened.packet_set_sha256,
    commitment_sha256: opened.commitment_sha256,
    reservation_sha256: opened.reservation_sha256,
    ledger_predecessor: opened.ledger_predecessor,
    mappings: Object.freeze(sortedMappings.map(Object.freeze))
  });
}
