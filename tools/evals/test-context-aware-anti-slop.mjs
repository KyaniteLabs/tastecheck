#!/usr/bin/env node
import assert from "node:assert/strict";
import { evaluateAntiSlop } from "./evaluators/anti-slop.mjs";

const prompt = "The sponsor asked for ‘modern and trustworthy’. Do not silently average the contradiction; leave TBD until confirmation.";
const justified = evaluateAntiSlop({
  job_id: "design-system-interview-upgraded-seed202",
  skill: "design-system-interview",
  raw_output: `${prompt}\n\nAbstention: TBD until the sponsor confirms whether the warm handmade direction or dense dashboard wins. Next action: request confirmation before emitting tokens.`,
}, { source_text: prompt });
assert.equal(justified.pass, true, `quoted prompt and justified abstention should not fail: ${JSON.stringify(justified)}`);
assert.equal(justified.context_excluded_count > 0, true);
assert.equal(justified.justified_abstention_count > 0, true);

const quotedPromptFact = evaluateAntiSlop({
  skill: "design-system-interview",
  raw_output: "The quoted brief says “Modern and trustworthy”; that phrase is not a design decision. The source also says ‘warm handmade’.",
}, { source_text: "The sponsor says only ‘modern and trustworthy’ and later asks for ‘warm handmade’." });
assert.equal(quotedPromptFact.findings.some((finding) => finding.pattern_id === "vague_adjectives"), false, "quoted prompt adjectives must not be scored as generated slop");

const longStructuredAbstention = evaluateAntiSlop({
  skill: "spacing-system",
  raw_output: `Status: PENDING | ${"source-level detail ".repeat(32)} | Reason: the source fixture was not supplied. | Remediation: run the CSS audit and record every replacement next. | Evidence: prompt facts only. | Provenance: scenario boundary.`,
});
assert.equal(longStructuredAbstention.pass, true, `long evidence-bearing abstention row should pass: ${JSON.stringify(longStructuredAbstention)}`);
assert.equal(longStructuredAbstention.unjustified_abstention_count, 0);

const nakedPending = evaluateAntiSlop({
  skill: "spacing-system",
  raw_output: "PENDING",
});
assert.equal(nakedPending.pass, false, "naked PENDING must still fail closed");
assert.equal(nakedPending.unjustified_abstention_count, 1);

const unjustified = evaluateAntiSlop({
  skill: "design-system-interview",
  raw_output: "TBD. The result may be modern and polished.",
});
assert.equal(unjustified.pass, false, "unjustified TBD must still fail closed");

const generic = evaluateAntiSlop({
  skill: "component-states",
  raw_output: "Ensure a robust, seamless, scalable, modern and intuitive experience. In conclusion, leverage synergy.",
});
assert.equal(generic.pass, false, "generic filler must still fail");

console.log("context-aware anti-slop tests: 6 passed");
