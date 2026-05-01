---
description: 로컬 diff (push 전)에 대해 4-agent 병렬 리뷰 (security/perf/arch/test) 실행. post-task-pipeline.json `before_pr.review-*` 카논을 읽어 한 메시지에서 Task tool 동시 spawn. HIGH 발견 시 사용자 결정 대기 (자동 fix-loop 금지). PR-2c #107 사고 이후 4-agent 강제 정책의 슬래시 진입점.
allowed-tools: Bash, Read, Write, Task, Glob
argument-hint: "<pr-id> [--dry-run]   예: /compound-review PR-7"
---

# /compound-review

`gh pr create` *직전* (push 전 또는 push 후·PR 생성 전) 4-agent 병렬 리뷰를 한 메시지에서 spawn해 종합 결과를 `docs/plans/<phase>/refs/reviews/<pr-id>.md`로 영구화. HIGH fix 가 push 전에 끝나므로 GitHub Actions CI 는 PR 당 1회만 돈다.

> **카논 single source**: `refs/post-task-pipeline-bridge.md` (4-agent 매핑 + P0–P3 라우팅 + 호출 타이밍) + `.claude/post-task-pipeline.json` `before_pr.review-*` (prompt template).
>
> **2026-05-01 타이밍 rename**: `after_pr` → `before_pr`. 이전 워크플로 (PR 생성 후 review → fix → push) 의 CI 2회 비효율을 단일 CI 호출로 압축.

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

### 2. PR 메타 추출 (선택, 로컬 우선)

PR 생성 전이므로 GitHub PR 은 아직 없다. 로컬 commit subject 우선:

```bash
PR_TITLE=$(git log -1 --pretty=%s 2>/dev/null || echo "")
# 이미 PR 이 만들어진 reactive 검증 시 fallback:
# PR_TITLE=$(gh pr view "$ARG_PR_NUM" --json title -q .title 2>/dev/null || echo "$PR_TITLE")
```

빈 문자열도 정상 동작 (helper 가 토큰을 빈 문자열로 치환). 토큰 치환은 **jq `--arg`**가 보장하므로 PR_TITLE 내용이 어떤 문자라도 안전 (helper 카논).

### 3. dry-run helper 호출 → 4-agent payload

```bash
DESIGN_PATH="$DESIGN_PATH" PR_TITLE="$PR_TITLE" \
  bash .claude/plugins/compound-mmp/scripts/compound-review-dry-run.sh "$PR_ID"
```

stdout: `[{"subagent_type":"...","model":"...","prompt":"..."}, ...]` (jq parsable, **dynamic length** = `pipeline.json`의 `parallel_group="review"` entry 수).

`--dry-run` 모드에서는 여기서 종료. 정상 모드는 다음 단계.

### 4. 한 메시지에서 N Task tool 동시 spawn (단일 source: helper.payload)

`superpowers:dispatching-parallel-agents` 스킬 패턴 준수. **helper payload를 그대로 iterate** — 본문에 agent 이름/개수 하드코딩 금지(HIGH-A1 카논). 단일 assistant message-block에 helper payload[]의 각 entry당 1개 Task 호출:

```
# 의사코드 — 메인 컨텍스트가 helper payload를 받아 그대로 매핑
for entry in helper.payload[]:
    Task(subagent_type=$(map_subagent entry.subagent_type),
         model=entry.model,
         prompt=$(contextualize entry.prompt))
```

5번째 reviewer가 `pipeline.json`에 추가되어도 본문 수정 불필요 (helper의 length 변화에 자동 적응).

#### 4.1 OMC fallback 매핑 (HIGH-A2 카논)

`oh-my-claudecode:*` agent는 user-home `~/.claude/plugins/`에 위치해 본 repo가 알 수 없다. 메인 컨텍스트는 spawn 시 OMC 가용성을 확인하고 미설치 시 다음 fallback 적용:

| OMC subagent_type (helper 출력) | Fallback subagent_type | model 유지 | 근거 |
|--------------------------------|------------------------|------------|------|
| `oh-my-claudecode:security-reviewer` | `general-purpose` | opus | 단일 메시지 4 spawn 호환 |
| `oh-my-claudecode:code-reviewer` | `general-purpose` | sonnet | perf 분석 일반 |
| `oh-my-claudecode:critic` | `superpowers:code-reviewer` | opus | adversarial 카논 가장 가까움 |
| `oh-my-claudecode:test-engineer` | `general-purpose` | sonnet | 테스트 갭 분석 |

