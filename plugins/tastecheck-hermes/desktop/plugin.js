/**
 * Tastecheck — desktop half: Taste Roll comparison workspace.
 *
 * The user clicks "Taste Roll" in the composer. We read THEIR project's HTML
 * (the session workspace folder, via the SDK folder grant — never the canned
 * demo page), open a workspace pane (stable id `tastecheck:tasteroll`) and
 * show their unchanged page as the left column. Every later click adds one
 * more restyled column; previous columns stay. Each column is an iframe
 * sandboxed exactly like the built-in preview frame: sandbox="allow-forms
 * allow-scripts", allow="fullscreen", referrerPolicy="no-referrer" — opaque
 * origin, no same-origin access.
 *
 * The roll system is the one merged on KyaniteLabs/tastecheck main (PR #35
 * head c41683068357258a7dae582de1a41191ae2153fe, incl. the #37–#39 QA
 * refinements): the verbatim seeded xoshiro128++ engine from
 * skills/tasteroll/assets/tasteroll-engine.js and the data-ref / data-vibe /
 * data-mode / data-sig token system from tasteroll.html, applied to the
 * user's own markup through generic element selectors.
 *
 * No network, no telemetry, no raw bridge. Sensitive door used: none beyond
 * the folder grant (ctx.files) and host.openWorkspace.
 */

import { COMPOSER_AREAS, GHOST_ICON_BTN, host } from '@hermes/plugin-sdk'
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
   application layer so the tokens restyle ARBITRARY user markup, not just the
   demo page's own structure. Applied only inside rolled columns, driven by
   the same html[data-ref][data-vibe][data-mode][data-sig] attributes. */
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

/** Build a rolled copy of the user's HTML: roll attributes on <html> plus the
 *  roll stylesheet. String surgery only — never executes or rewrites the
 *  user's scripts; the column iframe stays opaque-origin sandboxed. */
function buildRolledHtml(html, roll, seed) {
  const attrs = ` data-taste-roll="1" data-roll="s${seed}" data-ref="${roll.ref}" data-vibe="${roll.vibe}" data-mode="${roll.mode}" data-sig="${roll.sig}"`
  const style = `<style id="tastecheck-roll">${ROLL_CSS}</style>`
  let out = String(html || '')
  if (/<html(\s[^>]*)?>/i.test(out)) {
    out = out.replace(/<html(\s[^>]*)?>/i, (m) => m.replace(/\s*$/,'') + attrs + '>')
  } else {
    out = `<html${attrs}><head><meta charset="utf-8"></head><body>${out}</body></html>`
  }
  if (/<\/head>/i.test(out)) {
    out = out.replace(/<\/head>/i, style + '</head>')
  } else if (/<body(\s[^>]*)?>/i.test(out)) {
    out = out.replace(/<body(\s[^>]*)?>/i, (m) => m + style)
  } else {
    out = style + out
  }
  return out
}

/* ---- module state (the plugin's own; roll history persisted via ctx.storage) */
let pluginCtx = null
let comparison = null /* { cwd, file, filePath, columns: [{ seed, roll }] } */
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
  /* Slim copy: seeds + rolls + file identity only. The HTML text and built
   * column srcdocs are session-memory; they rebuild from the file on the
   * next click, keeping storage small. */
  const slim = {
    cwd: comparison.cwd,
    file: comparison.file,
    filePath: comparison.filePath,
    columns: (comparison.columns || []).map((c) => ({ seed: c.seed, roll: c.roll }))
  }
  const all = pluginCtx.storage.get('comparisons', {})
  all[storageKey(comparison.cwd)] = slim
  pluginCtx.storage.set('comparisons', all)
}

/** Deterministic "nearest HTML": fewest path segments under the grant, paths
 *  under the session cwd first, tasteroll.html NEVER eligible. */
function pickHtml(entriesByDir, cwd, grantPath) {
  const rows = []
  for (const [dir, entries] of Object.entries(entriesByDir)) {
    for (const e of entries) {
      if (e.isDirectory) continue
      if (!/\.html?$/i.test(e.name)) continue
      if (e.name.toLowerCase() === 'tasteroll.html') continue
      const rel = dir ? `${dir}/${e.name}` : e.name
      const abs = `${grantPath}/${rel}`
      rows.push({ rel, abs, depth: rel.split('/').length })
    }
  }
  if (!rows.length) return null
  const cwdPrefix = cwd && cwd !== '' ? String(cwd).replace(/\/+$/, '') + '/' : null
  rows.sort((a, b) => {
    const au = cwdPrefix && a.abs.startsWith(cwdPrefix) ? 0 : 1
    const bu = cwdPrefix && b.abs.startsWith(cwdPrefix) ? 0 : 1
    if (au !== bu) return au - bu
    if (a.depth !== b.depth) return a.depth - b.depth
    return a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0
  })
  return rows[0]
}

