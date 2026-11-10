/**
 * Entry-point detection that survives symlinked installs.
 *
 * Node resolves a module's `import.meta.url` to the real path, while
 * `process.argv[1]` keeps the path the caller typed. npm bin shims and
 * `install.sh`'s skill links are symlinks, so a lexical comparison is always
 * false for the installed layout and a guarded CLI silently exits 0 without
 * running. Compare realpaths on both sides and fall back to the literal path
 * when either side cannot be resolved (deleted entry, exotic filesystem).
 *
 * Callers pass their own `import.meta.url`: a default here would resolve to
 * this helper module, not to the CLI.
 */
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isMainEntry(moduleUrl, argv1 = process.argv[1]) {
  if (!moduleUrl) throw new TypeError("isMainEntry requires the caller's import.meta.url");
  if (!argv1) return false;
  const selfPath = fileURLToPath(moduleUrl);
  const entryLiteral = resolve(argv1);
  let entryPath;
  let selfReal;
  try { entryPath = realpathSync(entryLiteral); } catch { entryPath = entryLiteral; }
  try { selfReal = realpathSync(selfPath); } catch { selfReal = selfPath; }
  return entryPath === selfReal || entryLiteral === selfPath;
}
