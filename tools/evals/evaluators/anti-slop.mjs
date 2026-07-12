#!/usr/bin/env node
/**
 * Context-aware AI-slop detector.
 *
 * Prompt quotations and justified abstention markers are not generated slop.
 * Unjustified placeholders still fail closed, and the legacy generic-filler
 * patterns remain active for the generated portion of the response.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const EVALUATOR_MODEL = "gpt-5.6-luna";
const SLOP_THRESHOLD = 5.0;
const SLOP_PATTERNS = [
  { id: "hedge_generally", regex: /\b(generally|typically|usually|often|sometimes|may|might|could|tend to)\b/gi, weight: 0.5, label: "hedge word" },
  { id: "ai_tell_ensure", regex: /\bensure(s|d|ing)?\b/gi, weight: 0.8, label: "AI tell: 'ensure'" },
  { id: "ai_tell_leverage", regex: /\b(leverage|utilize|synergy|seamless|robust|scalable)\b/gi, weight: 1.0, label: "AI filler noun" },
  { id: "ai_delimiters", regex: /^(In conclusion|To summarize|In summary|Overall|In essence|It is worth noting)/gim, weight: 1.5, label: "AI closing delimiter" },
  { id: "placeholder_copy", regex: /\[insert|lorem ipsum|placeholder|TBD|TODO|FIXME/gi, weight: 2.0, label: "placeholder text" },
  { id: "false_specificity", regex: /approximately \d+%|roughly \d+|about \d+ (px|ms|rem)/gi, weight: 1.0, label: "hedged numeric value" },
  { id: "vague_adjectives", regex: /\b(modern|clean|professional|polished|sleek|intuitive|user.friendly)\b/gi, weight: 0.5, label: "vague design adjective" },
  { id: "invented_brand", regex: /brand.voice|brand.personality|brand.guidelines/gi, weight: 0.3, label: "invented brand context" },
];
const ABSTENTION_PATTERN = /\b(?:TBD|TBC|abstain(?:ed|s|ing)?|unknown|not supplied|await(?:ing)? confirmation|pending)\b/gi;

function escapeRegex(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function quotedPromptFragments(sourceText) {
  const fragments = [];
  for (const pattern of [/[“"]([^”"]+)[”"]/g, /[‘']([^’']+)[’']/g]) {
    for (const match of sourceText.matchAll(pattern)) if (match[1]?.trim()) fragments.push(match[1].trim());
  }
  return [...new Set(fragments)];
}

function removePromptContext(output, sourceText) {
  if (!sourceText) return { text: output, count: 0 };
  let text = output;
  let count = 0;
  const fragments = [sourceText, ...quotedPromptFragments(sourceText)];
  for (const fragment of fragments) {
    const pattern = new RegExp(escapeRegex(fragment), "gi");
    count += text.match(pattern)?.length ?? 0;
    text = text.replace(pattern, " ");
    if (fragment === sourceText) continue;
    for (const word of fragment.match(/\b[A-Za-z][A-Za-z-]{3,}\b/g) ?? []) {
      const wordPattern = new RegExp(`\\b${escapeRegex(word)}\\b`, "gi");
      count += text.match(wordPattern)?.length ?? 0;
      text = text.replace(wordPattern, " ");
    }
  }
  return { text, count };
}

function structuredContext(output, index, length) {
  const delimiters = ["\n", "\\n"];
  const starts = delimiters.map((delimiter) => output.lastIndexOf(delimiter, index));
  const ends = delimiters.map((delimiter) => {
    const end = output.indexOf(delimiter, index + length);
    return end < 0 ? output.length : end;
  });
  const startIndex = Math.max(...starts.map((start, indexOfDelimiter) => start < 0 ? 0 : start + delimiters[indexOfDelimiter].length));
  const endIndex = Math.min(...ends);
  return output.slice(startIndex, endIndex);
}

function isJustifiedAbstention(output, index, length) {
  const window = output.slice(Math.max(0, index - 180), Math.min(output.length, index + length + 220));
  const row = structuredContext(output, index, length);
  const context = `${window}\n${row}`;
  const status = /\b(?:TBD|TBC|abstain(?:ed|s|ing)?|unknown|not supplied|await(?:ing)? confirmation|pending|blocked|unmeasured)\b/i.test(context);
  const missing = /\b(?:missing|not supplied|not provided|unavailable|absent|no\s+[\w -]{0,48}(?:fixture|source|evidence|asset|stylesheet|trace))\b/i.test(context);
  const action = /\b(?:next action|remediation|run|audit|measure|verify|confirm|request|supply|provide|test|apply|replace|until|after)\b/i.test(context);
  const resolution = /\b(?:confirmation|review|approval|source|evidence|fixture|asset|wordmark|font|rights|owner|until|after)\b/i.test(context);
  return status && ((missing && action) || (resolution && action));
}

function maskJustifiedAbstentions(output) {
  let justified = 0;
  let unjustified = 0;
  const text = output.replace(ABSTENTION_PATTERN, (match, offset) => {
    if (isJustifiedAbstention(output, offset, match.length)) {
      justified += 1;
      return " ".repeat(match.length);
    }
    unjustified += 1;
    return match;
  });
  return { text, justified, unjustified };
}

export function evaluateAntiSlop(attempt, context = {}) {
  const output = attempt.raw_output ?? "";
  const sourceText = context.source_text ?? context.prompt_text ?? attempt.prompt_text ?? "";
  const promptRemoved = removePromptContext(output, sourceText);
  const abstentions = maskJustifiedAbstentions(promptRemoved.text);
  const analysisText = abstentions.text;
  const findings = [];
  let totalWeight = 0;
  for (const pattern of SLOP_PATTERNS) {
    pattern.regex.lastIndex = 0;
    const matches = [...analysisText.matchAll(pattern.regex)];
    if (matches.length === 0) continue;
    const score = pattern.weight * Math.min(matches.length, 5);
    totalWeight += score;
    findings.push({
      pattern_id: pattern.id,
      label: pattern.label,
      count: matches.length,
      weight: pattern.weight,
      score: Number(score.toFixed(2)),
      examples: matches.slice(0, 3).map((match) => match[0]),
    });
  }
  const bareCheckmarkCount = (analysisText.match(/^[✓✗✔✘]\s+\w/gm) ?? []).length;
  const totalLines = analysisText.split("\n").filter((line) => line.trim()).length;
  const bareCheckmarkRatio = totalLines > 0 ? bareCheckmarkCount / totalLines : 0;
  if (bareCheckmarkRatio > 0.3) {
    totalWeight += 3;
    findings.push({ pattern_id: "bare_checkmark", label: "High bare-checkmark ratio", count: bareCheckmarkCount, ratio: Number(bareCheckmarkRatio.toFixed(3)), score: 3 });
  }
  const slopScore = Number(totalWeight.toFixed(2));
  const pass = abstentions.unjustified === 0 && slopScore < SLOP_THRESHOLD;
  return {
    schema_version: 2,
    evaluator: "anti-slop",
    evaluator_model: EVALUATOR_MODEL,
    job_id: attempt.job_id,
    skill: attempt.skill,
    scenario_id: attempt.scenario_id,
    run_type: attempt.run_type,
    seed: attempt.requested_seed ?? attempt.seed ?? null,
    slop_score: slopScore,
    threshold: SLOP_THRESHOLD,
    pass,
    verdict: pass ? "clean" : "slop-detected",
    findings,
    bare_checkmark_ratio: Number(bareCheckmarkRatio.toFixed(3)),
    context_excluded_count: promptRemoved.count,
    justified_abstention_count: abstentions.justified,
    unjustified_abstention_count: abstentions.unjustified,
    output_length_chars: output.length,
    notes: pass ? null : abstentions.unjustified > 0 ? "Unjustified abstention or placeholder marker blocks release." : `Slop score ${slopScore} exceeds threshold ${SLOP_THRESHOLD}`,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const [,, attemptPath] = process.argv;
  if (!attemptPath) {
    console.error("Usage: node tools/evals/evaluators/anti-slop.mjs <attempt.json>");
    process.exit(1);
  }
  try {
    const result = evaluateAntiSlop(JSON.parse(readFileSync(attemptPath, "utf8")));
    console.log(JSON.stringify(result, null, 2));
    if (!result.pass) process.exit(1);
  } catch (error) {
    console.error("Cannot evaluate attempt:", error.message);
    process.exit(1);
  }
}
