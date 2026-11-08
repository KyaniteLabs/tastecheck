/**
 * Tastecheck — desktop half: Taste Roll comparison workspace.
 *
 * The user clicks "Taste Roll" (composer button or command palette). We read
 * THEIR project's HTML inside the session workspace (via the SDK folder grant —
 * never the canned demo page), open a workspace pane (stable id
 * `tastecheck:tasteroll`) and show their unchanged page as the left column.
 * Every later click appends one more restyled column to the right; previous
 * columns stay. Each column is an iframe sandboxed exactly like the built-in
 * preview frame: sandbox="allow-forms allow-scripts", allow="fullscreen",
 * referrerPolicy="no-referrer" — opaque origin, no same-origin access.
 *
 * Each rolled column is also GATED: its exact srcdoc is POSTed to this plugin's
 * own backend namespace (`ctx.rest('/roll-audit')` → the agent half's audit on
 * an installed browser) and the column header is stamped SHIP or HOLD with its
 * reasons. Fail closed — a missing REST surface, a busy gate or any error is a
 * visible HOLD, never a silent pass, and a HOLD column stays visible.
 *
 * The roll system is the one merged on KyaniteLabs/tastecheck main (PR #35
 * head c41683068357258a7dae582de1a41191ae2153fe, incl. the #37–#39 QA
 * refinements): the verbatim seeded xoshiro128++ engine from
 * skills/tasteroll/assets/tasteroll-engine.js and the data-ref / data-vibe /
 * data-mode / data-sig token system from tasteroll.html, applied to the user's
 * own markup through valid attributes on their real <html> element.
 *
 * Surface resolution (no active-file SDK seam exists): the newest-edited HTML
 * in the session workspace is "the surface they are actually on"; if the
 * newest edit is CSS, the nearest HTML to that CSS is used and named. Nothing
 * outside the session workspace is ever read, tasteroll.html is never eligible,
 * and a workspace with no HTML gets an honest strip that says so.
 *
 * No network, no telemetry, no raw bridge. Sensitive doors used: the folder
 * grant (ctx.files), host.openWorkspace (feature-detected BEFORE any side
 * effect) and ctx.rest to this plugin's own namespace.
 */

import { COMPOSER_AREAS, GHOST_ICON_BTN, PALETTE_AREA, host } from '@hermes/plugin-sdk'
import { createElement as h } from 'react'

/* tasteroll — seeded PRNG engine with lock/reroll support (xoshiro128++)
   Verbatim from skills/tasteroll/assets/tasteroll-engine.js @ 5168f89
   (KyaniteLabs/tastecheck main). Zero-dependency, deterministic:
   same seed → same roll, always. */
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

  return {
    get seed() { return state.seed; },
    roll: rollAll
  };
}

/* Faces from tools/tasteroll/faces.mjs @ 5168f89 (the live-demo dimension set). */
const FACES = {
  ref: ['mineral', 'Swiss', 'brutalist', 'folio', 'shipping', 'clinical', 'humanist', 'maximalist'],
  vibe: ['warm', 'serious', 'playful', 'refined', 'stark', 'editorial', 'operational', 'decorative'],
  mode: ['light', 'dark', 'dual'],
  sig: ['needle', 'rule', 'display-word', 'color-block', 'bento', 'timeline', 'annotation', 'sixling']
}

/* Token system from tasteroll.html @ 5168f89 (values verbatim), plus a generic
   application layer so the tokens restyle ARBITRARY user markup. Applied only
   inside rolled columns, driven by the same html[data-ref][data-vibe][data-mode]
   [data-sig] attributes. */
