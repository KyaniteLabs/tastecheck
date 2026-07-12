import { ARM_IDS } from "../validate-contracts.mjs";
import { assertPublicSafe, assertRepoRelativePath } from "./evidence.mjs";

export const MIN_OBSERVATIONS = 8;
export const MIN_EVALUATOR_FAMILIES = 2;
export const SYNTHETIC_NOTICE = "SYNTHETIC FIXTURE — NOT RELEASE EVIDENCE";

const SHA256 = /^[0-9a-f]{64}$/;
const OPAQUE_OBSERVATION = /^observation-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPAQUE_FAMILY = /^family-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPAQUE_RESULT = /^result-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPAQUE_JUDGE = /^judge-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROOT_KEYS = ["schema_version", "kind", "scenario_id", "target_arm", "comparator_arm", "release_scope", "provenance", "observations"];
const SYNTHETIC_OBSERVATION_KEYS = ["observation_id", "evaluator_family", "result_id", "preference"];
const COLLECTED_OBSERVATION_KEYS = [...SYNTHETIC_OBSERVATION_KEYS, "viewport_id", "evidence_citations"];

function isRecord(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function assertExactKeys(value, allowed, required, pathname) {
  if (!isRecord(value)) throw new TypeError(`${pathname} must be an object`);
  for (const key of required) if (!Object.hasOwn(value, key)) throw new TypeError(`${pathname}.${key} is required`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new TypeError(`${pathname}.${key} is not allowed`);
}
function assertOpaque(value, pattern, pathname) {
  if (typeof value !== "string" || !pattern.test(value)) throw new TypeError(`${pathname} must be an opaque role-prefixed identifier`);
}
function assertSha(value, pathname) { if (!SHA256.test(value ?? "")) throw new TypeError(`${pathname} must be a lowercase SHA-256`); }

export function validateObservationProvenance(provenance) {
  if (!isRecord(provenance)) throw new TypeError("$input.provenance must be an object");
  if (provenance.kind === "synthetic_fixture") {
    assertExactKeys(provenance, ["kind", "notice"], ["kind", "notice"], "$input.provenance");
    if (provenance.notice !== SYNTHETIC_NOTICE) throw new TypeError(`synthetic_fixture notice must equal ${SYNTHETIC_NOTICE}`);
    return { synthetic: true, results: new Map() };
  }
  if (provenance.kind !== "validated_judge_panel") throw new TypeError("$input.provenance.kind must identify a synthetic fixture or validated judge panel");
  assertExactKeys(provenance, ["kind", "packet", "unmask", "manifest", "results"], ["kind", "packet", "unmask", "manifest", "results"], "$input.provenance");
  assertExactKeys(provenance.packet, ["packet_id", "path", "file_sha256", "canonical_sha256"], ["packet_id", "path", "file_sha256", "canonical_sha256"], "$input.provenance.packet");
  if (typeof provenance.packet.packet_id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provenance.packet.packet_id)) throw new TypeError("$input.provenance.packet.packet_id must be a stable safe identifier");
  assertRepoRelativePath(provenance.packet.path);
  assertSha(provenance.packet.file_sha256, "$input.provenance.packet.file_sha256"); assertSha(provenance.packet.canonical_sha256, "$input.provenance.packet.canonical_sha256");
  assertExactKeys(provenance.unmask, ["path", "file_sha256"], ["path", "file_sha256"], "$input.provenance.unmask");
  assertRepoRelativePath(provenance.unmask.path); assertSha(provenance.unmask.file_sha256, "$input.provenance.unmask.file_sha256");
  assertExactKeys(provenance.manifest, ["path", "file_sha256", "canonical_sha256"], ["path", "file_sha256", "canonical_sha256"], "$input.provenance.manifest");
  assertRepoRelativePath(provenance.manifest.path);
  assertSha(provenance.manifest.file_sha256, "$input.provenance.manifest.file_sha256");
  assertSha(provenance.manifest.canonical_sha256, "$input.provenance.manifest.canonical_sha256");
  if (!Array.isArray(provenance.results) || provenance.results.length < 2) throw new TypeError("$input.provenance.results must contain a validated quorum");
  const results = new Map();
  for (const [index, result] of provenance.results.entries()) {
    const base = `$input.provenance.results[${index}]`;
    assertExactKeys(result, ["result_id", "path", "judge_id", "evaluator_family", "file_sha256", "canonical_sha256"], ["result_id", "path", "judge_id", "evaluator_family", "file_sha256", "canonical_sha256"], base);
    assertOpaque(result.result_id, OPAQUE_RESULT, `${base}.result_id`);
    assertOpaque(result.judge_id, OPAQUE_JUDGE, `${base}.judge_id`);
    assertOpaque(result.evaluator_family, OPAQUE_FAMILY, `${base}.evaluator_family`);
    assertRepoRelativePath(result.path);
    assertSha(result.file_sha256, `${base}.file_sha256`);
    assertSha(result.canonical_sha256, `${base}.canonical_sha256`);
    if (results.has(result.result_id)) throw new TypeError(`${base}.result_id must be unique`);
    results.set(result.result_id, result);
  }
  if (new Set([...results.values()].map((entry) => entry.evaluator_family)).size < MIN_EVALUATOR_FAMILIES) throw new TypeError("$input.provenance.results must contain at least 2 evaluator families");
  return { synthetic: false, results };
}

export function validateObservationSet(value) {
  assertExactKeys(value, ROOT_KEYS, ROOT_KEYS, "$input");
  if (value.schema_version !== 2) throw new TypeError("$input.schema_version must equal 2");
  if (value.kind !== "taste-oracle-paired-observations") throw new TypeError("$input.kind must equal taste-oracle-paired-observations");
  if (value.scenario_id !== "deslop-ui-hard-001") throw new TypeError("$input.scenario_id must equal deslop-ui-hard-001");
  if (value.release_scope !== "milestone_only") throw new TypeError("$input.release_scope must equal milestone_only");
  if (!ARM_IDS.includes(value.target_arm)) throw new TypeError("$input.target_arm must be a canonical arm ID");
  if (!ARM_IDS.includes(value.comparator_arm)) throw new TypeError("$input.comparator_arm must be a canonical arm ID");
  if (value.target_arm === value.comparator_arm) throw new TypeError("target_arm and comparator_arm must be distinct");
  const { synthetic, results } = validateObservationProvenance(value.provenance);
  try { assertPublicSafe(value); } catch { throw new TypeError("$input must contain recursively public-safe values"); }
  if (!Array.isArray(value.observations) || value.observations.length < MIN_OBSERVATIONS) throw new TypeError(`$input.observations must contain at least ${MIN_OBSERVATIONS} observations`);
  const ids = new Set();
  const families = new Set();
  const preferences = new Set([value.target_arm, value.comparator_arm, "tie", "abstain"]);
  value.observations.forEach((entry, index) => {
    const base = `$input.observations[${index}]`;
    const keys = synthetic ? SYNTHETIC_OBSERVATION_KEYS : COLLECTED_OBSERVATION_KEYS;
    assertExactKeys(entry, keys, keys, base);
    assertOpaque(entry.observation_id, OPAQUE_OBSERVATION, `${base}.observation_id`);
    assertOpaque(entry.evaluator_family, OPAQUE_FAMILY, `${base}.evaluator_family`);
    assertOpaque(entry.result_id, OPAQUE_RESULT, `${base}.result_id`);
    if (ids.has(entry.observation_id)) throw new TypeError(`${base}.observation_id must be unique`);
    ids.add(entry.observation_id); families.add(entry.evaluator_family);
    if (!preferences.has(entry.preference)) throw new TypeError(`${base}.preference must be target_arm, comparator_arm, tie, or abstain`);
    if (!synthetic) {
      assertOpaque(entry.result_id, OPAQUE_RESULT, `${base}.result_id`);
      if (!results.has(entry.result_id) || results.get(entry.result_id).evaluator_family !== entry.evaluator_family) throw new TypeError(`${base}.result_id must bind to matching validated result provenance`);
      if (!["mobile", "desktop"].includes(entry.viewport_id)) throw new TypeError(`${base}.viewport_id must be mobile or desktop`);
      if (!Array.isArray(entry.evidence_citations) || entry.evidence_citations.length < 2 || entry.evidence_citations.some((hash) => !SHA256.test(hash))) throw new TypeError(`${base}.evidence_citations must preserve both compared artifact hashes`);
    }
  });
  if (families.size < MIN_EVALUATOR_FAMILIES) throw new TypeError(`$input.observations must contain at least ${MIN_EVALUATOR_FAMILIES} evaluator families`);
  return value;
}

function seededRandom(seed) { let state = seed >>> 0; return () => { state = (state + 0x6D2B79F5) >>> 0; let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; }; }
function percentile(sorted, probability) { const position = (sorted.length - 1) * probability; const lower = Math.floor(position); const upper = Math.ceil(position); return lower === upper ? sorted[lower] : sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower); }
function rounded(value) { return Number(value.toFixed(6)); }
function hierarchicalBootstrap(families, seed, iterations) {
  const random = seededRandom(seed); const means = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const familyMeans = families.map(({ clusterMargins }) => {
      let total = 0;
      for (let sample = 0; sample < clusterMargins.length; sample += 1) total += clusterMargins[Math.floor(random() * clusterMargins.length)];
      return total / clusterMargins.length;
    });
    means.push(familyMeans.reduce((sum, value) => sum + value, 0) / familyMeans.length);
  }
  means.sort((left, right) => left - right);
  return [rounded(percentile(means, 0.025)), rounded(percentile(means, 0.975))];
}
function validateOptions(options) { const seed = options.seed ?? 20260711; const iterations = options.iterations ?? 10000; if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) throw new TypeError("bootstrap seed must be an unsigned 32-bit integer"); if (!Number.isInteger(iterations) || iterations < 200 || iterations > 1_000_000) throw new TypeError("bootstrap iterations must be an integer from 200 to 1000000"); return { seed, iterations }; }

