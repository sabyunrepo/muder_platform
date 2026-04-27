# Wrap-up 7단계 카논 (균형형 자동화)

`/compound-wrap [--session|--wave|--phase]` 실행 시 진행하는 7단계 시퀀스. 사용자 결정 "균형형" 자동화 정책 적용.

> 검증된 코어: Session-Wrap (team-attention) 5단계 + MMP 확장 2단계 (graphify decision + 핸드오프 자동 inject).

## 단계별 시퀀스

### Step 1 — Pre-scan (자동)
```bash
git status --short
git diff --stat HEAD~10..HEAD 2>/dev/null || git diff --stat
git log --oneline HEAD~10..HEAD
```
출력: 변경 파일 목록, 커밋 추세, 미커밋 변경.

### Step 2 — Phase 1 병렬 4 agent (자동 분석)
한 메시지에서 4개 Task tool 동시 spawn:
- `compound-mmp:doc-curator` (sonnet-4-6) — MEMORY.md/CLAUDE.md/refs 갱신 후보
- `compound-mmp:automation-scout` (sonnet-4-6) — 신규 자동화 기회
- `compound-mmp:learning-extractor` (sonnet-4-6) — TIL·실수·발견
- `compound-mmp:followup-suggester` (sonnet-4-6) — P0–P3 + Effort/Impact

각 agent 입력: Step 1의 git scan 결과 + 활성 phase 메타.
각 agent 권한: Read/Glob/Grep만.

### Step 3 — Phase 2 duplicate-checker (자동 분석)
`compound-mmp:duplicate-checker` (haiku-4-5)가 Phase 1의 4개 결과를 받아 QMD `mmp-memory` 컬렉션에서 중복 검증:
```
mcp__plugin_qmd_qmd__vector_search "<phase1-suggestion>" -c mmp-memory --top 3
```
중복 ≥0.7 score 시 "기존 메모리에 있음 — 추가 불필요" 표시.

### Step 4 — 결과 통합 + 사용자 표시 (자동 표시)
P0–P3 매트릭스 + Effort/Impact 표 형태로 메인 컨텍스트가 정리해 출력. 사용자가 다음 단계 선택지를 볼 수 있게.

### Step 5 — 자동 실행 (균형형 자동)

| 작업 | 위치 | 정책 |
|------|------|------|
| `memory/QUESTIONS.md` append | repo | 항상 자동 (질문 추가는 안전) |
| `memory/sessions/<YYYY-MM-DD>-<topic>.md` 생성 | repo | 항상 자동 (Haiku 요약 ≤300단어) |
| MEMORY.md entry append (인덱스 변경 X) | repo | 자동 (균형형 결정) |

핸드오프 노트 프론트매터:
```yaml
---
topic: <phase-or-wave-or-session-topic>
phase: <Phase N.M>
prs_touched: [PR-N, PR-M, ...]
key_decisions: |
  ...
next_session_priorities: |
  ...
---
```

### Step 6 — 승인 실행 (사용자 승인)

| 작업 | 위치 | 정책 |
|------|------|------|
| `memory/MISTAKES.md` append | repo | 사용자 승인 필수 (잘못 쓰면 카논 깨짐) |
| 활성 `docs/plans/<phase>/checklist.md` STATUS 마커 갱신 | repo | 사용자 입력 그대로 (자동화 폐기 정책) |

### Step 7 — graphify decision

| 모드 | 동작 |
|------|------|
| `--session` (기본) | skip (가벼움 우선) |
| `--wave` | `make graphify-update` 안내만 (자동 실행 X) |
| `--phase` | `make graphify-refresh` 자동 실행 → fresh rebuild PR 생성 안내 |

이후 다음 SessionStart hook이 `memory/sessions/`에서 가장 최근 1개 파일을 자동 inject.

## 자동 vs 승인 정리

| 단계 | 자동/승인 |
|------|----------|
| Step 1 | 자동 |
| Step 2 (Phase 1) | 자동 분석 |
| Step 3 (Phase 2) | 자동 분석 |
| Step 4 | 자동 표시 |
| Step 5 (QUESTIONS, handoff, MEMORY entry) | 자동 |
| Step 6 (MISTAKES, checklist STATUS) | **승인** |
| Step 7 (graphify) | `--phase`만 자동 |

## 검증
PR-10에서 dogfooding 1주. 매 세션 종료 시 `/compound-wrap --session` 실행, MEMORY.md drift 측정.
