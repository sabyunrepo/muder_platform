#!/usr/bin/env bash
# Safe wrapper around `gh pr create` for MMP.
# It prevents attaching `ready-for-ci` during PR creation so full-ci PRs start
# heavy CI only after CodeRabbit/Codecov/code-review issues are resolved.

set -euo pipefail

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

순서:
1. PR 생성
2. Coverage Plan 확인: 변경 파일/분기별 focused test 매핑을 PR 본문 또는 작업 메모에 기록
3. CodeRabbit / Codecov Report / 코드 리뷰 이슈 확인
4. 수정 커밋 push + review thread resolve
5. `scripts/mmp-pr-ci-scope.sh <PR>`로 full-ci / code-rabbit-only 분류
6. full-ci PR만 마지막에 `ready-for-ci` 라벨 부착으로 Full CI 실행
7. code-rabbit-only PR은 라벨 없이 light/focused validation 후 merge 판단
MSG
  exit 2
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

cat <<'MSG'
✅ PR 생성 가드 통과: `ready-for-ci` 라벨 없이 PR을 생성합니다.
   Coverage Plan과 focused test 근거를 PR 본문에 남긴 뒤, CodeRabbit/Codecov/리뷰 이슈 해결 후 full-ci PR에만 `ready-for-ci` 라벨을 붙이세요.
MSG

if [[ "${PR_CREATE_GUARD_DRY_RUN:-}" == "1" ]]; then
  printf 'DRY RUN: gh pr create'
  printf ' %q' "$@"
  printf '\n'
  exit 0
fi

exec gh pr create "$@"
