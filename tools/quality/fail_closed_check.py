#!/usr/bin/env python3
"""Entry-point contract check.

A file must behave the same whether invoked by its real path or through a
symlink. Divergence is the defect: the caller reaches a different program
depending on how the path was written.

  python3 fail_closed_check.py --self-test
  python3 fail_closed_check.py PATH [PATH...]
  python3 fail_closed_check.py --discover ROOT [ROOT...]

Verdicts:
  CONSISTENT            same exit class and output presence both ways
  DIVERGENT             behaves differently when reached by symlink
  SILENT_BEHIND_SYMLINK reached by symlink it exits 0 with no output at all
  ERROR                 could not execute
  UNSUPPORTED           no runner for the extension

Probes run with --help first (safe for most CLIs), then bare, inside an
isolated temp cwd so stray relative writes cannot touch the source tree.

Why a contract test and not a lint: measured 2026-11-10, a broad
exception-swallowing lint produced 80 hits across eight plugins and caught
none of the three known silent-success defects, while the first hit it did
get inspected was correct code. The behavioural contract caught the real
defect on its first run with no false positives.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

RUNNERS = {".py": [sys.executable], ".mjs": ["node"], ".js": ["node"], ".sh": ["bash"]}


def runner_for(path):
    return RUNNERS.get(os.path.splitext(path)[1].lower())


def run(cmd, path, args, cwd, timeout):
    try:
        r = subprocess.run(cmd + [path] + args, capture_output=True, text=True,
                           timeout=timeout, cwd=cwd, stdin=subprocess.DEVNULL)
    except (subprocess.TimeoutExpired, OSError):
        return None, ""
    return r.returncode, (r.stdout or "") + (r.stderr or "")


def signature(code, out):
    """Coarse behaviour signature: exit class plus whether anything was said."""
    if code is None:
        return "TIMEOUT"
    return ("0" if code == 0 else "N") + ("out" if out.strip() else "silent")


def probe(path, args, timeout):
    real = os.path.abspath(path)
    with tempfile.TemporaryDirectory(prefix="contract-") as d:
        # Keep the basename. Installers symlink by name; renaming the link would
        # break a guard that legitimately keys off its own filename.
        link = os.path.join(d, os.path.basename(real))
        try:
            os.symlink(real, link)
        except OSError:
            return None
        cmd = runner_for(path)
        return {"direct": run(cmd, real, args, d, timeout),
                "linked": run(cmd, link, args, d, timeout)}


def check(path, timeout=10):
    base = {"path": path}
    if not runner_for(path):
        return {**base, "verdict": "UNSUPPORTED"}
    chosen, res = None, None
    for args in (["--help"], []):
        res = probe(path, args, timeout)
        if res is None:
            return {**base, "verdict": "ERROR", "detail": "cannot symlink"}
        code, out = res["direct"]
        if code is not None and (out.strip() or code != 0):
            chosen = args
            break
    if chosen is None:
        chosen = []
        res = probe(path, chosen, timeout) or res
    (dcode, dout), (lcode, lout) = res["direct"], res["linked"]
    dsig, lsig = signature(dcode, dout), signature(lcode, lout)
    if lsig == "0silent" and dsig != "0silent":
        verdict = "SILENT_BEHIND_SYMLINK"
    elif dsig != lsig:
        verdict = "DIVERGENT"
    elif dcode is None:
        verdict = "ERROR"
    else:
        verdict = "CONSISTENT"
    return {**base, "verdict": verdict, "probe": chosen or ["<none>"],
            "direct": {"exit": dcode, "bytes": len(dout)},
            "via_symlink": {"exit": lcode, "bytes": len(lout)}}


# --- discovery ---------------------------------------------------------------
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build",
             ".next", "target", "vendor", ".mypy_cache", ".pytest_cache", "tests", "test"}
MAIN_PY = re.compile(r"^if\s+__name__\s*==\s*['\"]__main__['\"]", re.M)
MAIN_JS = re.compile(r"process\.argv\[1\]")


def discover(roots):
    found = []
    for root in roots:
        for dp, dns, fns in os.walk(root):
            dns[:] = [d for d in dns if d not in SKIP_DIRS and not d.startswith(".")]
            for fn in fns:
                ext = os.path.splitext(fn)[1]
                if ext not in RUNNERS:
                    continue
                p = os.path.join(dp, fn)
                try:
                    if os.path.getsize(p) > 400_000:
                        continue
                    txt = open(p, encoding="utf-8", errors="ignore").read()
                except OSError:
                    continue
                if ext == ".py" and MAIN_PY.search(txt):
                    found.append(p)
                elif ext in (".mjs", ".js") and MAIN_JS.search(txt):
                    found.append(p)
                elif ext == ".sh" and txt.startswith("#!"):
                    found.append(p)
    return sorted(set(found))


def self_test():
    with tempfile.TemporaryDirectory(prefix="contract-selftest-") as d:
        good = os.path.join(d, "good.mjs")
        bad = os.path.join(d, "bad.mjs")
        # Consistent: refuses the same way whatever path reaches it.
        open(good, "w").write('console.error("usage: needs --input"); process.exit(2);\n')
        # Reproduces the defect: the main-guard never matches behind a symlink.
        open(bad, "w").write(
            'import { fileURLToPath } from "node:url";\n'
            'import { resolve } from "node:path";\n'
            'if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {\n'
            '  console.error("usage: needs --input"); process.exit(2);\n'
            '}\n'
        )
        got = {n: check(p)["verdict"] for n, p in (("good", good), ("bad", bad))}
    ok = got == {"good": "CONSISTENT", "bad": "SILENT_BEHIND_SYMLINK"}
    print(f"self-test: {'PASS' if ok else 'FAIL'} {got}")
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--discover", nargs="+", metavar="ROOT")
    ap.add_argument("--timeout", type=int, default=10)
    ap.add_argument("--json-out")
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    paths = discover(args.discover) if args.discover else args.paths
    if not paths:
        ap.error("give paths, --discover ROOT, or --self-test")
    rows = [check(p, args.timeout) for p in paths]
    if args.json_out:
        open(args.json_out, "w").write(json.dumps(rows, indent=1))
    bad = 0
    for r in rows:
        if r["verdict"] in ("SILENT_BEHIND_SYMLINK", "DIVERGENT", "ERROR"):
            bad += 1
        print(f"{r['verdict']:<22} {r['path']} {r.get('direct','')} {r.get('via_symlink','')}")
    print(f"TOTAL {len(rows)} problem {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
