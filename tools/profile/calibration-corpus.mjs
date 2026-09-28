/**
 * Calibration corpus — the structured verdict-import format.
 *
 * Imports a user's verdict journal (the loved-corpus shape: verbatim quote,
 * context, extracted principle, desk of record) into the calibration format:
 * every entry becomes { polarity, salience } where salience maps taste
 * dimensions to signed weights in [-1, 1] (how hard each dimension drove the
 * verdict and in which direction it was violated or satisfied).
 *
 * An entry's salience is EXPLICIT when the corpus annotates it (auditable,
 * preferred for calibrated corpora) and DERIVED from the deterministic lexicon
 * when not (cold-start: a raw loved-corpus imports as-is). Every entry records
 * which path produced its salience; nothing is silent.
 *
 * Privacy law (evals/corpus/PROFILE.md): corpus files are USER-LOCAL data and
 * never live in the product repo. This module reads a path it is given and
 * writes nothing.
 */
import { readFileSync } from "node:fs";
import {
  ALL_DIMENSIONS,
  PROCESS_DIMENSIONS,
  SCHEMA_VERSION,
  VERDICT_KINDS,
  VERDICT_POLARITY,
  deriveSalience,
} from "./dimensions.mjs";

function validateEntry(raw, index) {
  const where = `entries[${index}]${raw?.id ? ` (${raw.id})` : ""}`;
  const problems = [];
  if (typeof raw !== "object" || raw === null) return [`${where}: not an object`];
  for (const field of ["id", "product", "date", "kind", "verdict_quote", "principle"]) {
    if (typeof raw[field] !== "string" || !raw[field].trim()) problems.push(`${where}: ${field} required and non-empty`);
  }
  if (!(raw.kind in VERDICT_POLARITY)) problems.push(`${where}: kind must be one of ${VERDICT_KINDS.join(", ")}`);
  if (!raw.source?.desk || typeof raw.source.desk !== "string") {
    problems.push(`${where}: source.desk required (corpus law: every verdict cites its desk of record)`);
  }
  if (raw.schema_version !== undefined && raw.schema_version !== SCHEMA_VERSION) {
    problems.push(`${where}: schema_version must be ${SCHEMA_VERSION}`);
  }
  if (raw.salience !== undefined) {
    if (typeof raw.salience !== "object" || raw.salience === null) {
      problems.push(`${where}: salience must be an object`);
    } else {
      const keys = Object.keys(raw.salience);
      for (const key of keys) {
        if (!ALL_DIMENSIONS.includes(key)) problems.push(`${where}: salience key "${key}" is not a canonical dimension`);
        const value = raw.salience[key];
        if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1) {
          problems.push(`${where}: salience.${key} must be a finite number in [-1, 1]`);
        }
      }
    }
  }
  return problems;
}

/**
 * Import a parsed corpus object. Returns { entries, stats } where each entry
 * carries its polarity, salience (explicit wins over derived), salience_source
 * ("explicit" | "derived"), layer ("taste" | "process"), and scoreable flag.
 * Entries whose salience touches no taste dimension (process-only or empty)
 * are imported and counted, but excluded from weight fitting and gate scoring.
 */
export function importCorpus(raw) {
  if (typeof raw !== "object" || raw === null) throw new Error("corpus is not an object");
  if (raw.schema_version !== SCHEMA_VERSION) throw new Error(`corpus schema_version must be ${SCHEMA_VERSION}`);
  if (raw.kind !== "tastecheck-calibration-corpus") throw new Error('corpus kind must be "tastecheck-calibration-corpus"');
  if (!Array.isArray(raw.entries) || raw.entries.length === 0) throw new Error("corpus entries must be a non-empty array");

  const problems = [];
  const seen = new Set();
  for (const [index, entry] of raw.entries.entries()) {
    problems.push(...validateEntry(entry, index));
    if (entry?.id) {
      if (seen.has(entry.id)) problems.push(`entries[${index}]: duplicate id ${entry.id}`);
      seen.add(entry.id);
    }
  }
  if (problems.length) throw new Error(`corpus invalid:\n  - ${problems.join("\n  - ")}`);

  const entries = raw.entries.map((entry) => {
    const polarity = VERDICT_POLARITY[entry.kind];
    const salienceSource = entry.salience !== undefined ? "explicit" : "derived";
    const salience = salienceSource === "explicit" ? entry.salience : deriveSalience({ ...entry, polarity });
    const tasteDimensions = Object.keys(salience).filter((dimension) => !PROCESS_DIMENSIONS.includes(dimension));
    return {
      id: entry.id,
      product: entry.product,
      date: entry.date,
      kind: entry.kind,
      verdict_quote: entry.verdict_quote,
      context: entry.context ?? "",
      principle: entry.principle,
      source: { desk: entry.source.desk, ...(entry.source.note ? { note: entry.source.note } : {}) },
      polarity,
      salience,
      salience_source: salienceSource,
      layer: tasteDimensions.length ? "taste" : "process",
      scoreable: tasteDimensions.length > 0,
    };
  });

  return {
    entries,
    stats: {
      total: entries.length,
      scoreable: entries.filter((entry) => entry.scoreable).length,
      process_only: entries.filter((entry) => !entry.scoreable).length,
      explicit: entries.filter((entry) => entry.salience_source === "explicit").length,
      derived: entries.filter((entry) => entry.salience_source === "derived").length,
      derived_unscoreable: entries.filter((entry) => entry.salience_source === "derived" && !entry.scoreable).length,
    },
  };
}

/** Load a corpus from a user-local JSON file (never in-repo — see privacy law). */
export function loadCorpus(path) {
  return importCorpus(JSON.parse(readFileSync(path, "utf8")));
}
