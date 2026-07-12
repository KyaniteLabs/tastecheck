const digest = (character) => character.repeat(64);

const family = (id, provider, lineage, model, marker) => ({
  family_id: id,
  provider,
  foundation_lineage: lineage,
  model_version: model,
  runtime_version: "dispatch-3.2.1",
  adapter_sha256: digest(marker),
  system_prompt_sha256: digest(marker === "c" ? "d" : "e"),
  rubric_sha256: digest("f"),
  identities: [`${id}-judge-1`, `${id}-judge-2`]
});

const manifest = {
  schema_version: 2,
  kind: "effectiveness-v2-execution-manifest",
  generator: {
    provider: "provider-generator",
    foundation_lineage: "generator-lineage",
    model_version: "generator-model-2026-07-01",
    runtime_version: "dispatch-3.2.1",
    adapter_sha256: digest("1"),
    system_prompt_sha256: digest("2"),
    settings_sha256: digest("3"),
    tool_policy_sha256: digest("4"),
    time_budget_seconds: 900
  },
  evaluator_families: [
    family("family-a", "provider-a", "lineage-a", "model-a-2026-06-15", "c"),
    family("family-b", "provider-b", "lineage-b", "model-b-2026-05-20", "9")
  ],
  playwright_version: "1.61.1",
  chromium_version: "141.0.7390.0",
  font_set_sha256: digest("5"),
  renderer_adapter_sha256: digest("6"),
  render_host_sha256: digest("7"),
  viewports: [
    { viewport_id: "mobile", width: 390, height: 844 },
    { viewport_id: "desktop", width: 1440, height: 1000 }
  ]
};

export const sameLineage = [
  family("family-a", "provider-a", "lineage-shared", "model-a-2026-06-15", "c"),
  family("family-b", "provider-b", "lineage-shared", "model-b-2026-05-20", "9")
];

export default manifest;
