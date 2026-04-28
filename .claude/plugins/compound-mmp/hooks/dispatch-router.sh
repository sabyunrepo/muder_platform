#!/usr/bin/env bash
# UserPromptSubmit hook — 사용자 프롬프트의 의도를 분류해 compound-mmp 4단계 중 적절한 진입점 추천.
# 카논: refs/auto-dispatch.md
#
# 원칙:
#   1. dispatch는 추천일 뿐. permissionDecision 사용 X (anti-pattern #11).
#   2. raw prompt echo 금지 — 분류 라벨만 additionalContext에 (security MEDIUM-1).
#   3. 슬래시 명령(`/compound-*`/`/sc:*` 시작, 대소문자 무관) 입력은 dispatch 스킵.
#   4. OMC magic keyword 시작 prompt (autopilot/ralph/ulw/ralplan/deep-interview/ai-slop-cleaner)는 OMC keyword-detector 우선 — dispatch 스킵 (anti-pattern #8 OMC 충돌 회피).
#   5. 사용자 의도 우선 — dispatch는 메인 컨텍스트가 무시할 수 있음 (override 우선순위 §refs/auto-dispatch.md).
#
# 입력: stdin JSON {prompt: "...", hook_event_name: "UserPromptSubmit", ...}
# 출력: stdout JSON {hookSpecificOutput: {hookEventName, additionalContext}} 또는 빈 응답

set -eu

# jq 미설치 시 silent (UserPromptSubmit hook이 prompt를 차단해선 안 됨 — 비차단 보장)
command -v jq >/dev/null 2>&1 || exit 0

input=$(cat)
prompt=$(echo "$input" | jq -r '.prompt // empty' 2>/dev/null || echo "")

# 빈 프롬프트는 silent
if [ -z "$prompt" ]; then
  exit 0
fi

# 슬래시 명령 시작 = dispatch 스킵 (대소문자 무관, 사용자 명시 호출 우선)
prompt_lower="${prompt,,}"
case "$prompt_lower" in
  /compound-*) exit 0 ;;
  /sc:*) exit 0 ;;
esac

# OMC magic keyword 시작 또는 포함 = dispatch 스킵 (OMC keyword-detector 우선)
case "$prompt_lower" in
  autopilot*|ralph*|ulw*|ralplan*|deep-interview*|ai-slop-cleaner*) exit 0 ;;
  *autopilot*|*ralph*|*ulw\ *|*ralplan*) exit 0 ;;
esac

# 부정문 stage 추출 — 부정된 stage만 mask, 양성 시그널은 살림
NEGATED=""
shopt -s nocasematch
if [[ "$prompt" =~ (리뷰|review|코드[[:space:]]*리뷰)[[:space:]]*(말고|빼고|제외|그만|건너뛰고|skip|except|but|하지[[:space:]]*마|되었|됐고) ]]; then
  NEGATED="${NEGATED}review "
fi
if [[ "$prompt" =~ (wrap|마무리|정리)[[:space:]]*(말고|빼고|제외|안|건너뛰고|나중에|skip) ]]; then
  NEGATED="${NEGATED}wrap "
fi
if [[ "$prompt" =~ (plan|계획|설계)[[:space:]]*(말고|빼고|제외|아직|skip) ]]; then
  NEGATED="${NEGATED}plan "
fi
shopt -u nocasematch

# 분류 (한글·영문, 대소문자 무시, 우선순위 wrap > review > plan > cycle > work)
classify() {
  local p="$1"
  local result="none"
  shopt -s nocasematch

  if [[ ! "$NEGATED" =~ wrap ]] && [[ "$p" =~ (wrap[-[:space:]]*up|wrap[[:space:]]+(해|하|할게|해줘|하자)|마무리|세션[[:space:]]*끝|session[[:space:]]*end|오늘[[:space:]]*끝|내일[[:space:]]*이어서|handoff|정리[[:space:]]*해) ]]; then
    result="wrap"
  elif [[ ! "$NEGATED" =~ review ]] && [[ "$p" =~ ((리뷰|검토)[[:space:]]*(해|봐|체크|확인|좀|이|를|줘|부탁)|코드[[:space:]]*리뷰|머지[[:space:]]*전|병합[[:space:]]*전|pre-merge|review[[:space:]]*(this|the[[:space:]]+pr|차이|변경|해|좀|please|부탁)) ]]; then
    result="review"
  elif [[ ! "$NEGATED" =~ plan ]] && [[ "$p" =~ (phase[[:space:]]*시작|phase[[:space:]]*설계|계획[[:space:]]*(세워|짜|짜줘)|설계[[:space:]]*해|brainstorm|어떻게[[:space:]]*만들지|PR[[:space:]]*분해|plan[[:space:]]+(this|the|out|짜|세워)|design[[:space:]]+(this|the)|spec[[:space:]]+out) ]]; then
    result="plan"
  elif [[ "$p" =~ (지금[[:space:]]*어디|다음[[:space:]]*단계|진행[[:space:]]*상황|현황|status[[:space:]]+(이|of|now)|where[[:space:]]+am[[:space:]]+i|what.s[[:space:]]+next) ]]; then
    result="cycle"
  elif [[ "$p" =~ (구현[[:space:]]*해|만들어[[:space:]]*줘|작성[[:space:]]*해|코딩[[:space:]]*하자|이[[:space:]]*PR[[:space:]]*진입|TDD[[:space:]]*시작|implement[[:space:]]+(this|the|it)|build[[:space:]]+(this|the|it)|write[[:space:]].*[[:space:]]code|write[[:space:]]code|start[[:space:]]+(PR|pr-)|짜[[:space:]]*줘) ]]; then
    result="work"
  fi

  shopt -u nocasematch
  echo "$result"
  return 0
}

stage=$(classify "$prompt")
[ "$stage" = "none" ] && exit 0

# JSON 안전 직렬화 (security MEDIUM-1: stage 변수 jq escape, raw prompt 사용 X)
jq -nc \
  --arg stage "$stage" \
  '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: ("[compound-mmp dispatch] stage=" + $stage + ". 적절한 시점에 `compound-mmp:" + $stage + "` 스킬 활성화 또는 `/compound-" + $stage + "` 명령 안내 권장. 사용자 의도가 dispatch와 다르면 무시하고 사용자 의도를 우선하세요.")}}'
