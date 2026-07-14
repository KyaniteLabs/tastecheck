/** Shared face sets for tasteroll live demo (landing-aligned). */
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
