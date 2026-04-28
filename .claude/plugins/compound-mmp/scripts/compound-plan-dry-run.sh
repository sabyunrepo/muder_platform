#!/usr/bin/env bash
# /compound-plan --dry-run 헬퍼.
# topic + (옵션) --from <previous-phase> 입력 → checklist 초안 생성 단계 시퀀스 JSON 출력.
#
# 출력 형식 (plan § /compound-plan 사양):
#   {
#     "topic": "<slug>",
#     "from_previous_phase": null | "<slug>",
#     "steps": [
#       {"step": 1, "skill": "compound-mmp:qmd-recall", "args": {"collection": "mmp-plans", "query": "...", "k": 5}},
#       {"step": 2, "skill": "superpowers:brainstorming"},
#       {"step": 3, "skill": "superpowers:writing-plans"},
#       {"step": 4, "action": "write_file", "path": "docs/plans/<date>-<topic>/checklist.md", "template": "<TEMPLATE_PATH>"}
#     ]
#   }
#
# 사용:
#   TEMPLATE_PATH=.claude/plugins/compound-mmp/templates/plan-draft-template.md \
#     bash scripts/compound-plan-dry-run.sh phase-20-clue-editor [--from phase-19-residual]
#
# Exit codes:
#   0 — 정상
#   2 — topic/--from 화이트리스트 실패 (^[a-z0-9-]{1,64}$)
#   3 — TEMPLATE_PATH 환경 변수 누락
#   4 — TEMPLATE_PATH 파일 부재
#   5 — jq missing
#
# 토큰 치환은 jq --arg (shell injection 차단). raw shell expansion 절대 금지.
# 카논 anti-pattern: 자동 PR 생성 step 포함 금지 (test fixture가 검증).

set -eu

TOPIC="${1:-}"
FROM_PHASE=""

# 1. topic 화이트리스트 (^[a-z0-9-]{1,64}$, bash builtin =~)
if [[ ! "$TOPIC" =~ ^[a-z0-9-]{1,64}$ ]]; then
  printf 'ERROR: topic must match ^[a-z0-9-]{1,64}$, got %q\n' "$TOPIC" >&2
  exit 2
fi

# 2. --from <previous-phase> 옵션 파싱
shift || true
while [ $# -gt 0 ]; do
  case "$1" in
    --from)
      FROM_PHASE="${2:-}"
      # HIGH-T1 가드: --from 다음 토큰이 또 다른 옵션(`-`로 시작)이면 거부.
      # 정규식 ^[a-z0-9-]{1,64}$가 `--from`/`-x` 같은 옵션 토큰을 통과시키는 false PASS 차단.
      if [[ "$FROM_PHASE" == -* ]]; then
        printf 'ERROR: --from value cannot start with - (option-like token), got %q\n' "$FROM_PHASE" >&2
        exit 2
      fi
      if [[ ! "$FROM_PHASE" =~ ^[a-z0-9-]{1,64}$ ]]; then
        printf 'ERROR: --from value must match ^[a-z0-9-]{1,64}$, got %q\n' "$FROM_PHASE" >&2
        exit 2
      fi
      shift 2
      ;;
    *)
      printf 'ERROR: unknown argument %q\n' "$1" >&2
      exit 2
      ;;
  esac
done

# 3. TEMPLATE_PATH 검증
TEMPLATE_PATH="${TEMPLATE_PATH:-}"
if [ -z "$TEMPLATE_PATH" ]; then
  echo "ERROR: TEMPLATE_PATH env required" >&2
  exit 3
fi
if [ ! -f "$TEMPLATE_PATH" ]; then
  printf 'ERROR: TEMPLATE_PATH file not found: %q\n' "$TEMPLATE_PATH" >&2
  exit 4
fi

# 4. jq 사전 검사
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required for token substitution (security: shell injection 차단)" >&2
  exit 5
fi

# 5. OUTPUT_BASE 기본값 (CI/test 격리용 override)
OUTPUT_BASE="${OUTPUT_BASE:-docs/plans}"

# 6. DATE 기본값 (CI/test 격리용 override)
DATE="${DATE:-$(date +%Y-%m-%d)}"

# 7. 단계 시퀀스 JSON 생성 (jq --arg 안전 토큰 치환)
PATH_PATTERN="{base}/{date}-{topic}/checklist.md"

jq -nc \
  --arg topic "$TOPIC" \
  --arg from "$FROM_PHASE" \
  --arg base "$OUTPUT_BASE" \
  --arg date "$DATE" \
  --arg template "$TEMPLATE_PATH" \
  --arg path_pattern "$PATH_PATTERN" \
  '{
    topic: $topic,
    from_previous_phase: (if $from == "" then null else $from end),
    mandatory_slots: ["qmd-recall-table"],
    steps: [
      {step: 1, skill: "compound-mmp:qmd-recall", args: {collection: "mmp-plans", query: $topic, k: 5}},
      {step: 2, skill: "superpowers:brainstorming", inject: ["steps[0].output"]},
      {step: 3, skill: "superpowers:writing-plans", inject: ["steps[1].output"]},
      {step: 4, action: "write_file",
        path: ($path_pattern
          | gsub("\\{base\\}"; $base)
          | gsub("\\{date\\}"; $date)
          | gsub("\\{topic\\}"; $topic)),
        template: $template,
        mandatory_slots: ["qmd-recall-table"]}
    ]
  }'
