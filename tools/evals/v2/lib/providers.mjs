// Pure, no-network foundations for effectiveness-v2 executor selection.
import { canonicalJson, sha256 } from "./canonical-json.mjs";
import { freezeExecutionManifest, freezeProtocol, validateContract } from "./contracts.mjs";

export const PRODUCTION_NOT_STARTED = "production_not_started";
export const PRODUCTION_ADMITTED = "production_admitted";
export const REHEARSAL_PASSED = "rehearsal_passed";

export const RESOLVER_ATTESTATION_ISSUER_ALLOWLIST = Object.freeze([
  "tastecheck-resolver-authority"
]);

export const RESOLVER_ATTESTATION_SCHEMA_URL =
  "https://tastecheck.dev/contracts/v2/effectiveness/resolver-attestation.schema.json";

const ASCII_ID = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]*$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const EXECUTOR_FIELDS = Object.freeze([
  "call_class", "provider", "foundation_lineage", "model_version",
  "runtime_version", "adapter_sha256", "system_prompt_sha256",
  "rubric_sha256", "settings_sha256", "tool_policy_sha256",
  "time_budget_seconds", "family", "identity", "zero_cost_proof"
]);
const ZERO_COST_FIELDS = Object.freeze(["kind", "incremental_spend_usd"]);
const PLACEHOLDER_HEX = /^(.)\1{63}$/;

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}|closed|object|required`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${label}|closed|fields|mismatch`);
  }
}

function assertCanonicalId(value, label) {
  if (typeof value !== "string" || !ASCII_ID.test(value)) {
    throw new Error(`canonical|${label}|ascii|case-sensitive|invalid`);
  }
}

function assertDigest(value, label, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== "string" || !HEX_64.test(value)) {
    throw new Error(`${label}|sha256|invalid`);
  }
}

function attestationDigest(attestation) {
  return sha256(canonicalJson(attestation));
}

export function canonicalExecutorDigest(executor) {
  assertExactKeys(executor, EXECUTOR_FIELDS, "executor");
  if (!["generation", "judge"].includes(executor.call_class)) {
    throw new Error("executor|call_class|invalid");
  }
  for (const field of ["provider", "foundation_lineage", "model_version", "runtime_version"]) {
    assertCanonicalId(executor[field], field);
  }
  for (const field of ["adapter_sha256", "system_prompt_sha256"]) {
    assertDigest(executor[field], field);
  }
  for (const field of ["rubric_sha256", "settings_sha256", "tool_policy_sha256"]) {
    assertDigest(executor[field], field, { nullable: true });
  }
  if (!Number.isInteger(executor.time_budget_seconds) || executor.time_budget_seconds < 1) {
    throw new Error("executor|time_budget_seconds|invalid");
  }
  assertExactKeys(executor.zero_cost_proof, ZERO_COST_FIELDS, "zero_cost_proof");
  if (!["flat-rate", "already-provisioned"].includes(executor.zero_cost_proof.kind) ||
      executor.zero_cost_proof.incremental_spend_usd !== 0) {
    throw new Error("zero-cost|incremental|spend|rejected");
  }
  if (executor.call_class === "generation") {
    assertCanonicalId(executor.family, "family");
    assertCanonicalId(executor.identity, "identity");
    if (executor.rubric_sha256 !== null ||
        executor.settings_sha256 === null || executor.tool_policy_sha256 === null) {
      throw new Error("executor|generation|closed|fields");
    }
  } else {
    assertCanonicalId(executor.family, "family");
    assertCanonicalId(executor.identity, "identity");
    if (executor.rubric_sha256 === null || executor.settings_sha256 === null ||
        executor.tool_policy_sha256 === null) {
      throw new Error("executor|judge|closed|fields");
    }
  }
  return sha256(canonicalJson(executor));
}

