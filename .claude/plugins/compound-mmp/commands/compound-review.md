---
description: PR diff에 대해 4-agent 병렬 리뷰 (security/perf/arch/test) 실행. post-task-pipeline.json `after_pr.review-*` 카논을 읽어 한 메시지에서 Task tool 동시 spawn. HIGH 발견 시 사용자 결정 대기 (자동 fix-loop 금지). PR-2c #107 사고 이후 4-agent 강제 정책의 슬래시 진입점.
allowed-tools: Bash, Read, Write, Task, Glob
argument-hint: "<pr-id> [--dry-run]   예: /compound-review PR-7"
---

# /compound-review

PR 머지 직전(또는 admin-merge 직후) 4-agent 병렬 리뷰를 한 메시지에서 spawn해 종합 결과를 `docs/plans/<phase>/refs/reviews/<pr-id>.md`로 영구화.

> **카논 single source**: `refs/post-task-pipeline-bridge.md` (4-agent 매핑 + P0–P3 라우팅) + `.claude/post-task-pipeline.json` `after_pr.review-*` (prompt template).

## 인자

- `<pr-id>` (필수) — `^PR-[0-9]+[a-z]?$` 정규식 매칭. 화이트리스트 외 거부 (helper exit 2).
- `--dry-run` (선택) — Task spawn 없이 4-agent payload(JSON array)만 stdout으로 출력. sim-case-a C-2 검증 모드.

## 실행 시퀀스 (메인 컨텍스트)

### 1. 활성 phase 검출 + design.md 경로 결정

```bash
ACTIVE_PHASE=$(ls -td docs/plans/*/ 2>/dev/null | head -1 | sed 's:/$::')
DESIGN_PATH="${ACTIVE_PHASE}/design.md"
[ -f "$DESIGN_PATH" ] || DESIGN_PATH="apps/server/CLAUDE.md"
```

design.md 부재 시 `apps/server/CLAUDE.md`(아키텍처 카논) fallback. 사용자가 명시 인자로 override 가능 (PR-9 추후).

### 2. PR 메타 추출 (선택)

```bash
PR_TITLE=$(gh pr view "$ARG_PR_NUM" --json title -q .title 2>/dev/null || echo "")
```

`gh` CLI 부재 또는 인증 미설정 시 빈 문자열 fallback. 토큰 치환은 **jq `--arg`**가 보장하므로 PR_TITLE 내용이 어떤 문자라도 안전 (helper 카논).

### 3. dry-run helper 호출 → 4-agent payload

```bash
DESIGN_PATH="$DESIGN_PATH" PR_TITLE="$PR_TITLE" \
  bash .claude/plugins/compound-mmp/scripts/compound-review-dry-run.sh "$PR_ID"
```

stdout: `[{"subagent_type":"...","model":"...","prompt":"..."}, ...]` (jq parsable, length == 4).

`--dry-run` 모드에서는 여기서 종료. 정상 모드는 다음 단계.

### 4. 한 메시지에서 4 Task tool 동시 spawn

`superpowers:dispatching-parallel-agents` 스킬 패턴 준수. 단일 assistant message-block에 4개 Task 호출:

```
Task(subagent_type="oh-my-claudecode:security-reviewer", model="opus", prompt="<helper.payload[0].prompt>")
Task(subagent_type="oh-my-claudecode:code-reviewer",     model="sonnet", prompt="<helper.payload[1].prompt>")
Task(subagent_type="oh-my-claudecode:critic",            model="opus", prompt="<helper.payload[2].prompt>")
Task(subagent_type="oh-my-claudecode:test-engineer",     model="sonnet", prompt="<helper.payload[3].prompt>")
```

> agent name 카논: `critic` (NOT `architect`). 모델 카논: opus = `claude-opus-4-7`, sonnet = `claude-sonnet-4-6` (sonnet-4-5 절대 금지 — `pre-task-model-guard.sh`가 차단).

### 5. 결과 종합 → reviews/<pr-id>.md

`templates/review-result-template.md` 형식 따름:

- 영역별 (security/perf/arch/test) 발견 사항 + 심각도 분류 (P0–P3, `refs/post-task-pipeline-bridge.md`)
- HIGH 통합 카운트
- 권고 액션 (사용자 결정 후보)

저장 경로: `${ACTIVE_PHASE}/refs/reviews/${PR_ID}.md` (디렉토리 부재 시 `mkdir -p`).

### 6. HIGH 발견 시 사용자 결정 대기

자동 fix-loop **금지** (PR-2c #107 사고 후 정책, `refs/post-task-pipeline-bridge.md` § "자동 fix-loop 금지"). 메인은 다음 한 줄을 사용자에게 표시:

```
HIGH N건 발견. 다음 중 선택: (a) 즉시 수정 — `/compound-work {pr-id}`, (b) 다음 PR 이월, (c) 무시 (이유 명시)
```

## 사용 예

```
# 정상 4-agent 리뷰
/compound-review PR-7

# dry-run (CI/sim-case-a 검증)
/compound-review PR-7 --dry-run | jq 'length == 4'   # → true

# sim-case-a 회귀 검증 (PR-10 진입 시)
/compound-review PR-2c-sim          # ← FAIL: alphabetic id 거부됨, sim 전용 흐름은 PR-10에서 별도 정의
```

## 디스패처 트리거

`hooks/dispatch-router.sh`가 다음 사용자 발화에서 `/compound-review` 추천 (stage=review):

- "리뷰 해줘" / "코드 리뷰" / "머지 전 확인" / "병합 전 체크"
- "review this PR" / "pre-merge review" / "audit this"

## 안티 패턴 (절대 금지)

- ❌ slash command 본문에서 `bash -c "$template"` 형태로 prompt 합성 — RCE 위험. **반드시 `compound-review-dry-run.sh` helper 경유** (jq `--arg` 강제).
- ❌ PR_TITLE을 직접 prompt 문자열에 보간 (`prompt="...${PR_TITLE}..."`) — helper만 사용.
- ❌ HIGH 발견 시 자동 `/compound-work` 호출 — manual gate 강제 (PR-2c 교훈).
- ❌ Task tool을 4개보다 적게 spawn (예: critic 생략) — 4-agent 카논 위반 (`feedback_4agent_review_before_admin_merge.md`).
- ❌ 4 Task를 별도 assistant message로 분산 spawn — 한 메시지 동시 spawn이 카논 (parallel_group="review", `superpowers:dispatching-parallel-agents`).

## 카논 ref

- `refs/post-task-pipeline-bridge.md` (4-agent 매핑, P0–P3 라우팅, 토큰 sanitize)
- `refs/sim-case-a.md` (PR-2c deadlock 재현 검증, dry-run C-2 계약)
- `templates/review-result-template.md` (결과 종합 형식)
- `scripts/compound-review-dry-run.sh` (helper, 24/24 self-test)
- `.claude/post-task-pipeline.json` `after_pr` (prompt template canonical)
- `memory/feedback_4agent_review_before_admin_merge.md` (강제 정책 근거 — PR-2c #107 hotfix #108)
