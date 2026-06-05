#!/usr/bin/env bash
# frontend-skills installer — symlinks the skills into any detected agent's skills dir.
# Re-runnable (idempotent). No sudo, no network. Links point back into this repo, so
# `git pull` updates every agent at once.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$REPO/skills"
SKILLS=(design-system-interview web-typography deslop-ui dark-mode color-system \
        responsive-layout component-states form-ux empty-states micro-motion a11y-pass)

# Agent homes that use a ~/<home>/skills/ convention
HOMES=(.claude .codex .gemini .cursor .kilocode .kimi)

echo "frontend-skills installer"
echo "repo: $REPO"
echo

linked_any=0
for h in "${HOMES[@]}"; do
  home="$HOME/$h"
  [ -d "$home" ] || continue
  mkdir -p "$home/skills"
  for s in "${SKILLS[@]}"; do
    ln -sfn "$SKILLS_SRC/$s" "$home/skills/$s"
  done
  echo "  linked 10 skills into ~/$h/skills/"
  linked_any=1
done

if [ "$linked_any" = 0 ]; then
  echo "  No known agent home found (.claude/.codex/.gemini/.cursor/.kilocode/.kimi)."
  echo "  Point your agent at: $SKILLS_SRC/<name>/SKILL.md"
fi

# Optional: Claude Code slash commands
if [ -d "$HOME/.claude" ]; then
  read -r -p $'\nCopy slash commands into ~/.claude/commands/ (Claude Code)? [y/N] ' ans || ans=n
  if [[ "${ans:-n}" =~ ^[Yy]$ ]]; then
    mkdir -p "$HOME/.claude/commands"
    cp "$REPO/commands/"*.md "$HOME/.claude/commands/"
    echo "  copied: /designsystem /typography /deslop /colorsystem /darkmode /responsive /states /formux /emptystates /motion /a11y"
  fi
fi

echo
echo "Done. Skills auto-load when your request matches them (e.g. \"fix this dark mode\")."
echo "Verify: ls ~/.claude/skills/ | grep -E 'dark-mode|web-typography'  (or your agent's home)"
