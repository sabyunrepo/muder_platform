#!/usr/bin/env bash
# /compound-work --dry-run 헬퍼.
# pr-id + (env) ACTIVE_PHASE/SCOPE/BASE_BRANCH 입력 → worktree+tdd+executor+post_test 단계 시퀀스 JSON 출력.
#
# 출력 형식 (plan § /compound-work 사양):
#   {
#     "pr_id": "PR-1",
#     "worktree": {"skill": "superpowers:using-git-worktrees", "branch": "feat/...", "base": "main"},
#     "tdd_skill": "compound-mmp:tdd-mmp-go" | "compound-mmp:tdd-mmp-react",
#     "executor": {"subagent_type": "oh-my-claudecode:executor", "model": "claude-sonnet-4-6"},
#     "post_test": "go test -race ./..." | "pnpm --filter web test",
#     "mandatory_slots": ["tdd-test-first"]
#   }
#
# 사용:
#   ACTIVE_PHASE=docs/plans/<phase> SCOPE=go BASE_BRANCH=main \
#     bash scripts/compound-work-dry-run.sh PR-1
#
# Exit codes:
#   0 — 정상
#   2 — pr-id 또는 SCOPE 화이트리스트 실패
#   3 — ACTIVE_PHASE 환경 변수 누락 또는 디렉토리 부재
#   5 — jq missing
#
# 카논:
#   - executor 모델: claude-sonnet-4-6 (4.5 차단 — pre-task-model-guard.sh 와 정합)
#   - mandatory_slots: tdd-test-first (M-N1 sister 어휘 통일, refs/mandatory-slots-canon.md)
#   - 자동 머지 금지: 출력에 admin-merge/auto-merge/gh pr merge 토큰 미포함

set -eu

PR_ID="${1:-}"

# 1. pr-id 화이트리스트
if [[ ! "$PR_ID" =~ ^PR-[0-9]+[a-z]?$ ]]; then
  printf 'ERROR: pr-id must match ^PR-[0-9]+[a-z]?$, got %q\n' "$PR_ID" >&2
  exit 2
fi

# 2. ACTIVE_PHASE 검증 (active phase 디렉토리 존재 확인)
ACTIVE_PHASE="${ACTIVE_PHASE:-}"
if [ -z "$ACTIVE_PHASE" ] || [ ! -d "$ACTIVE_PHASE" ]; then
  printf 'ERROR: ACTIVE_PHASE env required, directory must exist: %q\n' "$ACTIVE_PHASE" >&2
  exit 3
fi

# 3. SCOPE 화이트리스트 (go|react)
SCOPE="${SCOPE:-go}"
case "$SCOPE" in
  go|react) ;;
  *)
    printf 'ERROR: SCOPE must be one of {go,react}, got %q\n' "$SCOPE" >&2
    exit 2
    ;;
esac

# 4. BASE_BRANCH 기본값
BASE_BRANCH="${BASE_BRANCH:-main}"

# 5. jq 사전 검사
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required for token substitution (security: shell injection 차단)" >&2
  exit 5
fi

# 6. SCOPE에 따라 tdd skill / post_test 결정
if [ "$SCOPE" = "go" ]; then
  TDD_SKILL="compound-mmp:tdd-mmp-go"
  POST_TEST="cd apps/server && go test -race ./internal/..."
else
  TDD_SKILL="compound-mmp:tdd-mmp-react"
  POST_TEST="pnpm --filter web test"
fi

# 7. branch 자동 생성 패턴 (feat/<project-slug>/<pr-id>-<scope>)
# HIGH-A1 round-1: branch 명명 sister 카논 align (memory/sessions 7건 모두 feat/compound-mmp/...).
# PROJECT_SLUG env 우선 (plugin work 시 명시), 없으면 ACTIVE_PHASE basename fallback (phase work).
# MED-P1 round-1: parameter expansion `${VAR##*/}`로 basename fork 제거 (sister 1 fork 패리티).
# MED-S1 round-1: PROJECT_SLUG에 화이트리스트 적용 (sister 카논 대칭, downstream branch 안전).
PROJECT_SLUG="${PROJECT_SLUG:-${ACTIVE_PHASE##*/}}"
if [[ ! "$PROJECT_SLUG" =~ ^[a-z0-9_.-]+$ ]]; then
  printf 'ERROR: PROJECT_SLUG must match ^[a-z0-9_.-]+$, got %q\n' "$PROJECT_SLUG" >&2
  exit 2
fi
BRANCH="feat/${PROJECT_SLUG}/${PR_ID}-${SCOPE}"

# 8. JSON 출력 (jq --arg 안전 토큰 치환)
jq -nc \
  --arg pr_id "$PR_ID" \
  --arg branch "$BRANCH" \
  --arg base "$BASE_BRANCH" \
  --arg tdd "$TDD_SKILL" \
  --arg post "$POST_TEST" \
  '{
    pr_id: $pr_id,
    worktree: {
      skill: "superpowers:using-git-worktrees",
      branch: $branch,
      base: $base
    },
    tdd_skill: $tdd,
    executor: {
      subagent_type: "oh-my-claudecode:executor",
      model: "claude-sonnet-4-6"
    },
    post_test: $post,
    mandatory_slots: ["tdd-test-first"]
  }'
