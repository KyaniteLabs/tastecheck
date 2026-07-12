import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ARM_IDS = Object.freeze(["no-skill", "current", "frozen"]);
export const VIEWPORTS = Object.freeze([
  Object.freeze({ id: "mobile", width: 390, height: 844 }),
  Object.freeze({ id: "desktop", width: 1280, height: 900 }),
]);

const SCENARIO_KEYS = [
  "schema_version",
  "scenario_id",
  "skill",
  "tokens_path",
  "arms",
  "viewports",
];
const ARM_KEYS = ["id", "fixture_path"];
const VIEWPORT_KEYS = ["id", "width", "height"];
const TOKEN_KEYS = [
  "schema_version",
  "token_set_id",
  "colors",
  "type",
  "spacing",
  "radii",
];
const COLOR_ROLES = ["canvas", "surface", "text", "text_muted", "accent", "border"];
const TYPE_ROLES = [
  "font_family",
  "body_size",
  "body_line_height",
  "heading_size",
  "heading_line_height",
  "weight_regular",
  "weight_medium",
  "weight_bold",
];
const SPACING_ROLES = ["xs", "sm", "md", "lg", "xl"];
const RADIUS_ROLES = ["sm", "md", "pill"];

const CSS_LENGTH = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|vw|vh))$/;
const CSS_LINE_HEIGHT = /^(?:\d+(?:\.\d+)?|\.\d+|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%))$/;
const CSS_HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const CSS_NUMBER = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;
const CSS_PERCENTAGE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)%$/;
const CSS_HUE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:deg)?$/;
const FONT_FAMILY = /^[^{};\r\n]+$/;

function issue(pathname, code, message) {
  return { path: pathname, code, message };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkObject(value, pathname, keys, errors) {
  if (!isRecord(value)) {
    errors.push(issue(pathname, "type", "must be an object"));
    return false;
  }

  for (const key of keys) {
    if (!Object.hasOwn(value, key)) {
      errors.push(issue(`${pathname}.${key}`, "required", "is required"));
    }
  }

  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      errors.push(issue(`${pathname}.${key}`, "unknown_key", "is not allowed"));
    }
  }
  return true;
}

function checkString(value, pathname, errors) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(issue(pathname, "type", "must be a non-empty string"));
    return false;
  }
  return true;
}

function isRepoRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.startsWith("/") || value.startsWith("~") || value.includes("\\")) return false;
  if (/^[A-Za-z]:/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value)) return false;
  const segments = value.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
}

function checkRepoRelativePath(value, pathname, errors) {
  if (!isRepoRelativePath(value)) {
    errors.push(issue(pathname, "repo_relative_path", "must be a normalized repo-relative path"));
    return false;
  }
  return true;
}

function sameViewport(actual, expected) {
  return isRecord(actual)
    && actual.id === expected.id
    && actual.width === expected.width
    && actual.height === expected.height;
}

