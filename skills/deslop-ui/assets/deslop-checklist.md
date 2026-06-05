# Deslop UI — Fast Checklist

Copy into a PR description or run mentally before shipping any UI.

## Kill these (each is a tell)
- [ ] Pill-shaped TEXT CTA (`rounded-full` / 9999px) → 6–10px radius
- [ ] Indigo→violet gradient, esp. on white → one committed hue
- [ ] Headline font Inter / Roboto / Arial / Open Sans / system → distinctive face
- [ ] Centered hero + 3 equal icon cards → asymmetry, varied sizes
- [ ] `shadow-2xl` / heavy shadow on most cards → one elevation system, mostly flat
- [ ] Same radius on everything → 2–3-step radius scale by role
- [ ] Glassmorphism as default card style → use once on purpose, or remove
- [ ] Background gradient blobs / floating orbs → texture, flat field, image, or none
- [ ] Emoji section headers (🚀 ✨ 💡) → real headings / consistent icon set
- [ ] Gradient text headlines → solid or subtle within-hue
- [ ] Default untouched Tailwind slate/gray → semantic, hue-tinted tokens
- [ ] Timid type scale (H1 ~1.5× body) → 3×+ size & weight-extreme contrast

## Function (slop you feel, not see)
- [ ] Forms have required markers + validation + error/empty/loading states
- [ ] Realistic varied content (no Lorem ipsum, no 3× "John Doe")
- [ ] Visible `:focus-visible`, alt text, labels

## Commit (the positive half)
- [ ] I can name the aesthetic in one concrete phrase
- [ ] One dominant color + one sharp accent (not 5 timid pastels)
- [ ] Real type contrast (3×+ size, 800-vs-300 weight)
- [ ] One signature move, not five scattered micro-effects