async function collectHtml(files, folderId, cwd, grantPath) {
  const entriesByDir = {}
  const walk = async (rel, depth) => {
    if (depth > 3) return
    const res = await files.list(folderId, rel || undefined)
    if (!res || res.ok !== true || !res.entries) return
    entriesByDir[rel] = res.entries
    for (const e of res.entries) {
      if (e.isDirectory && e.name !== 'node_modules' && e.name !== '.git') {
        await walk(rel ? `${rel}/${e.name}` : e.name, depth + 1)
      }
    }
  }
  await walk('', 0)
  return pickHtml(entriesByDir, cwd, grantPath)
}

async function grantFor(cwd) {
  const folders = await pluginCtx.files.folders()
  const granted = (folders || []).filter((f) => f && f.path && cwd && (cwd + '/').startsWith(f.path.replace(/\/+$/, '') + '/'))
  if (granted.length) return granted.sort((a, b) => b.path.length - a.path.length)[0]
  const asked = await pluginCtx.files.requestFolder()
  if (!asked || asked.ok !== true || !asked.folder) return null
  return asked.folder
}

async function runRoll() {
  if (inFlight || !pluginCtx) return
  inFlight = true
  try {
    const cwd = (host.state.cwd && host.state.cwd.get ? host.state.cwd.get() : '') || ''
    const folder = await grantFor(cwd)
    if (!folder) {
      host.notify('Taste Roll needs your project folder — grant it to roll your own page.')
      return
    }
    let current = comparison && comparison.cwd === cwd ? comparison : loadComparison(cwd)
    let target
    if (current && current.file) {
      const stat = await pluginCtx.files.stat(folder.id, current.file)
      target = stat && stat.ok === true ? { rel: current.file, abs: `${folder.path}/${current.file}` } : null
    }
    if (!target) {
      target = await collectHtml(pluginCtx.files, folder.id, cwd, folder.path)
    }
    if (!target) {
      host.notifyError(`Taste Roll found no HTML in ${folder.path} (tasteroll.html is never used).`)
      return
    }
    const read = await pluginCtx.files.readText(folder.id, target.rel)
    if (!read || read.ok !== true) {
      host.notifyError(`Taste Roll could not read ${target.rel}.`)
      return
    }
    const html = read.text
    const seed = ((Date.now() / 1000) >>> 0) ^ ((current ? current.columns.length : 0) + 1) * 2654435761
    const roll = tasteroll(seed >>> 0).roll(FACES)
    if (!current) {
      current = { cwd, file: target.rel, filePath: target.abs, columns: [] }
    } else {
      current.file = target.rel
      current.filePath = target.abs
    }
    /* Left column and future rolls preview the CURRENT file; columns already
     * built keep their srcdoc (previous columns stay as they were rolled). */
    current.originalHtml = html
    current.columns.push({ seed: seed >>> 0, roll })
    comparison = current
    materialize(current)
    persistComparison()
    openPane()
    host.notify(`Taste Roll ${roll.ref} / ${roll.vibe} / ${roll.mode} / ${roll.sig} — column ${current.columns.length}.`)
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

function renderPane() {
  const cur = comparison
  if (!cur || !cur.columns.length) {
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
      h('div', { style: { padding: '.45rem .7rem', fontSize: '.78rem', fontWeight: 600, borderBottom: '1px solid var(--line, #ddd)' } },
        `Roll ${i + 1}: ${col.roll.ref} · ${col.roll.vibe} · ${col.roll.mode} · ${col.roll.sig} (seed ${col.seed})`),
      h(ColumnFrame, { label: `Roll ${i + 1}`, srcdoc: col.srcdoc })))
  })
  return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
    h('div', { style: { padding: '.5rem .8rem', fontSize: '.8rem', borderBottom: '1px solid var(--line, #ddd)', display: 'flex', gap: '1rem', alignItems: 'baseline' } },
      h('strong', null, 'Taste Roll'),
      h('span', { style: { opacity: .75 } }, cur.filePath || cur.file),
      h('span', { style: { opacity: .75, marginLeft: 'auto' } }, 'Each click adds a column; previous columns stay.')),
    h('div', { style: { display: 'flex', flex: '1 1 auto', overflowX: 'auto', height: '100%' } }, kids))
}

/** The pane reads live module state; the original HTML + built column srcdocs
 *  are cached on the comparison object for this session. */
function materialize(cur) {
  if (!cur) return
  cur.originalHtml = cur.originalHtml || cur.sourceText || ''
  cur.columns.forEach((col) => {
    if (!col.srcdoc) col.srcdoc = buildRolledHtml(cur.originalHtml, col.roll, col.seed)
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

/* ---- registration ---- */

export default {
  id: 'tastecheck',
  name: 'Tastecheck',
  description: 'Taste Roll: restyle your own page in comparison columns; the frontend ship gate lives in the Hermes-side tastecheck plugin.',
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
        title: 'Taste Roll — restyle your own page, add a comparison column'
      }, '\u{1F3B2} Taste Roll')
    })
    /* Restore the current workspace's roll history lazily: the next click
     * re-reads the file and rebuilds srcdocs (we never read user files
     * without an action). */
    const cwd = (host.state.cwd && host.state.cwd.get ? host.state.cwd.get() : '') || ''
    loadComparison(cwd)
  }
}
