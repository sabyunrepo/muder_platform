#!/usr/bin/env bash
# Safe wrapper around `gh pr create` for MMP.
# It prevents attaching `ready-for-ci` during PR creation so heavy CI starts only
# after CodeRabbit/Codecov/code-review issues are resolved.

set -euo pipefail

contains_ready_for_ci() {
  local value="$1"
  IFS=',' read -ra labels <<< "$value"
  for label in "${labels[@]}"; do
    label="${label#${label%%[![:space:]]*}}"
    label="${label%${label##*[![:space:]]}}"
    if [[ "$label" == "ready-for-ci" ]]; then
      return 0
    fi
  done
  return 1
}

prev=""
for arg in "$@"; do
  case "$prev" in
    --label|-l|--add-label)
      if contains_ready_for_ci "$arg"; then
        cat >&2 <<'MSG'
🚫 PR 생성 중단: `ready-for-ci` 라벨은 PR 생성 단계에서 붙일 수 없습니다.

순서:
1. PR 생성
2. CodeRabbit / Codecov Report / 코드 리뷰 이슈 확인
3. 수정 커밋 push + review thread resolve
4. 마지막에 `ready-for-ci` 라벨 부착으로 Full CI 실행
MSG
        exit 2
      fi
      ;;
  esac

  case "$arg" in
    --label=*|--add-label=*|-l=*)
      # Extract the value after the equals sign
      value="${arg#*=}"
      if contains_ready_for_ci "$value"; then
        cat >&2 <<'MSG'
🚫 PR 생성 중단: `ready-for-ci` 라벨은 PR 생성 단계에서 붙일 수 없습니다.

순서:
1. PR 생성
2. CodeRabbit / Codecov Report / 코드 리뷰 이슈 확인
3. 수정 커밋 push + review thread resolve
4. 마지막에 `ready-for-ci` 라벨 부착으로 Full CI 실행
MSG
        exit 2
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
   CodeRabbit/Codecov/리뷰 이슈 해결 후에만 `ready-for-ci` 라벨을 붙이세요.
MSG

if [[ "${PR_CREATE_GUARD_DRY_RUN:-}" == "1" ]]; then
  printf 'DRY RUN: gh pr create'
  printf ' %q' "$@"
  printf '\n'
  exit 0
fi

exec gh pr create "$@"
