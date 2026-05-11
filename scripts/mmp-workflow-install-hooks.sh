#!/usr/bin/env bash
# Install/uninstall repository hooks for MMP workflow strictness.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage:
  scripts/mmp-workflow-install-hooks.sh install [--force]
  scripts/mmp-workflow-install-hooks.sh uninstall
  scripts/mmp-workflow-install-hooks.sh status

Commands:
  install   .githooks/pre-push 설치 및 core.hooksPath 설정
  uninstall 기존 hooksPath 복원(원복 값이 없으면 해제)
  status    현재 hooksPath 및 MMP hook 설치 상태 출력

Options:
  --force   기존 hooksPath가 이미 있을 때 강제 교체
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

require_cmd git
require_cmd mkdir

ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$ROOT/.githooks"
HOOK_PATH_KEY="hooks.mmp-workflow.previous-path"
HOOK_SCRIPT="$HOOK_DIR/pre-push"
HOOK_SCRIPT_CONTENT='#!/usr/bin/env bash
set -euo pipefail

if [[ "${MMP_WORKFLOW_HOOKS_ENABLED:-1}" != "1" ]]; then
  exit 0
fi

if [[ "${MMP_WORKFLOW_INTERVIEW_STRICT:-1}" != "1" ]]; then
  exit 0
fi

if [[ "${MMP_WORKFLOW_HOOKS_SKIP:-0}" == "1" ]]; then
  exit 0
fi

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

if [[ ! -f scripts/mmp-workflow-gate.sh ]]; then
  echo "🚫 mmp-workflow-gate.sh 을 찾지 못했습니다." >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if ! scripts/mmp-workflow-gate.sh branch --branch "$branch" --min-status approved --require-acceptance --require-done; then
  echo "🚫 pre-push 차단: PR 가드 조건이 충족되지 않았습니다." >&2
  echo "   조건: branch 패턴(issue-번호) + seed approved/completed + acceptance/done 존재" >&2
  echo "   조치: scripts/mmp-workflow-agent.sh bootstrap --issue <번호> --auto-approve" >&2
  echo "        또는 환경 변수로 issue를 지정 후 재시도하세요." >&2
  exit 1
fi
'

install_hook() {
  local force="${1:-0}"
  local current_hooks_path
  local prev
  current_hooks_path="$(git config --get core.hooksPath || true)"

  if [[ -n "$current_hooks_path" && "$current_hooks_path" != ".githooks" ]]; then
    if [[ "$force" != "1" ]]; then
      echo "🚫 기존 hooksPath가 설정되어 있어 설치를 중단했습니다: $current_hooks_path" >&2
      echo "   재실행: scripts/mmp-workflow-install-hooks.sh install --force" >&2
      exit 2
    fi
    if [[ "$current_hooks_path" != ".githooks" ]]; then
      git config "$HOOK_PATH_KEY" "$current_hooks_path"
    fi
  elif [[ -z "$current_hooks_path" ]]; then
    git config "$HOOK_PATH_KEY" "<unset>"
  fi

  mkdir -p "$HOOK_DIR"
  printf '%s\n' "$HOOK_SCRIPT_CONTENT" > "$HOOK_SCRIPT"
  chmod +x "$HOOK_SCRIPT"

  git config core.hooksPath .githooks
  echo "✅ 설치 완료: core.hooksPath -> .githooks"
  echo "   설치된 훅: $HOOK_SCRIPT"
  prev="$(git config --get "$HOOK_PATH_KEY" || true)"
  if [[ "$prev" != "<unset>" ]]; then
    echo "   이전 hooksPath 백업: $prev"
  fi
}

status_hooks() {
  local current_hooks_path
  local previous_path
  current_hooks_path="$(git config --get core.hooksPath || true)"
  previous_path="$(git config --get "$HOOK_PATH_KEY" || true)"

  echo "현재 hooksPath: ${current_hooks_path:-<unset>}"
  echo "백업 hooksPath: ${previous_path:-<unset>}"
  if [[ "$current_hooks_path" == ".githooks" && -f "$HOOK_SCRIPT" ]]; then
    echo "MMP pre-push hook: installed"
  else
    echo "MMP pre-push hook: missing"
  fi
}

uninstall_hook() {
  local previous_path
  previous_path="$(git config --get "$HOOK_PATH_KEY" || true)"
  if [[ "$previous_path" == ".githooks" ]]; then
    previous_path=""
  fi

  if [[ -n "$previous_path" && "$previous_path" != "<unset>" ]]; then
    git config core.hooksPath "$previous_path"
    echo "✅ core.hooksPath 복원: $previous_path"
  else
    git config --unset core.hooksPath || true
    echo "✅ core.hooksPath 해제"
  fi

  if git config --get "$HOOK_PATH_KEY" >/dev/null 2>&1; then
    git config --unset "$HOOK_PATH_KEY"
  fi
}

cmd="${1:-}"
case "$cmd" in
  install)
    shift
    if [[ "${1:-}" == "--force" ]]; then
      install_hook 1
    else
      install_hook 0
    fi
    ;;
  uninstall)
    uninstall_hook
    ;;
  status)
    status_hooks
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "🚫 알 수 없는 명령: $cmd" >&2
    usage
    exit 2
    ;;
esac
