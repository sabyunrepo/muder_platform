---
name: 4-agent 코드리뷰는 admin-merge 전에 수행
description: CI admin-skip 정책 + auto mode 에서도 PR 머지 전에 security/perf/arch/test 4 병렬 리뷰 파이프라인을 기본 수행. 스킵 시 HIGH 이슈가 머지 후에 발견된 적 있음
type: feedback
---

Auto mode + CI admin-skip 운영 중이라도 `.claude/post-task-pipeline.json`
의 `after_pr` 블록 (security-reviewer · code-reviewer perf · critic arch ·
test-engineer) 4 병렬 리뷰를 PR 생성 직후 기본 실행할 것. 사용자가 "진행해"
로 빠르게 자동 실행을 요청하더라도 이 리뷰 단계는 건너뛰면 안 된다.

**Why:** 2026-04-18 밤 세션에서 PR-2c (#107) 를 리뷰 없이 admin squash-merge
한 뒤 사용자가 "작업할때 코드리뷰도 진행했었어?" 로 지적. 사후 4-agent 리뷰
에서 `handlers.handleCombine` 이 `m.mu.Lock` 홀드 중 `EventBus.Publish` 를
synchronous 호출하는 HIGH deadlock 잠재 이슈가 발견되어 hotfix PR #108 로
수습. 리뷰를 선행했으면 1 PR 로 끝났을 일. 신속성이 리스크 노출을 정당화
하지 못한다.

**How to apply:**
- Size S/Low + 순수 문서 변경 PR 은 리뷰 생략 가능, 단 사용자에게 이유
  명시 후 기본 동의 받은 뒤 진행.
- Size M+ 또는 보안/동시성/인터페이스 변경 포함 PR 은 예외 없이 4-agent
  리뷰 선행 (parallel_group=review).
- 리뷰 결과가 CRITICAL/HIGH 이면 admin-merge 전 fix-loop. MEDIUM 은 같은
  PR 에 묶거나 follow-up PR 로 명시 분리.
- 리뷰 건너뛰면 반드시 사용자 메시지로 "리뷰 없이 admin-merge 합니다"
  선언.

**Carve-out: 사용자 명시 4-agent 우회 + superpowers:code-review 대체**
- 사용자가 명시적으로 "4-agent 우회"를 결정한 경우 (`memory/feedback_mode_decision_gate.md` 카논상 mode 결정), `superpowers:requesting-code-review` 1회 호출이 단일 안전망으로 대체 가능.
- 우회 조건:
  1. 사용자 명시 발화 ("4-agent 우회", "superpowers code-review만" 등)
  2. PR scope에 보안 critical 변경 없음 (PR-2c 패턴 아님)
  3. `superpowers:requesting-code-review` 결과가 Critical 0 + 사용자 명시 acceptable
- 우회 사례 (Phase 23 PR #174, 2026-04-29):
  - mega PR scope (single-concern 카논 explicit override)
  - infrastructure 변경 (Dockerfile + workflow + compose, 보안 critical 아님)
  - superpowers:code-review APPROVED YES_WITH_FIXES (Critical 0, Important 1 fold-in)
  - admin-skip 머지 후 main에서 yaml syntax bug 발견 → hotfix #175 → 1 추가 PR cycle 비용. 4-agent였다면 검출됐을지는 미확정 (yaml syntax는 4-agent의 axes 외).
- **default는 4-agent 강제 유지** — 사용자 명시 없으면 우회 X.
