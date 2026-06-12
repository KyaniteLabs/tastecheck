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
Usage: ./install.sh [--force] [--yes|--no-commands] [--uninstall]

  --force        Move pre-existing real skill dirs/files aside before linking.
  --yes          Link Claude Code slash commands without prompting.
  --no-commands  Do not link Claude Code slash commands.
  --uninstall    Remove every symlink this installer created (links that point
                 into this repo) from all agent homes, then exit.

Notes on agent homes: skills are always linked into the canonical ~/.agents/skills/.
They are also mirrored into ~/.claude, ~/.codex, ~/.gemini, ~/.cursor, ~/.kilocode and
~/.kimi when those directories already exist — but whether an agent AUTO-LOADS from
its directory varies by agent and version. If yours doesn't, point it at the SKILL.md
files in ~/.agents/skills/ directly.
USAGE
}

UNINSTALL=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --yes) COMMANDS=yes ;;
    --no-commands) COMMANDS=no ;;
    --uninstall) UNINSTALL=1 ;;
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

uninstall_all() {
  local removed=0
  for h in .agents "${HOMES[@]}"; do
    local sk="$HOME/$h/skills"
    [ -d "$sk" ] || continue
    for link in "$sk"/*; do
      [ -L "$link" ] || continue
      case "$(readlink "$link")" in
        "$SKILLS_SRC"/*) rm "$link"; removed=$((removed+1)) ;;
      esac
    done
  done
  local cmds="$HOME/.claude/commands"
  if [ -d "$cmds" ]; then
    for link in "$cmds"/*.md; do
      [ -L "$link" ] || continue
      case "$(readlink "$link")" in
        "$REPO/commands/"*) rm "$link"; removed=$((removed+1)) ;;
      esac
    done
  fi
  echo "Removed $removed tastecheck symlinks."
}

if [ "$UNINSTALL" = 1 ]; then
  uninstall_all
  exit 0
fi

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
    read -r -p $'\nLink slash commands into ~/.claude/commands/ (Claude Code)? [y/N] ' ans || ans=n
    [[ "${ans:-n}" =~ ^[Yy]$ ]] && COMMANDS=yes || COMMANDS=no
  fi

  if [ "$COMMANDS" = yes ]; then
    mkdir -p "$HOME/.claude/commands"
    command_count=0
    for cmd in "$REPO/commands/"*.md; do
      link_skill "$cmd" "$HOME/.claude/commands/$(basename "$cmd")"
      command_count=$((command_count+1))
    done
    echo "  linked $command_count Claude Code slash commands into ~/.claude/commands/ (git pull updates them)"
  fi
fi

echo
echo "Done. Canonical skills: ~/.agents/skills/"
echo "Verify: test -L ~/.agents/skills/theming && test -L ~/.agents/skills/web-typography"
