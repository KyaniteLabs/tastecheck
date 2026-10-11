// Taste profile tests: CLI round trip in a temp HOME, then a cdp-qa integration run
// against a small fixture with no profile / accept / reject. Browser part skips cleanly.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runProfile, TELL_IDS, tellForWarning } from "../../bin/profile.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const script = join(root, "skills/tastecheck-pass/assets/cdp-qa.mjs");
const fixture = join(root, "tools/test/fixtures/profile/cards.html");
let failed = 0;
const check = (ok, msg) => { if (!ok) { failed++; console.error(`FAIL ${msg}`); } else console.log(`ok   ${msg}`); };

const home = mkdtempSync(join(tmpdir(), "profile-test-"));
const pfile = join(home, ".tastecheck", "profile.json");
const cli = (...argv) => {
  let o = "", e = "";
  const code = runProfile(argv, { home, env: {}, stdout: { write: (s) => (o += s) }, stderr: { write: (s) => (e += s) } });
  return { code, o, e };
};

/* ---- ids stay in step with the standalone copy inside cdp-qa and with gate-audit */
const qaSrc = readFileSync(script, "utf8");
check(TELL_IDS.every((id) => qaSrc.includes(`"${id}"`)), "every tell id is known to cdp-qa");
const audit = readFileSync(join(root, "skills/tastecheck-pass/assets/gate-audit.js"), "utf8");
check(/uniform card grid/.test(audit) && tellForWarning("uniform card grid: 3× x") === "uniform-card-grid", "uniform card grid warning maps to its id");
check(tellForWarning('display face resolves to "Inter" — x') === "safe-display-face" && tellForWarning("pill text CTA: x") === "pill-cta"
  && tellForWarning("stat-counter band: 3") === "stat-counter-band" && tellForWarning("indigo→violet gradient on x") === "indigo-violet-gradient", "other tells map to ids");

/* ---- CLI */
let r = cli("show");
check(r.code === 0 && r.o.includes("entries: 0") && r.o.includes(pfile), "show with no file");
r = cli("accept", "uniform-card-grid", "--reason", "real catalog", "--scope", "https://example.com");
check(r.code === 0 && existsSync(pfile), "accept writes the profile");
r = cli("reject", "pill-cta", "--reason", "too loud");
check(r.code === 0, "reject");
r = cli("show");
check(/uniform-card-grid: accept \(scope https:\/\/example.com\) - real catalog/.test(r.o) && /pill-cta: reject - too loud/.test(r.o) && r.o.includes("entries: 2"), "show lists decisions");
r = cli("accept", "pill-cta");
check(cli("show").o.includes("entries: 2") && /pill-cta: accept/.test(cli("show").o), "re-deciding a tell replaces its entry");
r = cli("accept", "no-such-tell");
check(r.code === 2 && r.e.includes("valid tells:") && TELL_IDS.every((id) => r.e.includes(id)), "bad tell id exits 2 and lists valid ids");
check(cli("accept").code === 2, "missing tell id exits 2");
check(cli("bogus").code === 2, "unknown command exits 2");
if (process.platform !== "win32") {
  check((statSync(pfile).mode & 0o777) === 0o600, "profile file is 0600");
  check((statSync(join(home, ".tastecheck")).mode & 0o777) === 0o700, "profile dir is 0700");
}
check(!readdirSync(join(home, ".tastecheck")).some((f) => f.endsWith(".tmp")), "no temp file left behind");

const exp = join(home, "out", "export.json");
r = cli("export", exp);
check(r.code === 0 && JSON.parse(readFileSync(exp, "utf8")).entries.length === 2, "export to file");
r = cli("export");
check(r.code === 0 && JSON.parse(r.o).kind === "tastecheck-taste-profile", "export to stdout");
r = cli("forget", "pill-cta");
check(r.code === 0 && !cli("show").o.includes("pill-cta"), "forget removes the tell");
check(cli("reset").code === 2 && existsSync(pfile), "reset without --yes refuses");
check(cli("reset", "--yes").code === 0 && !existsSync(pfile), "reset --yes deletes the file");
r = cli("import", exp);
check(r.code === 0 && cli("show").o.includes("entries: 2"), "import restores the exported profile");

