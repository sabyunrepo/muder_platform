#!/usr/bin/env bash
# /compound-cycle --dry-run 헬퍼.
# 활성 phase의 4단계 진행 상태 dashboard JSON 출력.
#
# 출력 형식 (plan § /compound-cycle 사양):
#   {
#     "phase": "<phase-basename>",
#     "stages": {
#       "plan": {"exists": bool, "status": "pending|in_progress|done"},
#       "work": {"exists": bool, "status": "..."},
#       "review": {"reviews_count": int, "status": "..."},
#       "compound": {"handoff_path": str|null, "status": "..."}
#     },
#     "next_gate": "plan|work|review|compound|done",
#     "blocked_reasons": [str],
#     "mandatory_slots": ["qmd-recall-table"]
#   }
#
# 사용:
#   ACTIVE_PHASE=docs/plans/<phase> bash scripts/compound-cycle-dry-run.sh
#
# Exit codes:
#   0 — 정상
#   3 — ACTIVE_PHASE env 누락 또는 디렉토리 부재
#   5 — jq missing
#
# 카논: 자동 진행 X. 단순 dashboard. 메인 컨텍스트가 next_gate를 보고 사용자에게 안내만.

set -eu

# 1. ACTIVE_PHASE 검증
ACTIVE_PHASE="${ACTIVE_PHASE:-}"
if [ -z "$ACTIVE_PHASE" ] || [ ! -d "$ACTIVE_PHASE" ]; then
  printf 'ERROR: ACTIVE_PHASE env required, directory must exist: %q\n' "$ACTIVE_PHASE" >&2
  exit 3
fi

# 2. jq 사전 검사
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required" >&2
  exit 5
fi

# 3. phase basename + 화이트리스트 (HIGH-S2 round-2 + HIGH-S3 round-3 fix: regex/option injection 차단)
# round-2 security HIGH-S2: phase-scoped grep이 BRE 정규식 해석 → metachar 잠입 시 다른 phase 매칭.
# round-3 security HIGH-S3: leading `-` 허용 → `grep -lF -eVAL` 옵션 흡수, fixed-string 우회.
# 해소 (defense-in-depth, 양 layer 강화):
#   (a) PHASE_NAME 화이트리스트 — `^[a-z0-9][a-z0-9_.-]*$` (첫 글자 alpha/num 강제, leading -/. 차단)
#   (b) `grep -lF -- "$PHASE_NAME"` (L102, `--` separator로 옵션 해석 차단)
PHASE_NAME="${ACTIVE_PHASE##*/}"
if [[ ! "$PHASE_NAME" =~ ^[a-z0-9][a-z0-9_.-]*$ ]]; then
  printf 'ERROR: PHASE_NAME must match ^[a-z0-9][a-z0-9_.-]*$ (no leading -/.), got %q\n' "$PHASE_NAME" >&2
  exit 3
fi

# 4. plan stage: checklist.md 존재 여부
CHECKLIST="${ACTIVE_PHASE}/checklist.md"
PLAN_EXISTS=false
PLAN_STATUS="pending"
if [ -f "$CHECKLIST" ]; then
  PLAN_EXISTS=true
  # qmd-recall-table 슬롯 inject 여부 (mandatory-slots-canon.md sister)
  if grep -q "INJECT-RECALL-MANDATORY-START" "$CHECKLIST" 2>/dev/null; then
    DOCID_COUNT=$(awk '/INJECT-RECALL-MANDATORY-START/,/INJECT-RECALL-MANDATORY-END/' "$CHECKLIST" 2>/dev/null | grep -oE '#[a-f0-9]{6}' | wc -l)
    if [ "$DOCID_COUNT" -ge 3 ]; then
      PLAN_STATUS="done"
    else
      PLAN_STATUS="in_progress"
    fi
  else
    PLAN_STATUS="in_progress"
  fi
fi

# 5. work stage: refs/sim-* 또는 .impl 마커 (있다면). 없으면 plan 종료 후 work 진입 가능 여부만 표시
WORK_EXISTS=false
WORK_STATUS="pending"
if [ -d "${ACTIVE_PHASE}/refs" ]; then
  if ls "${ACTIVE_PHASE}/refs"/sim-*.md 2>/dev/null | head -1 | grep -q .; then
    WORK_EXISTS=true
    WORK_STATUS="in_progress"
  fi
fi

