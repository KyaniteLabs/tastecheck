/* tasteroll — seeded PRNG engine with lock/reroll support (xoshiro128++)
   Zero-dependency, deterministic. Same seed → same roll, always.
   Inspired by Chance (kyanitelabs/chance) — multi-source randomness engine.

   Three interaction modes:
   1. One-shot: roll once, take it or leave it
   2. Iterative: roll → lock dimensions → re-roll unlocked → converge
   3. Shotgun: roll N seeds at once, compare, pick one to develop

   Usage:
     var t = tasteroll(42);                    // seed
     t.roll(dimensions);                        // roll all dimensions
     t.lock('personality');                     // lock a dimension
     t.reroll(dimensions);                      // re-roll unlocked only
     t.shotgun(dimensions, 5);                  // 5 rolls at once
     t.seed;                                    // current seed
     t.locked;                                  // {personality: 'warm', ...}
*/
function tasteroll(seed) {
  var currentSeed = seed >>> 0 || 1;

  function makeRng(s) {
    s = s >>> 0 || 1;
    var st = [0, 0, 0, 0];
    for (var i = 0; i < 4; i++) {
      s = (s + 0x9E3779B9) >>> 0;
      var z = s;
      z = (z ^ (z >>> 16)) * 0x85EBCA6B >>> 0;
      z = (z ^ (z >>> 13)) * 0xC2B2AE35 >>> 0;
      st[i] = z ^ (z >>> 16);
    }
    function rotl(x, k) { return (x << k) | (x >>> (32 - k)); }
    return function () {
      var result = (rotl((st[0] + st[3]) >>> 0, 7) + st[0]) >>> 0;
      var t = (st[1] << 9) >>> 0;
      st[2] = (st[2] ^ st[0]) >>> 0;
      st[3] = (st[3] ^ st[1]) >>> 0;
      st[1] = (st[1] ^ st[2]) >>> 0;
      st[0] = (st[0] ^ st[3]) >>> 0;
      st[2] = (st[2] ^ t) >>> 0;
      st[3] = (rotl(st[3], 21)) >>> 0;
      return result / 0x100000000;
    };
  }

  var state = {
    seed: currentSeed,
    locked: {},
    rollHistory: [],
    excludedDirections: []
  };

  function rollDimension(rng, candidates) {
    var filtered = candidates.filter(function (c) {
      return state.excludedDirections.indexOf(c) === -1;
    });
    if (!filtered.length) filtered = candidates;
    return filtered[Math.floor(rng() * filtered.length)];
  }

  function rollAll(dimensions) {
    // dimensions: { personality: ['warm','serious',...], aesthetic: [...], ... }
    // candidates are AI-generated from audit + intake context — NOT from a static file
    var rng = makeRng(state.seed);
    var result = {};
    for (var dim in dimensions) {
      if (state.locked[dim]) {
        result[dim] = state.locked[dim];
      } else {
        result[dim] = rollDimension(rng, dimensions[dim]);
      }
    }
    state.rollHistory.push({ seed: state.seed, result: Object.assign({}, result) });
    return result;
  }

  function lock(dimension, value) {
    if (value) state.locked[dimension] = value;
    return state.locked;
  }

  function unlock(dimension) {
    delete state.locked[dimension];
    return state.locked;
  }

  function reroll(dimensions) {
    state.seed++;
    return rollAll(dimensions);
  }

  function shotgun(dimensions, count) {
    var results = [];
    var baseSeed = state.seed;
    for (var i = 0; i < count; i++) {
      state.seed = baseSeed + i;
      results.push(rollAll(dimensions));
    }
    state.seed = baseSeed;
    return results;
  }

  function exclude(direction) {
    state.excludedDirections.push(direction);
  }

  return {
    get seed() { return state.seed; },
    get locked() { return Object.assign({}, state.locked); },
    get history() { return state.rollHistory.slice(); },
    roll: rollAll,
    reroll: reroll,
    lock: lock,
    unlock: unlock,
    shotgun: shotgun,
    exclude: exclude,
    /* raw RNG for custom use */
    range: function (min, max) { var r = makeRng(state.seed)(); return min + Math.floor(r * (max - min + 1)); },
    float: function (min, max) { var r = makeRng(state.seed)(); return min + r * (max - min); },
    pick: function (items) { var r = makeRng(state.seed)(); return items[Math.floor(r * items.length)]; },
    chance: function (p) { var r = makeRng(state.seed)(); return r < p; }
  };
}
