// Backward-compatible import surface. All judge acceptance semantics live in
// the closure-bound validate-judges.mjs entry point.
export {
  canonicalPacket,
  validateEvidenceCitation,
  validateJudgeBatch,
  packetSha256,
  anchorExpectedVerdict,
  __internal
} from "../validate-judges.mjs";