const ROLL_CSS = `
html[data-taste-roll]{--bg:#fff;--s1:#fff;--s2:#f3f3f3;--line:#ddd;--line-strong:#999;--ink:#111;--muted:#555;--acc:#055;--on-acc:#fff}
html[data-taste-roll][data-mode="light"]{--bg:#f6f2ea;--s1:#fffdf8;--s2:#ece5d8;--line:#d8cfbd;--line-strong:#9c917e;--ink:#211b13;--muted:#574d3f}
html[data-taste-roll][data-mode="dark"]{--bg:#17120e;--s1:#211a14;--s2:#2b231b;--line:#413528;--line-strong:#7d6e5a;--ink:#f4ede2;--muted:#b6a690}
html[data-taste-roll][data-mode="dual"]{--bg:#14100c;--s1:#1e1811;--s2:#282019;--line:#3c3126;--line-strong:#7d6e5a;--ink:#f4ede2;--muted:#b6a690}
html[data-taste-roll][data-ref="mineral"]{--acc-l:#8a5c10;--acc-d:#e0a54c;--on-l:#fffaf0;--on-d:#241703;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:Georgia,"Times New Roman",serif}
html[data-taste-roll][data-ref="Swiss"]{--acc-l:#2057b6;--acc-d:#79acff;--on-l:#fffdf8;--on-d:#0a1428;--font:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;--font-display:"Helvetica Neue",Helvetica,Arial,system-ui,sans-serif}
html[data-taste-roll][data-ref="brutalist"]{--acc-l:#bd3d10;--acc-d:#ff7a45;--on-l:#fffdf8;--on-d:#200b02;--font:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;--font-display:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
html[data-taste-roll][data-ref="folio"]{--acc-l:#97482a;--acc-d:#e5946c;--on-l:#fffaf2;--on-d:#26100a;--font:Georgia,"Times New Roman",serif;--font-display:Georgia,"Times New Roman",serif}
html[data-taste-roll][data-ref="shipping"]{--acc-l:#0c6b52;--acc-d:#3ec89c;--on-l:#fffdf8;--on-d:#03201a;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:system-ui,-apple-system,"Segoe UI",sans-serif}
html[data-taste-roll][data-ref="clinical"]{--acc-l:#0d697f;--acc-d:#5fbcd6;--on-l:#fffdf8;--on-d:#041c22;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:system-ui,-apple-system,"Segoe UI",sans-serif}
html[data-taste-roll][data-ref="humanist"]{--acc-l:#3d6a33;--acc-d:#92cc86;--on-l:#fffdf8;--on-d:#0c1c0a;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:Georgia,"Times New Roman",serif}
html[data-taste-roll][data-ref="maximalist"]{--acc-l:#ae2262;--acc-d:#ff79ae;--on-l:#fffaf2;--on-d:#260512;--font:system-ui,-apple-system,"Segoe UI",sans-serif;--font-display:Georgia,"Times New Roman",serif}
html[data-taste-roll][data-mode="light"]{--acc:var(--acc-l);--on-acc:var(--on-l)}
html[data-taste-roll][data-mode="dark"]{--acc:var(--acc-d);--on-acc:var(--on-d)}
html[data-taste-roll][data-mode="dual"]{--acc:var(--acc-d);--on-acc:var(--on-d)}
html[data-taste-roll][data-vibe="warm"]{--radius:6px;--lh:1.7;--fw-h:700;--track:0;--density:1.05;--sp:1.05rem}
html[data-taste-roll][data-vibe="serious"]{--radius:2px;--lh:1.55;--fw-h:700;--track:-.012em;--density:.95;--sp:.85rem}
html[data-taste-roll][data-vibe="playful"]{--radius:6px;--lh:1.65;--fw-h:800;--track:.012em;--density:1.1;--sp:1.15rem}
html[data-taste-roll][data-vibe="refined"]{--radius:4px;--lh:1.65;--fw-h:600;--track:0;--density:1;--sp:.95rem}
html[data-taste-roll][data-vibe="stark"]{--radius:0px;--lh:1.5;--fw-h:700;--track:.022em;--density:.85;--sp:.8rem}
html[data-taste-roll][data-vibe="editorial"]{--radius:2px;--lh:1.7;--fw-h:600;--track:0;--density:1.05;--sp:1rem}
html[data-taste-roll][data-vibe="operational"]{--radius:3px;--lh:1.5;--fw-h:600;--track:0;--density:.9;--sp:.7rem}
html[data-taste-roll][data-vibe="decorative"]{--radius:8px;--lh:1.75;--fw-h:800;--track:.02em;--density:1.15;--sp:1.25rem}
html[data-taste-roll] body{margin:0;background:var(--bg);color:var(--ink);font:400 1.02rem/var(--lh,1.6) var(--font,system-ui,sans-serif);letter-spacing:var(--track,0)}
html[data-taste-roll] h1,html[data-taste-roll] h2,html[data-taste-roll] h3,html[data-taste-roll] h4{font-family:var(--font-display,var(--font,system-ui));font-weight:var(--fw-h,700);line-height:1.15;letter-spacing:calc(var(--track,0) * .5)}
html[data-taste-roll] h1{font-size:2.2em;margin:.65em 0 .35em}
html[data-taste-roll] h2{font-size:1.6em;margin:1em 0 .4em;border-bottom:1px solid var(--line);padding-bottom:.25em}
html[data-taste-roll] h3{font-size:1.25em;margin:1em 0 .35em}
html[data-taste-roll] a{color:var(--acc);text-decoration:underline;text-underline-offset:.18em}
html[data-taste-roll] a:hover{color:var(--ink)}
html[data-taste-roll] :focus-visible{outline:2px solid var(--acc);outline-offset:2px}
html[data-taste-roll] button,html[data-taste-roll] input[type="button"],html[data-taste-roll] input[type="submit"]{background:var(--acc);color:var(--on-acc);border:0;border-radius:var(--radius,4px);padding:.55em 1.1em;font:inherit;font-weight:600;cursor:pointer}
html[data-taste-roll] button:hover{filter:brightness(1.08)}
html[data-taste-roll] input,html[data-taste-roll] select,html[data-taste-roll] textarea{background:var(--s1);color:var(--ink);border:1px solid var(--line-strong);border-radius:var(--radius,4px);padding:.5em .7em;font:inherit}
html[data-taste-roll] code,html[data-taste-roll] pre,html[data-taste-roll] kbd,html[data-taste-roll] samp{font:400 .92em/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--s2);border-radius:calc(var(--radius,4px) / 2)}
html[data-taste-roll] pre{padding:calc(var(--sp,1rem) * .8);overflow:auto;border:1px solid var(--line)}
html[data-taste-roll] code{padding:.12em .35em}
html[data-taste-roll] blockquote{margin:calc(var(--sp,1rem) * 1.4) 0;padding:.2em 0 .2em calc(var(--sp,1rem) * 1.2);border-left:3px solid var(--acc);color:var(--muted);font-style:italic}
html[data-taste-roll] hr{border:0;border-top:1px solid var(--line-strong);margin:calc(var(--sp,1rem) * 1.6) 0}
html[data-taste-roll] table{border-collapse:collapse;width:100%}
html[data-taste-roll] th{background:var(--s2);text-align:left;font-weight:var(--fw-h,700)}
html[data-taste-roll] th,html[data-taste-roll] td{border:1px solid var(--line);padding:calc(var(--sp,1rem) * .5) calc(var(--sp,1rem) * .7)}
html[data-taste-roll] img{max-width:100%;height:auto;border-radius:var(--radius,4px)}
html[data-taste-roll] section,html[data-taste-roll] article{margin:calc(var(--sp,1rem) * 1.2) 0;line-height:var(--lh,1.6)}
html[data-taste-roll] header,html[data-taste-roll] nav,html[data-taste-roll] main,html[data-taste-roll] footer{box-sizing:border-box}
html[data-taste-roll] main,html[data-taste-roll] body{padding:0}
html[data-taste-roll] main{max-width:72ch;margin:0 auto;padding:calc(var(--sp,1rem) * 1.5)}
html[data-taste-roll] ul,html[data-taste-roll] ol{padding-left:1.4em}
html[data-taste-roll] li{margin:.3em 0}
html[data-taste-roll][data-sig="needle"]{border-left:4px solid var(--acc)}
html[data-taste-roll][data-sig="needle"] body{padding-left:calc(var(--sp,1rem) * 1.1)}
html[data-taste-roll][data-sig="rule"] h2{border-bottom:2px solid var(--ink)}
html[data-taste-roll][data-sig="rule"] h1{border-bottom:4px double var(--ink);padding-bottom:.3em}
html[data-taste-roll][data-sig="display-word"] h1{font-size:3em;text-transform:uppercase;letter-spacing:.04em}
html[data-taste-roll][data-sig="display-word"] h2{font-size:1.9em}
html[data-taste-roll][data-sig="color-block"] h1{background:var(--acc);color:var(--on-acc);display:inline-block;padding:.25em .5em;border-radius:var(--radius,4px)}
html[data-taste-roll][data-sig="color-block"] header,html[data-taste-roll][data-sig="color-block"] nav{background:var(--acc);color:var(--on-acc);padding:calc(var(--sp,1rem) * .8) calc(var(--sp,1rem) * 1.1)}
html[data-taste-roll][data-sig="color-block"] header a,html[data-taste-roll][data-sig="color-block"] nav a{color:var(--on-acc)}
html[data-taste-roll][data-sig="bento"] body{display:grid;grid-template-columns:repeat(auto-fit,minmax(16rem,1fr));gap:var(--sp,1rem);align-items:start}
html[data-taste-roll][data-sig="bento"]>*{margin:0;border:1px solid var(--line);border-radius:var(--radius,4px);padding:calc(var(--sp,1rem) * .9);background:var(--s1)}
html[data-taste-roll][data-sig="bento"] h1{grid-column:1/-1;font-size:1.8em}
html[data-taste-roll][data-sig="timeline"] body{position:relative;padding-left:calc(var(--sp,1rem) * 2.4)}
html[data-taste-roll][data-sig="timeline"] body::before{content:"";position:absolute;left:calc(var(--sp,1rem) * 1.1);top:0;bottom:0;width:2px;background:var(--acc)}
html[data-taste-roll][data-sig="timeline"] section,html[data-taste-roll][data-sig="timeline"] article{position:relative}
html[data-taste-roll][data-sig="timeline"] section::before,html[data-taste-roll][data-sig="timeline"] article::before{content:"";position:absolute;left:calc(var(--sp,1rem) * -1.55);top:.45em;width:.7em;height:.7em;border-radius:50%;background:var(--acc)}
html[data-taste-roll][data-sig="annotation"] blockquote{border:1px dashed var(--line-strong);border-left:3px solid var(--acc);background:var(--s2);border-radius:var(--radius,4px);padding:calc(var(--sp,1rem) * .8);font-style:italic}
html[data-taste-roll][data-sig="annotation"] h2::after{content:" *";color:var(--acc)}
html[data-taste-roll][data-sig="sixling"] body{column-count:2;column-gap:calc(var(--sp,1rem) * 2);column-rule:1px solid var(--line)}
html[data-taste-roll][data-sig="sixling"] h1{column-span:all}
`