const bad = (name, mutate) => {
  const p = JSON.parse(readFileSync(exp, "utf8")); mutate(p);
  const f = join(home, `bad-${name}.json`); writeFileSync(f, JSON.stringify(p));
  const before = readFileSync(pfile, "utf8");
  const x = cli("import", f);
  check(x.code === 2 && readFileSync(pfile, "utf8") === before, `import refuses ${name} and leaves the profile alone`);
};
bad("wrong schema_version", (p) => { p.schema_version = 2; });
bad("unknown top-level field", (p) => { p.extra = 1; });
bad("unknown entry field", (p) => { p.entries[0].taste_score = 9; });
bad("unknown tell", (p) => { p.entries[0].tell = "nope"; });
bad("bad decision", (p) => { p.entries[0].decision = "maybe"; });
writeFileSync(join(home, "junk.json"), "not json");
check(cli("import", join(home, "junk.json")).code === 2, "import refuses non-JSON");

/* ---- cdp-qa integration */
if (typeof WebSocket === "undefined") { console.log("skipped: no browser (Node 22+ global WebSocket required)"); finish(); }
const OBJECTIVE = ["keyboard", "contrast", "reflow320", "zoom400", "tapTargets", "resources", "leaks", "consoleCold", "coldLoad", "reducedMotion"];
const qa = (name, extra, profileFile) => {
  const out = mkdtempSync(join(tmpdir(), `profile-qa-${name}-`));
  const env = { ...process.env, HOME: home }; delete env.TASTECHECK_PROFILE;
  const x = spawnSync(process.execPath, [script, fixture, out, ...extra], { encoding: "utf8", timeout: 120_000, env });
  const ev = existsSync(join(out, "evidence.json")) ? JSON.parse(readFileSync(join(out, "evidence.json"), "utf8")) : null;
  return { x, ev, out };
};
rmSync(pfile, { force: true });
const none = qa("none", []);
if (none.x.status === 2 && /no Chrome\/Chromium\/Edge found/.test(none.x.stderr)) { console.log("skipped: no browser"); finish(); }
check(none.ev && none.ev.probes.templateSlop.status === "warn" && /uniform card grid/.test(none.ev.probes.templateSlop.evidence), `no profile: templateSlop warns (${none.x.stderr.slice(0, 120)})`);
check(none.ev && none.ev.verdict === "SHIP" && !("profile" in none.ev), "no profile: SHIP, no profile block");

cli("accept", "uniform-card-grid", "--reason", "real product catalog");
const acc = qa("accept", []);
check(acc.ev && acc.ev.probes.templateSlop.status === "pass", "accept: tell no longer counted (templateSlop pass)");
check(acc.ev && /accepted by your taste profile: real product catalog/.test(acc.ev.probes.templateSlop.evidence), "accept: evidence still shows the tell and the reason");
check(acc.ev && acc.ev.profile && acc.ev.profile.ignored_objective === true && acc.ev.profile.path === pfile
  && acc.ev.profile.applied.some((a) => a.tell === "uniform-card-grid" && a.decision === "accept"), "accept: profile block recorded in evidence.json");

const off = qa("off", ["--no-profile"]);
check(off.ev && off.ev.probes.templateSlop.status === "warn" && !("profile" in off.ev), "--no-profile ignores the profile");

cli("forget", "uniform-card-grid");
cli("accept", "uniform-card-grid", "--scope", "https://elsewhere.example", "--reason", "other site");
const scoped = qa("scoped", []);
check(scoped.ev && scoped.ev.probes.templateSlop.status === "warn", "a scope that does not match the target changes nothing");
cli("forget", "uniform-card-grid");

cli("reject", "uniform-card-grid", "--reason", "be strict");
const rej = qa("reject", []);
check(rej.ev && rej.ev.probes.templateSlop.status === "fail" && rej.ev.verdict === "HOLD" && rej.x.status === 1, "reject: templateSlop fails and verdict is HOLD");

const own = join(home, "own.json");
writeFileSync(own, JSON.stringify({ schema_version: 1, kind: "tastecheck-taste-profile", entries: [{ tell: "uniform-card-grid", decision: "accept", reason: "own file", decided_at: new Date().toISOString() }] }));
const explicit = qa("explicit", ["--profile", own]);
check(explicit.ev && explicit.ev.probes.templateSlop.status === "pass" && explicit.ev.profile.path === own, "--profile <file> reads that file");

for (const k of OBJECTIVE) {
  const same = [acc, rej, off].every((o) => o.ev && JSON.stringify(o.ev.probes[k]) === JSON.stringify(none.ev.probes[k]));
  check(same, `objective probe ${k} identical with and without a profile`);
}
for (const o of [none, acc, off, scoped, rej, explicit]) rmSync(o.out, { recursive: true, force: true });
finish();

function finish() {
  rmSync(home, { recursive: true, force: true });
  if (failed) { console.error(`${failed} check(s) failed`); process.exit(1); }
  console.log("profile tests passed");
  process.exit(0);
}