export function validateScenario(value) {
  const errors = [];
  if (!checkObject(value, "$", SCENARIO_KEYS, errors)) return errors;

  if (value.schema_version !== 2) {
    errors.push(issue("$.schema_version", "const", "must equal 2"));
  }
  checkString(value.scenario_id, "$.scenario_id", errors);
  if (value.skill !== "deslop-ui") {
    errors.push(issue("$.skill", "const", "must equal deslop-ui"));
  }
  checkRepoRelativePath(value.tokens_path, "$.tokens_path", errors);

  if (!Array.isArray(value.arms)) {
    errors.push(issue("$.arms", "type", "must be an array"));
  } else {
    const actualIds = value.arms.map((arm) => arm?.id);
    if (actualIds.length !== ARM_IDS.length || actualIds.some((id, index) => id !== ARM_IDS[index])) {
      errors.push(issue("$.arms", "exact_arm_ids", `must contain ${ARM_IDS.join(", ")} in canonical order`));
    }

    const seenPaths = new Set();
    value.arms.forEach((arm, index) => {
      const pathname = `$.arms[${index}]`;
      if (!checkObject(arm, pathname, ARM_KEYS, errors)) return;
      checkString(arm.id, `${pathname}.id`, errors);
      if (checkRepoRelativePath(arm.fixture_path, `${pathname}.fixture_path`, errors)) {
        if (seenPaths.has(arm.fixture_path)) {
          errors.push(issue(`${pathname}.fixture_path`, "duplicate_path", "must be distinct across arms"));
        }
        seenPaths.add(arm.fixture_path);
      }
    });
  }

  if (!Array.isArray(value.viewports)) {
    errors.push(issue("$.viewports", "type", "must be an array"));
  } else {
    const exact = value.viewports.length === VIEWPORTS.length
      && value.viewports.every((viewport, index) => sameViewport(viewport, VIEWPORTS[index]));
    if (!exact) {
      errors.push(issue("$.viewports", "exact_viewports", "must equal mobile 390x844 then desktop 1280x900"));
    }
    value.viewports.forEach((viewport, index) => {
      checkObject(viewport, `$.viewports[${index}]`, VIEWPORT_KEYS, errors);
    });
  }

  return errors;
}

function checkRoleObject(value, pathname, roles, validator, errors) {
  if (!checkObject(value, pathname, roles, errors)) return;
  for (const role of roles) {
    if (Object.hasOwn(value, role) && !validator(value[role], role)) {
      errors.push(issue(`${pathname}.${role}`, "css_value", "must be a supported CSS value"));
    }
  }
}

function validFontValue(value, role) {
  if (role === "font_family") return typeof value === "string" && FONT_FAMILY.test(value.trim());
  if (role.startsWith("weight_")) return Number.isInteger(value) && value >= 100 && value <= 900 && value % 100 === 0;
  if (role.endsWith("line_height")) return typeof value === "string" && CSS_LINE_HEIGHT.test(value);
  return typeof value === "string" && CSS_LENGTH.test(value);
}

function parseBoundedNumber(token, { minimum, maximum, percentage }) {
  const pattern = percentage ? CSS_PERCENTAGE : CSS_NUMBER;
  if (!pattern.test(token)) return null;
  const numeric = Number.parseFloat(token);
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) return null;
  return numeric;
}

function validAlpha(token) {
  return parseBoundedNumber(token, { minimum: 0, maximum: 1, percentage: false }) !== null
    || parseBoundedNumber(token, { minimum: 0, maximum: 100, percentage: true }) !== null;
}

function splitFunctionalColor(value, functionName) {
  const prefix = `${functionName}(`;
  if (!value.startsWith(prefix) || !value.endsWith(")")) return null;
  const body = value.slice(prefix.length, -1).trim();
  if (body.length === 0 || /[{},;]/.test(body)) return null;
  const alphaParts = body.split("/");
  if (alphaParts.length > 2) return null;
  const components = alphaParts[0].trim().split(/\s+/);
  const alpha = alphaParts.length === 2 ? alphaParts[1].trim() : null;
  if (alphaParts.length === 2 && (alpha.length === 0 || /\s/.test(alpha) || !validAlpha(alpha))) return null;
  return { components, alpha };
}

function validRgb(value) {
  const parsed = splitFunctionalColor(value, "rgb");
  if (!parsed || parsed.components.length !== 3) return false;
  const arePercentages = parsed.components.map((component) => CSS_PERCENTAGE.test(component));
  if (!arePercentages.every(Boolean) && arePercentages.some(Boolean)) return false;
  return parsed.components.every((component) => (
    arePercentages[0]
      ? parseBoundedNumber(component, { minimum: 0, maximum: 100, percentage: true }) !== null
      : parseBoundedNumber(component, { minimum: 0, maximum: 255, percentage: false }) !== null
  ));
}

