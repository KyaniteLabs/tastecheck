import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadContractPair,
  validateContractPair,
  validateScenario,
  validateTokens,
} from "./validate-contracts.mjs";

const rootDirectory = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));

const canonicalScenario = {
  schema_version: 2,
  scenario_id: "deslop-ui-hard-001",
  skill: "deslop-ui",
  tokens_path: "evals/taste-oracle/deslop-ui-hard-001/tokens.json",
  arms: [
    {
      id: "no-skill",
      fixture_path: "evals/taste-oracle/deslop-ui-hard-001/fixtures/no-skill.html",
    },
    {
      id: "current",
      fixture_path: "evals/taste-oracle/deslop-ui-hard-001/fixtures/current.html",
    },
    {
      id: "frozen",
      fixture_path: "evals/taste-oracle/deslop-ui-hard-001/fixtures/frozen.html",
    },
  ],
  viewports: [
    { id: "mobile", width: 390, height: 844 },
    { id: "desktop", width: 1280, height: 900 },
  ],
};

const canonicalTokens = {
  schema_version: 2,
  token_set_id: "deslop-ui-hard-001",
  colors: {
    canvas: "oklch(97% 0.01 80)",
    surface: "#ffffff",
    text: "oklch(22% 0.02 260)",
    text_muted: "rgb(88 94 107)",
    accent: "#2457d6",
    border: "hsl(220 15% 82%)",
  },
  type: {
    font_family: "Inter, system-ui, sans-serif",
    body_size: "1rem",
    body_line_height: "1.5",
    heading_size: "2.5rem",
    heading_line_height: "1.1",
    weight_regular: 400,
    weight_medium: 500,
    weight_bold: 700,
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2.5rem",
  },
  radii: {
    sm: "0.25rem",
    md: "0.75rem",
    pill: "999px",
  },
};

function clone(value) {
  return structuredClone(value);
}

function expectError(errors, path, code) {
  assert.ok(
    errors.some((error) => error.path === path && error.code === code),
    `expected ${path} (${code}), received ${JSON.stringify(errors)}`,
  );
}

assert.deepEqual(validateScenario(canonicalScenario), []);
assert.deepEqual(validateTokens(canonicalTokens), []);