OMC 가용성 확인 (메인 컨텍스트 책임):
```bash
ls ~/.claude/plugins/oh-my-claudecode 2>/dev/null && OMC_AVAILABLE=1 || OMC_AVAILABLE=0
```

OMC 가용 시 helper 출력을 그대로 사용. 미가용 시 위 fallback 매핑 적용. **prompt 내용은 동일** (helper가 generic하게 작성).

#### 4.2 프롬프트 컨텍스트화 (필수)

helper의 prompt template은 generic하므로 메인이 PR 컨텍스트(diff 위치, 변경 파일 목록, design ref 경로)를 추가 보강해 spawn. raw template 그대로 spawn 금지 (subagent가 PR diff를 못 봄).

#### 4.3 모델 카논

opus = `claude-opus-4-7`, sonnet = `claude-sonnet-4-6` (sonnet-4-5 절대 금지 — `pre-task-model-guard.sh`가 차단). agent name 카논: `critic` (NOT `architect`, refs/post-task-pipeline-bridge.md § 정정).

### 5. 결과 종합 → reviews/<pr-id>.md

`templates/review-result-template.md` 형식 따름:

- 영역별 (security/perf/arch/test) 발견 사항 + 심각도 분류 (P0–P3, `refs/post-task-pipeline-bridge.md`)
- HIGH 통합 카운트
- 권고 액션 (사용자 결정 후보)

저장 경로: `${ACTIVE_PHASE}/refs/reviews/${PR_ID}.md` (디렉토리 부재 시 `mkdir -p`).

### 6. HIGH 발견 시 사용자 결정 대기

자동 fix-loop **금지** (PR-2c #107 사고 후 정책, `refs/post-task-pipeline-bridge.md` § "자동 fix-loop 금지"). 메인은 다음 한 줄을 사용자에게 표시:

```
HIGH N건 발견 (push 전). 다음 중 선택:
  (a) 즉시 수정 후 round-2 — `/compound-work {pr-id}` (수정 → /compound-review 재실행)
  (b) 그대로 push + PR 생성, 별도 follow-up PR 이월
  (c) 무시 (이유 명시)
```

(a) 가 카논 default — push 전 fix → 단일 CI run 의 핵심.

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

`hooks/dispatch-router.sh`가 다음 사용자 발화에서 `/compound-review` 추천 (stage=review). **이 목록은 `test-dispatch.sh` fixture로 검증** — doc-vs-behavior 100% align (HIGH-A3 카논):

- "리뷰 해줘" / "코드 리뷰" / "PR 전 확인" / "머지 전 확인" / "병합 전 체크"
- "review this PR" / "pre-pr review" / "pre-merge review"

> "audit this" 등 일반 영문 단어는 false positive 위험("audit log 추가" → review 오라우팅) 때문에 의도적으로 제외.

## 안티 패턴 (절대 금지)

- ❌ slash command 본문에서 `bash -c "$template"` 형태로 prompt 합성 — RCE 위험. **반드시 `compound-review-dry-run.sh` helper 경유** (jq `--arg` 강제).
- ❌ PR_TITLE을 직접 prompt 문자열에 보간 (`prompt="...${PR_TITLE}..."`) — helper만 사용.
- ❌ HIGH 발견 시 자동 `/compound-work` 호출 — manual gate 강제 (PR-2c 교훈, refs/anti-patterns.md #7).
- ❌ helper payload 길이보다 적게/많게 Task spawn — 단일 source 위반. helper의 length가 카논 (HIGH-A1).
- ❌ 슬래시 본문에 4개 (또는 N개) agent 이름 하드코딩 — pipeline.json mutation 시 silent break (HIGH-A1). **iterate over helper.payload[]만 사용**.
- ❌ Task를 별도 assistant message로 분산 spawn — 한 메시지 동시 spawn이 카논 (parallel_group="review", `superpowers:dispatching-parallel-agents`).
- ❌ OMC 가용성 미확인 spawn — `oh-my-claudecode:*`은 user-home 의존. 미설치 시 § 4.1 fallback 매핑 필수 (HIGH-A2).

## 카논 ref

- `refs/post-task-pipeline-bridge.md` (4-agent 매핑, P0–P3 라우팅, 토큰 sanitize)
- `refs/sim-case-a.md` (PR-2c deadlock 재현 검증, dry-run C-2 계약)
- `templates/review-result-template.md` (결과 종합 형식)
- `scripts/compound-review-dry-run.sh` (helper, 24/24 self-test)
- `.claude/post-task-pipeline.json` `before_pr` (prompt template canonical)
- `memory/feedback_4agent_review_before_admin_merge.md` (강제 정책 근거 — PR-2c #107 hotfix #108)
