# ROLE: RISK & SAFETY LENS (GLM-5.3) — tastecheck stage-1
Read _retrofit-2026-09-04/FACTS.md first; it is authoritative.
Your lens: RISK + SAFETY of the product itself:
- assets/gate-audit.js runs in users' browsers on cold load — audit it as untrusted-adjacent code: what can it touch, does it exfiltrate anything (any network calls at all?), failure modes on locked-down CSP, errors swallowed?
- install.sh: what does it install where, clobber risks, curl|sh patterns, permissions.
- Skill-text safety: instructions that could push an agent to modify user code without approval, or treat untested as passed; "n/a" semantics leaking into SHIP verdicts.
- Supply chain: package.json deps minimal? lockfile sane? fonts licensing (FONTS-LICENSES.md) obligations intact in site/?
- Public embarrassment modes: anything in site/ or llms.txt that overclaims (would not survive scrutiny).
Output ONLY: _retrofit-2026-09-04/FINDINGS-glm.md (FACTS contract).
