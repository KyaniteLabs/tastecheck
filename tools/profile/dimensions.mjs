/**
 * Canonical taste dimensions for taste profiles.
 *
 * The judgment layer (register, boldness, fit-to-intent) is profile-weighted;
 * objective defect classes (a11y floors, credential leaks) are universal and
 * NEVER personalize (evals/corpus/PROFILE.md). Dimensions are split accordingly:
 * TASTE_DIMENSIONS are personalizable, PROCESS_DIMENSIONS record process
 * verdicts (verification cost, extraction hygiene) without personalizing.
 */

export const SCHEMA_VERSION = 1;

export const TASTE_DIMENSIONS = [
  "composition",
  "material-depth",
  "boldness",
  "consistency",
  "drift-fidelity",
  "type-voice",
  "interaction-fit",
  "color-register",
  "family-coherence",
];

export const PROCESS_DIMENSIONS = ["verification-cost"];

export const ALL_DIMENSIONS = [...TASTE_DIMENSIONS, ...PROCESS_DIMENSIONS];

export const VERDICT_KINDS = [
  "negative",
  "drift",
  "bar",
  "positive",
  "positive-order",
  "course-correct",
];

/** Polarity of a verdict kind: -1 the surface was denied, +1 it was upheld. */
export const VERDICT_POLARITY = {
  negative: -1,
  drift: -1,
  bar: 1,
  positive: 1,
  "positive-order": 1,
  "course-correct": -1,
};

/**
 * Deterministic lexicon deriving dimension salience from a verdict's own words
 * (verdict_quote + principle). This is the cold-start path: a raw loved-corpus
 * entry (no annotations) imports as-is. Extraction is OUR job — the user is
 * never asked to explain (deep-strategy §7). Every mapping is a visible rule;
 * an entry may always carry an explicit salience block instead, which wins.
 *
 * Order matters and is stable: first match per dimension wins at full weight,
 * later matches of the SAME dimension do not stack. Sign comes from the
 * verdict polarity: a dimension named in a negative verdict was violated
 * (negative salience); in a positive verdict it was satisfied (positive).
 */
export const SALIENCE_LEXICON = [
  { dimension: "composition", weight: 1.0, pattern: /trash|dead zone|primary action|unreadable|half-empty|hero|composition|density|12px/i },
  { dimension: "material-depth", weight: 1.0, pattern: /diagonal lines|metaphor|carapace|exoskeleton|insect wing|texture|grain|art direction|authored|velvet|lamplight|material depth|composite material|life\/texture|craft/i },
  { dimension: "boldness", weight: 1.0, pattern: /timid|sterile|bland|cheap|empty|5 years old|warm|bold|human|point of view|soulless|timidness/i },
  { dimension: "consistency", weight: 1.0, pattern: /consisten|corner radii|radius|scale|one system|one identity|one thing|scattered values|pill/i },
  { dimension: "drift-fidelity", weight: 1.0, pattern: /drift|not what i asked|quote the order|verbatim|spec adherence|interpretation substituted/i },
  { dimension: "type-voice", weight: 1.0, pattern: /fraunces|typeface|type role|font|typeface identit|characterful button|display face/i },
  { dimension: "interaction-fit", weight: 1.0, pattern: /autoplay|should just play|tap-to-play|hands-off|hover-only|consumption|first-gesture|pending state|visitor must know/i },
  { dimension: "color-register", weight: 1.0, pattern: /greens? too similar|accent|contrast|luminance|dark\/light|hue count|register \(|gemstone|tsavorite|phthalo|9\.3-11\.6|5\.99:1/i },
  { dimension: "family-coherence", weight: 1.0, pattern: /family|house[- ]style|one hand|cross-product|inspired by resonant|implement order/i },
  { dimension: "verification-cost", weight: 1.0, pattern: /wasted all my time|tokens|rendered probe|destructive edit|before expensive gates|verification cost|interview|anchor-free|contaminat/i },
];

/**
 * Derive signed salience from an entry's own words. Returns a map
 * { dimension: signedWeight } with per-entry L-infinity normalization to 1
 * (every verdict carries one equal vote regardless of how many dimensions
 * its words name). No matches -> {} (the entry is importable but unscoreable
 * and counted as such — never silently dropped).
 */
export function deriveSalience({ verdict_quote, principle, polarity }) {
  const text = `${verdict_quote}\n${principle}`;
  const raw = {};
  for (const rule of SALIENCE_LEXICON) {
    if (rule.pattern.test(text) && !(rule.dimension in raw)) {
      raw[rule.dimension] = rule.weight * polarity;
    }
  }
  const dimensions = Object.keys(raw);
  if (!dimensions.length) return {};
  const maxMagnitude = Math.max(...dimensions.map((dimension) => Math.abs(raw[dimension])));
  const normalized = {};
  for (const dimension of dimensions.sort()) {
    normalized[dimension] = Number((raw[dimension] / maxMagnitude).toFixed(4));
  }
  return normalized;
}
