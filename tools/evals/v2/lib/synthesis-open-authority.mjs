// Task 6: The synthesis-open authority. The sole public method openCommittedMap
// verifies the committed reservation, creates the terminal opening-attempt
// marker, appends its ledger event, reads the seed, decrypts the authenticated
// map, recomputes and verifies HMAC tokens, then zeroes the seed. This module
// never imports the build authority; the HMAC tuple contract is shared via
// contracts.mjs.

import { createHash, createHmac, createDecipheriv } from "node:crypto";
import { execSync } from "node:child_process";
import {
  closeSync, existsSync, fsyncSync, openSync, readFileSync, statSync, writeFileSync
} from "node:fs";
import { dirname, join } from "node:path";

import { canonicalJson, sha256, hmacTuple } from "./contracts.mjs";
import { appendEvent } from "./ledger.mjs";

function gitBool(cwd, args) {
  try { execSync(`git ${args}`, { cwd, encoding: "utf8", stdio: "pipe" }); return true; } catch { return false; }
}

function loadSeed(privateStateRef) {
  let stats;
  try { stats = statSync(privateStateRef.secretPath); } catch { throw new Error("randomization secret missing"); }
  if ((stats.mode & 0o777) !== 0o600) throw new Error("randomization secret permission must be 0600");
  const seed = readFileSync(privateStateRef.secretPath);
  const commitmentCheck = createHash("sha256").update("tastecheck-randomization-v2\0").update(privateStateRef.domain).update("\0").update(seed).digest("hex");
  if (seed.length !== 32 || commitmentCheck !== privateStateRef.commitment_sha256) {
    seed.fill(0);
    throw new Error("randomization commitment replacement detected");
  }
  return seed;
}

function decryptMap(seed, encryptedMap, expectedPacketSetSha) {
  const key = createHmac("sha256", seed).update("unmask-encryption-key-v1").digest();
  const nonce = createHmac("sha256", seed).update("unmask-encryption-nonce-v1").digest().subarray(0, 12);
  const envelope = JSON.parse(
    Buffer.isBuffer(encryptedMap) ? encryptedMap.toString("utf8") : encryptedMap
  );
  if (envelope.algorithm !== "aes-256-gcm") throw new Error("opening: invalid encryption algorithm");
  if (envelope.packet_set_sha256 !== expectedPacketSetSha) throw new Error("opening: packet_set_sha256 AAD mismatch");
  const aad = Buffer.from(envelope.packet_set_sha256, "utf8");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  let plaintext;
  try {
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final()
    ]);
  } catch {
    throw new Error("opening: authenticated decryption failed (invalid opening or forged map)");
  }
  return JSON.parse(plaintext.toString("utf8"));
}

