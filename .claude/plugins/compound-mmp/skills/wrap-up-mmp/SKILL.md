---
name: wrap-up-mmp
description: |
  사용자가 작업 세션을 마무리하려는 의도를 표현할 때 자동 활성화. compound-mmp 4단계 라이프사이클의 Compound 단계 (Plan→Work→Review→Compound).
  트리거: "wrap up", "마무리", "세션 끝", "정리", "내일 이어서", "오늘 끝", "handoff", "wrap-up" 등 한글/영문 키워드 또는 /compound-wrap 명시 호출.
  Phase·Wave·session 종료 시점에 7단계 wrap 시퀀스를 실행해 MEMORY 갱신·MISTAKES/QUESTIONS append·다음 세션 핸드오프 노트 생성을 자동화한다.
  카논 위치: refs/wrap-up-checklist.md, refs/learning-quality-gate.md.
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, Task, mcp__plugin_qmd_qmd__vector_search
---

# wrap-up-mmp 7단계 시퀀스

세션·Wave·Phase 종료 시 자동 분석 + 학습 영구화 + 다음 세션 핸드오프.

## 입력 인자

`mode` ∈ {`--session` (기본), `--wave`, `--phase`}

| mode | graphify | 비용 | 용도 |
|------|----------|------|------|
| `--session` | skip | 최저 | 매일 세션 종료 |
| `--wave` | `--update` 안내 | 중 | Wave 머지 직후 |
| `--phase` | 자동 fresh rebuild | 고 ($0.15–2) | Phase 종료 |

## Step 1 — Pre-scan (자동)

```bash
git status --short
git diff --stat HEAD~10..HEAD 2>/dev/null || git diff --stat
git log --oneline HEAD~10..HEAD
```

추가로 활성 phase 메타 수집:
```bash
ls -t docs/plans/ | head -3
cat docs/plans/<latest-phase>/checklist.md | grep -A2 "STATUS-START"
```

## Step 2 — Phase 1 병렬 4 agent (자동 분석)

한 메시지에서 4 Task tool 동시 spawn (parallel_group, 병렬 1단계):

```
Task(subagent_type="oh-my-claudecode:document-specialist", model="claude-sonnet-4-6", prompt="...")
Task(subagent_type="compound-mmp:automation-scout", prompt="...")
Task(subagent_type="compound-mmp:learning-extractor", prompt="...")
Task(subagent_type="compound-mmp:followup-suggester", prompt="...")
```

각 prompt 내용:
- 공통: Step 1의 git scan 결과 + 활성 phase 메타 + 세션 발화 중 corrections/decisions/blockers 신호
- document-specialist: **MMP 카논 경로 강제 주입** — `memory/` canonical, `CLAUDE.md`/`refs/` 카논 매트릭스, "Write 권한 없음. 후보만 출력"
- automation-scout: 신규 자동화 후보 분류 트리 (Skill/Command/Hook/Agent)
- learning-extractor: `refs/learning-quality-gate.md` Q1/Q2/Q3 적용 → MISTAKES/QUESTIONS 분류
- followup-suggester: P0–P3 + Effort×Impact 매트릭스, Done Criteria 강제

각 agent 결과는 메인 컨텍스트로 단일 응답씩 반환 (≤300단어 권장).

## Step 3 — Phase 2 순차 duplicate-checker (자동 분석)

Phase 1의 4개 결과를 통합한 후보 목록을 prompt에 넣어 단일 Task spawn:

```
Task(subagent_type="compound-mmp:duplicate-checker", model="claude-haiku-4-5", prompt="<통합된 후보 N건>... + Phase 1 출력 raw")
```

duplicate-checker는 후보별로 `mcp__plugin_qmd_qmd__vector_search`를 자체 실행 (`-c mmp-memory --top 3`).

## Step 4 — 결과 통합 + 사용자 표시

P0–P3 매트릭스 + Effort×Impact 표 + 중복 검증 결과를 메인 컨텍스트가 정리해 출력. 사용자가 다음 단계 선택지를 보도록.

```markdown
## Wrap-up 요약 (mode={session|wave|phase})

### 다음 세션 우선순위
- **P0**: <1줄> (Done: ...)
- **P1**: <1줄> (Done: ...)

### MISTAKES 후보 (NEW, Q-gate PASS)
1. ...

### QUESTIONS 후보 (자동 append 예정)
1. ...

### 자동화 기회 (NEW)
- ...

### 카논 갱신 후보 (document-specialist)
- MEMORY.md: <항목>
- CLAUDE.md: <항목>
- refs/...: <항목>
```

## Step 5 — 자동 실행 (균형형)

### 5-1. `memory/QUESTIONS.md` append
- 항상 자동 (질문 추가는 안전)
- 형식: `## 2026-MM-DD <topic>\n- <질문>`

