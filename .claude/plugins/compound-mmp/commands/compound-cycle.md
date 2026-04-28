---
description: 활성 phase의 4단계 라이프사이클 진행 상태 dry-run 대시보드. plan/work/review/compound 게이트 + 다음 단계 + 미충족 조건 출력. 자동 진행 X.
allowed-tools: Bash, Read, Glob
argument-hint: "[--dry-run]   예: /compound-cycle"
---

# /compound-cycle

활성 phase의 4단계(Plan→Work→Review→Compound) 진행 상태를 한 화면에서 확인. 다음 게이트와 미충족 조건만 출력 — **자동 진행 X**, 사용자가 다음 슬래시 명령을 명시 호출.

> **카논 single source**: plan § "/compound-cycle 사양" + `skills/compound-lifecycle/SKILL.md` (4단계 게이트 정의) + `refs/mandatory-slots-canon.md` (qmd-recall-table 슬롯).

## 인자

- `--dry-run` (선택) — 실질적으로 본 명령은 항상 dry-run (helper 출력만). 플래그 없이도 동일 동작.

## 환경 변수

- `ACTIVE_PHASE` (필수) — 활성 phase 디렉토리. 메인 컨텍스트가 `ls -td docs/plans/*/ | head -1`로 자동 검출.

## 실행 시퀀스 (메인 컨텍스트)

### 1. helper 호출 → 4단계 dashboard JSON

```bash
ACTIVE_PHASE="$(ls -td docs/plans/*/ 2>/dev/null | head -1 | sed 's:/$::')" \
  bash .claude/plugins/compound-mmp/scripts/compound-cycle-dry-run.sh
```

stdout:
```json
{
  "phase": "<phase-basename>",
  "stages": {
    "plan": {"exists": bool, "status": "pending|in_progress|done"},
    "work": {...},
    "review": {"reviews_count": int, "status": "..."},
    "compound": {"handoff_path": str|null, "status": "..."}
  },
  "next_gate": "plan|work|review|compound|done",
  "blocked_reasons": [str],
  "mandatory_slots": ["qmd-recall-table"]
}
```

### 2. 사용자에게 표시 (자동 진행 금지)

helper 출력을 사람 읽기 좋게 표 + 다음 안내로 변환:

```
Phase: <phase-basename>

  단계        상태           세부
  ----        ----           ----
  Plan        ✓ done          checklist.md, qmd-recall-table 5/5 inject
  Work        ↻ in_progress   sim-* 마커 검출
  Review      ⏵ pending       refs/reviews/ 비어있음
  Compound    ⏵ pending       핸드오프 노트 부재

다음 게이트: review

권고 다음 명령: /compound-review PR-<N>
미충족: review 미진입 — /compound-work 후 /compound-review 호출 필요

자동 진행 X — 사용자가 다음 슬래시 명령 명시 호출.
```

### 3. 사용자 결정 게이트 (CRITICAL)

본 명령은 read-only 대시보드. **자동으로 다음 단계 진입 X** (anti-pattern).

## 4단계 게이트 정의 (compound-lifecycle SKILL 인용)

| 단계 | 진입 조건 | 종료 조건 (다음 게이트로 이동) |
|------|----------|---------------------------|
| **Plan** | `ACTIVE_PHASE` 디렉토리 존재 | `checklist.md` 작성 + `INJECT-RECALL-MANDATORY` 마커 사이 docid ≥3 (mandatory-slots-canon) |
| **Work** | Plan 종료 | sim-*.md 마커 또는 PR 머지 N개 (현재 helper는 sim-* 검출만 — PR 카운트는 PR-11+ 보강) |
| **Review** | Work 진입 | `refs/reviews/PR-*.md` ≥1건 + 모든 PR HIGH 0 (메인 self-check) |
| **Compound** | Review 종료 | `memory/sessions/<date>-<topic>.md` 핸드오프 생성 |
| **Done** | 모든 단계 종료 | — |

## Anti-pattern (helper/fixture 차단)

- ❌ ACTIVE_PHASE 미설정 또는 디렉토리 부재 → helper exit 3
- ❌ helper output에 자동 실행 명령 (`gh pr merge`/`git push --force`/`admin-merge`) 토큰 → fixture 차단
- ❌ 메인이 `next_gate` 보고 자동으로 `/compound-<gate>` 호출 → 사용자 결정 게이트 우회
- ❌ next_gate=`done`이라고 자동 wrap-up 진입 → 사용자가 명시 결정

## 사용 예

```
사용자: /compound-cycle
메인:
  1. helper 실행 → JSON {phase, stages, next_gate, blocked_reasons}
  2. 사람 읽기 좋게 표 변환 + 다음 안내
  3. 사용자 결정 대기
사용자: /compound-review PR-1 진행
```

## 검증 (test-compound-cycle-dry-run.sh, 24 case)

helper 직접 실행 → JSON contract 검증. env (3 case) / JSON 구조 (5 case) / 4단계 stages 매핑 (4 case) / stage 상태 (3 case) / checklist 부재 (1 case) / reviews count (1 case) / next_gate enum (1 case) / 자동 진행 금지 (1 case) / mandatory_slots (2 case) / jq deps (1 case) / phase 경로 (1 case) / handoff_path (1 case).

CI: `.github/workflows/ci-hooks.yml` ubuntu+macOS 양쪽 fixture 실행. sister 카논 (compound-{plan,work,review}-dry-run.sh).