export function createOpenAuthority(privateStateRef) {
  return Object.freeze({
    /**
     * openCommittedMap({ reservationRepoRoot, runId, reservation, head,
     *   ledgerPath, ledgerEvents, encryptedMap, expectedPacketSetSha,
     *   commitment, scenarioIds, seeds })
     *
     * Returns { mappings, packet_set_sha256, commitment_sha256,
     *   reservation_sha256, ledger_predecessor }.
     */
    openCommittedMap(params) {
      const {
        reservationRepoRoot, runId, reservation, head,
        ledgerPath, ledgerEvents, encryptedMap, expectedPacketSetSha,
        commitment, scenarioIds, seeds
      } = params;

      // 1. Verify committed reservation (clean tree).
      const isClean = gitBool(reservationRepoRoot, "diff-index --quiet HEAD --");
      if (!isClean) throw new Error("opening: worktree must be clean (post-reservation replacement detected)");

      // 2. Verify reservation exists in HEAD.
      let reservationContent;
      try {
        reservationContent = execSync(
          `git show ${head}:evals/v2/runs/${runId}/synthesis-reservation.json`,
          { cwd: reservationRepoRoot, encoding: "utf8" }
        ).trim();
      } catch {
        throw new Error("opening: committed reservation not found in HEAD");
      }
      const parsedReservation = JSON.parse(reservationContent);
      const reservationDigest = sha256(canonicalJson(parsedReservation));
      if (reservation && reservation.sha256 !== reservationDigest) {
        throw new Error("opening: reservation sha256 mismatch (binding)");
      }

      // 3. Create terminal opening-attempt marker (exclusive create + fsync).
      const markerPath = join(reservationRepoRoot, "evals/v2/runs", runId, "opening-attempt.json");
      if (existsSync(markerPath)) {
        throw new Error("one-time opening: opening-attempt.json already exists (crash terminal — cannot resume)");
      }
      const marker = {
        schema_version: 2,
        kind: "effectiveness-v2-opening-attempt",
        run_id: runId,
        reservation_sha256: reservationDigest,
        at: new Date().toISOString()
      };
      const fd = openSync(markerPath, "wx", 0o600);
      try { writeFileSync(fd, canonicalJson(marker) + "\n", { flush: true }); } finally { closeSync(fd); }
      try {
        const dirFd = openSync(dirname(markerPath), "r");
        try { fsyncSync(dirFd); } finally { closeSync(dirFd); }
      } catch { /* best-effort */ }

      // 4. Append opening_attempted event to ledger.
      let ledgerPredecessor = null;
      let lastEvent = null;
      if (ledgerPath && ledgerEvents) {
        lastEvent = ledgerEvents[ledgerEvents.length - 1];
      }
      const openingEvent = appendEvent(ledgerPath, lastEvent, {
        type: "opening_attempted", at: marker.at, run_id: runId,
        reservation_sha256: reservationDigest
      });
      ledgerPredecessor = openingEvent.event_sha256;

      // 5. Read seed, decrypt map, verify commitment, recompute tokens, zero seed.
      const seed = loadSeed(privateStateRef);
      let result;
      try {
        // Decrypt
        const plaintextMap = decryptMap(seed, encryptedMap, expectedPacketSetSha);

        // Verify commitment: SHA256(canonicalJson(plaintextMap)) === commitment
        const actualCommitment = sha256(canonicalJson(plaintextMap));
        if (actualCommitment !== commitment) {
          throw new Error("opening: map commitment mismatch (recomputed or replaced map)");
        }

        // Verify and recompute HMAC tokens for every mapping.
        const verifiedMappings = [];
        for (const m of plaintextMap.mappings) {
          // Recompute unit_id, scenario_id_token, assignment
          const recomputedUnitId = hmacTuple(seed, "unit", m.scenario_id, m.generation_seed);
          if (recomputedUnitId !== m.unit_id) {
            throw new Error(`opening: HMAC unit_id re-verification failed for scenario ${m.scenario_id} (invented ID or tampered map)`);
          }
          const recomputedAssignment = hmacTuple(seed, "assignment", m.scenario_id, m.generation_seed)[0] & 1;
          const expectedArm = m.opaque_slot === recomputedAssignment ? "baseline" : "candidate";
          if (expectedArm !== m.arm) {
            throw new Error(`opening: HMAC assignment re-verification failed for unit ${m.unit_id.slice(0, 12)} (swapped arm)`);
          }
          // Verify scenario_id is in the frozen registry.
          if (!scenarioIds.includes(m.scenario_id)) {
            throw new Error(`opening: scenario_id "${m.scenario_id}" not in frozen registry (invented ID rejected)`);
          }
          // Verify generation_seed is in protocol.
          if (!seeds.includes(m.generation_seed)) {
            throw new Error(`opening: generation_seed ${m.generation_seed} not in protocol seeds`);
          }
          verifiedMappings.push({
            unit_id: m.unit_id,
            opaque_slot: m.opaque_slot,
            arm: m.arm,
            scenario_id: m.scenario_id,
            generation_seed: m.generation_seed
          });
        }

        result = {
          mappings: verifiedMappings,
          packet_set_sha256: plaintextMap.packet_set_sha256,
          commitment_sha256: actualCommitment,
          reservation_sha256: reservationDigest,
          ledger_predecessor: ledgerPredecessor,
          run_id: runId
        };
      } finally {
        seed.fill(0);
      }

      return result;
    }
  });
}