function buildAnalysis(input, options = {}) {
  validateObservationSet(input);
  const { seed, iterations } = validateOptions(options);
  const observations = [...input.observations].sort((left, right) => left.observation_id.localeCompare(right.observation_id, "en"));
  const scoreOf = (entry) => entry.preference === input.target_arm ? 1 : entry.preference === input.comparator_arm ? -1 : entry.preference === "tie" ? 0 : null;
  const analyzed = observations.filter((entry) => entry.preference !== "abstain");
  const scores = analyzed.map(scoreOf);
  const wins = scores.filter((score) => score === 1).length;
  const losses = scores.filter((score) => score === -1).length;
  const ties = scores.length - wins - losses;
  const abstentions = observations.length - analyzed.length;
  const familyCounts = new Map(); const rowsByFamily = new Map();
  for (const entry of observations) { familyCounts.set(entry.evaluator_family, (familyCounts.get(entry.evaluator_family) ?? 0) + 1); if (!rowsByFamily.has(entry.evaluator_family)) rowsByFamily.set(entry.evaluator_family, []); rowsByFamily.get(entry.evaluator_family).push(entry); }
  const sortedFamilyCounts = [...familyCounts].sort(([left], [right]) => left.localeCompare(right, "en"));
  const familyStatistics = Object.fromEntries([...rowsByFamily].sort(([a], [b]) => a.localeCompare(b, "en")).map(([family, rows]) => {
    const clusters = new Map(); for (const row of rows) { if (!clusters.has(row.result_id)) clusters.set(row.result_id, []); clusters.get(row.result_id).push(row); }
    const clusterMargins = [...clusters].sort(([left], [right]) => left.localeCompare(right, "en")).map(([, clusterRows]) => clusterRows.map(scoreOf).filter((value) => value !== null)).filter((values) => values.length > 0).map((values) => rounded(values.reduce((sum, value) => sum + value, 0) / values.length));
    const familyScores = rows.map(scoreOf).filter((value) => value !== null);
    return [family, { samples: rows.length, analyzed: familyScores.length, clusters: clusters.size, analyzed_clusters: clusterMargins.length, wins: familyScores.filter((v) => v === 1).length, losses: familyScores.filter((v) => v === -1).length, ties: familyScores.filter((v) => v === 0).length, abstentions: rows.length - familyScores.length, margin: clusterMargins.length ? rounded(clusterMargins.reduce((sum, value) => sum + value, 0) / clusterMargins.length) : null, clusterMargins }];
  }));
  const familyRows = Object.entries(familyStatistics);
  const bootstrapFamilies = familyRows.map(([, value]) => value).filter((value) => value.clusterMargins.length > 0);
  const balancedMargin = bootstrapFamilies.length === familyRows.length ? rounded(bootstrapFamilies.reduce((sum, value) => sum + value.margin, 0) / bootstrapFamilies.length) : null;
  const enoughClusters = bootstrapFamilies.length === familyRows.length && bootstrapFamilies.every((value) => value.clusterMargins.length >= 2);
  const interval = bootstrapFamilies.length === familyRows.length ? hierarchicalBootstrap(bootstrapFamilies, seed, iterations) : null;
  const directions = new Set(bootstrapFamilies.map((value) => Math.sign(value.margin)));
  const familyDisagreement = bootstrapFamilies.length !== familyRows.length || directions.size > 1;
  const status = !interval || !enoughClusters || familyDisagreement ? "insufficient_evidence" : interval[0] > 0 ? "supported" : interval[1] < 0 ? "not_supported" : "insufficient_evidence";
  const decisiveCount = wins + losses;
  const synthetic = input.provenance.kind === "synthetic_fixture";
  const output = {
    schema_version: 2,
    kind: "taste-oracle-analysis-result",
    scenario_id: input.scenario_id,
    target_arm: input.target_arm,
    comparator_arm: input.comparator_arm,
    release_scope: "milestone_only",
    provenance: input.provenance,
    evidence_notice: synthetic ? SYNTHETIC_NOTICE : "STRUCTURAL ANALYSIS ONLY — FILE-BACKED AUTHORITY NOT VERIFIED",
    counts: { samples: observations.length, analyzed: analyzed.length, families: sortedFamilyCounts.length, wins, losses, ties, abstentions },
    samples_by_family: Object.fromEntries(sortedFamilyCounts),
    family_statistics: Object.fromEntries(familyRows.map(([family, value]) => [family, { ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== "clusterMargins")), cluster_margins: value.clusterMargins }])),
    family_disagreement: familyDisagreement,
    preference_rate: decisiveCount === 0 ? null : rounded(wins / decisiveCount),
    tie_rate: analyzed.length === 0 ? null : rounded(ties / analyzed.length),
    abstention_rate: rounded(abstentions / observations.length),
    preference_margin: balancedMargin,
    bootstrap: { method: "family_balanced_cluster_percentile", confidence_level: 0.95, seed, iterations, interval, minimum_clusters_per_family: 2, enough_independent_clusters: enoughClusters },
    status,
  };
  validateAnalysisResult(output);
  return output;
}

