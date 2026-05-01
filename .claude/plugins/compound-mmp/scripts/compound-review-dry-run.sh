#!/usr/bin/env bash
# /compound-review --dry-run 헬퍼.
# post-task-pipeline.json `before_pr.review-*` 4개 entry를 읽어 토큰 치환 후 JSON array 출력.
# (2026-05-01: after_pr → before_pr rename — PR 생성 직전 로컬 diff 기준 4-agent 호출 카논화)
#
# 출력 형식 (sim-case-a.md C-2 계약):
#   [{"subagent_type": "...", "model": "...", "prompt": "..."}, ...]  # length == 4
#
# 사용:
#   DESIGN_PATH=docs/plans/<phase>/design.md PR_TITLE='...' \
#     bash scripts/compound-review-dry-run.sh PR-123
#
# Exit codes:
#   0 — 정상
#   2 — pr-id 화이트리스트 실패 (^PR-[0-9]+[a-z]?$)
#   3 — DESIGN_PATH 환경 변수 누락 또는 파일 부재
#   4 — post-task-pipeline.json 부재 (PIPELINE_PATH 환경으로 override 가능)
#
# 토큰 치환은 jq --arg (shell injection 차단). raw shell expansion 절대 금지.
# 카논: refs/post-task-pipeline-bridge.md "토큰 sanitize 의무".

set -eu

PR_ID="${1:-}"

# 1. pr-id 화이트리스트 (정규식, MED-P2: bash builtin =~로 grep fork 제거)
if [[ ! "$PR_ID" =~ ^PR-[0-9]+[a-z]?$ ]]; then
  printf 'ERROR: pr-id must match ^PR-[0-9]+[a-z]?$, got %q\n' "$PR_ID" >&2
  exit 2
fi

# 2. DESIGN_PATH 검증
DESIGN_PATH="${DESIGN_PATH:-}"
if [ -z "$DESIGN_PATH" ] || [ ! -f "$DESIGN_PATH" ]; then
  printf 'ERROR: DESIGN_PATH env required, file must exist: %q\n' "$DESIGN_PATH" >&2
  exit 3
fi

# 3. post-task-pipeline.json 위치 (MED-P1: BASH_SOURCE로 dirname+cd+pwd 2 fork 제거)
# 디렉토리 prefix 없는 호출(예: cwd 안에서 `bash script.sh`) 대비 fallback
SCRIPT_DIR="${BASH_SOURCE[0]%/*}"
[ "$SCRIPT_DIR" = "${BASH_SOURCE[0]}" ] && SCRIPT_DIR="."
DEFAULT_PIPELINE="${SCRIPT_DIR}/../../../post-task-pipeline.json"
PIPELINE_PATH="${PIPELINE_PATH:-$DEFAULT_PIPELINE}"
if [ ! -f "$PIPELINE_PATH" ]; then
  printf 'ERROR: post-task-pipeline.json not found at %q\n' "$PIPELINE_PATH" >&2
  exit 4
fi

# 4. jq 사전 검사
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq is required for token substitution (security: shell injection 차단)" >&2
  exit 5
fi

# 5. PR_TITLE (선택, 기본 빈 문자열)
PR_TITLE="${PR_TITLE:-}"

# 6. review-* 4 entry 추출 + 토큰 치환 (jq --arg 안전)
jq -c \
  --arg pr_id "$PR_ID" \
  --arg pr_title "$PR_TITLE" \
  --arg design "$DESIGN_PATH" \
  '[.before_pr[]
    | select(.type == "subagent" and .parallel_group == "review")
    | {
        subagent_type: .agent,
        model: .model,
        prompt: (.prompt
          | gsub("\\{pr_id\\}"; $pr_id)
          | gsub("\\{pr_title\\}"; $pr_title)
          | gsub("\\{design\\}"; $design))
      }]' "$PIPELINE_PATH"