export function verifyResolverAttestationFormat(attestation, options = {}) {
  const result = validateContract("resolver-attestation", attestation);
  if (!result.valid) {
    const detail = result.errors.map((error) =>
      `${error.instancePath || "/"}|${error.keyword}|${error.message || ""}`
    ).join(";");
    throw new Error(`resolver|attestation|schema|${detail}`);
  }
  const allowlist = options.allowlist ?? RESOLVER_ATTESTATION_ISSUER_ALLOWLIST;
  const allowed = allowlist instanceof Set ? allowlist : new Set(allowlist);
  if (!allowed.has(attestation.issuer)) throw new Error("resolver|issuer|not-allowed");
  for (const field of ["issuer", "subject_canonical_id", "provider", "resolved_version", "foundation_lineage"]) {
    assertCanonicalId(attestation[field], field);
  }
  assertDigest(attestation.evidence_sha256, "resolver|evidence");
  if (attestation.introspection_only !== true) throw new Error("resolver|introspection-only|required");
  if (attestation.incremental_spend_usd !== 0 ||
      !["flat-rate", "already-provisioned"].includes(attestation.cost_kind)) {
    throw new Error("resolver|zero-cost|incremental|spend");
  }
  const bound = options.boundVersions?.get(attestation.subject_canonical_id);
  if (bound !== undefined && bound !== attestation.resolved_version) {
    throw new Error("resolver|version|drift|immutable");
  }
  return Object.freeze({ ...structuredClone(attestation), attestation_sha256: attestationDigest(attestation) });
}

export function verifyResolverAttestation(attestation, options = {}) {
  const formatted = verifyResolverAttestationFormat(attestation, options);
  // No pinned trust anchor exists for signed resolver attestations. Until
  // Dispatch or another already-trusted resolver supplies a signed receipt
  // verified against a pinned trust anchor, production is unavailable.
  // Issuer text, schema validity, evidence digest, and self-contained public
  // keys are NOT authenticity.
  if (!options.trustAnchor) {
    throw new Error("resolver|attestation|trusted-signature|required");
  }
  return formatted;
}

const SECRET_KEY = /(?:credential|api[_-]?key|token|secret|password|authorization|endpoint|base[_-]?url|local[_-]?path|environment|env)/i;

export function sanitizeCapability(capability) {
  if (!capability || typeof capability !== "object" || Array.isArray(capability)) {
    throw new Error("capability|object|required");
  }
  function sanitize(value) {
    if (Array.isArray(value)) return value.map(sanitize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, nested]) => [key, sanitize(nested)]));
  }
  return Object.freeze(sanitize(capability));
}

export function discoverProvisionedFamilies({ capabilities, attestations }) {
  if (!Array.isArray(capabilities) || !Array.isArray(attestations)) {
    throw new Error("capabilities|attestations|required");
  }
  const verified = [];
  for (const attestation of attestations) {
    try { verified.push(verifyResolverAttestationFormat(attestation)); } catch { /* reject-only */ }
  }
  return Object.freeze(capabilities.flatMap((capability) => {
    if (!capability || capability.incremental_spend_usd !== 0) return [];
    const match = verified.some((attestation) =>
      attestation.subject_kind === "judge" &&
      attestation.provider === capability.provider &&
      attestation.foundation_lineage === capability.foundation_lineage &&
      attestation.resolved_version === capability.model_version);
    return match ? [sanitizeCapability(capability)] : [];
  }));
}

export function selectFamilies(capabilities) {
  if (!Array.isArray(capabilities) || capabilities.length !== 2) {
    throw new Error("exactly two provider families required");
  }
  for (const capability of capabilities) {
    assertCanonicalId(capability.provider, "provider");
    assertCanonicalId(capability.foundation_lineage, "foundation_lineage");
    if (capability.lineage_verified !== true) throw new Error("foundation lineage must be verified");
    if (capability.incremental_spend_usd !== 0 ||
        !["flat-rate", "already-provisioned"].includes(capability.cost_kind)) {
      throw new Error("incremental spend must remain zero");
    }
  }
  if (new Set(capabilities.map(({ provider }) => provider)).size !== 2) {
    throw new Error("two canonical providers required");
  }
  if (new Set(capabilities.map(({ foundation_lineage }) => foundation_lineage)).size !== 2) {
    throw new Error("two distinct verified foundation lineages required");
  }
  return Object.freeze(capabilities.map(sanitizeCapability));
}