### 5-2. `memory/sessions/<YYYY-MM-DD>-<topic>.md` 생성
- 자동, 매번 신규 파일
- **path traversal 방어 (security MEDIUM 대응)**: `topic`이 사용자 발화 유래 → 정규화 필수
  ```bash
  topic_safe=$(printf '%s' "$topic" | tr -cd 'a-zA-Z0-9가-힣_-' | cut -c1-40)
  [ -n "$topic_safe" ] || topic_safe="session"
  ```
- **markdown bullet 포맷** (OMC team handoff `.omc/handoffs/<stage>.md`와 cross-mode 호환):

```markdown
---
topic: "한 줄 요약"
phase: "Phase N.M"
prs_touched: [PR-N, PR-M]
session_date: 2026-MM-DD
---

# Session Handoff: <topic>

## Decided
- 결정 사항

## Rejected
- 거부된 옵션 (이유) (없으면 "- 없음")

## Risks
- 잠재 위험

## Files
- 수정 파일

## Remaining
- 미완료 항목 (Done: <조건>)

## Next Session Priorities
- P0/P1 항목

---

## What we did
(메인 모델 요약 ≤300단어)
```

전체 템플릿: `templates/handoff-note-template.md`. OMC team 5섹션과 동일 헤더 → cross-mode markdown parser 호환.

### 5-3. `memory/MEMORY.md` entry append
- 자동 (구조 변경 X — 기존 카테고리 끝에 1줄만 추가)
- 형식: `- [<제목>](file.md) — <한 줄 hook>`
- 어떤 카테고리에 추가할지는 메인 컨텍스트가 결정 (예: Phase progress → "## 프로젝트 정보" 카테고리)

## Step 6 — 승인 실행 (사용자 승인)

### 6-1. `memory/MISTAKES.md` append
- duplicate-checker가 NEW로 분류한 entry만 후보
- 사용자가 Y 응답 시 append, N 응답 시 skip

### 6-2. 활성 `docs/plans/<phase>/checklist.md` STATUS 마커 갱신
- 사용자 입력 그대로 (예: "PR-2 머지됨" → STATUS-START 영역 수동 입력)
- 메인이 grep으로 `<!-- STATUS-START -->` ~ `<!-- STATUS-END -->` 찾아서 Edit

## Step 7 — graphify decision

| mode | 동작 |
|------|------|
| `--session` | skip (출력만 "graphify update 안내 — 다음 wrap 시점에 evaluate") |
| `--wave` | `make graphify-update` 안내 출력만 (사용자 수동 실행) |
| `--phase` | `make graphify-refresh` 자동 실행 + 후속 PR 생성 안내 |

`--phase`는 fresh rebuild이므로 graph.json 업데이트 PR이 별도 필요 (anti-patterns #4 carve-out).

### 실패 처리 (PR-5 카논화)

`--phase` 모드에서 `make graphify-refresh` 실패 시:
1. **stderr 그대로 사용자에게 표시** — 메인 컨텍스트가 가공·요약 X.
2. **자동 retry 금지** — anti-patterns #1 (자동 fix-loop 폐기 정책) 강제.
3. **수동 retry 안내**: `cd $(git rev-parse --show-toplevel) && make graphify-refresh` 다시 실행 또는 `make graphify-update` 증분 시도.
4. **graph.json 부분 손상 의심 시**: `git restore graphify-out/graph.json && make graphify-refresh` (이전 fresh 결과로 롤백 후 재시도).
5. **wrap 자체는 정상 완료로 간주** — Step 1~6은 이미 성공했으므로 graphify 실패가 wrap 결과를 무효화하지 않음. 사용자가 후속 작업 결정.

이 정책은 graphify가 외부 인덱싱이며 wrap의 critical path가 아니라는 카논(`.claude/refs/graphify.md`)을 따른다.

## 종료 후

다음 세션에서 사용자가 `/compound-resume` 명시 호출 시 `memory/sessions/`에서 가장 최근 1개 파일 read. 자동 SessionStart inject 폐기 — 사용자 결정 2026-04-28 (매 세션 토큰 낭비 회피, 필요할 때만 명시 호출). 카논: `commands/compound-resume.md`, `templates/session-recall-template.md`.

## 검증 (PR-10 dogfooding)

- Step 5-2 handoff 노트가 다음 세션 `/compound-resume` 호출 시 정상 read 되는지
- Step 5-3 MEMORY.md drift 측정 (1주 누적)
- Step 6-1 MISTAKES.md 사용자 승인율 (≥80% 권장 — 너무 낮으면 learning-extractor Q-gate 강화)

## 안티 패턴

- ❌ Step 5-3 MEMORY.md 인덱스 카테고리 신설·재정렬 자동화 — Step 6으로 승강
- ❌ Step 6-1 MISTAKES.md 자동 append — 카논 깨짐 위험 (anti-patterns #9)
- ❌ Step 7 `--session`에서 graphify rebuild — semantic ~6% 손실 (anti-patterns #4)
- ❌ Phase 1·2 결과 raw를 메인 컨텍스트에 그대로 dump — ≤300단어 요약 강제 (Opus 헤드쿼터 정책)
