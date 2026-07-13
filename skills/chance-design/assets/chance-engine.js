/* chance-design — seeded PRNG engine (xoshiro128++)
   Pasteable, zero-dependency, deterministic. Same seed → same design.
   Inspired by Chance (kyanitelabs/chance) — a multi-source randomness engine.
   Usage:
     const rng = chanceEngine(42);           // seed with a number
     rng.pick(['warm','serious','playful']); // uniform pick from array
     rng.range(58, 75);                      // uniform int in [min, max]
     rng.float(0.10, 0.16);                  // uniform float in [min, max)
     rng.chance(0.3);                        // true ~30% of the time
     rng.seed;                               // read current seed
*/
function chanceEngine(seed) {
  // SplitMix32 to expand a single seed into 4 xoshiro state words
  var s = seed >>> 0 || 1;
  function next32() {
    s = (s + 0x9E3779B9) >>> 0;
    var z = s;
    z = (z ^ (z >>> 16)) * 0x85EBCA6B >>> 0;
    z = (z ^ (z >>> 13)) * 0xC2B2AE35 >>> 0;
    return z ^ (z >>> 16);
  }
  var state = [next32(), next32(), next32(), next32()];

  function rotl(x, k) { return (x << k) | (x >>> (32 - k)); }

  function next() {
    var result = (rotl((state[0] + state[3]) >>> 0, 7) + state[0]) >>> 0;
    var t = (state[1] << 9) >>> 0;
    state[2] = (state[2] ^ state[0]) >>> 0;
    state[3] = (state[3] ^ state[1]) >>> 0;
    state[1] = (state[1] ^ state[2]) >>> 0;
    state[0] = (state[0] ^ state[3]) >>> 0;
    state[2] = (state[2] ^ t) >>> 0;
    state[3] = (rotl(state[3], 21)) >>> 0;
    return result / 0x100000000; // normalize to [0, 1)
  }

  return {
    seed: seed,
    next: next,
    range: function(min, max) { return min + Math.floor(next() * (max - min + 1)); },
    float: function(min, max) { return min + next() * (max - min); },
    pick: function(items) { return items[Math.floor(next() * items.length)]; },
    pickWeighted: function(items, weights) {
      var total = weights.reduce(function(a, b) { return a + b; }, 0);
      var r = next() * total;
      for (var i = 0; i < items.length; i++) { r -= weights[i]; if (r < 0) return items[i]; }
      return items[items.length - 1];
    },
    chance: function(p) { return next() < p; },
    shuffle: function(items) {
      var a = items.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(next() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
      }
      return a;
    }
  };
}

/* Example: roll a complete design system from seed 42
var rng = chanceEngine(42);
var space = { personality: ['warm','serious','playful','refined','stark','editorial','operational','decorative'],
              color_mode: ['light','dark','dual'],
              density: ['compact','standard','airy'],
              rhythm: ['metronomic','syncopated','asymmetrical'] };
var design = {};
Object.keys(space).forEach(function(k) { design[k] = rng.pick(space[k]); });
console.log('Seed 42:', JSON.stringify(design));
*/
