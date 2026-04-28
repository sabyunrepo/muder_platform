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

> spike 결과 (`refs/spike-omc-overlap.md`) 반영: doc-curator는 OMC `document-specialist` 호출로 대체. 신규 정의는 4개.

한 메시지에서 4개 Task tool 동시 spawn:
- `oh-my-claudecode:document-specialist` (sonnet) — MEMORY.md/CLAUDE.md/refs 갱신 후보. **prompt 주입 필수**: (a) Step 1 git scan, (b) `memory/` canonical 경로, (c) MMP CLAUDE.md/refs 카논 매트릭스, (d) "Write 권한 없음. 후보만 출력" 명시
- `compound-mmp:automation-scout` (sonnet) — 신규 자동화 기회
- `compound-mmp:learning-extractor` (sonnet) — TIL·실수·발견 (Quality Gate `refs/learning-quality-gate.md` 적용)
- `compound-mmp:followup-suggester` (sonnet) — P0–P3 + Effort/Impact

각 agent 입력: Step 1의 git scan 결과 + 활성 phase 메타.
각 agent 권한: Read/Glob/Grep만 (compound-mmp:* 3개는 frontmatter `disallowedTools` 명시, document-specialist는 OMC 카논 그대로 read-only).

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

핸드오프 노트는 **markdown bullet 포맷** (OMC team handoff `.omc/handoffs/<stage>.md`와 cross-mode 호환). YAML frontmatter는 metadata만, 5섹션은 markdown:

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

(메인 모델 요약 ≤300단어)
```

OMC team 5섹션 (`Decided/Rejected/Risks/Files/Remaining`)과 정확히 동일 섹션 헤더 → markdown 파서 cross-mode 호환. 전체 템플릿: `templates/handoff-note-template.md`.

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