/* ---- roll attribute surgery (R1) ------------------------------------------
 * Valid attributes ON the actual <html> element, preserving the user's
 * document: quote-aware tag scan, stale roll attributes stripped, one — and
 * only one — '>' emitted. No regex munging of the tag body. */
const ROLL_ATTR_NAMES = ['data-taste-roll', 'data-roll', 'data-ref', 'data-vibe', 'data-mode', 'data-sig']

function findTagEnd(html, from) {
  /* Index of the '>' closing the tag whose attributes start at `from`
   * (right after '<html'), honoring quoted attribute values. -1 = none. */
  let quote = null
  for (let i = from; i < html.length; i++) {
    const c = html[i]
    if (quote) { if (c === quote) quote = null; continue }
    if (c === '"' || c === "'") { quote = c; continue }
    if (c === '>') return i
  }
  return -1
}

function stripRollAttrs(attrText) {
  let out = String(attrText || '')
  for (const name of ROLL_ATTR_NAMES) {
    out = out.replace(new RegExp(`\\s+${name}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, 'gi'), '')
  }
  return out
}

function rollAttrString(roll, seed) {
  return ` data-taste-roll="1" data-roll="s${seed}" data-ref="${roll.ref}" data-vibe="${roll.vibe}" data-mode="${roll.mode}" data-sig="${roll.sig}"`
}

function buildRolledHtml(html, roll, seed) {
  const attrs = rollAttrString(roll, seed)
  const style = `<style id="tastecheck-roll">${ROLL_CSS}</style>`
  let out = String(html || '')
  const open = /<html[\s>]/i.exec(out)
  if (open) {
    const tagEnd = findTagEnd(out, open.index + 5)
    if (tagEnd >= 0) {
      const before = out.slice(0, open.index)
      const attrText = stripRollAttrs(out.slice(open.index + 5, tagEnd))
      const rest = out.slice(tagEnd + 1)
      out = `${before}<html${attrText}${attrs}>${rest}`
    } else {
      /* '<html' with no closing '>' anywhere: treat as text, wrap defensively. */
      out = `<html${attrs}><head><meta charset="utf-8"></head><body>${out}</body></html>`
    }
  } else if (/<body(\s[^>]*)?>/i.test(out)) {
    /* body without an html element: open one just before <body>, close at EOF. */
    out = out.replace(/<body(\s[^>]*)?>/i, (m) => `<html${attrs}>${m}`)
    if (!/<\/html\s*>/i.test(out)) out += '</html>'
  } else {
    out = `<html${attrs}><head><meta charset="utf-8"></head><body>${out}</body></html>`
  }
  if (/<\/head\s*>/i.test(out)) {
    out = out.replace(/<\/head\s*>/i, style + '</head>')
  } else if (/<body(\s[^>]*)?>/i.test(out)) {
    out = out.replace(/<body(\s[^>]*)?>/i, (m) => m + style)
  } else {
    out = style + out
  }
  return out
}

/* ---- module state --------------------------------------------------------- */
let pluginCtx = null
/* comparison = { cwd, file, filePath, why,
 *                columns: [{ seed, roll, srcdoc, verdict, reasons, error }],
 *                noHtml: { message } | undefined } */
let comparison = null
let inFlight = false

function storageKey(cwd) { return `roll:${cwd || '(detached)'}` }

function loadComparison(cwd) {
  if (!pluginCtx) return null
  const all = pluginCtx.storage.get('comparisons', {})
  const saved = all[storageKey(cwd)]
  if (!saved || !Array.isArray(saved.columns) || !saved.columns.length) return null
  comparison = saved
  return saved
}

function persistComparison() {
  if (!pluginCtx || !comparison) return
  /* Slim copy: seeds + rolls + file identity only. The HTML text, built column
   * srcdocs and verdicts are session state; srcdocs rebuild from the file on
   * the next click and verdicts re-audit, keeping storage small. */
  const slim = {
    cwd: comparison.cwd,
    file: comparison.file,
    filePath: comparison.filePath,
    why: comparison.why,
    columns: (comparison.columns || []).map((c) => ({ seed: c.seed, roll: c.roll }))
  }
  const all = pluginCtx.storage.get('comparisons', {})
  all[storageKey(comparison.cwd)] = slim
  pluginCtx.storage.set('comparisons', all)
}

/* ---- surface resolution (R3) ----------------------------------------------
 * The session workspace (host cwd) IS the boundary: candidates come from the
 * cwd subtree only — a folder grant wider than the cwd never leaks a sibling
 * project in. Newest mtime wins ("the surface they are actually on"); a CSS
 * newest edit maps to the nearest HTML, which is named in the strip header. */
const SKIP_DIRS = new Set(['node_modules', '.git', '.hermes', '__pycache__', 'dist', 'build', '.next'])

async function listDir(files, folderId, rel) {
  try {
    const res = await files.list(folderId, rel || undefined)
    if (!res || res.ok !== true || !Array.isArray(res.entries)) return null
    return res.entries
  } catch {
    return null
  }
}

async function collectFrontend(files, folderId, rootRel) {
  const rows = [] /* { rel, isCss } */
  const walk = async (rel, depth) => {
    if (depth > 4 || rows.length > 400) return
    const entries = await listDir(files, folderId, rel)
    if (!entries) return
    for (const e of entries) {
      if (e.isDirectory) {
        if (SKIP_DIRS.has(e.name)) continue
        await walk(rel ? `${rel}/${e.name}` : e.name, depth + 1)
      } else {
        if (/\.html?$/i.test(e.name) && e.name.toLowerCase() !== 'tasteroll.html') {
          rows.push({ rel: rel ? `${rel}/${e.name}` : e.name, isCss: false })
        } else if (/\.css$/i.test(e.name)) {
          rows.push({ rel: rel ? `${rel}/${e.name}` : e.name, isCss: true })
        }
      }
    }
  }
  await walk(rootRel, 0)
  return rows
}

async function statMs(files, folderId, rel) {
  try {
    const st = await files.stat(folderId, rel)
    if (!st || st.ok !== true || !st.exists) return -1
    return typeof st.mtimeMs === 'number' ? st.mtimeMs : 0
  } catch {
    return -1
  }
}

function nearestHtml(toRel, htmls) {
  /* Nearest HTML by shared-directory depth, same directory first; ties broken
   * by newest mtime, then shallower, then name — deterministic. */
  const dirOf = (p) => { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i) }
  const segs = (d) => (d ? d.split('/') : [])
  const cssDir = segs(dirOf(toRel))
  let best = null
  for (const row of htmls) {
    const htmlDir = segs(dirOf(row.rel))
    let shared = 0
    while (shared < cssDir.length && shared < htmlDir.length && cssDir[shared] === htmlDir[shared]) shared++
    const hops = (cssDir.length - shared) + (htmlDir.length - shared)
    const depth = row.rel.split('/').length
    const mtime = typeof row.mtime === 'number' ? row.mtime : -1
    if (!best
      || hops < best.hops
      || (hops === best.hops && mtime > best.mtime)
      || (hops === best.hops && mtime === best.mtime && depth < best.depth)) {
      best = { rel: row.rel, hops, depth, mtime }
    }
  }
  return best ? best.rel : null
}

async function resolveSurface(files, folderId, cwd, grantPath) {
  /* cwd relative to the grant; when the grant IS the cwd the root is ''. A cwd
   * outside the grant cannot happen (grantFor only returns covering grants). */
  const base = String(grantPath || '').replace(/\/+$/, '')
  const cwdAbs = String(cwd || '').replace(/\/+$/, '')
  if (!cwdAbs.startsWith(base)) return null
  const rootRel = cwdAbs.slice(base.length).replace(/^\/+/, '')
  const rows = await collectFrontend(files, folderId, rootRel)
  if (!rows.length) return null
  const capped = rows.slice(0, 120)
  const stats = await Promise.all(capped.map(async (r) => ({ ...r, mtime: await statMs(files, folderId, r.rel) })))
  const mtimeByRel = new Map(stats.map((s) => [s.rel, s.mtime]))
  const htmls = rows.filter((r) => !r.isCss).map((r) => ({ rel: r.rel, mtime: mtimeByRel.has(r.rel) ? mtimeByRel.get(r.rel) : -1 }))
  stats.sort((a, b) => b.mtime - a.mtime)
  const newest = stats.find((s) => s.mtime >= 0)
  if (!newest) {
    if (!htmls.length) return null
    htmls.sort((a, b) => b.mtime - a.mtime || a.rel.split('/').length - b.rel.split('/').length || (a.rel < b.rel ? -1 : 1))
    return { rel: htmls[0].rel, why: 'newest HTML in this workspace' }
  }
  if (!newest.isCss) {
    return { rel: newest.rel, why: `your latest edit (${newest.rel})` }
  }
  if (!htmls.length) return null
  const rel = nearestHtml(newest.rel, htmls)
  return { rel, why: `latest edit was ${newest.rel} → rolling its nearest HTML` }
}

async function grantFor(cwd) {
  const folders = await pluginCtx.files.folders()
  const granted = (folders || []).filter((f) => f && f.path && cwd && (cwd + '/').startsWith(f.path.replace(/\/+$/, '') + '/'))
  if (granted.length) return granted.sort((a, b) => b.path.length - a.path.length)[0]
  const asked = await pluginCtx.files.requestFolder()
  if (!asked || asked.ok !== true || !asked.folder) return null
  return asked.folder
}

/* ---- per-column gate (R2) --------------------------------------------------
 * The column's exact srcdoc goes to this plugin's own backend namespace; the
 * verdict comes back bound to evidence. Fail closed: missing REST, busy gate,
 * transport error or a malformed response all stamp a visible HOLD. */
async function auditColumn(col, fileLabel) {
  col.verdict = null
  col.reasons = []
  col.error = null
  openPane() /* show the pending state immediately */
  const rest = pluginCtx && typeof pluginCtx.rest === 'function' ? pluginCtx.rest.bind(pluginCtx) : null
  if (!rest) {
    col.verdict = 'HOLD'
    col.reasons = ['gate unavailable: plugin REST missing (install/enable the tastecheck-hermes agent half)']
    openPane()
    return
  }
  try {
    const res = await rest('/roll-audit', {
      method: 'POST',
      body: { html: col.srcdoc, label: `s${col.seed} ${col.roll.ref}/${col.roll.vibe}/${col.roll.mode}/${col.roll.sig} — ${fileLabel}` },
      timeoutMs: 300000
    })
    const verdict = res && typeof res === 'object' ? String(res.verdict || '') : ''
    if (verdict === 'SHIP' && res.ok === true) {
      col.verdict = 'SHIP'
      col.reasons = Array.isArray(res.hold_reasons) ? res.hold_reasons : []
      col.evidenceDir = res.evidence_dir || null
    } else if (verdict === 'HOLD') {
      col.verdict = 'HOLD'
      col.reasons = Array.isArray(res.hold_reasons) && res.hold_reasons.length
        ? res.hold_reasons
        : [String((res && res.error) || 'audit did not produce evidence')]
      col.evidenceDir = (res && res.evidence_dir) || null
    } else {
      col.verdict = 'HOLD'
      col.reasons = ['gate returned no valid verdict (fail closed)']
    }
  } catch (err) {
    col.verdict = 'HOLD'
    col.reasons = [`gate unreachable: ${(err && err.message) || err}`]
  }
  openPane() /* re-render with the stamp; the column stays visible either way */
}

async function runRoll() {
  if (inFlight || !pluginCtx) return
  /* R5: feature-detect the host capability BEFORE any side effect — no file
   * read, no roll, no persisted state when the host cannot show the pane. */
  if (typeof host.openWorkspace !== 'function') {
    host.notifyError('This Hermes Desktop build has no plugin workspace panes (host.openWorkspace). Taste Roll needs it to show the comparison beside your work.')
    return
  }
  inFlight = true
  try {
    const cwd = (host.state.cwd && host.state.cwd.get ? host.state.cwd.get() : '') || ''
    const folder = await grantFor(cwd)
    if (!folder) {
      host.notify('Taste Roll needs your project folder — grant it to roll your own page.')
      return
    }
    let current = comparison && comparison.cwd === cwd ? comparison : loadComparison(cwd)
    /* Sticky target: an existing comparison keeps its named file while it still
     * exists, so consecutive rolls iterate the same surface. */
    let target = null
    if (current && current.file) {
      const stat = await pluginCtx.files.stat(folder.id, current.file)
      if (stat && stat.ok === true && stat.exists) {
        target = { rel: current.file, why: current.why || 'same surface as your previous rolls' }
      }
    }
    if (!target) {
      target = await resolveSurface(pluginCtx.files, folder.id, cwd, folder.path)
    }
    if (!target) {
      /* R5: no HTML in the workspace — say so IN the strip, not only a toast. */
      comparison = { cwd, noHtml: { message: `No HTML in ${cwd || 'this workspace'} — Taste Roll restyles HTML surfaces. (tasteroll.html is never used.)` }, columns: [] }
      openPane()
      host.notify(comparison.noHtml.message)
      return
    }
    const read = await pluginCtx.files.readText(folder.id, target.rel)
    if (!read || read.ok !== true) {
      host.notifyError(`Taste Roll could not read ${target.rel}.`)
      return
    }
    const html = read.text
    const seed = (((Date.now() / 1000) >>> 0) ^ ((current ? current.columns.length : 0) + 1) * 2654435761) >>> 0
    const roll = tasteroll(seed).roll(FACES)
    if (!current) {
      current = { cwd, file: target.rel, filePath: `${folder.path}/${target.rel}`, why: target.why, columns: [] }
    } else {
      current.noHtml = undefined
      current.file = target.rel
      current.filePath = `${folder.path}/${target.rel}`
      current.why = target.why
    }
    current.originalHtml = html
    const col = { seed, roll, srcdoc: buildRolledHtml(html, roll, seed), verdict: null, reasons: [], error: null }
    current.columns.push(col)
    comparison = current
    try {
      openPane() /* the pane opens with the new column in PENDING state */
    } catch (openErr) {
      /* R5: the host refused — roll the column back; nothing persists. */
      current.columns.pop()
      comparison = current.columns.length || current.noHtml ? current : null
      host.notifyError(`Taste Roll could not open the comparison pane: ${(openErr && openErr.message) || openErr}`)
      return
    }
    persistComparison()
    host.notify(`Taste Roll ${roll.ref} / ${roll.vibe} / ${roll.mode} / ${roll.sig} (s${seed}) — column ${current.columns.length}, gate running…`)
    void auditColumn(col, target.rel)
  } catch (err) {
    host.notifyError(`Taste Roll failed: ${(err && err.message) || err}`)
  } finally {
    inFlight = false
  }
}

/* ---- the comparison pane (stable id; re-registering replaces + reveals) ---- */

const PANE_ID = 'tastecheck:tasteroll'

function ColumnFrame(props) {
  /* Sandbox mirrors the built-in preview frame exactly (preview-browser-frame.ts):
     allow-forms allow-scripts, allow="fullscreen", no-referrer — opaque origin. */
  return h('iframe', {
    srcDoc: props.srcdoc,
    sandbox: 'allow-forms allow-scripts',
    allow: 'fullscreen',
    referrerPolicy: 'no-referrer',
    title: props.label,
    style: { width: '100%', flex: '1 1 auto', border: 0, background: '#fff' }
  })
}

const STAMP_STYLE = {
  SHIP: { background: '#0c6b52', color: '#fff', padding: '.1rem .45rem', borderRadius: '.35rem', fontWeight: 700, fontSize: '.72rem', letterSpacing: '.04em' },
  HOLD: { background: '#bd3d10', color: '#fff', padding: '.1rem .45rem', borderRadius: '.35rem', fontWeight: 700, fontSize: '.72rem', letterSpacing: '.04em' },
  PENDING: { background: '#555', color: '#fff', padding: '.1rem .45rem', borderRadius: '.35rem', fontWeight: 600, fontSize: '.72rem', letterSpacing: '.04em' }
}

function ColumnHeader(props) {
  const { col, index } = props
  const kids = [
    h('div', { key: 'title', style: { display: 'flex', gap: '.45rem', alignItems: 'baseline', flexWrap: 'wrap' } },
      h('span', null, `Roll ${index + 1} · s${col.seed}`),
      h('span', { style: { opacity: .8 } }, `${col.roll.ref} · ${col.roll.vibe} · ${col.roll.mode} · ${col.roll.sig}`))
  ]
  if (col.verdict === 'SHIP') {
    kids.push(h('div', { key: 'stamp', style: { display: 'flex', gap: '.45rem', alignItems: 'center', marginTop: '.15rem' } },
      h('span', { style: STAMP_STYLE.SHIP }, 'SHIP'),
      h('span', { style: { opacity: .7, fontSize: '.7rem' } }, 'gate passed')))
  } else if (col.verdict === 'HOLD') {
    kids.push(h('div', { key: 'stamp', style: { display: 'flex', gap: '.45rem', alignItems: 'baseline', marginTop: '.15rem', flexWrap: 'wrap' } },
      h('span', { style: STAMP_STYLE.HOLD }, 'HOLD'),
      h('span', { style: { opacity: .8, fontSize: '.7rem' } }, (col.reasons || []).slice(0, 2).join(' · ') || 'held')))
  } else {
    kids.push(h('div', { key: 'stamp', style: { display: 'flex', gap: '.45rem', alignItems: 'center', marginTop: '.15rem' } },
      h('span', { style: STAMP_STYLE.PENDING }, col.restored ? 'GATE —' : 'GATE…'),
      h('span', { style: { opacity: .7, fontSize: '.7rem' } }, col.restored ? 'not audited this session (click Taste Roll to re-roll + gate)' : 'auditing this column')))
  }
  return h('div', { style: { padding: '.45rem .7rem', fontSize: '.78rem', fontWeight: 600, borderBottom: '1px solid var(--line, #ddd)' } }, kids)
}

function renderPane() {
  const cur = comparison
  if (!cur) {
    return h('div', { style: { padding: '1rem', opacity: .75 } },
      'Taste Roll — click “Taste Roll” above the composer to restyle your own page.')
  }
  if (cur.noHtml) {
    return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
      h('div', { style: { padding: '.5rem .8rem', fontSize: '.8rem', borderBottom: '1px solid var(--line, #ddd)', display: 'flex', gap: '1rem', alignItems: 'baseline' } },
        h('strong', null, 'Taste Roll')),
      h('div', { style: { padding: '1rem', opacity: .85, fontSize: '.85rem' } }, cur.noHtml.message))
  }
  if (!cur.columns.length) {
    return h('div', { style: { padding: '1rem', opacity: .75 } },
      'Taste Roll — click “Taste Roll” above the composer to restyle your own page.')
  }
  const kids = []
  kids.push(h('div', {
    key: 'col-original',
    style: { display: 'flex', flexDirection: 'column', minWidth: '24rem', width: '24rem', borderRight: '1px solid var(--line, #ddd)' }
  },
    h('div', { style: { padding: '.45rem .7rem', fontSize: '.78rem', fontWeight: 600, borderBottom: '1px solid var(--line, #ddd)' } },
      `Your work — unchanged (${cur.file})`),
    h(ColumnFrame, { label: 'Your work', srcdoc: cur.originalHtml })))
  cur.columns.forEach((col, i) => {
    kids.push(h('div', {
      key: `col-${col.seed}-${i}`,
      style: { display: 'flex', flexDirection: 'column', minWidth: '24rem', width: '24rem', borderRight: '1px solid var(--line, #ddd)' }
    },
      h(ColumnHeader, { col, index: i }),
      h(ColumnFrame, { label: `Roll ${i + 1}`, srcdoc: col.srcdoc })))
  })
  return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
    h('div', { style: { padding: '.5rem .8rem', fontSize: '.8rem', borderBottom: '1px solid var(--line, #ddd)', display: 'flex', gap: '1rem', alignItems: 'baseline' } },
      h('strong', null, 'Taste Roll'),
      h('span', { style: { opacity: .75 } }, `${cur.file} — ${cur.why || 'your surface'}`),
      h('span', { style: { opacity: .75, marginLeft: 'auto' } }, 'Each click adds a column; previous columns stay.')),
    h('div', { style: { display: 'flex', flex: '1 1 auto', overflowX: 'auto', height: '100%' } }, kids))
}

/** The pane reads live module state; the original HTML + built column srcdocs
 *  are cached on the comparison object for this session. */
function materialize(cur) {
  if (!cur) return
  cur.originalHtml = cur.originalHtml || cur.sourceText || ''
  cur.columns.forEach((col) => {
    if (!col.srcdoc) {
      col.srcdoc = buildRolledHtml(cur.originalHtml, col.roll, col.seed)
      /* Restored from persistence without this-session verdicts: show an
       * honest "not audited this session" state, not a fake pending/SHIP. */
      if (!col.verdict) col.restored = true
    }
  })
}

let lastClose = null

function openPane() {
  if (comparison) materialize(comparison)
  /* Stable id: re-registering replaces the existing pane contribution and
   * re-reveals it — one workspace tab, columns accumulate inside it. */
  lastClose = host.openWorkspace(PANE_ID, {
    title: 'Taste Roll',
    minWidth: '24rem',
    render: renderPane
  })
}

/* ---- registration --------------------------------------------------------- */

export default {
  /* MUST equal the package folder name (`plugins/tastecheck-hermes/`): the
   * desktop host namespaces contributions AND ctx.rest by the DECLARED id, and
   * the backend router mounts at /api/plugins/tastecheck-hermes/. */
  id: 'tastecheck-hermes',
  name: 'Tastecheck',
  description: 'Taste Roll: restyle your own page in gated comparison columns; the frontend ship gate lives in the Hermes-side tastecheck plugin.',
  register(ctx) {
    pluginCtx = ctx
    ctx.register({
      area: COMPOSER_AREAS.actions,
      id: 'taste-roll',
      title: 'Taste Roll',
      render: () => h('button', {
        type: 'button',
        className: GHOST_ICON_BTN,
        onClick: (e) => { e.preventDefault(); void runRoll() },
        title: 'Taste Roll — restyle your own page, add a gated comparison column'
      }, '\u{1F3B2} Taste Roll')
    })
    /* R5: the same behavior from the command palette (⌘K), not only the button. */
    if (PALETTE_AREA) {
      ctx.register({
        id: 'taste-roll',
        area: PALETTE_AREA,
        data: {
          id: 'taste-roll',
          label: 'Taste Roll: restyle my page',
          keywords: ['taste', 'roll', 'restyle', 'theme', 'design', 'ship gate'],
          detail: () => (comparison && comparison.file ? comparison.file : 'adds a gated restyle column'),
          detailVariant: 'state',
          run: () => { void runRoll() }
        }
      })
    }
    /* Restore the current workspace's roll history lazily: the next click
     * re-reads the file and rebuilds srcdocs (we never read user files
     * without an action). */
    const cwd = (host.state.cwd && host.state.cwd.get ? host.state.cwd.get() : '') || ''
    loadComparison(cwd)
  }
}