function requireAttestation(attestations, expected) {
  const matches = attestations.filter((attestation) =>
    attestation.subject_kind === expected.subject_kind &&
    attestation.subject_canonical_id === expected.subject_canonical_id);
  if (matches.length !== 1) throw new Error(`resolver|attestation|exactly-one|${expected.subject_canonical_id}`);
  const verified = verifyResolverAttestationFormat(matches[0]);
  for (const field of ["provider", "foundation_lineage"]) {
    if (verified[field] !== expected[field]) throw new Error(`resolver|attestation|${field}|mismatch`);
  }
  if (verified.resolved_version !== expected.model_version) {
    throw new Error("resolver|attestation|version|drift");
  }
  return verified;
}

function selectionDigestPayload(selection) {
  return {
    execution_manifest_sha256: selection.execution_manifest_sha256,
    generator: {
      executor_digest: selection.generator.executor_digest,
      resolver_attestation_sha256: selection.generator.resolver_attestation_sha256
    },
    judges: selection.judges.map((judge) => ({
      executor_digest: judge.executor_digest,
      resolver_attestation_sha256: judge.resolver_attestation_sha256
    })).sort((left, right) => left.executor_digest.localeCompare(right.executor_digest))
  };
}

export function freezeExecutionSelection({ manifest, attestations }) {
  const frozen = freezeExecutionManifest(manifest);
  const m = frozen.manifest;
  const verifiedAttestations = Array.isArray(attestations) ? attestations : [];

  const generatorAttestation = requireAttestation(verifiedAttestations, {
    subject_kind: "generator",
    subject_canonical_id: m.generator.identity,
    provider: m.generator.provider,
    foundation_lineage: m.generator.foundation_lineage,
    model_version: m.generator.model_version
  });
  const generatorExecutor = Object.freeze({
    call_class: "generation",
    provider: m.generator.provider,
    foundation_lineage: m.generator.foundation_lineage,
    model_version: m.generator.model_version,
    runtime_version: m.generator.runtime_version,
    adapter_sha256: m.generator.adapter_sha256,
    system_prompt_sha256: m.generator.system_prompt_sha256,
    rubric_sha256: null,
    settings_sha256: m.generator.settings_sha256,
    tool_policy_sha256: m.generator.tool_policy_sha256,
    time_budget_seconds: m.generator.time_budget_seconds,
    family: m.generator.family_id,
    identity: m.generator.identity,
    zero_cost_proof: Object.freeze({ kind: generatorAttestation.cost_kind, incremental_spend_usd: 0 })
  });
  const generator = Object.freeze({
    executor: generatorExecutor,
    executor_digest: canonicalExecutorDigest(generatorExecutor),
    resolver_attestation_sha256: generatorAttestation.attestation_sha256
  });

  const judges = [];
  for (const family of m.evaluator_families) {
    for (const identity of family.identities) {
      const attestation = requireAttestation(verifiedAttestations, {
        subject_kind: "judge",
        subject_canonical_id: identity,
        provider: family.provider,
        foundation_lineage: family.foundation_lineage,
        model_version: family.model_version
      });
      const executor = Object.freeze({
        call_class: "judge",
        provider: family.provider,
        foundation_lineage: family.foundation_lineage,
        model_version: family.model_version,
        runtime_version: family.runtime_version,
        adapter_sha256: family.adapter_sha256,
        system_prompt_sha256: family.system_prompt_sha256,
        rubric_sha256: family.rubric_sha256,
        settings_sha256: family.settings_sha256,
        tool_policy_sha256: family.tool_policy_sha256,
        time_budget_seconds: family.time_budget_seconds,
        family: family.family_id,
        identity,
        zero_cost_proof: Object.freeze({ kind: attestation.cost_kind, incremental_spend_usd: 0 })
      });
      judges.push(Object.freeze({
        executor,
        executor_digest: canonicalExecutorDigest(executor),
        resolver_attestation_sha256: attestation.attestation_sha256
      }));
    }
  }
  if (judges.length !== 4 || new Set(judges.map(({ executor_digest }) => executor_digest)).size !== 4) {
    throw new Error("exactly four distinct judge executor digests required");
  }
  const selection = {
    execution_manifest_sha256: frozen.canonical_sha256,
    generator,
    judges: Object.freeze(judges)
  };
  return Object.freeze({
    ...selection,
    selection_sha256: sha256(canonicalJson(selectionDigestPayload(selection)))
  });
}