# 6. review stage: refs/reviews/PR-*.md 카운트
REVIEWS_DIR="${ACTIVE_PHASE}/refs/reviews"
REVIEWS_COUNT=0
REVIEW_STATUS="pending"
if [ -d "$REVIEWS_DIR" ]; then
  REVIEWS_COUNT=$(ls "$REVIEWS_DIR"/PR-*.md 2>/dev/null | wc -l | tr -d ' ')
  if [ "$REVIEWS_COUNT" -gt 0 ]; then
    REVIEW_STATUS="in_progress"
  fi
fi

# 7. compound stage: memory/sessions 핸드오프 검색 (phase-scoped — HIGH-A1 fix)
# round-1 critic HIGH-A1: ls -t memory/sessions/*.md가 다른 phase 핸드오프 매칭 → false done.
# 해소: PHASE_NAME 키워드 grep으로 phase-scoped 매칭 (가장 최근 mtime).
HANDOFF_PATH=""
COMPOUND_STATUS="pending"
if [ -d memory/sessions ]; then
  # HIGH-S2 round-2 + HIGH-S3 round-3 fix: -F (fixed-string) + -- separator (옵션 흡수 차단).
  LATEST_HANDOFF=$(grep -lF -- "$PHASE_NAME" memory/sessions/*.md 2>/dev/null | head -1 || true)
  if [ -n "$LATEST_HANDOFF" ] && [ -f "$LATEST_HANDOFF" ]; then
    HANDOFF_PATH="$LATEST_HANDOFF"
    COMPOUND_STATUS="in_progress"
  fi
fi

# 8. next_gate 결정 (4단계 순차) — HIGH-A2 carry-over PR-11 (review/compound unreachable)
# 본 PR scope에선 work.exists 무시 알고리즘 유지. PR-11에서 work.exists를 next_gate에 포함.
NEXT_GATE="plan"
BLOCKED_REASONS=()
if [ "$PLAN_EXISTS" = "false" ]; then
  NEXT_GATE="plan"
  BLOCKED_REASONS+=("checklist.md 부재 — /compound-plan 먼저 실행")
elif [ "$PLAN_STATUS" = "in_progress" ]; then
  NEXT_GATE="plan"
  BLOCKED_REASONS+=("plan stage 미완료 — qmd-recall-table 슬롯 inject 또는 plan 본문 작성 필요")
elif [ "$REVIEWS_COUNT" -eq 0 ]; then
  NEXT_GATE="work"
  BLOCKED_REASONS+=("review 미진입 — /compound-work 후 /compound-review 호출 필요")
elif [ -z "$HANDOFF_PATH" ]; then
  NEXT_GATE="compound"
  BLOCKED_REASONS+=("핸드오프 노트 부재 (phase=$PHASE_NAME) — /compound-wrap 호출 필요")
else
  NEXT_GATE="done"
fi

# 9. blocked_reasons → JSON array (HIGH-A3 fix: 빈 배열 처리)
# round-1 critic HIGH-A3: printf 빈 배열 → [""] 출력 → contract 위반.
# 해소: 명시 분기 — 빈 배열 시 '[]' 직접 사용.
if [ ${#BLOCKED_REASONS[@]} -eq 0 ]; then
  BLOCKED_JSON='[]'
else
  BLOCKED_JSON=$(printf '%s\n' "${BLOCKED_REASONS[@]}" | jq -R . | jq -sc .)
fi

# 10. JSON 출력 (HIGH-S1/T1 fix: handoff_path --arg + jq 안 null 분기)
# round-1 security/test HIGH: --argjson "\"$path\"" raw expansion → 파일명 escape 깨짐.
# 해소: --arg handoff_path "$path" + jq 안에서 if empty then null 패턴 (sister 카논 align).
jq -nc \
  --arg phase "$PHASE_NAME" \
  --argjson plan_exists "$PLAN_EXISTS" \
  --arg plan_status "$PLAN_STATUS" \
  --argjson work_exists "$WORK_EXISTS" \
  --arg work_status "$WORK_STATUS" \
  --argjson reviews_count "$REVIEWS_COUNT" \
  --arg review_status "$REVIEW_STATUS" \
  --arg handoff_path "$HANDOFF_PATH" \
  --arg compound_status "$COMPOUND_STATUS" \
  --arg next_gate "$NEXT_GATE" \
  --argjson blocked "$BLOCKED_JSON" \
  '{
    phase: $phase,
    stages: {
      plan: {exists: $plan_exists, status: $plan_status},
      work: {exists: $work_exists, status: $work_status},
      review: {reviews_count: $reviews_count, status: $review_status},
      compound: {
        handoff_path: (if $handoff_path == "" then null else $handoff_path end),
        status: $compound_status
      }
    },
    next_gate: $next_gate,
    blocked_reasons: $blocked,
    mandatory_slots: ["qmd-recall-table"]
  }'
