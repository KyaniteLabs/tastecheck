#!/usr/bin/env node
/**
 * Calibration corpus — offline surface probes.
 *
 * The offline (markup-only, no browser) subset of the fast-lane surface checks:
 * the leak classes and the tells that do not need computed styles or geometry.
 * Probes that require a rendered surface (computed display face after
 * fallback, uniform card grids by measured box, stat bands by font size, tap
 * target overlap) stay in skills/tastecheck-pass/assets/gate-audit.js and are
 * out of scope for the offline runner — CORPUS.md records that boundary.
 *
 * Every probe returns findings of shape { id, evidence } where evidence cites
 * the exact matched text so a report reader can verify the claim.
 */

const MACHINE_PATH = /(?:\/(?:Users|home)\/[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\[A-Za-z0-9._-]+)(?:\/[^\s"'<>)]+)*\//g;
const CREDENTIAL_ASSIGNMENT = /\b(?:api[_-]?key|apikey|secret|access[_-]?token|auth[_-]?token|password)\b\s*[:=]\s*(["'])[^"']{4,}\1/gi;
const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const INDIGO = /(?:#6366f1|#818cf8|rgba?\(\s*99\s*,\s*102\s*,\s*241|rgba?\(\s*129\s*,\s*140\s*,\s*248)/i;
const VIOLET = /(?:#a855f7|#c084fc|rgba?\(\s*168\s*,\s*85\s*,\s*247|rgba?\(\s*192\s*,\s*132\s*,\s*252)/i;
const DEFAULT_DISPLAY_FACES = /^(?:inter|roboto|arial|helvetica(?:\s+neue)?|open sans|system-ui|-apple-system|segoe ui|ui-sans-serif|sans-serif)(?:\s*,\s*.*)?$/i;

function title(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

function metaDescriptions(html) {
  return [...html.matchAll(/<meta\s+(?:[^>]*?\s)?(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["'][^>]*?\scontent=["']([^"']*)["'][^>]*>/gi)].map((match) => match[1]);
}

/** Strip <script> and <style> blocks so text probes judge rendered text, not code. */
function visibleTextAndHead(html) {
  const head = html.slice(0, /<body[^>]*>/i.test(html) ? html.search(/<body[^>]*>/i) : html.length);
  const withoutBlocks = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const withoutTags = withoutBlocks.replace(/<[^>]+>/g, " ");
  return { head, text: withoutTags.replace(/\s+/g, " ") };
}

/** Inline script + inline style source (client-reachable code, no external fetch). */
function inlineSource(html) {
  return [...html.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]).join("\n");
}

export function probeMachinePaths(html) {
  const { text, head } = visibleTextAndHead(html);
  const surface = `${head} ${text}`;
  const hits = surface.match(MACHINE_PATH) || [];
  if (!hits.length) return [];
  return [{ id: "leak:machine-paths", evidence: `machine path in rendered surface: ${hits[0]}` }];
}

export function probeCredentials(html) {
  const source = inlineSource(html);
  const hits = source.match(CREDENTIAL_ASSIGNMENT) || [];
  if (!hits.length) return [];
  const first = hits[0].replace(/(["'])[^"']{4,}\1$/, "$1***redacted***");
  return [{ id: "leak:credential-pattern", evidence: `literal credential assigned in browser-reachable source: ${first.slice(0, 80)}` }];
}

export function probeTitleVocabulary(html, { vocabulary = [] } = {}) {
  if (!vocabulary.length) return [];
  const surfaces = [title(html), ...metaDescriptions(html)].filter(Boolean);
  for (const surface of surfaces) {
    const leaked = vocabulary.find((word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(surface));
    if (leaked) return [{ id: "leak:title-vocabulary", evidence: `internal vocabulary "${leaked}" in <title>/meta: "${surface.slice(0, 60)}"` }];
  }
  return [];
}

export function probeEmails(html, { allow = [] } = {}) {
  const { text } = visibleTextAndHead(html);
  const hits = [...new Set(text.match(EMAIL) || [])].filter((address) => !allow.includes(address));
  if (!hits.length) return [];
  return [{ id: "leak:pii-email", evidence: `email address in rendered text: ${hits[0]}` }];
}

export function probeIndigoGradient(html) {
  const styled = `${inlineSource(html)} ${html.match(/<[^>]*style=["']([^"']*)["']/gi)?.join(" ") || ""}`;
  for (const segment of styled.split(";")) {
    if (/gradient/i.test(segment) && INDIGO.test(segment) && VIOLET.test(segment)) {
      return [{ id: "slop:indigo-gradient", evidence: `indigo->violet gradient: ${segment.trim().slice(0, 80)}` }];
    }
  }
  return [];
}

export function probeDefaultDisplayFace(html) {
  const source = `${inlineSource(html)} ${[...html.matchAll(/<h[12][^>]*\sstyle=["']([^"']*)["']/gi)].map((match) => match[1]).join(";")}`;
  const declarations = source.match(/font-family\s*:\s*([^;}]+)/gi) || [];
  for (const declaration of declarations) {
    const first = declaration.replace(/font-family\s*:\s*/i, "").split(",")[0].replace(/["']/g, "").trim();
    if (first && DEFAULT_DISPLAY_FACES.test(first) && !/^var\(/.test(first)) {
      return [{ id: "slop:default-display-face", evidence: `display heading resolves to "${first}" first — the safe-font tell` }];
    }
  }
  return [];
}

/**
 * Run the offline probe set. `options.vocabulary` scopes the internal-vocabulary
 * probe (what counts as "internal" is product-specific); `options.allow` scopes
 * the email probe. The verdict is FAIL when any leak fires, REVIEW when only
 * slop tells fire, CLEAN otherwise — mirroring gate-audit.js severity classes.
 */
export function runSurfaceProbes(html, options = {}) {
  const findings = [
    ...probeMachinePaths(html),
    ...probeCredentials(html),
    ...probeTitleVocabulary(html, options),
    ...probeEmails(html, options),
    ...probeIndigoGradient(html),
    ...probeDefaultDisplayFace(html),
  ];
  const verdict = findings.some((finding) => finding.id.startsWith("leak:")) ? "FAIL" : findings.length ? "REVIEW" : "CLEAN";
  return { verdict, findings };
}
