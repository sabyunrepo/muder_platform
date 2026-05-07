#!/usr/bin/env bash
# Safe wrapper around `gh pr create` for MMP.
# It prevents attaching `ready-for-ci`; development-minimum PRs use
# CodeRabbit + local validation instead of GitHub CI workers.

set -euo pipefail

base_ref="${MMP_PR_GUARD_BASE_REF:-origin/main}"
if ! git rev-parse --verify "$base_ref" >/dev/null 2>&1; then
  base_ref="${MMP_PR_GUARD_FALLBACK_BASE_REF:-main}"
fi

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    cat >&2 <<'MSG'
🚫 PR 생성 중단: 로컬 CI marker 확인에는 jq가 필요합니다.
   macOS: brew install jq
   Linux: apt-get install jq
MSG
    exit 2
  fi
}

local_ci_marker() {
  local common_dir
  common_dir="$(git rev-parse --git-common-dir 2>/dev/null || true)"
  [ -n "$common_dir" ] || return 1
  printf '%s/mmp-local-ci/last-run.json\n' "$common_dir"
}

contains_ready_for_ci() {
  local value="$1"
  IFS=',' read -ra labels <<< "$value"
  for label in "${labels[@]}"; do
    label="${label#"${label%%[![:space:]]*}"}"
    label="${label%"${label##*[![:space:]]}"}"
    if [[ "$label" == "ready-for-ci" ]]; then
      return 0
    fi
  done
  return 1
}

fail_ready_for_ci() {
  cat >&2 <<'MSG'
🚫 PR 생성 중단: `ready-for-ci` 라벨은 PR 생성 단계에서 붙일 수 없습니다.

개발 최소 워커 모드 순서:
1. PR 생성
2. Coverage Plan 확인: 변경 파일/분기별 focused test 매핑을 PR 본문 또는 작업 메모에 기록
3. PR 묶음 확인: 같은 이슈/같은 CI scope의 저충돌 workflow 변경은 하나로 묶고, 실패 영향이 큰 변경만 분리
4. CodeRabbit 리뷰 이슈 확인
5. 수정 커밋 push + review thread resolve
6. 최신 HEAD 기준 local validation 근거 확인
7. `ready-for-ci` 라벨이나 workflow_dispatch 없이 merge 판단
MSG
  exit 2
}

changed_code_files() {
  local merge_base
  merge_base="$(git merge-base "$base_ref" HEAD 2>/dev/null || true)"
  [ -n "$merge_base" ] || return 0

  git diff --name-only "$merge_base"...HEAD -- \
    'apps/**' \
    'packages/**' \
    'tooling/**' \
    'package.json' \
    'pnpm-lock.yaml' \
    'turbo.json' \
    'apps/server/go.mod' \
    'apps/server/go.sum'
}

require_local_ci_for_code_changes() {
  local code_files
  code_files="$(changed_code_files)"
  [ -n "$code_files" ] || return 0

  if [ "${MMP_SKIP_LOCAL_CI_GUARD:-}" = "1" ]; then
    cat >&2 <<'MSG'
⚠️ 로컬 CI 가드 우회: MMP_SKIP_LOCAL_CI_GUARD=1 이 설정되어 있습니다.
   PR 본문에 우회 사유와 대체 검증 근거를 반드시 남기세요.
MSG
    return 0
  fi

  local marker head marker_head marker_status
  require_jq
  marker="$(local_ci_marker)"
  head="$(git rev-parse HEAD)"

  if [ ! -f "$marker" ]; then
    cat >&2 <<MSG
🚫 PR 생성 중단: 코드 변경이 있지만 로컬 CI 성공 기록이 없습니다.

변경된 코드 경로:
$code_files

먼저 다음 중 하나를 실행하세요:
  scripts/mmp-local-ci.sh quick
  scripts/mmp-local-ci.sh coverage
  scripts/mmp-local-ci.sh full

예외가 필요한 운영/긴급 PR이면:
  MMP_SKIP_LOCAL_CI_GUARD=1 scripts/pr-create-guard.sh ...

marker: $marker
MSG
    exit 2
  fi

  marker_head="$(jq -r '.head // ""' "$marker" 2>/dev/null || true)"
  marker_status="$(jq -r '.status // ""' "$marker" 2>/dev/null || true)"

  if [ "$marker_head" != "$head" ] || [ "$marker_status" != "success" ]; then
    cat >&2 <<MSG
🚫 PR 생성 중단: 로컬 CI 기록이 현재 HEAD 성공 기록과 일치하지 않습니다.

현재 HEAD: $head
marker HEAD: ${marker_head:-<missing>}
marker status: ${marker_status:-<missing>}

최종 커밋 이후 다시 실행하세요:
  scripts/mmp-local-ci.sh quick
  scripts/mmp-local-ci.sh coverage
  scripts/mmp-local-ci.sh full
MSG
    exit 2
  fi
}

prev=""
for arg in "$@"; do
  case "$prev" in
    --label|-l|--add-label)
      if contains_ready_for_ci "$arg"; then
        fail_ready_for_ci
      fi
      ;;
  esac

  case "$arg" in
    --label=*|--add-label=*|-l=*)
      label_value="${arg#*=}"
      if contains_ready_for_ci "$label_value"; then
        fail_ready_for_ci
      fi
      ;;
  esac

  if [[ "$arg" == "--label" || "$arg" == "-l" || "$arg" == "--add-label" ]]; then
    prev="$arg"
  else
    prev=""
  fi
done

require_local_ci_for_code_changes

cat <<'MSG'
✅ PR 생성 가드 통과: `ready-for-ci` 라벨 없이 PR을 생성합니다.
   Coverage Plan과 local validation 근거를 PR 본문에 남긴 뒤, CodeRabbit 리뷰 이슈 해결 후 merge 판단하세요.
   같은 CI scope의 저충돌 workflow 변경은 하나의 PR로 묶고, heavy CI를 반복 소모하는 초소형 PR은 피하세요.
MSG

if [[ "${PR_CREATE_GUARD_DRY_RUN:-}" == "1" ]]; then
  printf 'DRY RUN: gh pr create'
  printf ' %q' "$@"
  printf '\n'
  exit 0
fi

exec gh pr create "$@"
