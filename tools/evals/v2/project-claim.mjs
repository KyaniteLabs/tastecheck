// Task 6: Public claim projector. The ONLY way to produce a public effectiveness
// claim from a synthesis contract. Returns the exact approved copy and rejects
// any scope promotion (human, universal, task, model, skill-level).

import { validateContract } from "./lib/contracts.mjs";

export const ALLOWED_POSITIVE_CLAIM =
  "TasteCheck passed a precommitted, multi-model blind evaluation for the frozen corpus, generator, evaluator families, runtimes, render environment, and source revisions.";

const ALLOWED_SYNTHESIS_KEYS = new Set([
  "schema_version", "kind", "run_id", "status", "families", "hard_regressions", "claim_allowed"
]);

const FORBIDDEN_PROMOTION_PATTERNS = [
  /\bhuman\b/i,
  /\ball\s+users\b/i,
  /\bevery\s+user\b/i,
  /\buniversal\b/i,
  /\ball\s+models\b/i,
  /\bevery\s+model\b/i,
  /\ball\s+tasks\b/i,
  /\bevery\s+task\b/i,
  /\bskill[- ]level\b/i,
  /\bindividual\s+skills?\b/i,
  /\benhances?\s+all\b/i,
  /\bunqualified\b/i
];

/**
 * projectPublicClaim(synthesis)
 *
 * Returns { schema_version, kind, run_id, status, claim } with the exact
 * allowed positive claim copy. Throws on any scope promotion or non-supported
 * status.
 */
export function projectPublicClaim(synthesis) {
  if (!synthesis || typeof synthesis !== "object") {
    throw new Error("claim scope: synthesis required");
  }
  // Reject any property outside the closed synthesis contract — this catches
  // injected scope-promotion fields like _promotedScope.
  for (const key of Object.keys(synthesis)) {
    if (!ALLOWED_SYNTHESIS_KEYS.has(key)) {
      throw new Error(`claim scope: unknown property "${key}" — scope promotion not allowed`);
    }
  }
  if (synthesis.status !== "supported") {
    throw new Error(`claim scope: only a supported synthesis may project a positive claim (got ${synthesis.status})`);
  }
  // Defense-in-depth: scan the allowed claim copy for forbidden promotion language.
  // The claim is a constant so this never triggers in production, but it guards
  // against future edits to ALLOWED_POSITIVE_CLAIM.
  for (const pattern of FORBIDDEN_PROMOTION_PATTERNS) {
    if (pattern.test(ALLOWED_POSITIVE_CLAIM)) {
      throw new Error("claim scope: allowed claim text contains forbidden promotion language");
    }
  }
  const claim = {
    schema_version: 2,
    kind: "effectiveness-v2-public-claim",
    run_id: synthesis.run_id,
    status: synthesis.status,
    claim: ALLOWED_POSITIVE_CLAIM
  };
  const validation = validateContract("public-claim", claim);
  if (!validation.valid) {
    throw new Error(`claim scope: projected claim failed schema validation: ${validation.errors.map((e) => e.message).join("; ")}`);
  }
  return claim;
}
