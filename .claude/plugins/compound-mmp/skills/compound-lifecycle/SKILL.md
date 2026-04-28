---
name: compound-lifecycle
description: |
  compound-mmp 4단계 라이프사이클(Plan→Work→Review→Compound)의 게이트 정의 단일 source. `/compound-cycle` 대시보드 + 각 단계 슬래시 진입 시 자동 활성화.
  자동 활성화 트리거: `/compound-cycle` 명시 호출, "지금 어디", "다음 단계", "현황", "진행 상황", "what's next" 등 한글/영문 키워드.
  4단계 진입/종료 조건, 단계 간 전환 규칙, mandatory_slots 슬롯 매핑, anti-pattern 정의. plan body L83 명시 카논.
allowed-tools: Bash, Read, Glob, Grep
---

# compound-lifecycle — 4단계 게이트 단일 source

`/compound-cycle` 대시보드 및 4단계 슬래시 명령 (`/compound-plan`, `/compound-work`, `/compound-review`, `/compound-wrap`)이 공통으로 참조하는 게이트 카논.

> **카논 single source**: 본 SKILL + `commands/compound-cycle.md` (대시보드 시퀀스) + `scripts/compound-cycle-dry-run.sh` (helper 출력 contract) + `refs/mandatory-slots-canon.md` (슬롯 매핑) + `refs/lifecycle-stages.md` (4단계 전체 카논).

## 4단계 게이트 표

| 단계 | 진입점 | 진입 조건 | 종료 조건 | 다음 게이트 | mandatory_slot |
|------|--------|----------|----------|------------|----------------|
| **Plan** | `/compound-plan` | `ACTIVE_PHASE` 존재 | `checklist.md` + `INJECT-RECALL-MANDATORY` 마커 사이 docid ≥3 | Work | `qmd-recall-table` |
| **Work** | `/compound-work` | Plan 종료 | sim-*.md 또는 PR 머지 N개 (PR-11+ 보강) + post-test 통과 | Review | `tdd-test-first` |
| **Review** | `/compound-review` | Work 진입 | `refs/reviews/PR-*.md` ≥1건 + 모든 PR HIGH 0 | Compound | (슬롯 없음 — 4-agent payload envelope) |
| **Compound** | `/compound-wrap` | Review 종료 | `memory/sessions/<date>-<topic>.md` 핸드오프 생성 | Done (또는 next phase Plan) | (envelope 자체가 핸드오프) |

## 단계 간 전환 규칙

### Plan → Work
- **자동 X** (사용자 결정). 메인이 `/compound-cycle` 결과에 "next_gate: work"가 보이면 사용자에게 안내만.
- 종료 검증: `/compound-cycle`이 `qmd-recall-table` 슬롯 inject 여부를 grep — 미달 시 `next_gate=plan` 유지.

### Work → Review
- **자동 X**. 메인이 post-test 통과 보고 후 사용자 결정 대기 (`commands/compound-work.md` § 3 사용자 보고 게이트).
- 종료 검증: 메인이 worktree에서 PR 생성 후 `/compound-review PR-<N>` 명시 호출.

### Review → Compound
- **자동 X** (CRITICAL). HIGH 0 + admin-merge 후에도 사용자가 `/compound-wrap` 명시 호출. 자동 진행은 anti-pattern (`refs/anti-patterns.md`).
- 종료 검증: `refs/reviews/PR-*.md` 카운트 + 메인 self-check.

### Compound → Done (또는 다음 phase Plan)
- **자동 X**. 사용자가 wrap 후 새 phase 시작 시 `/compound-plan <new-topic>` 명시 호출.

## mandatory_slots 슬롯 매핑

| 슬롯 | 출처 단계 | inject 시점 | 검증 단계 (wrap-up Step 1.5) |
|------|----------|------------|---------------------------|
| `qmd-recall-table` | Plan | `templates/plan-draft-template.md` `<!-- INJECT-RECALL-MANDATORY-START/END -->` 마커 | docid ≥3 grep (advisory) |
| `tdd-test-first` | Work | `pre-edit-size-check.sh` PreToolUse hook (소스 파일 작성 전 `*_test.go`/`*.test.tsx` 존재 검사) | hook 자체가 검증 (deny 시점) |

> **추가 슬롯 도입 시**: `refs/mandatory-slots-canon.md` 표 갱신 + 본 SKILL 표 갱신 + helper output `mandatory_slots` 배열 추가 + wrap-up Step 1.5 grep 카논 추가 (4중 갱신 의무).

## next_gate 결정 알고리즘

`compound-cycle-dry-run.sh`가 사용:

```
if !plan.exists or plan.status == "in_progress" → next_gate = "plan"
elif review.reviews_count == 0                  → next_gate = "work"
elif compound.handoff_path == null              → next_gate = "compound"
else                                            → next_gate = "done"
```

work stage 종료 검증은 현재 sim-*.md 마커만 (PR 머지 카운트 미구현). PR-11+에서 `gh pr list` 통합 시 정밀화.

## Anti-pattern

- ❌ 메인이 `next_gate` 결과 보고 자동으로 다음 슬래시 호출 — 사용자 결정 게이트 절대 우회 금지
- ❌ `/compound-cycle`을 자동 trigger (예: 매 응답마다) — read-only 대시보드는 사용자 명시 호출만
- ❌ 단계 간 전환을 hook으로 강제 — soft ask 카논과 충돌, 단계 간은 항상 사용자 결정
- ❌ mandatory_slots 추가 시 단일 source (`refs/mandatory-slots-canon.md`) 갱신 누락 — drift 위험
- ❌ next_gate 알고리즘을 helper 외부에서 재구현 — single source 깨짐

## 검증

- `test-compound-cycle-dry-run.sh` 24 case — 4단계 stages 매핑 + next_gate enum + 자동 진행 금지 + mandatory_slots
- 풀 사이클 dogfooding (Phase 21+): `/compound-plan` → `/compound-work` → `/compound-review` → `/compound-wrap` → `/compound-cycle`이 매 단계에서 정확한 next_gate 반환

## carry-over (PR-11+)

- PR 머지 카운트 통합 (`gh pr list` 호출) — work stage 정밀화
- mandatory_slots 강제 tier 승격 (advisory → hook deny) — `pre-write-checklist-final.sh` PreToolUse
- PHASE_SLUG/PROJECT_SLUG 어휘 sister 통일 (work helper와 cycle helper)
