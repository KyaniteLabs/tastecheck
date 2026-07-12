import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ARM_IDS, VIEWPORTS } from "../validate-contracts.mjs";
import { PUBLIC_UNSAFE_TEXT } from "./public-safety.mjs";

const SHA256 = /^[0-9a-f]{64}$/;
const REQUIRED_PROBES = ["root", "heading", "primary-action", "summary-card", "status"];

function normalizeValue(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical JSON requires a finite JSON number");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === "object") {
    const output = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined || typeof value[key] === "function" || typeof value[key] === "symbol") {
        throw new TypeError("canonical JSON requires JSON-compatible values");
      }
      output[key] = normalizeValue(value[key]);
    }
    return output;
  }
  throw new TypeError("canonical JSON requires JSON-compatible values");
}

export function canonicalJson(value) {
  return JSON.stringify(normalizeValue(value));
}

export function hashCanonicalJson(value) {
  return crypto.createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function hashBytes(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function findClippedProbes(domFacts) {
  const viewport = domFacts?.viewport;
  if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height)) return [];
  const entries = Array.isArray(domFacts?.probes)
    ? domFacts.probes.map((probe) => [probe?.name, probe?.rect ?? probe?.bounds, probe?.visible])
    : Object.entries(domFacts?.probes ?? {}).map(([name, probe]) => [name, probe?.rect ?? probe?.bounds, probe?.visible]);
  return entries
    .filter(([name]) => name !== "root")
    .filter(([, rect, visible]) => (
      visible === false
      || !rect
      || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
      || rect.width <= 0
      || rect.height <= 0
      || rect.x < 0
      || rect.y < 0
      || rect.x + rect.width > viewport.width
      || rect.y + rect.height > viewport.height
    ))
    .map(([name]) => name);
}

export function assertRepoRelativePath(value) {
  const valid = typeof value === "string"
    && value.length > 0
    && !value.startsWith("/")
    && !value.startsWith("~")
    && !value.includes("\\")
    && !/^[A-Za-z]:/.test(value)
    && !/^[a-z][a-z0-9+.-]*:/i.test(value)
    && value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
  if (!valid) throw new TypeError("path must be a normalized repo-relative path");
  return value;
}

function visitStrings(value, visit) {
  if (typeof value === "string") return visit(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => visitStrings(entry, visit));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      visit(key);
      visitStrings(entry, visit);
    }
  }
}

export function assertPublicSafe(value) {
  visitStrings(value, (text) => {
    if (PUBLIC_UNSAFE_TEXT.test(text)) {
      throw new TypeError("evidence must contain only public-safe values");
    }
  });
  return value;
}

export function normalizeEvidenceManifest(value) {
  const normalized = structuredClone(value);
  if (Array.isArray(normalized.captures)) {
    normalized.captures.sort((left, right) => (
      ARM_IDS.indexOf(left.arm_id) - ARM_IDS.indexOf(right.arm_id)
      || VIEWPORTS.findIndex((entry) => entry.id === left.viewport_id)
        - VIEWPORTS.findIndex((entry) => entry.id === right.viewport_id)
    ));
  }
  return normalizeValue(normalized);
}

export function verifyArtifactHashes(manifest, artifactRoot) {
  const errors = [];
  const root = path.resolve(artifactRoot);
  for (const [index, capture] of (manifest?.captures ?? []).entries()) {
    const base = `$.captures[${index}]`;
    try {
      assertRepoRelativePath(capture.screenshot_path);
      const screenshotFile = path.resolve(root, capture.screenshot_path);
      if (!screenshotFile.startsWith(`${root}${path.sep}`)) throw new Error("outside artifact root");
      if (!fs.existsSync(screenshotFile)) {
        errors.push(error(`${base}.screenshot_path`, "screenshot_missing", "artifact is missing"));
      } else if (hashBytes(fs.readFileSync(screenshotFile)) !== capture.screenshot_sha256) {
        errors.push(error(`${base}.screenshot_sha256`, "screenshot_hash_mismatch", "does not match artifact bytes"));
      }
    } catch {
      errors.push(error(`${base}.screenshot_path`, "repo_relative_path", "must resolve inside the artifact root"));
    }
    if (hashCanonicalJson(capture.dom_facts) !== capture.dom_sha256) {
      errors.push(error(`${base}.dom_sha256`, "dom_hash_mismatch", "does not match canonical DOM facts"));
    }
    if (hashCanonicalJson(capture.computed_styles) !== capture.style_sha256) {
      errors.push(error(`${base}.style_sha256`, "style_hash_mismatch", "does not match canonical computed styles"));
    }
  }
  return errors;
}