{
  const { errors } = loadContractPair(
    rootDirectory,
    "evals/taste-oracle/deslop-ui-hard-001/scenario.json",
  );
  assert.deepEqual(errors, []);

  for (const schemaPath of [
    "contracts/v2/design-tokens.schema.json",
    "contracts/v2/taste-oracle-scenario.schema.json",
  ]) {
    const schema = JSON.parse(fs.readFileSync(path.join(rootDirectory, schemaPath), "utf8"));
    assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
    assert.match(schema.$id, /^https:\/\/tastecheck\.dev\/contracts\/v2\//);
    assert.equal(schema.additionalProperties, false);
    if (schemaPath.endsWith("design-tokens.schema.json")) {
      const colorGrammar = new RegExp(schema.definitions.color.pattern);
      assert.equal(colorGrammar.test("#12345"), false);
      assert.equal(colorGrammar.test("rgb(not-a-color)"), false);
      assert.equal(colorGrammar.test("rgb(10% 20 30%)"), false);
      for (const color of Object.values(canonicalTokens.colors)) {
        assert.equal(colorGrammar.test(color), true, `schema rejected canonical color: ${color}`);
      }
    }
  }
}

{
  const value = clone(canonicalScenario);
  value.schema_version = 1;
  expectError(validateScenario(value), "$.schema_version", "const");
}

{
  const value = clone(canonicalScenario);
  value.arms[0].id = "control";
  expectError(validateScenario(value), "$.arms", "exact_arm_ids");
}

{
  const value = clone(canonicalScenario);
  value.arms[1].fixture_path = value.arms[0].fixture_path;
  expectError(validateScenario(value), "$.arms[1].fixture_path", "duplicate_path");
}

{
  const value = clone(canonicalScenario);
  value.arms[2].fixture_path = "/fixtures/frozen.html";
  expectError(validateScenario(value), "$.arms[2].fixture_path", "repo_relative_path");
}

{
  const value = clone(canonicalScenario);
  value.arms[2].fixture_path = "C:\\fixtures\\frozen.html";
  expectError(validateScenario(value), "$.arms[2].fixture_path", "repo_relative_path");
}

{
  const value = clone(canonicalScenario);
  value.tokens_path = "../tokens.json";
  expectError(validateScenario(value), "$.tokens_path", "repo_relative_path");
}

{
  const value = clone(canonicalScenario);
  value.viewports.reverse();
  expectError(validateScenario(value), "$.viewports", "exact_viewports");
}

{
  const value = clone(canonicalScenario);
  value.debug = true;
  expectError(validateScenario(value), "$.debug", "unknown_key");
}

{
  const value = clone(canonicalScenario);
  value.arms[0].label = "A";
  expectError(validateScenario(value), "$.arms[0].label", "unknown_key");
}

{
  const value = clone(canonicalTokens);
  value.schema_version = 1;
  expectError(validateTokens(value), "$.schema_version", "const");
}

for (const [group, role] of [
  ["colors", "canvas"],
  ["type", "body_size"],
  ["spacing", "md"],
  ["radii", "sm"],
]) {
  const value = clone(canonicalTokens);
  delete value[group][role];
  expectError(validateTokens(value), `$.${group}.${role}`, "required");
}

for (const [path, mutate] of [
  ["$.colors.accent", (value) => { value.colors.accent = "definitely-not-a-color"; }],
  ["$.type.body_size", (value) => { value.type.body_size = "large"; }],
  ["$.type.body_line_height", (value) => { value.type.body_line_height = "tight"; }],
  ["$.type.font_family", (value) => { value.type.font_family = "Inter; color: red"; }],
  ["$.type.weight_bold", (value) => { value.type.weight_bold = 750; }],
  ["$.spacing.lg", (value) => { value.spacing.lg = "lots"; }],
  ["$.radii.pill", (value) => { value.radii.pill = "round"; }],
]) {
  const value = clone(canonicalTokens);
  mutate(value);
  expectError(validateTokens(value), path, "css_value");
}

for (const invalidColor of [
  "#12345",
  "rgb(not-a-color)",
  "rgb(256 0 0)",
  "rgb(10% 20% 101%)",
  "rgb(1 2 3 / 1.1)",
  "hsl(20 101% 50%)",
  "hsl(20 50 50%)",
  "oklch(120% 0.2 10)",
  "oklch(50% -0.1 10)",
  "oklch(50% 0.1 nope)",
]) {
  const value = clone(canonicalTokens);
  value.colors.accent = invalidColor;
  expectError(validateTokens(value), "$.colors.accent", "css_value");
}

for (const validColor of [
  "#abc",
  "#abcd",
  "#abcdef12",
  "rgb(10% 20% 30% / 50%)",
  "hsl(20deg 10% 20% / 0.5)",
  "oklch(0.5 0.1 120 / 80%)",
]) {
  const value = clone(canonicalTokens);
  value.colors.accent = validColor;
  assert.deepEqual(validateTokens(value), [], `expected valid color: ${validColor}`);
}

{
  const value = clone(canonicalTokens);
  value.colors.brand = "#ff00ff";
  expectError(validateTokens(value), "$.colors.brand", "unknown_key");
}

{
  const value = clone(canonicalTokens);
  value.spacing = [];
  expectError(validateTokens(value), "$.spacing", "type");
}

{
  const value = clone(canonicalTokens);
  value.token_set_id = "some-other-scenario";
  expectError(validateContractPair(canonicalScenario, value), "tokens.token_set_id", "scenario_match");
}

console.log("taste-oracle contract tests passed");