function validHsl(value) {
  const parsed = splitFunctionalColor(value, "hsl");
  if (!parsed || parsed.components.length !== 3 || !CSS_HUE.test(parsed.components[0])) return false;
  if (!Number.isFinite(Number.parseFloat(parsed.components[0]))) return false;
  return parsed.components.slice(1).every((component) => (
    parseBoundedNumber(component, { minimum: 0, maximum: 100, percentage: true }) !== null
  ));
}

function validOklch(value) {
  const parsed = splitFunctionalColor(value, "oklch");
  if (!parsed || parsed.components.length !== 3 || !CSS_HUE.test(parsed.components[2])) return false;
  const [lightness, chroma] = parsed.components;
  const validLightness = CSS_PERCENTAGE.test(lightness)
    ? parseBoundedNumber(lightness, { minimum: 0, maximum: 100, percentage: true }) !== null
    : parseBoundedNumber(lightness, { minimum: 0, maximum: 1, percentage: false }) !== null;
  const numericChroma = Number.parseFloat(chroma);
  const validChroma = CSS_NUMBER.test(chroma) && Number.isFinite(numericChroma) && numericChroma >= 0;
  const validHue = Number.isFinite(Number.parseFloat(parsed.components[2]));
  return validLightness && validChroma && validHue;
}

function validCssColor(value) {
  if (typeof value !== "string" || value !== value.trim()) return false;
  return CSS_HEX_COLOR.test(value)
    || validRgb(value)
    || validHsl(value)
    || validOklch(value);
}

export function validateTokens(value) {
  const errors = [];
  if (!checkObject(value, "$", TOKEN_KEYS, errors)) return errors;

  if (value.schema_version !== 2) {
    errors.push(issue("$.schema_version", "const", "must equal 2"));
  }
  checkString(value.token_set_id, "$.token_set_id", errors);
  checkRoleObject(value.colors, "$.colors", COLOR_ROLES, validCssColor, errors);
  checkRoleObject(value.type, "$.type", TYPE_ROLES, validFontValue, errors);
  checkRoleObject(value.spacing, "$.spacing", SPACING_ROLES, (entry) => typeof entry === "string" && CSS_LENGTH.test(entry), errors);
  checkRoleObject(value.radii, "$.radii", RADIUS_ROLES, (entry) => typeof entry === "string" && CSS_LENGTH.test(entry), errors);
  return errors;
}

export function validateContractPair(scenario, tokens) {
  const errors = [
    ...validateScenario(scenario).map((error) => ({ ...error, path: `scenario${error.path.slice(1)}` })),
    ...validateTokens(tokens).map((error) => ({ ...error, path: `tokens${error.path.slice(1)}` })),
  ];
  if (isRecord(scenario) && isRecord(tokens) && scenario.scenario_id !== tokens.token_set_id) {
    errors.push(issue("tokens.token_set_id", "scenario_match", "must equal scenario.scenario_id"));
  }
  return errors;
}

export function loadContractPair(rootDirectory, scenarioPath) {
  if (!isRepoRelativePath(scenarioPath)) {
    throw new Error("scenario path must be repo-relative");
  }
  const scenario = JSON.parse(fs.readFileSync(path.join(rootDirectory, scenarioPath), "utf8"));
  if (!isRepoRelativePath(scenario.tokens_path)) {
    return { scenario, tokens: null, errors: validateScenario(scenario) };
  }
  const tokens = JSON.parse(fs.readFileSync(path.join(rootDirectory, scenario.tokens_path), "utf8"));
  return { scenario, tokens, errors: validateContractPair(scenario, tokens) };
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const rootDirectory = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const scenarioPath = process.argv[2] ?? "evals/taste-oracle/deslop-ui-hard-001/scenario.json";
  try {
    const { errors } = loadContractPair(rootDirectory, scenarioPath);
    if (errors.length > 0) {
      console.error(JSON.stringify({ valid: false, errors }, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify({ valid: true, scenario: scenarioPath }, null, 2));
    }
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [{ path: "$", code: "read", message: error.message }] }, null, 2));
    process.exitCode = 1;
  }
}