function error(path, code, message) {
  return { path, code, message };
}

function normalizeVisibleCopy(text) {
  return typeof text === "string"
    ? text.normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim()
    : null;
}

function exactViewportList(actual) {
  return Array.isArray(actual)
    && actual.length === VIEWPORTS.length
    && actual.every((viewport, index) => (
      viewport?.id === VIEWPORTS[index].id
      && viewport?.width === VIEWPORTS[index].width
      && viewport?.height === VIEWPORTS[index].height
    ));
}

export function validateEvidenceManifest(value) {
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [error("$", "type", "must be an object")];
  }
  if (value.schema_version !== 1) errors.push(error("$.schema_version", "const", "must equal 1"));
  if (value.scenario_id !== "deslop-ui-hard-001") errors.push(error("$.scenario_id", "const", "must equal deslop-ui-hard-001"));
  if (typeof value.captured_at !== "string" || Number.isNaN(Date.parse(value.captured_at)) || !value.captured_at.endsWith("Z")) {
    errors.push(error("$.captured_at", "utc_timestamp", "must be an ISO UTC timestamp"));
  }
  if (!exactViewportList(value.viewports)) errors.push(error("$.viewports", "exact_viewports", "must equal mobile 390x844 then desktop 1280x900"));
  if (!Array.isArray(value.arms) || value.arms.length !== ARM_IDS.length || value.arms.some((id, index) => id !== ARM_IDS[index])) {
    errors.push(error("$.arms", "exact_arm_ids", `must equal ${ARM_IDS.join(", ")}`));
  }

  const expected = new Set(ARM_IDS.flatMap((armId) => VIEWPORTS.map((viewport) => `${armId}:${viewport.id}`)));
  const seen = new Set();
  if (!Array.isArray(value.captures)) {
    errors.push(error("$.captures", "type", "must be an array"));
  } else {
    value.captures.forEach((capture, index) => {
      const base = `$.captures[${index}]`;
      const key = `${capture?.arm_id}:${capture?.viewport_id}`;
      if (seen.has(key)) errors.push(error(base, "duplicate_capture", `duplicate capture ${key}`));
      seen.add(key);
      if (!expected.has(key)) errors.push(error(base, "capture_identity", "must reference a canonical arm and viewport"));
      try {
        assertRepoRelativePath(capture?.screenshot_path);
        if (!capture.screenshot_path.startsWith("artifacts/") || capture.screenshot_path === "artifacts/") {
          errors.push(error(`${base}.screenshot_path`, "artifact_relative_path", "must be relative to the capture output root"));
        }
      } catch {
        errors.push(error(`${base}.screenshot_path`, "repo_relative_path", "must be a normalized repo-relative path"));
      }
      for (const field of ["screenshot_sha256", "dom_sha256", "style_sha256"]) {
        if (!(field in (capture ?? {}))) errors.push(error(`${base}.${field}`, "required_hash", "is required"));
        else if (!SHA256.test(capture[field])) errors.push(error(`${base}.${field}`, "sha256", "must be a lowercase SHA-256 hash"));
      }
      if (!capture?.dom_facts || typeof capture.dom_facts !== "object") errors.push(error(`${base}.dom_facts`, "required", "is required"));
      if (!capture?.computed_styles || typeof capture.computed_styles !== "object") errors.push(error(`${base}.computed_styles`, "required", "is required"));
    });
  }
  if (seen.size !== expected.size || [...expected].some((key) => !seen.has(key))) {
    errors.push(error("$.captures", "exact_capture_coverage", "must contain each arm and viewport exactly once"));
  }
  if (Array.isArray(value.captures)) {
    for (const viewport of VIEWPORTS) {
      const captures = ARM_IDS.map((armId) => value.captures.find((capture) => (
        capture?.arm_id === armId && capture?.viewport_id === viewport.id
      )));
      for (const probeName of REQUIRED_PROBES) {
        const texts = captures.map((capture) => capture?.dom_facts?.probes?.[probeName]?.text);
        if (texts.some((text) => typeof text !== "string") || new Set(texts.map(normalizeVisibleCopy)).size !== 1) {
          errors.push(error(
            `$.captures[viewport=${viewport.id}].dom_facts.probes.${probeName}.text`,
            "visible_content_parity",
            "rendered visible probe text must match across all arms",
          ));
        }
      }
    }
  }
  try {
    assertPublicSafe(value);
  } catch {
    errors.push(error("$", "public_safe", "must not contain local paths, identities, email, or secret assignments"));
  }
  return errors;
}
