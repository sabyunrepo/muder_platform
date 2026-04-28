#!/usr/bin/env bash
# pre-task-model-guard.sh
# PreToolUse(Task) hook — Sonnet 4.5 차단 + 4.6 안내.
#
# 카논:
#   - Sonnet 4.6 기본: memory/feedback_sonnet_46_default.md
#                     (서브에이전트 = sonnet-4-6, 검색 = haiku-4-5, 보안/아키텍처 = opus-4-7)
#   - 검증 시뮬레이션 Case C: refs/sim-case-c.md
#
# 입력 (stdin JSON, Claude Code PreToolUse 표준 payload):
#   {tool_name: "Task",
#    tool_input: {prompt, subagent_type, model?, ...}}
#
# 출력 (stdout):
#   - silent (tool_name != Task, 또는 4.5 미언급): exit 0, 빈 출력
#   - deny: {hookSpecificOutput: {permissionDecision: "deny", ...}}
#
# 비차단 보장: jq 부재 / 비정상 stdin은 silent exit 0.
# 긴급 비활성: COMPOUND_MMP_MODEL_GUARD_DISABLE=1 환경변수.
#
# 매칭 정책:
#   - prompt 또는 tool_input.model 에 정규식 (claude-)?sonnet-4[-.]5 매칭 (case insensitive)
#   - sonnet-4-5 / sonnet-4.5 / claude-sonnet-4-5-<date> 모두 catch
#   - haiku-4-5 (검색 카논) 및 sonnet-4-6/opus-4-7 은 false positive 없음

set -eu

# 긴급 비활성 토글
if [ "${COMPOUND_MMP_MODEL_GUARD_DISABLE:-}" = "1" ]; then
  exit 0
fi

# jq 부재 시 silent (비차단)
command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)
[ -z "$input" ] && exit 0

# 메타 추출 (jq 1회, @tsv) — tool_name + prompt + model 동시 (자매 pre-edit-size 패턴 대칭)
meta=$(printf '%s' "$input" | jq -r '[.tool_name // "", .tool_input.prompt // "", .tool_input.model // ""] | @tsv' 2>/dev/null || printf '\t\t')
tool_name=""
prompt=""
model=""
IFS=$'\t' read -r tool_name prompt model <<EOF
$meta
EOF

# tool_name 게이트 (Task 만 검사)
[ "$tool_name" != "Task" ] && exit 0

# Sonnet 4.5 정규식 (bash 3.2 호환: 변수 unquoted RHS)
# (claude-)?sonnet-4[-.]5 — sonnet-4-5 / sonnet-4.5 / claude-sonnet-4-5 / *-20250929 모두 catch
# haiku-4-5 / sonnet-4-6 / opus-4-7 미매칭
PATTERN='(claude-)?sonnet-4[-.]5'

shopt -s nocasematch
violation=""
if [[ "$prompt" =~ $PATTERN ]]; then
  violation="prompt"
fi
if [ -z "$violation" ] && [[ "$model" =~ $PATTERN ]]; then
  violation="model"
fi
shopt -u nocasematch

if [ -z "$violation" ]; then
  exit 0
fi

# deny reason 작성 (4.6 안내 + 우회 토글 명시)
if [ "$violation" = "prompt" ]; then
  reason="Task prompt에 Sonnet 4.5 모델 참조가 포함되었습니다. 카논: Sonnet 4.6 (claude-sonnet-4-6) 사용 — memory/feedback_sonnet_46_default.md. 서브에이전트 spawn 시 model='claude-sonnet-4-6' 명시. 검색 전용은 haiku-4-5, 보안/아키텍처는 opus-4-7. 긴급 우회는 COMPOUND_MMP_MODEL_GUARD_DISABLE=1."
else
  reason="Task tool_input.model 이 Sonnet 4.5 ID 입니다. 카논: Sonnet 4.6 (claude-sonnet-4-6) 사용 — memory/feedback_sonnet_46_default.md. 검색 전용은 haiku-4-5, 보안/아키텍처는 opus-4-7. 긴급 우회는 COMPOUND_MMP_MODEL_GUARD_DISABLE=1."
fi

jq -nc \
  --arg reason "$reason" \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $reason}}'

exit 0
