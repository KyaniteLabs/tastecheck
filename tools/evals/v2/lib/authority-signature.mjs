import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

const ED25519_PKCS8_SEED_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function privateKeyFromSeed(seed) {
  if (!Buffer.isBuffer(seed) || seed.length !== 32) throw new Error("authority seed must be 32 bytes");
  return createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_SEED_PREFIX, seed]),
    format: "der",
    type: "pkcs8"
  });
}

export function authorityPublicKey(seed) {
  return createPublicKey(privateKeyFromSeed(seed)).export({ format: "der", type: "spki" });
}

export function signAuthorityReceipt(seed, bytes) {
  return sign(null, Buffer.from(bytes, "utf8"), privateKeyFromSeed(seed)).toString("base64");
}

export function verifyAuthorityReceipt(publicKeyBase64, bytes, signatureBase64) {
  try {
    const publicKey = createPublicKey({ key: Buffer.from(publicKeyBase64, "base64"), format: "der", type: "spki" });
    return verify(null, Buffer.from(bytes, "utf8"), publicKey, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}
