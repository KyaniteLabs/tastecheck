# OKLCH Ramp Generator

Drop-in math to produce a ramp for any hue, with a chroma taper and hex fallback.

## JS (browser/Node) — emits CSS variables
```js
// hue in degrees; returns {50..900} OKLCH strings
function ramp(hue) {
  const stops = [50,100,200,300,400,500,600,700,800,900];
  const Ls    = [0.97,0.93,0.86,0.78,0.70,0.62,0.54,0.46,0.38,0.30];
  // chroma rises to mid then falls (taper)
  const Cs    = [0.02,0.04,0.07,0.10,0.14,0.16,0.16,0.14,0.11,0.08];
  const out = {};
  stops.forEach((s,i) => out[s] = `oklch(${Ls[i]} ${Cs[i]} ${hue})`);
  return out;
}
// neutrals = same hue, tiny chroma
function neutrals(hue) {
  const Ls = {50:0.98,200:0.90,500:0.62,800:0.32,950:0.18};
  const o={}; for (const k in Ls) o[k]=`oklch(${Ls[k]} 0.01 ${hue})`; return o;
}
// print CSS
const b = ramp(250);
console.log(Object.entries(b).map(([k,v])=>`  --brand-${k}: ${v};`).join("\n"));
```

## Python — same, plus print
```python
def ramp(hue):
    stops=[50,100,200,300,400,500,600,700,800,900]
    Ls=[0.97,0.93,0.86,0.78,0.70,0.62,0.54,0.46,0.38,0.30]
    Cs=[0.02,0.04,0.07,0.10,0.14,0.16,0.16,0.14,0.11,0.08]
    return {s:f"oklch({l} {c} {hue})" for s,l,c in zip(stops,Ls,Cs)}

for s,v in ramp(250).items():
    print(f"  --brand-{s}: {v};")
```

## Hex fallback
Use a CSS tool (PostCSS `@csstools/postcss-oklab-function`) to emit sRGB hex before each
OKLCH line, or convert via `culori` (JS): `import {formatHex, oklch} from 'culori'` →
`formatHex(oklch({l,c,h}))`.

## Harmony helper
```js
const analogous   = h => [(h+330)%360, h, (h+30)%360];
const complement  = h => (h+180)%360;
const triad       = h => [h,(h+120)%360,(h+240)%360];
```

## Usage
1. Pick brand hue (e.g. 250). Generate brand ramp + neutrals(250).
2. Pick accent hue via a harmony helper; generate its ramp.
3. Add semantic state colors at matched L/C (success ~150, error ~25, warning ~85,
   info ~230).
4. Map semantic tokens (`--color-primary: var(--brand-600)`).
5. Verify contrast on real pairs.
