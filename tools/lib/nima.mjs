// tools/lib/nima.mjs — dependency-free NIMA HTTP client for the TasteCheck gate harness.
//
// Talks to the NIMA aesthetic-scoring service (VGG16/AVA) over its localhost HTTP API:
//   python3 ~/launchpad/docs/neural-beauty-engine/nima_service.py   # :8765
//     GET  /health              → {"status":"ok",...}
//     POST /score  (raw bytes)  → {"score": <1-10>, "histogram": [...]}
//
// Phase 1 contract (see ~/launchpad/docs/neural-beauty-engine/tastecheck-nima-plan.md §7):
// NIMA is a WARN-only heuristic. A low score can upgrade a CLEAN gate to REVIEW WARNS,
// but it NEVER produces a FAIL, and a missing service is "n/a" with zero verdict impact.

const NIMA_BASE = "http://127.0.0.1:8765";
const HEALTH_TIMEOUT_MS = 2000;
const SCORE_TIMEOUT_MS = 10_000;
const HEALTH_CACHE_MS = 60_000;

// Single tuning knob. WARN-only in Phase 1; promote to a hard FAIL threshold only after
// calibration proves it separates known-good from known-slop on UI images (not AVA photos).
export const NIMA_WARN_THRESHOLD = 5.5;

let healthUp = null;
let healthCheckedAt = 0;

// GET /health → boolean. Cached for HEALTH_CACHE_MS so a multi-surface, multi-viewport
// run reuses one probe instead of issuing one per screenshot.
export async function isNimaAvailable() {
  const now = Date.now();
  if (healthUp !== null && now - healthCheckedAt < HEALTH_CACHE_MS) return healthUp;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const response = await fetch(`${NIMA_BASE}/health`, { signal: controller.signal });
    clearTimeout(timer);
    healthUp = response.ok;
  } catch {
    healthUp = false;
  }
  healthCheckedAt = now;
  return healthUp;
}

// POST raw image bytes to /score → { score, histogram } | null.
// Returns null on any failure (service down, non-OK, malformed payload, timeout) so
// callers treat "unmeasured" uniformly as graceful degradation.
export async function scoreNima(imageBuffer) {
  if (!(await isNimaAvailable())) return null;
  try {
    const body = Buffer.isBuffer(imageBuffer) ? imageBuffer : Buffer.from(imageBuffer);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCORE_TIMEOUT_MS);
    const response = await fetch(`${NIMA_BASE}/score`, { method: "POST", body, signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const payload = await response.json();
    if (typeof payload?.score !== "number") return null;
    return payload;
  } catch {
    return null;
  }
}

// Pure status logic — unit-testable without the service.
//   null / undefined             → "n/a"   (not measured; never a defect)
//   score <  NIMA_WARN_THRESHOLD → "warn"
//   score >= NIMA_WARN_THRESHOLD → "ok"
export function aestheticStatus(score) {
  if (score == null) return "n/a";
  return score < NIMA_WARN_THRESHOLD ? "warn" : "ok";
}

// Reset the health-check cache. Intended for tests that swap the fetch implementation.
export function _resetNimaHealthCache() {
  healthUp = null;
  healthCheckedAt = 0;
}

// --- Plan-API aliases (corrected to Phase 1 WARN-only; never FAIL) --------------
// Re-exported under the tastecheck-nima-plan §5a names so either harness wiring
// resolves. nimaVerdict never returns "fail" in Phase 1 (no calibrated FAIL threshold),
// which keeps any "nv !== 'fail'" gate check passing.
export const NIMA_FAIL = Infinity; // disabled in Phase 1 — WARN-only (see plan §7)
export { scoreNima as nimaScore, isNimaAvailable as nimaAvailable, NIMA_WARN_THRESHOLD as NIMA_WARN };
export function nimaVerdict(score) {
  if (score == null) return "n/a";
  return score < NIMA_WARN_THRESHOLD ? "warn" : "pass";
}
export function combinedVerdict(gate, nimaScore) {
  const gateVerdict = gate?.verdict ?? "CLEAN";
  if (gateVerdict === "FAIL") return "FAIL";
  if (gateVerdict === "REVIEW WARNS" || nimaVerdict(nimaScore) === "warn") return "REVIEW WARNS";
  return "CLEAN";
}
