import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";

const commitment = (domain, seed) => createHash("sha256").update("tastecheck-randomization-v2\0").update(domain).update("\0").update(seed).digest("hex");
function buildDigest(privateStateRef, input) {
  let seed, stats;
  try { stats = statSync(privateStateRef.secretPath); seed = readFileSync(privateStateRef.secretPath); } catch { throw new Error("randomization secret missing"); }
  if ((stats.mode & 0o777) !== 0o600) throw new Error("randomization secret permission must be 0600");
  if (seed.length !== 32 || commitment(privateStateRef.domain, seed) !== privateStateRef.commitment_sha256) throw new Error("randomization commitment replacement detected");
  try { return createHash("sha256").update(seed).update(JSON.stringify(input)).digest("hex"); }
  finally { seed.fill(0); }
}

export function createBuildAuthority(privateStateRef) {
  return Object.freeze({ buildPackets(input) { return { packet_set_sha256: buildDigest(privateStateRef, input) }; } });
}