export function verifyAdmissionBindings({ protocol, manifest, selection, attestations, commitmentSha256 }) {
  if (!protocol || !manifest || !selection || !Array.isArray(attestations)) {
    throw new Error("admission|inputs|required");
  }
  if (!HEX_64.test(commitmentSha256 ?? "") || PLACEHOLDER_HEX.test(commitmentSha256)) {
    throw new Error("admission|commitment|real|sha256|required");
  }
  if (protocol.randomization_commitment_sha256 !== commitmentSha256) {
    throw new Error("admission|commitment|binding|mismatch");
  }
  const protocolCheck = validateContract("protocol", protocol);
  if (!protocolCheck.valid) throw new Error("admission|protocol|schema|invalid");
  // freezeProtocol is the single invariant authority. Substitute only the
  // tracked placeholder commitment while checking every other frozen field.
  const structuralProtocol = { ...protocol, randomization_commitment_sha256: "a".repeat(64) };
  freezeProtocol(structuralProtocol);
  const frozenManifest = freezeExecutionManifest(manifest);
  const expectedSelection = freezeExecutionSelection({ manifest, attestations });
  assertDigest(selection.execution_manifest_sha256, "admission|execution-manifest");
  assertDigest(selection.selection_sha256, "admission|selection");
  if (!selection.generator || typeof selection.generator !== "object") {
    throw new Error("admission|generator|required");
  }
  assertDigest(selection.generator.executor_digest, "admission|generator|executor");
  assertDigest(selection.generator.resolver_attestation_sha256, "admission|generator|resolver-attestation");
  if (!Array.isArray(selection.judges)) throw new Error("admission|judges|required");
  for (const judge of selection.judges) {
    assertDigest(judge?.executor_digest, "admission|judge|executor");
    assertDigest(judge?.resolver_attestation_sha256, "admission|judge|resolver-attestation");
  }
  if (canonicalJson(selection) !== canonicalJson(expectedSelection)) {
    throw new Error("admission|selection|canonical|mismatch");
  }
  if (selection.execution_manifest_sha256 !== frozenManifest.canonical_sha256) {
    throw new Error("admission|execution-manifest|digest|mismatch");
  }
  if (canonicalExecutorDigest(selection.generator.executor) !== selection.generator.executor_digest) {
    throw new Error("admission|generator|executor|digest|mismatch");
  }
  if (!Array.isArray(selection.judges) || selection.judges.length !== 4 ||
      new Set(selection.judges.map(({ executor_digest }) => executor_digest)).size !== 4) {
    throw new Error("admission|judges|exactly-four|distinct|required");
  }
  for (const judge of selection.judges) {
    if (canonicalExecutorDigest(judge.executor) !== judge.executor_digest) {
      throw new Error("admission|judge|executor|digest|mismatch");
    }
  }
  const recomputedSelection = sha256(canonicalJson(selectionDigestPayload(selection)));
  if (selection.selection_sha256 !== recomputedSelection) {
    throw new Error("admission|selection|digest|mismatch");
  }
  return Object.freeze({
    protocol_sha256: sha256(canonicalJson(protocol)),
    execution_manifest_sha256: frozenManifest.canonical_sha256,
    selection_sha256: selection.selection_sha256,
    randomization_commitment_sha256: commitmentSha256
  });
}
