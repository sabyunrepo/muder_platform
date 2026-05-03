#!/usr/bin/env bash
# Start isolated MMP issue work from latest origin/main.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage: scripts/mmp-start-issue-work.sh ISSUE_NUMBER [BRANCH_SLUG]

GitHub Issue 기준으로 새 worktree와 feature branch를 생성합니다.
- 기본 branch prefix: feat (BRANCH_PREFIX=docs 로 변경 가능)
- 기본 worktree 위치: .worktrees/<branch-name>
- 현재 worktree가 dirty면 중단합니다. 필요 시 ALLOW_DIRTY=1 로 우회하세요.

Example:
  scripts/mmp-start-issue-work.sh 248 phase-24-pr-6-phase-entity
  BRANCH_PREFIX=docs scripts/mmp-start-issue-work.sh 250 agent-workflow
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c 1-64
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -lt 1 ]]; then
  usage
  exit 0
fi

require_cmd git
require_cmd gh

issue_number="$1"
manual_slug="${2:-}"
branch_prefix="${BRANCH_PREFIX:-feat}"

if [[ "${ALLOW_DIRTY:-}" != "1" && -n "$(git status --porcelain)" ]]; then
  echo "🚫 현재 worktree에 미정리 변경이 있습니다. 먼저 commit/stash/worktree 분리 후 다시 실행하세요." >&2
  exit 2
fi

issue_title="$(gh issue view "$issue_number" --json title --jq '.title')"
if [[ -n "$manual_slug" ]]; then
  slug="$(slugify "$manual_slug")"
else
  slug="$(slugify "$issue_title")"
fi
if [[ -z "$slug" ]]; then
  slug="issue-$issue_number"
fi

branch_name="$branch_prefix/issue-$issue_number-$slug"
worktree_path=".worktrees/${branch_name//\//-}"

git fetch origin main
if git rev-parse --verify "$branch_name" >/dev/null 2>&1; then
  echo "🚫 이미 존재하는 branch입니다: $branch_name" >&2
  exit 3
fi
if [[ -e "$worktree_path" ]]; then
  echo "🚫 이미 존재하는 worktree path입니다: $worktree_path" >&2
  exit 4
fi

git worktree add -b "$branch_name" "$worktree_path" origin/main

cat <<MSG
✅ Issue 작업 worktree 생성 완료

- Issue: #$issue_number $issue_title
- Branch: $branch_name
- Worktree: $worktree_path

다음 단계:
1. cd "$worktree_path"
2. 관련 AGENTS.md와 docs/plans checklist 확인
3. 구현/검증 후 PR은 라벨 없이 생성
MSG
