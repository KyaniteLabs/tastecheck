#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
node --input-type=module -e 'const major = Number(process.versions.node.split(".")[0]); if (major < 22) { console.error(`TasteCheck QA runner requires Node 22+, found ${process.version}`); process.exit(2); }'
exec node "$ROOT/qa/run.mjs" "$@"
