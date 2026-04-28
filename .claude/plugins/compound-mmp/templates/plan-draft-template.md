# Plan Draft Template

`/compound-plan`이 `docs/plans/<YYYY-MM-DD>-<topic>/checklist.md`에 생성하는 초안 포맷.

> **단일 source**: 본 파일 + `commands/compound-plan.md` § 실행 시퀀스 + `scripts/compound-plan-dry-run.sh` (입력 검증·JSON contract).

## 출력 예시

```markdown
---
phase_id: "phase-21-runtime-bugfix"
phase_title: "Phase 21 Runtime Bugfix"
created: 2026-04-28
status: "draft (사용자 승인 대기)"
from_previous_phase: "phase-20-clue-editor"
waves: 3
prs_estimated: 5
---

# Phase 21 Runtime Bugfix — Plan Draft

> **상태**: 초안 (`/compound-plan` 산출). 사용자 승인 + Wave/PR 분해 조정 후 `/compound-work PR-1` 진입.

## QMD 회상 (mmp-plans 5건)

<!-- INJECT-RECALL-MANDATORY-START -->
> `qmd-recall` Step 1 결과. 유사 phase의 패턴·실수·검증 시뮬레이션을 본 plan 작성에 인용. **이 표가 비어 있으면 inject 누락 (anti-pattern, A.7 핵심 위반)** — `/compound-wrap` Step 1 검증이 마커 사이 `docid` 토큰 ≥3 검사로 drift 감지.

| # | phase | 핵심 인용 | docid |
|---|-------|----------|-------|
| 1 | <prev-phase-A> | <한 줄 요약> | #abc123 |
| 2 | <prev-phase-B> | <한 줄 요약> | #def456 |
| 3 | <prev-phase-C> | <한 줄 요약> | #ghi789 |
| 4 | <prev-phase-D> | <한 줄 요약> | #jkl012 |
| 5 | <prev-phase-E> | <한 줄 요약> | #mno345 |
<!-- INJECT-RECALL-MANDATORY-END -->

> 메인 컨텍스트는 `mcp__plugin_qmd_qmd__vector_search` 결과를 본 표에 직접 채우고, 핵심 인용을 brainstorm 단계에 inject한다. helper output `mandatory_slots: ["qmd-recall-table"]` 메타가 inject 의무를 명시 (drift 검증 anchor).

## Brainstorm 결과

> `superpowers:brainstorming` Step 2 산출. 사용자 의도·요구·제약 명시화.

### 핵심 사용자 의도
- ...

### 명시 요구
- ...

### 제약·전제
- ...

### Out of Scope
- ...

## Wave/PR 분해

> `superpowers:writing-plans` Step 3 산출. 각 PR은 `feat/compound-mmp/PR-<N>-<slug>` 브랜치, 4-agent 리뷰 후 admin-merge.

### Wave 1: <이름>
- **PR-1** <slug> — <한 줄 설명> (Effort S/M/L, Impact)
- **PR-2** <slug> — ...

### Wave 2: <이름>
- **PR-3** <slug> — ...
- **PR-4** <slug> — ...

### Wave 3: <이름>
- **PR-5** <slug> — ...

## Carry-over (`--from` inject)

> 이전 phase에서 미해소된 MED/LOW 또는 Out of Scope 항목. PR-N 어디에 piggyback할지 메인 컨텍스트가 분해.

- **MED-1** (from <prev-phase>) <설명> → PR-? piggyback
- **LOW-1** (from <prev-phase>) <설명> → PR-? piggyback

## 검증 시뮬레이션

> Phase 종료 시 풀 사이클 dogfooding 시나리오. 산출 위치: `docs/plans/<phase>/refs/sim-<case>.md`.

### Case A: <시나리오 이름>
1. <step>
2. <step>
3. **Pass 기준**: ...

### Case B: <시나리오 이름>
1. ...

## Out of Scope (이 plan에서 다루지 않음)

- ...
- ...

## 사용자 승인 게이트

다음 진입은 **사용자 명시 승인 후**:
- `/compound-work PR-1` — TDD 구현 시작
- 초안 직접 수정 — Wave/PR 분해 조정
- `/compound-cycle` — 현재 phase 상태 확인
```

## 슬롯 매핑 (메인 컨텍스트 inject 가이드)

| 슬롯 | 출처 | 누가 채우나 |
|------|------|------------|
| frontmatter `phase_id` | helper input `<topic>` | helper.steps[3].path 가공 |
| frontmatter `from_previous_phase` | helper output `.from_previous_phase` | helper |
| QMD 회상 표 | `qmd-recall` 결과 (5 row) | 메인 컨텍스트 |
| Brainstorm 결과 | `superpowers:brainstorming` 산출 | 메인 컨텍스트 |
| Wave/PR 분해 | `superpowers:writing-plans` 산출 | 메인 컨텍스트 |
| Carry-over | `--from` 지정 시 이전 phase의 MED/LOW carry-over | 메인 컨텍스트 |
| 검증 시뮬레이션 | brainstorm + writing-plans 산출 | 메인 컨텍스트 |

## Anti-pattern (이 template에 추가 금지)

- ❌ "다음 단계 자동 호출" 명령 추가 — 사용자 승인 게이트 우회 (compound-plan.md § Anti-pattern과 중복 차단)
- ❌ 회상 5건을 본문 시작 전에 단순 dump — brainstorm 단계에 inject되지 않으면 의미 상실 (A.7)
- ❌ Wave/PR 개수를 미리 결정 — `superpowers:writing-plans` 산출에 따라 동적 결정
- ❌ Phase 번호를 자동 할당 — 사용자가 `<topic>`에 명시 (예: `phase-21-...`). helper는 슬러그만 검증.
