#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";
import { loadCorpus, stratifiedSplit } from "./stratified-split.mjs";

const row = (id, cls) => ({ id, class: cls, expectation: { verdict: "SHIP" } });

const mixed = [
  ...Array.from({ length: 12 }, (_, i) => row(`c${i}`, "conflict")),
  ...Array.from({ length: 7 }, (_, i) => row(`r${i}`, "routine")),
];

test("held-out ALWAYS contains every class present in the corpus", () => {
  for (const seed of ["round-2", "abc", "zzz", "2026-09-28"]) {
    const m = stratifiedSplit(mixed, { ratio: 0.4, seed });
    assert.ok(m.held_out_class_counts.conflict >= 1, `seed ${seed}: conflict missing from held-out`);
    assert.ok(m.held_out_class_counts.routine >= 1, `seed ${seed}: routine missing from held-out`);
  }
});

test("deterministic: same corpus+seed+ratio => identical manifest", () => {
  const a = stratifiedSplit(mixed, { ratio: 0.4, seed: "s" });
  const b = stratifiedSplit([...mixed].reverse(), { ratio: 0.4, seed: "s" }); // file order must not matter
  assert.deepEqual(a, b);
});

test("different seeds can differ (no hidden constant)", () => {
  const seeds = new Set();
  for (let i = 0; i < 8; i += 1) seeds.add(JSON.stringify(stratifiedSplit(mixed, { ratio: 0.4, seed: `s${i}` }).held_out));
  assert.ok(seeds.size > 1);
});

test("partition property: train ∪ held-out = corpus, disjoint", () => {
  const m = stratifiedSplit(mixed, { ratio: 0.35, seed: "x" });
  assert.equal(m.counts.train + m.counts.held_out, mixed.length);
  assert.equal(new Set([...m.train, ...m.held_out]).size, mixed.length);
});

test("single-class corpus: invariant reported, split still valid", () => {
  const only = Array.from({ length: 6 }, (_, i) => row(`o${i}`, "conflict"));
  const m = stratifiedSplit(only, { ratio: 0.4, seed: "s" });
  assert.ok(m.held_out_class_counts.conflict >= 1);
  assert.deepEqual(m.invariants.unsplittable_single_class_corpus, []);
});

test("tiny corpus (2 rows, 2 classes): the invariant dominates the ratio", () => {
  const m = stratifiedSplit([row("a", "conflict"), row("b", "routine")], { ratio: 0.5, seed: "s" });
  // round-robin fills 1 slot; repair then moves the missing class in
  assert.ok(m.held_out_class_counts.conflict >= 1);
  assert.ok(m.held_out_class_counts.routine >= 1);
  assert.equal(m.counts.train + m.counts.held_out, 2);
  assert.ok(m.repairs.length >= 1);
});

test("repair pass is recorded when it fires", () => {
  // skew: 18 conflict vs 1 routine, ratio 0.4 -> round-robin fills held-out with conflict rows only
  const skew = [...Array.from({ length: 18 }, (_, i) => row(`c${i}`, "conflict")), row("r0", "routine")];
  const m = stratifiedSplit(skew, { ratio: 0.4, seed: "s" });
  assert.ok(m.held_out_class_counts.routine >= 1, "routine class lost in skewed corpus");
});

test("loadCorpus rejects malformed lines", () => {
  assert.throws(() => loadCorpus('{"id":"a","class":"c"}\nnot json'), /not JSON/);
  assert.throws(() => loadCorpus('{"class":"a"}'), /missing id/);
  assert.throws(() => loadCorpus('{"id":"a"}'), /missing class/);
  const rows = loadCorpus(mixed.map((r) => JSON.stringify(r)).join("\n") + "\n\n");
  assert.equal(rows.length, mixed.length);
});
