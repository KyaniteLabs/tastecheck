import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const hash = (value) => createHash("sha256").update(value).digest("hex");
export const normalize = (value) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
const shingles = (value) => {
  const words = normalize(value).split(" ").filter(Boolean);
  return new Set(words.length < 3 ? words : words.slice(0, -2).map((_, i) => words.slice(i, i + 3).join(" ")));
};
const similarity = (a, b) => {
  const left = shingles(a), right = shingles(b);
  const union = new Set([...left, ...right]);
  return union.size ? [...left].filter((item) => right.has(item)).length / union.size : 1;
};
const row = (path) => {
  const bytes = readFileSync(path);
  return { ...JSON.parse(bytes), sha256: hash(bytes) };
};

export function loadRegistry(root) {
  const dir = join(root, "evals/v2/scenarios");
  const scenarios = readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => row(join(dir, name))).sort((a, b) => a.sha256.localeCompare(b.sha256));
  const anchorDir = join(root, "evals/v2/anchors");
  const anchors = readdirSync(anchorDir).filter((name) => name.endsWith(".json")).map((name) => row(join(anchorDir, name))).sort((a, b) => a.sha256.localeCompare(b.sha256));
  return { schema_version: 2, scenarios, anchors };
}

export function groupByStratum(registry) {
  return Object.fromEntries(registry.scenarios.reduce((map, scenario) => {
    if (!map.has(scenario.stratum)) map.set(scenario.stratum, []);
    map.get(scenario.stratum).push(scenario);
    return map;
  }, new Map()));
}

export function validateCorpusSeparation(registry) {
  const rows = [...(registry.scenarios ?? []), ...(registry.anchors ?? [])];
  if (registry.scenarios?.length !== 12 || registry.anchors?.length !== 4) throw new Error("corpus requires exactly 12 scenarios and 4 anchors");
  const ids = new Set();
  const scenarioKeys = ["scenario_id", "stratum", "brief", "starting_fixture", "required_skills", "forbidden_cues", "render_required", "hard_regressions", "time_budget_seconds", "tool_policy", "sha256"];
  const anchorKinds = new Set(["identical", "identical-reversed", "broken-complete", "broken-complete-reversed"]);
  for (const value of registry.scenarios) {
    if (Object.keys(value).some((key) => !scenarioKeys.includes(key)) || scenarioKeys.some((key) => !(key in value))) throw new Error("scenario has unknown or missing required fields");
    if (ids.has(value.scenario_id)) throw new Error("duplicate scenario id"); ids.add(value.scenario_id);
    if (!Array.isArray(value.required_skills) || !value.required_skills.length || !Array.isArray(value.forbidden_cues) || !Array.isArray(value.hard_regressions) || value.render_required !== true || value.time_budget_seconds !== 900) throw new Error("invalid scenario field");
  }
  const groups = groupByStratum(registry);
  const expected = ["greenfield-direction", "brownfield-repair", "accessibility-safety", "verbal-copy", "orchestration-gates", "render-integration"];
  if (Object.keys(groups).some((key) => !expected.includes(key)) || expected.some((key) => groups[key]?.length !== 2)) throw new Error("each named stratum requires exactly two scenarios");
  const anchorIds = new Set();
  for (const value of registry.anchors) {
    const common = ["anchor_id", "kind", "expected", "label_order", "sha256"];
    const content = value.kind.startsWith("identical") ? ["artifact_content"] : ["broken", "complete"];
    const allowed = [...common, ...content];
    const expectedVerdict = value.kind.startsWith("identical") ? "tie" : value.kind.endsWith("reversed") ? "slot-0" : "slot-1";
    if (Object.keys(value).some((key) => !allowed.includes(key)) || allowed.some((key) => !(key in value)) || !value.anchor_id || !anchorKinds.has(value.kind) || value.expected !== expectedVerdict || !Array.isArray(value.label_order) || value.label_order.length !== 2 || new Set(value.label_order).size !== 2 || !value.label_order.every((slot) => slot === 0 || slot === 1) || anchorIds.has(value.anchor_id)) throw new Error("invalid or duplicate anchor");
    anchorIds.add(value.anchor_id);
  }
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    if (rows[i].sha256 === rows[j].sha256) throw new Error("duplicate corpus hash overlap");
    const left = JSON.stringify(rows[i]), right = JSON.stringify(rows[j]);
    if (similarity(left, right) >= 0.85) throw new Error("normalized semantic overlap");
  }
  return true;
}
