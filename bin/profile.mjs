/* profile.mjs — the local taste profile (v0).

   A small JSON file the user owns. It records which template tells they have
   deliberately accepted or want treated strictly. It is read only by the
   templateSlop judgment in cdp-qa; objective probes never consult it.
   Local only: nothing here reads the network or ships anywhere. */
import {
  readFileSync, writeFileSync, renameSync, mkdirSync, existsSync, rmSync, chmodSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";

export const SCHEMA_VERSION = 1;
export const KIND = "tastecheck-taste-profile";

/* Stable ids for the template tells gate-audit.js can emit. `match` recognises
   the warning text. cdp-qa.mjs keeps its own copy of these patterns so the skill
   asset stays standalone; tools/test/test-profile.mjs checks the two agree. */
export const TELLS = [
  { id: "uniform-card-grid", match: /^uniform card grid/, about: "three or more identical bordered or rounded cards in a row" },
  { id: "stat-counter-band", match: /^stat-counter band/, about: "a band of three or more big numeric callouts" },
  { id: "safe-display-face", match: /^display face resolves to/, about: "headline set in a default sans (Inter, Roboto, Arial, system-ui...)" },
  { id: "pill-cta", match: /^pill text CTA/, about: "a fully rounded pill-shaped text button" },
  { id: "indigo-violet-gradient", match: /^indigo→violet gradient/, about: "the indigo to violet gradient" },
];
export const TELL_IDS = TELLS.map((t) => t.id);
export const tellForWarning = (w) => (TELLS.find((t) => t.match.test(String(w))) || {}).id || null;

const DECISIONS = ["accept", "reject"];
const ENTRY_KEYS = new Set(["tell", "decision", "reason", "scope", "decided_at"]);
const TOP_KEYS = new Set(["schema_version", "kind", "entries"]);

export function profilePath(env = process.env, home = homedir()) {
  if (env.TASTECHECK_PROFILE) return resolve(env.TASTECHECK_PROFILE);
  return join(env.HOME || home, ".tastecheck", "profile.json");
}

export function emptyProfile() { return { schema_version: SCHEMA_VERSION, kind: KIND, entries: [] }; }

/* Returns an array of problems; empty means valid. Unknown fields are refused. */
export function validateProfile(p) {
  const errs = [];
  if (!p || typeof p !== "object" || Array.isArray(p)) return ["profile must be a JSON object"];
  for (const k of Object.keys(p)) if (!TOP_KEYS.has(k)) errs.push(`unknown field "${k}"`);
  if (p.schema_version !== SCHEMA_VERSION) errs.push(`schema_version must be ${SCHEMA_VERSION}`);
  if (p.kind !== KIND) errs.push(`kind must be "${KIND}"`);
  if (!Array.isArray(p.entries)) { errs.push("entries must be an array"); return errs; }
  p.entries.forEach((e, i) => {
    const at = `entries[${i}]`;
    if (!e || typeof e !== "object" || Array.isArray(e)) { errs.push(`${at} must be an object`); return; }
    for (const k of Object.keys(e)) if (!ENTRY_KEYS.has(k)) errs.push(`${at}: unknown field "${k}"`);
    if (!TELL_IDS.includes(e.tell)) errs.push(`${at}: unknown tell "${e.tell}"`);
    if (!DECISIONS.includes(e.decision)) errs.push(`${at}: decision must be accept or reject`);
    if (typeof e.reason !== "string") errs.push(`${at}: reason must be a string`);
    if (e.scope !== undefined && (typeof e.scope !== "string" || !e.scope)) errs.push(`${at}: scope must be a non-empty string`);
    if (typeof e.decided_at !== "string" || Number.isNaN(Date.parse(e.decided_at))) errs.push(`${at}: decided_at must be an ISO date string`);
  });
  return errs;
}

export function loadProfile(path) {
  if (!existsSync(path)) return null;
  const p = JSON.parse(readFileSync(path, "utf8"));
  const errs = validateProfile(p);
  if (errs.length) throw new Error(`invalid profile at ${path}: ${errs.join("; ")}`);
  return p;
}

export function saveProfile(path, profile) {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = join(dir, `.profile.${process.pid}.tmp`);
  writeFileSync(tmp, JSON.stringify(profile, null, 2) + "\n", { mode: 0o600 });
  try { chmodSync(tmp, 0o600); } catch { /* non-posix */ }
  renameSync(tmp, path);
}

/* A scope is an origin ("https://example.com") or a glob ("*example.com/app/*").
   It is matched against the full target URL; file: targets also match by path. */
export function scopeMatches(scope, url) {
  if (!scope) return true;
  const re = (g) => new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
  if (!/[*?]/.test(scope)) {
    const s = scope.replace(/\/+$/, "");
    return url === s || url.startsWith(s + "/") || url.startsWith(s + "?") || url.startsWith(s + "#");
  }
  return re(scope).test(url);
}

/* Which decision applies to this tell for this url. reject beats accept. */
export function decisionFor(profile, tell, url) {
  if (!profile) return null;
  const hits = profile.entries.filter((e) => e.tell === tell && scopeMatches(e.scope, url));
  return hits.find((e) => e.decision === "reject") || hits[0] || null;
}

/* ------------------------------------------------------------------- CLI */
export const USAGE = `usage: tastecheck profile <command>

  show                                   path, entry count, decisions per tell
  accept <tell> [--reason "..."] [--scope <origin-or-glob>]
                                         keep this tell on purpose (not counted as slop)
  reject <tell> [--reason "..."] [--scope <origin-or-glob>]
                                         treat this tell strictly (warn becomes fail)
  forget <tell> [--scope <...>]          remove your decision(s) for a tell
  export [file]                          write the profile as JSON (stdout by default)
  import <file>                          replace the profile from a JSON file (validated)
  reset --yes                            delete the profile file

File: $TASTECHECK_PROFILE, else ~/.tastecheck/profile.json. Local only; never uploaded.
Only the template-tell judgment uses it. Objective checks never do.
Tells: ${TELL_IDS.join(", ")}`;

function parseFlags(argv) {
  const pos = [], flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "--help") flags[a.slice(2)] = true;
    else if (a === "--reason" || a === "--scope") {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      flags[a.slice(2)] = argv[++i];
    } else if (a.startsWith("--")) throw new Error(`unknown option ${a}`);
    else pos.push(a);
  }
  return { pos, flags };
}