export function analyzeStructuralObservations(input, options = {}) {
  return buildAnalysis(input, options);
}

export function analyzePairedObservations(input, options = {}) {
  if (input?.provenance?.kind !== "synthetic_fixture") throw new TypeError("authoritative collected analysis requires a file-backed certified receipt");
  return buildAnalysis(input, options);
}

export function validateAnalysisResult(output) {
  const keys = ["schema_version", "kind", "scenario_id", "target_arm", "comparator_arm", "release_scope", "provenance", "evidence_notice", "counts", "samples_by_family", "family_statistics", "family_disagreement", "preference_rate", "tie_rate", "abstention_rate", "preference_margin", "bootstrap", "status"];
  assertExactKeys(output, keys, keys, "$analysis");
  if (output.schema_version !== 2 || output.kind !== "taste-oracle-analysis-result" || output.release_scope !== "milestone_only") throw new TypeError("analysis contract identity is invalid");
  if (!ARM_IDS.includes(output.target_arm) || !ARM_IDS.includes(output.comparator_arm) || output.target_arm === output.comparator_arm) throw new TypeError("analysis target and comparator must be distinct canonical arms");
  const provenanceValidation = validateObservationProvenance(output.provenance); assertPublicSafe(output);
  const counts = output.counts;
  assertExactKeys(counts, ["samples", "analyzed", "families", "wins", "losses", "ties", "abstentions"], ["samples", "analyzed", "families", "wins", "losses", "ties", "abstentions"], "$analysis.counts");
  if (Object.values(counts).some((value) => !Number.isInteger(value) || value < 0) || counts.samples < MIN_OBSERVATIONS || counts.families < MIN_EVALUATOR_FAMILIES) throw new TypeError("analysis counts are outside contract ranges");
  if (counts.samples !== counts.analyzed + counts.abstentions || counts.analyzed !== counts.wins + counts.losses + counts.ties) throw new TypeError("analysis count arithmetic is inconsistent");
  const families = Object.keys(output.family_statistics).sort();
  if (families.length !== counts.families || JSON.stringify(families) !== JSON.stringify(Object.keys(output.samples_by_family).sort())) throw new TypeError("analysis family coverage is inconsistent");
  const totals = { samples: 0, analyzed: 0, wins: 0, losses: 0, ties: 0, abstentions: 0 };
  const close = (left, right) => left === right || (Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 1e-6);
  for (const family of families) {
    const item = output.family_statistics[family];
    assertExactKeys(item, ["samples", "analyzed", "clusters", "analyzed_clusters", "wins", "losses", "ties", "abstentions", "margin", "cluster_margins"], ["samples", "analyzed", "clusters", "analyzed_clusters", "wins", "losses", "ties", "abstentions", "margin", "cluster_margins"], `$analysis.family_statistics.${family}`);
    for (const key of Object.keys(totals)) totals[key] += item[key];
    if (output.samples_by_family[family] !== item.samples || item.samples !== item.analyzed + item.abstentions || item.analyzed !== item.wins + item.losses + item.ties) throw new TypeError("analysis per-family arithmetic is inconsistent");
    if (["samples", "analyzed", "clusters", "analyzed_clusters", "wins", "losses", "ties", "abstentions"].some((key) => !Number.isInteger(item[key]) || item[key] < 0)) throw new TypeError("analysis family counts are outside contract ranges");
    if (item.samples < 1 || item.clusters < 1 || item.clusters > item.samples || item.analyzed_clusters > item.clusters || item.analyzed_clusters > item.analyzed) throw new TypeError("analysis cluster/sample relationships are inconsistent");
    if (!provenanceValidation.synthetic) {
      const availableClusters = [...provenanceValidation.results.values()].filter((result) => result.evaluator_family === family).length;
      if (availableClusters === 0 || item.clusters > availableClusters) throw new TypeError("analysis clusters exceed certified result provenance");
    }
    if (!Array.isArray(item.cluster_margins) || item.cluster_margins.length !== item.analyzed_clusters || item.cluster_margins.some((margin) => !Number.isFinite(margin) || margin < -1 || margin > 1)) throw new TypeError("analysis cluster margins are inconsistent");
    const expectedFamilyMargin = item.cluster_margins.length ? item.cluster_margins.reduce((sum, value) => sum + value, 0) / item.cluster_margins.length : null;
    if (!close(item.margin, expectedFamilyMargin)) throw new TypeError("analysis family margin is inconsistent");
  }
  for (const [key, value] of Object.entries(totals)) if (counts[key] !== value) throw new TypeError("analysis aggregate arithmetic is inconsistent");
  const decisive = counts.wins + counts.losses;
  if (!close(output.preference_rate, decisive ? counts.wins / decisive : null) || !close(output.tie_rate, counts.analyzed ? counts.ties / counts.analyzed : null) || !close(output.abstention_rate, counts.abstentions / counts.samples)) throw new TypeError("analysis rates are inconsistent");
  const margins = families.map((family) => output.family_statistics[family].margin);
  const expectedMargin = margins.every(Number.isFinite) ? margins.reduce((sum, value) => sum + value, 0) / margins.length : null;
  if (!close(output.preference_margin, expectedMargin)) throw new TypeError("analysis balanced margin is inconsistent");
  const interval = output.bootstrap.interval;
  assertExactKeys(output.bootstrap, ["method", "confidence_level", "seed", "iterations", "interval", "minimum_clusters_per_family", "enough_independent_clusters"], ["method", "confidence_level", "seed", "iterations", "interval", "minimum_clusters_per_family", "enough_independent_clusters"], "$analysis.bootstrap");
  if (output.bootstrap.method !== "family_balanced_cluster_percentile" || output.bootstrap.confidence_level !== 0.95 || output.bootstrap.minimum_clusters_per_family !== 2 || typeof output.bootstrap.enough_independent_clusters !== "boolean") throw new TypeError("analysis bootstrap contract is invalid");
  validateOptions({ seed: output.bootstrap.seed, iterations: output.bootstrap.iterations });
  if (interval !== null && (!Array.isArray(interval) || interval.length !== 2 || interval.some((value) => !Number.isFinite(value) || value < -1 || value > 1) || interval[0] > interval[1])) throw new TypeError("analysis bootstrap interval is invalid");
  const bootstrapFamilies = families.map((family) => ({ clusterMargins: output.family_statistics[family].cluster_margins })).filter((family) => family.clusterMargins.length > 0);
  const expectedInterval = bootstrapFamilies.length === families.length
    ? hierarchicalBootstrap(bootstrapFamilies, output.bootstrap.seed, output.bootstrap.iterations)
    : null;
  if (JSON.stringify(interval) !== JSON.stringify(expectedInterval)) throw new TypeError("analysis bootstrap interval is inconsistent with its inputs");
  const expectedEnough = families.every((family) => output.family_statistics[family].analyzed_clusters >= output.bootstrap.minimum_clusters_per_family);
  if (output.bootstrap.enough_independent_clusters !== expectedEnough) throw new TypeError("analysis independent-cluster sufficiency is inconsistent");
  const directions = new Set(margins.filter(Number.isFinite).map((margin) => Math.sign(margin)));
  const expectedDisagreement = margins.some((margin) => !Number.isFinite(margin)) || directions.size > 1;
  if (output.family_disagreement !== expectedDisagreement) throw new TypeError("analysis family disagreement is inconsistent");
  const expectedStatus = !expectedInterval || !expectedEnough || expectedDisagreement ? "insufficient_evidence" : expectedInterval[0] > 0 ? "supported" : expectedInterval[1] < 0 ? "not_supported" : "insufficient_evidence";
  if (output.status !== expectedStatus) throw new TypeError("analysis status is inconsistent");
  return output;
}
