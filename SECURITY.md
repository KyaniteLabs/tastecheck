# Security policy

## Report a vulnerability privately

Use GitHub private vulnerability reporting: open the **Security** tab of [KyaniteLabs/tastecheck](https://github.com/KyaniteLabs/tastecheck) and choose **Report a vulnerability** (a private security advisory). Please do not open a public issue for a security problem.

Include what you did, what you expected, what happened, and the version or commit.

## What is in scope

- Forging or tampering with receipts, ledgers or review bindings so the gate returns SHIP when it should return HOLD
- Any gate bypass: a way to pass a required check without evidence
- Unsafe execution in the CLI, installer or scripts (path traversal, symlink writes outside the target, command injection)
- Leaking secrets or personal data through reports, receipts or logs

## Out of scope

- Disagreement with a subjective design verdict
- Issues in third-party tools or in your own project being checked

## What to expect

We aim to acknowledge reports within a few days and will tell you when a fix ships. Only the latest release is supported.
