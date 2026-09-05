# Correctness findings — luna

Verdict: RETROFIT-NEEDED yes — the focused scripts expose multiple false-pass and fail-open paths; the repository verifier also fails on the authoritative pre-existing `deslop-ui` deletions.

## Findings

### LUNA-001 — P1 — CLI lint silently accepts unknown skill references

File: `tools/lint-skills.mjs:69-77`

Verbatim evidence:

```js
for (const [, token] of text.matchAll(kebab)) {
  if (KNOWN_STALE.has(token)) {
    findings.push({ level: "fail", file: rel(path), message: `stale skill reference \`${token}\`` });
    continue;
  }
  // Only treat as a skill ref if it matches a real/external skill name or LOOKS like
  // one we'd expect (avoid flagging CSS terms like `focus-visible`).
  if (skillNames.includes(token) || EXTERNAL_OK.has(token)) continue;
}
```

Why: every unknown backticked kebab-case token falls through without a finding. The strict implementation in `tools/lib/skill-lint.mjs:104-131` is not imported by this CLI, while `package.json:10` runs this weaker CLI. Adding `` `future-color-engine` `` to any `SKILL.md` leaves `node tools/lint-skills.mjs` and the default lint lane green.

Fix sketch: make the CLI call the exported library implementation, or share one checker; run the existing unknown-reference fixture through the default package test.

### LUNA-002 — P1 — Landing and integration contracts scan source text, not the live surface

Files: `tools/verify-landing.mjs:31,40-42,65-73`; `tools/verify-integration.mjs:25,35-37,60-67`

Verbatim evidence:

```js
const covered = new Set([...html.matchAll(/data-skill="([^"]+)"/g)].map((match) => match[1]));
const countPattern = new RegExp(`skillCount:\\s*${landingSkills.length}\\b`);
const exposesFunction = html.includes(`${fn}:`) || new RegExp(`\\b${fn}\\s*,`).test(html);
```

Why: HTML comments, dead JavaScript strings, and non-rendered nodes satisfy coverage, `skillCount`, `data-test`, and function-presence checks. For example, deleting a visible skill card but leaving `<!-- data-skill="color-system" -->` passes coverage; leaving `// setTheme: null` passes the operator-function check. The scripts never parse the DOM or call the exposed browser contract.

Fix sketch: use a real browser/DOM fixture to query visible nodes and evaluate the named contract object; require callable functions and controls with the expected element roles.

### LUNA-003 — P1 — Form-name checks accept empty labels, dangling references, and omit textareas

Files: `tools/verify.mjs:267-272`; `tools/verify-landing.mjs:87-92`; `tools/verify-integration.mjs:81-86`

Verbatim evidence:

```js
const named = /\baria-label=|\baria-labelledby=/i.test(tag) || (id && labels.has(id));
if (!named) fail(`${rel(path)} has unnamed input: ${tag}`);
```

Why: `aria-label=""` and `aria-labelledby="missing-id"` both pass without an accessible name. The landing and integration regexes inspect only `input|select`, and the repository-wide demo check inspects only `input`, so an unnamed `<textarea>` is invisible to these gates.

Fix sketch: parse controls, require a non-empty `aria-label` or at least one existing non-empty `aria-labelledby` target, resolve label-for/wrapping semantics, and include `textarea`.

### LUNA-004 — P1 — Skip-link verification omits current pages and ignores hidden ancestors

File: `tools/verify.mjs:331-350`

Verbatim evidence:

```js
const pages = [
  "index.html",
  "samples/copper/index.html",
  "samples/swiss/index.html",
  "samples/maximal/index.html",
  "samples/concrete/index.html",
  "samples/clay/index.html",
  "samples/dispatch/index.html",
];
const first = [...body.matchAll(focusableTag)].map((match) => match[0]).find((tag) => {
  if (/\bhidden\b|\bdisabled\b|\btabindex\s*=\s*["']?-1/i.test(tag)) return false;
```

Why: the repository currently contains `samples/index.html`, `samples/verge/index.html`, and `samples/tasteroll/index.html`, but none is checked. The raw tag scan also treats `<div hidden><a class="skip" href="#main">...</a></div>` as the first focusable control because it checks only the anchor’s own attributes. A missing or unreachable skip link on those surfaces can therefore pass.

Fix sketch: enumerate pages from the repository/manifest and run the check in a browser, accounting for ancestor `display`, `visibility`, `inert`, and focus order.

### LUNA-005 — P1 — Installer deletes unrelated symlinks without backup or target validation

File: `install.sh:104-106`

Verbatim evidence:

```bash
if [ -L "$dest" ]; then
  rm "$dest"
fi
```

Why: any existing symlink is removed, even when it points to another agent pack or a user-maintained checkout. The documented `--force` backup protection applies only to non-symlinks, and the deletion occurs before the new link is created. Running the installer normally against `~/.agents/skills/theming -> /other/repo/skills/theming` destroys that link with no backup.

Fix sketch: keep an already-correct `$src` link; abort or back up a wrong symlink unless an explicit replacement decision is supplied, and make replacement atomic where possible.

### LUNA-006 — P1 — NIMA endpoint disagrees with its own startup instruction

File: `tools/lib/nima.mjs:4-5,12`

Verbatim evidence:

```js
//   python3 ~/launchpad/docs/neural-beauty-engine/nima_service.py   # :8765
const NIMA_BASE = "http://127.0.0.1:8767";
```

Why: following the documented service startup leaves the client probing a different port. `isNimaAvailable()` then returns false and every release screenshot receives a silent `n/a` aesthetic result, which is indistinguishable from an intentionally unavailable optional heuristic.

Fix sketch: align the default port and documentation, or make the endpoint an explicit validated configuration with the selected endpoint recorded in the receipt.

### LUNA-007 — P1 — NIMA accepts out-of-contract scores and malformed payloads

File: `tools/lib/nima.mjs:42-56,66-68`

Verbatim evidence:

```js
// POST raw image bytes to /score → { score, histogram } | null.
const payload = await response.json();
if (typeof payload?.score !== "number") return null;
return payload;
```

Why: the documented score domain is 1–10, but `{"score":11,"histogram":"bad"}` is accepted and `aestheticStatus(11)` returns `"ok"`; JSON `1e309` becomes `Infinity` and is also accepted. A broken or hostile local service can therefore clear the aesthetic lane with an invalid score, while the promised malformed-payload degradation does not occur.

Fix sketch: require a finite score in the inclusive 1–10 range and validate the histogram shape (or explicitly remove it from the contract) before returning a measurement.

### LUNA-008 — P2 — `combinedVerdict` converts an unknown gate state into CLEAN

File: `tools/lib/nima.mjs:87-91`

Verbatim evidence:

```js
const gateVerdict = gate?.verdict ?? "CLEAN";
if (gateVerdict === "FAIL") return "FAIL";
if (gateVerdict === "REVIEW WARNS" || nimaVerdict(nimaScore) === "warn") return "REVIEW WARNS";
return "CLEAN";
```

Why: `{ verdict: "CORRUPT" }` with no NIMA score returns `CLEAN`. Only nullish absence is a reasonable default; an unrecognized gate result must not be promoted to a passing verdict.

Fix sketch: allow only `CLEAN`, `REVIEW WARNS`, and `FAIL`; return a fail-closed error/result for any other value.

### LUNA-009 — P1 — Gate audit suppresses a visible error when any hidden descendant exists

File: `skills/tastecheck-pass/assets/gate-audit.js:50-60`

Verbatim evidence:

```js
if(hiddenHits.some(h=>h===el||h.contains(el)||el.contains(h)))return;
```

Why: for `<div class="error">Bad email<span hidden>old hint</span></div>`, the visible error candidate contains a hidden descendant, so `el.contains(h)` suppresses the entire candidate. The fresh-load audit can report CLEAN despite visible error text.

Fix sketch: suppress only candidates that are themselves hidden or descendants of a hidden element; do not suppress an outer visible candidate merely because it contains unrelated hidden content.

### LUNA-010 — P1 — A11y color-path guard misses the ordinary numeric regex regression it claims to prevent

File: `tools/verify.mjs:304-314`

Verbatim evidence:

```js
if (/match\(\s*\/\\?\[\\?d/.test(text)) fail(`${rel(path)} still parses colors with numeric regex`);
if (!/getImageData/.test(text)) fail(`${rel(path)} does not rasterize CSS colors before luminance`);
```

Why: the guard detects a narrow character-class spelling such as `/[\\d/`, but not the conventional `c.match(/\\d+/g)` parser. A regression can retain an unrelated/dead `getImageData` string and pass `new Function` plus both textual checks while runtime contrast still parses CSS colors numerically.

Fix sketch: execute the color parser against named colors, hex, rgb(), alpha, and CSS functions in a browser fixture, and couple the rasterization assertion to the actual contrast path instead of source substrings.

### LUNA-011 — P2 — Node verifier roots are URL-encoded and not Windows-safe

Files: `tools/verify.mjs:7`; `tools/lint-skills.mjs:8`; `tools/verify-landing.mjs:5`; `tools/verify-integration.mjs:5`; `tools/verify-gate-audit.mjs:17`

Verbatim evidence:

```js
const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
```

Why: a checkout path containing a space is exposed as `%20` in `.pathname`, so file reads resolve the wrong path; Windows file URLs also produce a leading slash and drive-letter form that is not a native path. The focused verification scripts fail before checking the repository in those environments.

Fix sketch: use `fileURLToPath(new URL("..", import.meta.url))` everywhere and retain native path operations thereafter.

### LUNA-012 — P2 — HTML fragment links are falsely reported missing

File: `tools/verify.mjs:213-220`

Verbatim evidence:

```js
...text.matchAll(/\b(?:href|src)=["'](?!https?:|mailto:|#|data:)([^"']+)["']/g)
const target = join(dir, href.split("?")[0]);
```

Why: the HTML example names `../index.html#main` as a valid local file plus fragment, but the verifier stats a path literally ending in `#main`. The Markdown branch strips fragments in its regex; the HTML branch does not, making equivalent links behave inconsistently.

Fix sketch: strip both query and fragment (`split(/[?#]/)[0]`) for HTML candidates, then URL-decode the path before statting it.

### LUNA-013 — P2 — Gate audit never scans body-level card/stat groups

File: `skills/tastecheck-pass/assets/gate-audit.js:82-86,110-116`

Verbatim evidence:

```js
document.querySelectorAll('body *').forEach(parent=>{
  const kids=[...parent.children].filter(visible);
```

Why: CSS selector `body *` excludes the `<body>` element itself. Three equal bordered cards or numeric stat children directly under `body` are therefore never considered by checks 6 or 7, even though the comments describe those checks as page-wide.

Fix sketch: include `document.body` in the parent candidates or query all elements and explicitly add the body.

### LUNA-014 — P2 — Gradient detection is defeated by modern color serialization and case variation

File: `skills/tastecheck-pass/assets/gate-audit.js:153-158`

Verbatim evidence:

```js
if(bg.includes('gradient')&&(/99[,\s]+102[,\s]+241|129[,\s]+140[,\s]+248|#6366f1|#818cf8/.test(bg))&&(/168[,\s]+85[,\s]+247|192[,\s]+132[,\s]+252|#a855f7|#c084fc/.test(bg))){
```

Why: the check recognizes only a few literal RGB/hex spellings, with case-sensitive hex. A computed `linear-gradient(oklch(...), oklch(...))`, CSS-variable result serialized with modern color syntax, or uppercase `#6366F1`/`#A855F7` bypasses the canonical indigo-to-violet gradient warning.

Fix sketch: parse computed gradient stops into colors and compare normalized color values, or render a minimal sample and inspect its resolved pixels.

### LUNA-015 — P2 — Installer smoke test proves only a small subset of the installer contract

File: `tools/verify.mjs:124-138`

Verbatim evidence:

```js
for (const h of [".agents", ".claude"]) {
  for (const skill of ["theming", "web-typography", "data-viz", "improve-existing-website"]) {
try {
  statSync(join(home, ".claude", "commands", "improvesite.md"));
```

Why: the installer discovers and links all current skills and all command files, but the smoke test verifies only four skills, only two homes, and existence (not symlink target) of one command. An installer that omits the other skills/commands or installs a wrong regular file still passes this smoke lane.

Fix sketch: derive expected skill and command sets from the repository, assert every expected symlink and target in each applicable home, and test uninstall/replacement behavior.

### LUNA-016 — P1 — Current authoritative tree cannot pass its own repository verifier

File: `tools/verify.mjs:48-54`; evidence: `_retrofit-2026-09-04/scratch-verify.log`

Verbatim evidence:

```js
for (const match of text.matchAll(/(?:references|assets)\/[A-Za-z0-9._/-]+/g)) {
  const target = join(dir, match[0]);
  try {
    statSync(target);
  } catch {
    fail(`${rel(skillPath)} references missing ${match[0]}`);
```

Why: the authoritative `verify.mjs` run exited 1 with nine failures because the working tree has the known unstaged deletions under `skills/deslop-ui/` (`contract.json` and four referenced files). This leaves the required verification gate red; the files are user-owned dirty state and were not restored or committed.

Fix sketch: stage-3 owner action must either restore the deleted resources or update `deslop-ui/SKILL.md` and its contract together, then rerun the full verifier.

### LUNA-017 — P1 — Skill frontmatter checks are not bounded to frontmatter

File: `tools/verify.mjs:35-46`

Verbatim evidence:

```js
const frontmatterName = text.match(/^name:\s*(.+)$/m)?.[1]?.trim();
const description = text.match(/^description:\s*>-\n([\s\S]*?)\n---/m)?.[1]
  ?.replace(/\n\s*/g, " ")
  ?.trim() ?? "";
if (!/^description:\s*>-/m.test(text)) fail(`${rel(skillPath)} missing folded description`);
```

Why: `name` and `description` are searched across the whole file rather than the parsed `---` frontmatter block. A malformed skill with no valid frontmatter can put `name: <directory>` and a folded-looking `description` later in prose before a horizontal rule and pass this structure gate.

Fix sketch: require opening and closing frontmatter delimiters, parse only that block, and reuse the bounded parser already present in `tools/lib/skill-lint.mjs`.

## Coverage swept

Inspected `tools/verify.mjs`, `tools/lint-skills.mjs`, `tools/lib/skill-lint.mjs`, `tools/verify-landing.mjs`, `tools/verify-integration.mjs`, `tools/verify-gate-audit.mjs`, `tools/lib/nima.mjs`, `skills/tastecheck-pass/assets/gate-audit.js`, `install.sh`, and `package.json` scripts. Also checked current sample-page inventory, NIMA consumer behavior, the gate-audit fake-DOM harness, the smoke fixture documentation, and the package lock metadata without modifying user-owned files.

Offline verifier receipts:

- `scratch-verify.log`: exit 1; nine known `deslop-ui` missing-resource/link failures.
- `scratch-lint-skills.log`: exit 0.
- `scratch-verify-landing.log`: exit 0.
- `scratch-verify-integration.log`: exit 0.
- `scratch-verify-gate-audit.log`: exit 0.
- `scratch-nima-legacy.log`: exit 0.
- `scratch-nima-node-test.log`: exit 0.
- `scratch-npm-test.log`: exit 1 before the focused verifiers because local `playwright` is not installed (`ERR_MODULE_NOT_FOUND` in `test:oracle-capture`).

## Unknowns

- No real browser render was run because the local Playwright dependency is absent; layout-dependent gate behavior remains unverified beyond the committed fake-DOM harness and source audit.
- No network or live NIMA service was used; endpoint reachability and the actual service port require owner-side confirmation.
- No files outside `_retrofit-2026-09-04/` were modified; the known dirty tree remains intact.
