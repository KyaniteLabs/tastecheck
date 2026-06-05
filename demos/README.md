# Demos

Standalone HTML pages that apply the **actual CSS assets** from the skills (no build
step — open any file in a browser). These are the pages used in end-to-end
verification; rendered screenshots live in [`../docs/screenshots/`](../docs/screenshots/).

| Demo | Exercises |
|------|-----------|
| `01-foundations.html` | color-system tokens + dark-mode surfaces + web-typography (measure, fluid heading). Click "Toggle theme". |
| `02-states.html` | component-states full matrix: default/disabled/loading button, link, input + error, selected tab, toggles. |
| `03-responsive.html` | responsive-layout intrinsic patterns: auto-fit grid + sidebar (resize the window — no breakpoints needed). |
| `04-motion-forms-empty.html` | micro-motion skeleton shimmer, empty-states empty screen, form-ux labeled field with inline error. |
| `05-deslop.html` | deslop-ui before/after: pill+purple+emoji+shadow-2xl vs 8px+committed hue+flat. |

Every demo renders with **zero console errors** at 390 / 768 / 1280px and in dark mode.
See [`../docs/VERIFICATION.md`](../docs/VERIFICATION.md).
