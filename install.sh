#!/usr/bin/env bash
# frontend-skills installer — symlinks the skills into detected agent skill dirs.
# Re-runnable (idempotent). No sudo, no network. Links point back into this repo, so
# `git pull` updates every agent at once.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$REPO/skills"
FORCE=0
COMMANDS=ask

usage() {
  cat <<'USAGE'
Usage: ./install.sh [--force] [--yes|--no-commands]

  --force        Move pre-existing real skill dirs/files aside before linking.
  --yes          Copy Claude Code slash commands without prompting.
  --no-commands  Do not copy Claude Code slash commands.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --yes) COMMANDS=yes ;;
    --no-commands) COMMANDS=no ;;
    -h|--help) usage; exit 0 ;;
    *) echo "ERROR: unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

SKILLS=()
while IFS= read -r skill_dir; do
  SKILLS+=("$(basename "$skill_dir")")
done < <(find "$SKILLS_SRC" -mindepth 1 -maxdepth 1 -type d -name '*' | sort)

# Agent homes that use a ~/<home>/skills/ convention.
# ~/.agents is canonical because the slash commands load from that path.
HOMES=(.claude .codex .gemini .cursor .kilocode .kimi)

echo "frontend-skills installer"
echo "repo: $REPO"
echo

link_skill() {
  local src="$1"
  local dest="$2"
  local backup

  if [ -e "$dest" ] && [ ! -L "$dest" ]; then
    if [ "$FORCE" = 1 ]; then
      backup="${dest}.backup.$(date +%Y%m%d%H%M%S)"
      mv "$dest" "$backup"
      echo "    moved existing $(basename "$dest") to $backup"
    else
      cat >&2 <<ERROR
ERROR: $dest already exists and is not a symlink.
       Move it aside, or rerun with --force to create a timestamped backup.
ERROR
      return 1
    fi
  fi

  if [ -L "$dest" ]; then
    rm "$dest"
  fi

  ln -s "$src" "$dest"

  if [ ! -L "$dest" ] || [ "$(readlink "$dest")" != "$src" ]; then
    echo "ERROR: failed to link $dest -> $src" >&2
    return 1
  fi
}

install_home() {
  local h="$1"
  local home="$HOME/$h"
  mkdir -p "$home/skills"

  for s in "${SKILLS[@]}"; do
    link_skill "$SKILLS_SRC/$s" "$home/skills/$s"
  done

  echo "  linked ${#SKILLS[@]} skills into ~/$h/skills/"
}

# Always install the canonical path used by slash commands.
install_home ".agents"

linked_detected=0
for h in "${HOMES[@]}"; do
  [ -d "$HOME/$h" ] || continue
  install_home "$h"
  linked_detected=1
done

if [ "$linked_detected" = 0 ]; then
  echo "  No detected agent-specific home found (.claude/.codex/.gemini/.cursor/.kilocode/.kimi)."
  echo "  Canonical skills are available at ~/.agents/skills/."
fi

# Optional: Claude Code slash commands
if [ -d "$HOME/.claude" ]; then
  if [ "$COMMANDS" = ask ]; then
    read -r -p $'\nCopy slash commands into ~/.claude/commands/ (Claude Code)? [y/N] ' ans || ans=n
    [[ "${ans:-n}" =~ ^[Yy]$ ]] && COMMANDS=yes || COMMANDS=no
  fi

  if [ "$COMMANDS" = yes ]; then
    mkdir -p "$HOME/.claude/commands"
    cp "$REPO/commands/"*.md "$HOME/.claude/commands/"
    command_count=$(find "$REPO/commands" -maxdepth 1 -type f -name '*.md' | wc -l | tr -d ' ')
    echo "  copied $command_count Claude Code slash commands into ~/.claude/commands/"
  fi
fi

echo
echo "Done. Canonical skills: ~/.agents/skills/"
echo "Verify: test -L ~/.agents/skills/theming && test -L ~/.agents/skills/web-typography"
