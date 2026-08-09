#!/usr/bin/env bash
# 把本倉庫的 skill 軟連結到 Claude Code 和/或 codex 的 skills 目錄。
# 軟連結而不是複製：git pull 之後立刻生效。
#
#   ./scripts/install.sh              裝全部，裝到檢測到的所有 agent
#   ./scripts/install.sh novel-characters
#   ./scripts/install.sh --claude     只裝到 Claude Code
#   ./scripts/install.sh --codex      只裝到 codex
#   ./scripts/install.sh --uninstall  取消軟連結
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_DIR="$REPO/skills"

targets=()
wanted=()
uninstall=0

for arg in "$@"; do
  case "$arg" in
    --claude)    targets+=("$HOME/.claude/skills") ;;
    --codex)     targets+=("$HOME/.codex/skills") ;;
    --uninstall) uninstall=1 ;;
    -h|--help)   sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)          echo "未知選項 $arg" >&2; exit 1 ;;
    *)           wanted+=("$arg") ;;
  esac
done

# 沒指定目標就自動檢測：哪個 agent 裝了就裝到哪
if [ ${#targets[@]} -eq 0 ]; then
  [ -d "$HOME/.claude" ] && targets+=("$HOME/.claude/skills")
  [ -d "$HOME/.codex" ] && targets+=("$HOME/.codex/skills")
fi
if [ ${#targets[@]} -eq 0 ]; then
  echo "沒找到 ~/.claude 或 ~/.codex，指定 --claude 或 --codex 試試" >&2
  exit 1
fi

# 沒指定 skill 就裝全部
if [ ${#wanted[@]} -eq 0 ]; then
  for d in "$SKILLS_DIR"/*/; do
    [ -f "$d/SKILL.md" ] && wanted+=("$(basename "$d")")
  done
fi

for target in "${targets[@]}"; do
  mkdir -p "$target"
  for name in "${wanted[@]}"; do
    src="$SKILLS_DIR/$name"
    dst="$target/$name"
    if [ ! -f "$src/SKILL.md" ]; then
      echo "✗ $name — 不是一個 skill（缺 SKILL.md）" >&2
      exit 1
    fi
    if [ "$uninstall" -eq 1 ]; then
      if [ -L "$dst" ]; then rm "$dst"; echo "− $dst"; fi
      continue
    fi
    # 只覆蓋軟連結；真實目錄是使用者自己放的，不動
    if [ -e "$dst" ] && [ ! -L "$dst" ]; then
      echo "✗ $dst 已存在且不是軟連結，跳過" >&2
      continue
    fi
    ln -sfn "$src" "$dst"
    echo "✓ $dst → $src"
  done
done
