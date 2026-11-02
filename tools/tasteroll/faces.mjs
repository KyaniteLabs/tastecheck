/** Shared face sets for tasteroll live demo (landing-aligned). */
import { createHash } from 'node:crypto';

export const FACES = {
  ref: [
    'mineral',
    'Swiss',
    'brutalist',
    'folio',
    'shipping',
    'clinical',
    'humanist',
    'maximalist',
  ],
  vibe: [
    'warm',
    'serious',
    'playful',
    'refined',
    'stark',
    'editorial',
    'operational',
    'decorative',
  ],
  mode: ['light', 'dark', 'dual'],
  sig: [
    'needle',
    'rule',
    'display-word',
    'color-block',
    'bento',
    'timeline',
    'annotation',
    'sixling',
  ],
};

/** Full legal cartesian product (soft bans void). */
export function cartesianRolls() {
  const out = [];
  for (const ref of FACES.ref) {
    for (const vibe of FACES.vibe) {
      for (const mode of FACES.mode) {
        for (const sig of FACES.sig) {
          out.push({ ref, vibe, mode, sig });
        }
      }
    }
  }
  return out;
}

export function assertKnownFaces(row) {
  for (const dim of Object.keys(FACES)) {
    if (!FACES[dim].includes(row[dim])) {
      throw new Error(`unknown ${dim}=${row[dim]}`);
    }
  }
}

/**
 * Revision of the face sets — bump when faces change intentionally so the
 * mint fingerprint (below) rotates even if a face list happens to hash equal.
 */
export const FACES_REVISION = 'tasteroll-live-demo-v1';

/**
 * The legal roll set: known-face cartesian ∩ renderer-ready. Soft taste bans
 * are void — a combo is illegal only when it is structurally unrenderable,
 * an engineering fact. Today every cartesian combo is renderable, so the
 * legal cover is the full product (8×8×3×8 = 1536). If a recipe ever makes a
 * combo impossible, exclude it here and only here; the fingerprint changes
 * and tools/tasteroll/test-inventory.mjs fails until the artifact is
 * re-minted (`npm run mint:tasteroll`).
 */
export function legalRolls() {
  return cartesianRolls();
}

/**
 * Stable identity of the legal set: faces + revision + the legal cover
 * itself. The mint embeds this in the artifact (`legal_fingerprint`); the
 * external validator recomputes it from the current sources, so any edit to
 * faces or recipe exclusions marks a committed artifact as stale.
 */
export function legalFingerprint() {
  const canonical = JSON.stringify({
    revision: FACES_REVISION,
    faces: FACES,
    legal: legalRolls(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}