export function runProfile(argv, { home, stdout = process.stdout, stderr = process.stderr, env = process.env } = {}) {
  const out = (s) => stdout.write(s + "\n");
  const err = (s) => stderr.write(s + "\n");
  let parsed;
  try { parsed = parseFlags(argv); } catch (e) { err(`profile: ${e.message}\n${USAGE}`); return 2; }
  const { pos, flags } = parsed;
  const [cmd, arg] = pos;
  if (!cmd || flags.help || cmd === "help") { (cmd || flags.help ? out : err)(USAGE); return cmd || flags.help ? 0 : 2; }
  const path = profilePath(home ? { ...env, HOME: home, TASTECHECK_PROFILE: env.TASTECHECK_PROFILE } : env, home || homedir());

  const needTell = () => {
    if (!arg) { err(`profile ${cmd}: missing tell id\nvalid tells: ${TELL_IDS.join(", ")}`); return false; }
    if (!TELL_IDS.includes(arg)) { err(`profile: unknown tell "${arg}"\nvalid tells: ${TELL_IDS.join(", ")}`); return false; }
    return true;
  };
  try {
    switch (cmd) {
      case "show": {
        const p = loadProfile(path);
        out(`path: ${path}`);
        if (!p) { out("entries: 0 (no profile file; every tell is judged by the defaults)"); return 0; }
        out(`entries: ${p.entries.length}`);
        for (const t of TELL_IDS) {
          for (const e of p.entries.filter((x) => x.tell === t)) {
            out(`  ${t}: ${e.decision}${e.scope ? ` (scope ${e.scope})` : ""}${e.reason ? ` - ${e.reason}` : ""} [${e.decided_at.slice(0, 10)}]`);
          }
        }
        return 0;
      }
      case "accept": case "reject": {
        if (!needTell()) return 2;
        const p = loadProfile(path) || emptyProfile();
        const entry = { tell: arg, decision: cmd, reason: flags.reason || "", ...(flags.scope ? { scope: flags.scope } : {}), decided_at: new Date().toISOString() };
        p.entries = p.entries.filter((e) => !(e.tell === arg && (e.scope || "") === (flags.scope || "")));
        p.entries.push(entry);
        saveProfile(path, p);
        out(`${cmd === "accept" ? "accepted" : "rejected"} ${arg}${flags.scope ? ` for ${flags.scope}` : ""} -> ${path}`);
        return 0;
      }
      case "forget": {
        if (!needTell()) return 2;
        const p = loadProfile(path);
        const keep = p ? p.entries.filter((e) => !(e.tell === arg && (!flags.scope || e.scope === flags.scope))) : [];
        const removed = p ? p.entries.length - keep.length : 0;
        if (removed) { p.entries = keep; saveProfile(path, p); }
        out(`forgot ${removed} decision(s) for ${arg}`);
        return 0;
      }
      case "export": {
        const p = loadProfile(path) || emptyProfile();
        const text = JSON.stringify(p, null, 2) + "\n";
        if (arg) { mkdirSync(dirname(resolve(arg)), { recursive: true }); writeFileSync(resolve(arg), text, { mode: 0o600 }); out(`exported ${p.entries.length} entries to ${resolve(arg)}`); }
        else stdout.write(text);
        return 0;
      }
      case "import": {
        if (!arg) { err("profile import: missing file"); return 2; }
        let p;
        try { p = JSON.parse(readFileSync(resolve(arg), "utf8")); } catch (e) { err(`profile import: cannot read ${arg}: ${e.message}`); return 2; }
        const errs = validateProfile(p);
        if (errs.length) { err(`profile import: refused, ${errs.length} problem(s):\n  ${errs.join("\n  ")}`); return 2; }
        saveProfile(path, p);
        out(`imported ${p.entries.length} entries -> ${path}`);
        return 0;
      }
      case "reset": {
        if (!flags.yes) { err("profile reset deletes your profile file. Re-run with --yes to confirm."); return 2; }
        const had = existsSync(path);
        rmSync(path, { force: true });
        out(had ? `deleted ${path}` : `nothing to delete at ${path}`);
        return 0;
      }
      default:
        err(`profile: unknown command "${cmd}"\n${USAGE}`);
        return 2;
    }
  } catch (e) { err(`profile: ${e.message}`); return 1; }
}

/* run directly: node bin/profile.mjs <command> */
import { fileURLToPath } from "node:url";
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(runProfile(process.argv.slice(2), {}));
}
