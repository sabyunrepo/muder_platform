#!/usr/bin/env bash
# UserPromptSubmit hook — 사용자 프롬프트의 의도를 분류해 compound-mmp 4단계 중 적절한 진입점 추천.
# 카논: refs/auto-dispatch.md
#
# 원칙:
#   1. dispatch는 추천일 뿐. permissionDecision 사용 X (anti-pattern #11).
#   2. raw prompt echo 금지 — 분류 라벨만 additionalContext에 (security MEDIUM-1).
#   3. 슬래시 명령(`/compound-*` 시작) 입력은 dispatch 스킵.
#   4. 사용자 의도 우선 — dispatch는 메인 컨텍스트가 무시할 수 있음 (override 우선순위 §refs/auto-dispatch.md).
#
# 입력: stdin JSON {prompt: "...", hook_event_name: "UserPromptSubmit", ...}
# 출력: stdout JSON {hookSpecificOutput: {hookEventName, additionalContext}} 또는 빈 응답

set -eu

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt // empty' 2>/dev/null || echo "")

# 빈 프롬프트는 silent (test H-1 경계 입력)
if [ -z "$prompt" ]; then
  exit 0
fi

# 슬래시 명령 시작 = dispatch 스킵 (사용자 명시 호출 우선)
case "$prompt" in
  /compound-*) exit 0 ;;
  /sc:*) exit 0 ;;          # OMC magic keyword 충돌 회피
esac

# 부정문 패턴 (false positive 방지, test H-1)
# "리뷰 말고", "review 말고", "wrap 안 해" 등
shopt -s nocasematch
if [[ "$prompt" =~ (리뷰[[:space:]]*말고|review[[:space:]]*(말고|skip|except|but)|wrap[[:space:]]*(말고|안)) ]]; then
  shopt -u nocasematch
  exit 0
fi
shopt -u nocasematch

# 분류 (한글·영문, 대소문자 무시, 우선순위는 위에서 아래로)
classify() {
  local p="$1"
  shopt -s nocasematch

  # Wrap (가장 명확한 시그널 — 세션 종료 의도)
  if [[ "$p" =~ (wrap[-[:space:]]*up|wrap[[:space:]]+해|마무리|세션[[:space:]]*끝|session[[:space:]]*end|오늘[[:space:]]*끝|내일[[:space:]]*이어서|handoff|정리[[:space:]]*해) ]]; then
    echo "wrap"
    return
  fi

  # Review (머지 전 검증 의도)
  if [[ "$p" =~ (리뷰[[:space:]]*해|코드[[:space:]]*리뷰|머지[[:space:]]*전|병합[[:space:]]*전|pre-merge|review[[:space:]]+(this|the[[:space:]]+pr|차이|변경)) ]]; then
    echo "review"
    return
  fi

  # Plan (새 phase 설계 의도)
  if [[ "$p" =~ (phase[[:space:]]*시작|phase[[:space:]]*설계|계획[[:space:]]*세워|설계[[:space:]]*해|brainstorm|어떻게[[:space:]]*만들지|PR[[:space:]]*분해|plan[[:space:]]+(this|the|out)|design[[:space:]]+(this|the)|spec[[:space:]]+out) ]]; then
    echo "plan"
    return
  fi

  # Cycle (현재 상태 조회)
  if [[ "$p" =~ (지금[[:space:]]*어디|다음[[:space:]]*단계|진행[[:space:]]*상황|현황|status[[:space:]]+(이|of|now)|where[[:space:]]+am[[:space:]]+i|what.s[[:space:]]+next) ]]; then
    echo "cycle"
    return
  fi

  # Work (실제 구현 의도) — 가장 약한 시그널, 마지막
  # write 패턴은 "write ... code" 형태 모두 매칭 (write the implementation code, write some code 등)
  if [[ "$p" =~ (구현[[:space:]]*해|만들어[[:space:]]*줘|작성[[:space:]]*해|코딩[[:space:]]*하자|이[[:space:]]*PR[[:space:]]*진입|TDD[[:space:]]*시작|implement[[:space:]]+(this|the|it)|build[[:space:]]+(this|the|it)|write[[:space:]].*[[:space:]]code|write[[:space:]]code|start[[:space:]]+(PR|pr-)) ]]; then
    echo "work"
    return
  fi

  echo "none"
  shopt -u nocasematch
}

stage=$(classify "$prompt")
[ "$stage" = "none" ] && exit 0

# 분류 라벨만 echo (raw prompt 사용 X — security MEDIUM-1)
cat <<EOF
{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"[compound-mmp dispatch] stage=${stage}. 적절한 시점에 \`compound-mmp:${stage}\` 스킬 활성화 또는 \`/compound-${stage}\` 명령 안내 권장. 사용자 의도가 dispatch와 다르면 무시하고 사용자 의도를 우선하세요."}}
EOF
