#!/usr/bin/env bash
# Classify whether an MMP PR should run full CI or the CodeRabbit-only exception.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage: scripts/mmp-pr-ci-scope.sh [--format text|env] [--stdin] [PR_NUMBER]

PR 변경 파일이 heavy CI path filter에 걸리는지 분류합니다.

Modes:
- full-ci: apps/runtime/test/build/security/workflow trigger path를 변경했습니다.
- code-rabbit-only: heavy CI가 의도적으로 생성되지 않는 운영/문서/규칙 경로만 변경했습니다.

Examples:
  scripts/mmp-pr-ci-scope.sh 334
  git diff --name-only origin/main...HEAD | scripts/mmp-pr-ci-scope.sh --stdin --format env
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

format="text"
from_stdin="0"
pr_number=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --format)
      format="$2"
      shift 2
      ;;
    --stdin)
      from_stdin="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "알 수 없는 옵션: $1" >&2
      usage >&2
      exit 64
      ;;
    *)
      if [[ -n "$pr_number" ]]; then
        echo "PR_NUMBER는 하나만 지정할 수 있습니다." >&2
        usage >&2
        exit 64
      fi
      pr_number="$1"
      shift
      ;;
  esac
done

if [[ "$format" != "text" && "$format" != "env" ]]; then
  echo "--format 값은 text 또는 env 여야 합니다: $format" >&2
  exit 64
fi

heavy_reason_for_path() {
  local path="$1"
  case "$path" in
    apps/*|packages/*|tooling/*)
      printf 'app/runtime/package/tooling'
      ;;
    .github/workflows/*)
      printf 'workflow-definition'
      ;;
    package.json|pnpm-lock.yaml|turbo.json)
      printf 'node-build-root'
      ;;
    playwright.config.ts|e2e/*)
      printf 'e2e-config-or-spec'
      ;;
    go.mod|go.sum|*/go.mod|*/go.sum|.gitleaks.toml)
      printf 'security-or-dependency'
      ;;
    infra/runners/Dockerfile|infra/runners/hooks/*)
      printf 'runner-image'
      ;;
    *)
      return 1
      ;;
  esac
}

files=()
if [[ "$from_stdin" == "1" ]]; then
  while IFS= read -r line; do
    [[ -n "$line" ]] && files+=("$line")
  done
else
  require_cmd gh
  if [[ -z "$pr_number" ]]; then
    pr_number="$(gh pr view --json number --jq '.number')"
  fi
  while IFS= read -r line; do
    [[ -n "$line" ]] && files+=("$line")
  done < <(gh pr diff "$pr_number" --name-only)
fi

heavy=()
light=()
for file in "${files[@]}"; do
  if reason="$(heavy_reason_for_path "$file")"; then
    heavy+=("$file:$reason")
  else
    light+=("$file")
  fi
done

if [[ "${#heavy[@]}" -gt 0 ]]; then
  scope="full-ci"
else
  scope="code-rabbit-only"
fi

if [[ "$format" == "env" ]]; then
  printf 'CI_SCOPE=%q\n' "$scope"
  printf 'CI_HEAVY_COUNT=%q\n' "${#heavy[@]}"
  printf 'CI_LIGHT_COUNT=%q\n' "${#light[@]}"
  printf 'CI_HEAVY_FILES=%q\n' "$(IFS=','; printf '%s' "${heavy[*]}")"
  printf 'CI_LIGHT_FILES=%q\n' "$(IFS=','; printf '%s' "${light[*]}")"
else
  printf 'CI scope: %s\n' "$scope"
  if [[ "${#heavy[@]}" -gt 0 ]]; then
    printf 'Heavy CI trigger files:\n'
    printf -- '- %s\n' "${heavy[@]}"
  else
    printf 'Heavy CI trigger files: none\n'
  fi
  if [[ "${#light[@]}" -gt 0 ]]; then
    printf 'Light/operational files:\n'
    printf -- '- %s\n' "${light[@]}"
  fi
fi
