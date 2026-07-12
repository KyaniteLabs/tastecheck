import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const commitment = (domain, seed) => createHash("sha256").update("tastecheck-randomization-v2\0").update(domain).update("\0").update(seed).digest("hex");

export function createRandomization({ domain, secretRoot }) {
  mkdirSync(secretRoot, { recursive: true, mode: 0o700 });
  const seed = randomBytes(32);
  const secretPath = join(secretRoot, `${domain}.seed`);
  const fd = openSync(secretPath, "wx", 0o600);
  try { writeFileSync(fd, seed, { flush: true }); } finally { closeSync(fd); }
  const commitment_sha256 = commitment(domain, seed);
  return {
    commitment: { schema_version: 2, kind: "effectiveness-v2-randomization-commitment", domain, commitment_sha256, adapter_sha256: createHash("sha256").update(readFileSync(new URL("./packet-build-authority.mjs", import.meta.url))).digest("hex") },
    privateStateRef: { domain, secretPath, commitment_sha256 }
  };
}

export function assertProductionCommitment(commitmentValue) {
  if (/^(.)\1{63}$/.test(commitmentValue.commitment_sha256)) throw new Error("placeholder randomization commitment: production not started");
  return true;
}
