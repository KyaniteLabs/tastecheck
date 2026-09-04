# FLOOR OPINION — lane 'floor-crack' (CRACK-Ornith) on tastecheck
# via bridge :8817, 71s, source=content

# TasteCheck — Practitioner Take

## 1. What does it do (2 sentences)?

TasteCheck is a **fail-closed frontend release gate**: it runs a defined suite of design / structure / accessibility / surface checks against a *real rendered artifact* and emits a deterministic **SHIP** or **HOLD** verdict up front, backed by an evidence ledger where every failure becomes a concrete repair path (owner + rerun + acceptance rule). Its whole point is to stop files, build steps, and claimed checkmarks from standing in for actual execution evidence.

## 2. Where would you get stuck?

- **The "real artifact" bar.** The gate refuses to infer execution from a file existing or a checkmark, but the only way to *prove* you have a real rendered artifact (cold load + `assets/gate-audit.js` + manual shadow-root/iframe inspection) is partly honor-based. A stale build that happens to load can slip through.
- **n/a vs "not tested."** n/a means the subject is *absent*, never "not tested." The instant a required row can be marked n/a to escape a fail, the gate softens — and there's no hard guard against lazy n/a.
- **Required-check enforcement.** Direction, foundations, structure, accessibility, and against-spec `design-critique` are "required," but nothing mechanically forces the verdict to HOLD when one is missing or n/a — it's practitioner discipline.
- **Release-path overhead.** Every blocker needs owner + concrete repair + rerun + acceptance rule + predecessor. Assigning owners and getting fresh reruns in a real team is slow, and "ETA never changes HOLD to SHIP" means you can't paper over the stall.
- **Automation vs manual tension.** `gate-audit.js` "supports" the browser pass but "does not replace it" — so the real evidence (320px, 400% zoom, keyboard, contrast, reduced motion) stays manual, tedious, and inconsistent.

## 3. Top 5 problems

1. **Soft real-artifact gate.** No deterministic test proves the artifact is genuinely rendered-and-loaded vs merely present-and-buildable. Cold-load + audit helps, but manual inspection is subjective.
2. **n/a can be gamed.** Nothing stops a required check being marked n/a to dodge a fail; the semantics need an audit guardrail.
3. **Honor-based required coverage.** The "required" set (direction / foundations / structure / a11y / design-critique) has no machine check that re-derives the verdict when one is absent.
4. **design-critique circularity.** It needs `DESIGN-SYSTEM.md` or an "approved inferred-system" — but you can infer a system and thus rarely truly fail, making the "return to direction" escape hatch easy to walk through.
5. **Verdict determinism vs human judgment.** The contract demands a deterministic verdict, yet `design-critique`, `humanize-copy`, and `cognitive-a11y` are subjective calls — variance leaks into the SHIP/HOLD outcome.

## 4. Vote: **GOOD-ENOUGH** (with a clear path to AMAZING)

**Why GOOD-ENOUGH:** the bones are right — fail-closed, verdict-first, evidence ledger, "ETA doesn't soften the verdict," and the anti-"it's in the repo" stance are genuinely good practice and rare. But the execution rails are honor-based: the real-artifact bar, n/a semantics, required-check enforcement, and the subjective audit
