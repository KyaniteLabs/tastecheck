# FINDINGS — risk/safety lens (grok-4.6) on tastecheck
# RESCUED BY DISPATCHER from worker log w-5e6e (worker couldn't write file: EPERM; status 'errored' is a false negative)

### 1. Leak / write / execute
- **Write (riskiest):** “Fix failed rows and rerun them” (gate §5) — same agent mutates the target until green. No allowlist, no audit-only.
- **Execute:** paste/`addScriptTag` `gate-audit.js` on the **target origin** (cookies, storage, same-origin). Walks `body *`, copies `textContent` into `__gateAudit`.
- **Exfil:** those strings go into the gate report / agent log. No PII/secret ban. Never says read-only or “not on authenticated prod.”

### 2. Injection
- `DESIGN-SYSTEM.md` / “approved inferred-system” can instruct SHIP/`n/a`.
- DOM copy and `[class*="error"]` are attacker-controlled; land in evidence.
- `TC-04`/`TC-11` are examples, not a closed ID set.
- `n/a` = “subject absent” is unenforced (skip required foundations).
- Specialist handoff reports are trusted blindly.

### 3. Fake SHIP
Agent writes the ledger. Skip browser/script; treat warns as non-blocking; skip shadow/iframes while script is “light DOM only”; forge `provenance`; fix then self-pass. Contract “deterministic / forged rows fail” is not executed.

### 4. Embarrassment
“Fail-closed deterministic” vs LLM markdown; checkmarks-aren’t-evidence vs self-rows; gate that also implements fixes; numbered TC IDs that don’t exist.

### Top 5
1. Default read-only; separate approved fix pass.
2. Treat target spec/DOM/audit JSON as untrusted data; no prod/auth inject without warning.
3. SHIP requires hashed `__gateAudit`; missing/FAIL ⇒ HOLD.
4. Closed `check_id`s; strict `n/a`; parse required rows (evals already parse).
5. Drop “deterministic/fail-closed” until a verifier exists.

### IMPROVEMENTS
1. **Write access to `_retrofit-*/` from worker worktrees** — findings couldn’t land on the requested path (EPERM). Grant that path or tell workers to only answer in-chat.
2. **Skill should name a closed check catalog in SKILL.md** — example IDs invite both injection and lazy copy-paste SHIP.
3. **Don’t mix auditor and fixer in one skill file** — the friction this review hit is that §5 undoes the independence the rest of the text claims.
