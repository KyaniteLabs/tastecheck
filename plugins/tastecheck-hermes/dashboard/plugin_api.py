"""Tastecheck dashboard plugin API — mounted at ``/api/plugins/tastecheck-hermes/``.

One real endpoint: ``POST /roll-audit``. The Desktop Taste Roll pane sends the
exact srcdoc of one rolled column; this router materializes it as a file and
runs the SAME audit path the agent tool uses (the vendored, manifest-verified
CLI on an already-installed browser; no download, allowlisted child env), served
read-only over loopback from the column's own directory. ``audit()`` records the
verdict in the shared ledger with ``source="roll-audit"``; the completion gate
never counts roll-audit verdicts (a rolled column in plugin-data is not the
workspace artifact being shipped). Fail closed: every error path returns HOLD.

The audit implementation is loaded BY PATH from the package's agent half
(``plugins/tastecheck-hermes/__init__.py``) so there is exactly one audit
implementation and the two surfaces cannot drift. Settings come from
``plugins.entries.tastecheck-hermes.settings`` in the Hermes config (the agent
half reads them itself when no PluginContext is bound). No network of its own,
no secrets. PERSISTENCE DISCLOSURE: each audited column IS persisted — the exact
srcdoc is written as ``column.html`` under
``<HERMES_HOME>/plugin-data/tastecheck-hermes/roll-audits/<timestamp>/page/``
(latest 40 kept, then pruned) alongside the ordinary audit evidence; only
verdicts, reasons and evidence identity go into the ledger. Those copies are
plain local files inside your Hermes profile, readable by anything that already
reads that profile — the sandboxed opaque-origin iframe posture applies to
in-app RENDERING, not to these retained evidence files. Delete the
``roll-audits`` directory to drop them.
"""

from __future__ import annotations

import importlib.util
import logging
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

log = logging.getLogger(__name__)

router = APIRouter()

_PKG_ROOT = Path(__file__).resolve().parents[1]
_AGENT_MODULE = "tastecheck_hermes_agent_half"
_audit_lock = threading.Lock()  # one browser audit at a time per gateway process

_agent_half: Optional[Any] = None


def _load_agent_half() -> Any:
    """Import the package's own ``__init__.py`` by path (the dashboard loader
    imports this file standalone, so sibling package imports don't exist)."""
    global _agent_half
    if _agent_half is None:
        spec = importlib.util.spec_from_file_location(
            _AGENT_MODULE, _PKG_ROOT / "__init__.py")
        if spec is None or spec.loader is None:
            raise RuntimeError("cannot load tastecheck agent half")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _agent_half = mod
    return _agent_half


class RollAuditRequest(BaseModel):
    """One rolled column: its exact srcdoc plus the roll id label shown on it."""

    html: str = Field(..., min_length=1, max_length=4 * 1024 * 1024)
    label: str = Field(default="", max_length=200)


class RollAuditResponse(BaseModel):
    ok: bool
    verdict: str  # SHIP | HOLD (never anything else)
    hold_reasons: list[str] = []
    evidence_dir: Optional[str] = None
    target: Optional[str] = None
    duration_ms: Optional[int] = None
    error: Optional[str] = None


def _hold(error: str, target: Optional[str] = None) -> RollAuditResponse:
    return RollAuditResponse(ok=False, verdict="HOLD", hold_reasons=[error[:200]],
                             target=target, error=error[:500])


def _prune_roll_files(root: Path, keep: int = 40) -> None:
    try:
        dirs = sorted((d for d in root.iterdir() if d.is_dir()),
                      key=lambda d: d.name)
        for d in dirs[:-keep]:
            import shutil
            shutil.rmtree(d, ignore_errors=True)
    except Exception:
        log.debug("tastecheck roll-audit prune failed", exc_info=True)


@router.get("/health")
def health() -> Dict[str, Any]:
    mod = _load_agent_half()
    return {
        "ok": True,
        "plugin": "tastecheck-hermes",
        "vendor_manifest_sha256": mod._file_sha256(mod.VENDOR_MANIFEST),  # noqa: SLF001
    }


@router.post("/roll-audit", response_model=RollAuditResponse)
def roll_audit(req: RollAuditRequest) -> RollAuditResponse:
    """Audit one rolled column. Fail closed: every failure is a HOLD verdict."""
    started = time.time()
    target: Optional[str] = None
    try:
        mod = _load_agent_half()
        root = mod._data_dir() / "roll-audits"  # noqa: SLF001 — same package, by design
        root.mkdir(parents=True, exist_ok=True)
        out_dir = root / (time.strftime("%Y%m%d-%H%M%S") + f"-{int(time.time()*1000)%10000:04d}")
        out_dir.mkdir(parents=True, exist_ok=False)
        page_dir = out_dir / "page"
        page_dir.mkdir()
        column = page_dir / "column.html"
        column.write_text(req.html, encoding="utf-8")
        target = str(column)
        _prune_roll_files(root)

        timeout = float(mod._cfg("timeout_seconds"))  # noqa: SLF001
        if not _audit_lock.acquire(timeout=timeout):
            return _hold("gate busy: another roll audit is running; click again to re-audit", target)
        try:
            # audit() is the single ledger writer (source="roll-audit"); the column is
            # served from its own directory, never from the session workspace.
            res = mod.audit(target, source="roll-audit", serve_root=page_dir)
        finally:
            _audit_lock.release()

        duration_ms = int((time.time() - started) * 1000)
        data = res.get("data") if isinstance(res.get("data"), dict) else {}
        reasons = [str(r)[:200] for r in (data.get("holdReasons") or [])][:10]
        if res.get("verdict") == "SHIP" and res.get("ok"):
            verdict, ok = "SHIP", True
        else:
            verdict = "HOLD"
            ok = False
            if not reasons:
                reasons = [str(res.get("error") or "audit did not produce evidence")[:200]]
        return RollAuditResponse(
            ok=ok, verdict=verdict, hold_reasons=reasons,
            evidence_dir=res.get("evidence_dir"), target=target,
            duration_ms=duration_ms,
            error=None if ok else (res.get("error") or None),
        )
    except Exception as exc:  # health: any failure is a HOLD, never a 500-SHIP ambiguity
        log.warning("tastecheck roll-audit failed: %s", exc, exc_info=True)
        return _hold(f"roll audit failed: {exc}", target)
