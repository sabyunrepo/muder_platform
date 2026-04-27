#!/usr/bin/env bash
# compound-mmp 단일 hook 디스패처. Superpowers 패턴 차용.
# 사용법: run-hook.sh <event>
#   event ∈ {dispatch, pre-edit-size, pre-task-model, session-start, stop-wrap-reminder}
#
# Claude Code hook system이 stdin으로 JSON event payload를 전달하고, stdout은 hookSpecificOutput JSON 또는 빈 응답.
# CLAUDE_PLUGIN_ROOT는 marketplace runtime이 자동 설정.

set -eu

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
EVENT="${1:-}"

case "$EVENT" in
  dispatch)
    # PR-4에서 구현. UserPromptSubmit hook → dispatch-router.sh
    if [ -x "$PLUGIN_ROOT/hooks/dispatch-router.sh" ]; then
      exec "$PLUGIN_ROOT/hooks/dispatch-router.sh"
    fi
    exit 0
    ;;
  pre-edit-size)
    # PR-5에서 구현. PreToolUse(Edit|Write) hook
    if [ -x "$PLUGIN_ROOT/hooks/pre-edit-size-check.sh" ]; then
      exec "$PLUGIN_ROOT/hooks/pre-edit-size-check.sh"
    fi
    exit 0
    ;;
  pre-task-model)
    # PR-6에서 구현. PreToolUse(Task) hook
    if [ -x "$PLUGIN_ROOT/hooks/pre-task-model-guard.sh" ]; then
      exec "$PLUGIN_ROOT/hooks/pre-task-model-guard.sh"
    fi
    exit 0
    ;;
  session-start)
    # PR-6에서 구현. SessionStart hook
    if [ -x "$PLUGIN_ROOT/hooks/session-start-context.sh" ]; then
      exec "$PLUGIN_ROOT/hooks/session-start-context.sh"
    fi
    exit 0
    ;;
  stop-wrap-reminder)
    # 이번 PR-3에서 구현. Stop hook → 변경 50줄+ 이고 wrap 미실행이면 한 줄 리마인드
    exec "$PLUGIN_ROOT/hooks/stop-wrap-reminder.sh"
    ;;
  "")
    echo "Usage: run-hook.sh <event>" >&2
    exit 1
    ;;
  *)
    echo "Unknown event: $EVENT" >&2
    exit 1
    ;;
esac
