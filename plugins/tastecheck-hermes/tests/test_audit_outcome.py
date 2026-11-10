"""The audit-outcome state machine (AuditOutcome): one named lifecycle for the
``ok`` / ``verdict`` / ``outcome`` triple every audit result carries and for the
``verdict`` persisted in each ledger entry."""

from __future__ import annotations

import json

import pytest
from hypothesis import settings
from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, invariant, precondition, rule

# The full derived state table. Adding a state to AuditOutcome without a row here
# fails test_state_table_is_exhaustive.
EXPECTED_FIELDS = {
    "SHIP": {"ok": True, "verdict": "SHIP", "outcome": "SHIP"},
    "HOLD": {"ok": True, "verdict": "HOLD", "outcome": "HOLD"},
    "ERROR": {"ok": False, "verdict": "HOLD", "outcome": "ERROR"},
}
LEGAL = {
    None: {"SHIP", "HOLD", "ERROR"},
    "SHIP": {"ERROR"},
    "HOLD": set(),
    "ERROR": set(),
}


def _states(plugin):
    return [None] + list(plugin.AuditOutcome)


def _name(state):
    return None if state is None else state.value


def test_state_table_is_exhaustive(plugin):
    names = {s.value for s in plugin.AuditOutcome}
    assert names == set(EXPECTED_FIELDS) == {k for k in LEGAL if k}
    assert set(plugin._OUTCOME_FIELDS) == set(plugin.AuditOutcome)
    assert set(plugin._OUTCOME_MOVES) == set(_states(plugin))


@pytest.mark.parametrize("name", sorted(EXPECTED_FIELDS))
def test_each_outcome_writes_its_whole_row(plugin, name):
    res = plugin._set_outcome({}, plugin.AuditOutcome(name), reason="why")
    assert {k: res[k] for k in ("ok", "verdict", "outcome")} == EXPECTED_FIELDS[name]
    assert ("error" in res) is (name == "ERROR")


def test_every_transition_is_legal_or_refused(plugin):
    """Exhaustive over (from, to): legal moves land; every other move raises."""
    for frm in _states(plugin):
        for to in plugin.AuditOutcome:
            res = {} if frm is None else plugin._set_outcome({}, frm, reason="r")
            before = dict(res)
            if to.value in LEGAL[_name(frm)]:
                plugin._set_outcome(res, to, reason="r")
                assert plugin.audit_outcome(res) is to
            else:
                with pytest.raises(plugin.IllegalOutcomeTransition):
                    plugin._set_outcome(res, to, reason="r")
                assert res == before, "a refused move must not half-write the result"


def test_nothing_ever_returns_to_ship(plugin):
    for frm in plugin.AuditOutcome:
        with pytest.raises(plugin.IllegalOutcomeTransition):
            plugin.next_outcome(frm, plugin.AuditOutcome.SHIP)


def test_unknown_stored_outcome_is_an_illegal_state(plugin):
    with pytest.raises(plugin.IllegalOutcomeTransition):
        plugin.audit_outcome({"outcome": "MAYBE"})
    assert plugin.parse_outcome("MAYBE") is None
    assert plugin.parse_outcome(None) is None


def test_error_keeps_an_earlier_error_reason(plugin):
    res = plugin._error({"error": "browser died"}, "fallback")
    assert res["error"] == "browser died"


@pytest.mark.parametrize("payload,stored", [
    ({"outcome": "SHIP"}, "SHIP"),
    ({"outcome": "HOLD"}, "HOLD"),
    ({"outcome": "ERROR", "verdict": "HOLD"}, "ERROR"),
    ({"verdict": "SHIP"}, "SHIP"),   # legacy payload: no outcome key
    ({"verdict": "HOLD"}, "HOLD"),
    ({"verdict": "WEIRD"}, "ERROR"),  # unknown: fail closed
    ({}, "ERROR"),
])
def test_ledger_stores_the_same_strings(plugin, ws, payload, stored):
    """Persisted format is unchanged: plain "SHIP"/"HOLD"/"ERROR" strings."""
    (ws / "p.html").write_text("<p>x</p>")
    plugin.record_verdict(str(ws / "p.html"), payload)
    raw = json.loads(plugin._ledger_path().read_text(encoding="utf-8"))[-1]
    assert raw["verdict"] == stored and type(raw["verdict"]) is str


def test_legacy_ledger_values_still_read_by_the_gate(plugin, ws):
    """Entries already on disk (plain strings, unknown values) read as before."""
    from conftest import put_entry
    (ws / "a.html").write_text("<p>a</p>")
    (ws / "b.html").write_text("<p>b</p>")
    put_entry(plugin, ws / "a.html", "SHIP")
    put_entry(plugin, ws / "b.html", "HOLD")
    put_entry(plugin, ws / "b.html", "SHIP")
    ledger = json.loads(plugin._ledger_path().read_text(encoding="utf-8"))
    ledger[-1].pop("sig", None)
    ledger[-1]["verdict"] = "LEGACY-UNKNOWN"
    plugin._sign_entry(ledger[-1])
    plugin._save_json(plugin._ledger_path(), ledger)
    verdicts = [e["verdict"] for e in plugin._gate_entries()]
    assert verdicts == ["SHIP", "HOLD"], "unknown stored verdicts never count"


def test_record_downgrades_a_ship_whose_artifact_changed(plugin, ws):
    p = ws / "p.html"
    p.write_text("<p>v1</p>")
    sha = plugin._file_sha256(p)
    p.write_text("<p>v2</p>")
    entry = plugin.record_verdict(str(p), {"outcome": "SHIP"}, expected_sha=sha)
    assert entry["verdict"] == "ERROR" and entry["error"] == "artifact changed during the audit"


class OutcomeMachine(RuleBasedStateMachine):
    """Random sequences of transitions on one audit result; the invariants hold after
    every step and illegal moves leave the result untouched."""

    def __init__(self):
        super().__init__()
        self.mod = _MOD
        self.res = {}
        self.model = None  # the reference model: None or an outcome name

    @rule(to=st.sampled_from(["SHIP", "HOLD", "ERROR"]), reason=st.none() | st.text(max_size=5))
    def move(self, to, reason):
        target = self.mod.AuditOutcome(to)
        before = dict(self.res)
        if to in LEGAL[self.model]:
            self.mod._set_outcome(self.res, target, reason)
            self.model = to
        else:
            with pytest.raises(self.mod.IllegalOutcomeTransition):
                self.mod._set_outcome(self.res, target, reason)
            assert self.res == before

    @precondition(lambda self: self.model is not None)
    @rule()
    def persist_and_reread(self):
        stored = self.mod._payload_verdict(json.loads(json.dumps(self.res)))
        assert stored.value == self.model

    @invariant()
    def row_matches_model(self):
        if self.model is None:
            assert self.mod.audit_outcome(self.res) is None
            return
        assert {k: self.res[k] for k in ("ok", "verdict", "outcome")} == EXPECTED_FIELDS[self.model]
        # The caller only ever sees SHIP for a SHIP outcome.
        assert (self.res["verdict"] == "SHIP") is (self.model == "SHIP")


_MOD = None


def test_outcome_state_machine(plugin):
    global _MOD
    _MOD = plugin
    try:
        OutcomeMachine.TestCase.settings = settings(max_examples=150, stateful_step_count=12, deadline=None)
        OutcomeMachine.TestCase().runTest()
    finally:
        _MOD = None
